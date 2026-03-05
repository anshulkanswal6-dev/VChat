import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const generateUserId = () => {
    if (!window.__voiceAppUserId) {
        window.__voiceAppUserId = crypto.randomUUID();
    }
    return window.__voiceAppUserId;
};

const useWebRTC = (roomId, userName, roomType = 'public', emoji = '😎') => {
    const [remotePeers, setRemotePeers] = useState({}); // { socketId: { stream, name, emoji, color } }
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [error, setError] = useState(null);
    const [isWaitingApproval, setIsWaitingApproval] = useState(false);
    const [joinRequests, setJoinRequests] = useState([]); // [{ socketId, name, emoji }]
    const [isHost, setIsHost] = useState(false);
    const [currentRoomType, setCurrentRoomType] = useState(roomType);
    const [myColor, setMyColor] = useState('#10b981');
    const [localStream, setLocalStream] = useState(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [localVolumes, setLocalVolumes] = useState([4, 4, 4, 4, 4]);

    const userId = useMemo(() => generateUserId(), []);
    const socketRef = useRef(null);
    const localStreamRef = useRef(null);
    const peerConnections = useRef({});

    const initLocalStream = useCallback(async () => {
        try {
            if (localStreamRef.current) return localStreamRef.current;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            setLocalStream(stream);
            return stream;
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setError('Microphone permission denied.');
            throw err;
        }
    }, []);

    const createPeerConnection = useCallback((targetId, targetName, targetEmoji, targetColor, socket) => {
        if (peerConnections.current[targetId]) {
            peerConnections.current[targetId].close();
        }

        const pc = new RTCPeerConnection(rtcConfig);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { target: targetId, candidate: event.candidate });
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                console.warn(`ICE connection ${pc.iceConnectionState} for peer ${targetId}`);
            }
        };

        pc.ontrack = (event) => {
            setRemotePeers(prev => ({
                ...prev,
                [targetId]: { ...prev[targetId], stream: event.streams[0], name: targetName, emoji: targetEmoji, color: targetColor }
            }));
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        peerConnections.current[targetId] = pc;
        return pc;
    }, []);

    useEffect(() => {
        if (!roomId || !userName) return;

        const socket = io(SOCKET_SERVER_URL, {
            transports: ['websocket'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-room', { roomId, name: userName, type: roomType, userId, emoji });
        });

        socket.on('waiting-for-approval', () => setIsWaitingApproval(true));
        socket.on('join-declined', () => { setIsWaitingApproval(false); setError('Your request to join was declined by the host.'); });
        socket.on('room-closed', () => { setIsWaitingApproval(false); setError('The room was closed by the host.'); });

        socket.on('room-ready', async ({ users, isHost, pending, roomType: serverRoomType, myColor: serverColor }) => {
            setIsWaitingApproval(false);
            setIsConnected(true);
            setIsHost(isHost);
            if (serverRoomType) setCurrentRoomType(serverRoomType);
            if (serverColor) setMyColor(serverColor);

            if (isHost && pending && pending.length > 0) {
                setJoinRequests(pending);
            }

            try {
                await initLocalStream();
            } catch (err) {
                console.error('Failed to init local stream:', err);
                return;
            }

            for (const user of users) {
                try {
                    const pc = createPeerConnection(user.socketId, user.name, user.emoji, user.color, socket);
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('offer', { target: user.socketId, offer, name: userName, emoji, color: serverColor });
                } catch (err) {
                    console.error(`Failed to create offer for ${user.name}:`, err);
                }
            }
        });

        socket.on('user-joined', ({ socketId, name, emoji: peerEmoji, color }) => {
            setRemotePeers(prev => ({ ...prev, [socketId]: { name, stream: null, emoji: peerEmoji, color, isMuted: false, isSpeaking: false } }));
        });

        socket.on('join-request', ({ socketId, name, emoji: reqEmoji }) => {
            setJoinRequests(prev => {
                if (prev.some(r => r.socketId === socketId)) return prev;
                return [...prev, { socketId, name, emoji: reqEmoji }];
            });
        });

        socket.on('offer', async ({ from, offer, name, emoji: peerEmoji, color }) => {
            try {
                setRemotePeers(prev => ({ ...prev, [from]: { ...prev[from], name, emoji: peerEmoji, color, isMuted: false, isSpeaking: false } }));
                const pc = createPeerConnection(from, name, peerEmoji, color, socket);
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', { target: from, answer });
            } catch (err) {
                console.error(`Failed to handle offer from ${name}:`, err);
            }
        });

        socket.on('answer', async ({ from, answer }) => {
            try {
                const pc = peerConnections.current[from];
                if (pc && pc.signalingState !== 'stable') {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                }
            } catch (err) {
                console.error('Failed to set remote answer:', err);
            }
        });

        socket.on('ice-candidate', async ({ from, candidate }) => {
            const pc = peerConnections.current[from];
            if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
        });

        socket.on('user-left', (socketId) => {
            if (peerConnections.current[socketId]) {
                peerConnections.current[socketId].close();
                delete peerConnections.current[socketId];
            }
            setRemotePeers(prev => {
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
        });

        socket.on('user-toggled-mute', ({ socketId, isMuted: peerMuted }) => {
            setRemotePeers(prev => {
                if (!prev[socketId]) return prev;
                return { ...prev, [socketId]: { ...prev[socketId], isMuted: peerMuted } };
            });
        });

        socket.on('user-toggled-speaking', ({ socketId, isSpeaking: peerSpeaking }) => {
            setRemotePeers(prev => {
                if (!prev[socketId]) return prev;
                return { ...prev, [socketId]: { ...prev[socketId], isSpeaking: peerSpeaking } };
            });
        });

        socket.on('became-host', () => setIsHost(true));

        socket.on('kicked', () => {
            setError('You have been removed from the room by the host.');
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        });

        socket.on('error-message', (msg) => {
            setError(msg);
        });

        return () => {
            socket.disconnect();
            Object.values(peerConnections.current).forEach(pc => pc.close());
            peerConnections.current = {};
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
                localStreamRef.current = null;
            }
        };
    }, [roomId, userName, roomType, emoji, userId, initLocalStream, createPeerConnection]);

    // Local Speaking Detection
    useEffect(() => {
        if (!localStream || isMuted) {
            setIsSpeaking(false);
            return;
        }

        let audioContext;
        let analyser;
        let source;
        let animationFrame;

        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source = audioContext.createMediaStreamSource(localStream);
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            let lastSpeaking = false;

            const checkVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                const sum = dataArray.reduce((a, b) => a + b, 0);
                const average = sum / dataArray.length;
                const currentlySpeaking = average > 10;

                if (currentlySpeaking !== lastSpeaking) {
                    lastSpeaking = currentlySpeaking;
                    setIsSpeaking(currentlySpeaking);
                    socketRef.current?.emit('toggle-speaking', { isSpeaking: currentlySpeaking });
                }

                if (currentlySpeaking) {
                    const multiplier = 1.6;
                    const newVolumes = [
                        dataArray[5] || 0,
                        dataArray[15] || 0,
                        dataArray[30] || 0,
                        dataArray[50] || 0,
                        dataArray[80] || 0
                    ].map(v => {
                        const scaled = (v / 255) * 24 * multiplier;
                        return Math.min(24, Math.max(4, scaled));
                    });
                    setLocalVolumes(newVolumes);
                } else {
                    setLocalVolumes([4, 4, 4, 4, 4]);
                }

                animationFrame = requestAnimationFrame(checkVolume);
            };

            checkVolume();
        } catch (err) {
            console.error('Speaking Detection Error:', err);
        }

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
            if (audioContext) audioContext.close().catch(() => { });
        };
    }, [localStream, isMuted]);

    const approveJoin = (socketId) => {
        socketRef.current?.emit('approve-request', { roomId, socketId });
        setJoinRequests(prev => prev.filter(r => r.socketId !== socketId));
    };

    const declineJoin = (socketId) => {
        socketRef.current?.emit('decline-request', { roomId, socketId });
        setJoinRequests(prev => prev.filter(r => r.socketId !== socketId));
    };

    const kickUser = (socketId) => {
        socketRef.current?.emit('kick-user', { roomId, socketId });
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const newMuteState = !audioTrack.enabled;
                setIsMuted(newMuteState);
                socketRef.current?.emit('toggle-mute', { isMuted: newMuteState });
                if (newMuteState) {
                    setIsSpeaking(false);
                    socketRef.current?.emit('toggle-speaking', { isSpeaking: false });
                }
            }
        }
    };

    return {
        remotePeers, isConnected, isMuted, toggleMute, error,
        isWaitingApproval, joinRequests, approveJoin, declineJoin,
        isHost, currentRoomType, myColor, localStream, isSpeaking, localVolumes, kickUser
    };
};

export default useWebRTC;
