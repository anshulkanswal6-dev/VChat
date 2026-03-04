import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff, LogOut, Check, Users, Link as LinkIcon, Crown, Lock, X, Activity, Shield, Trash2, ShieldAlert } from 'lucide-react';
import useWebRTC from '../hooks/useWebRTC';

const EMOJI_OPTIONS = [
    '😎', '🎧', '🎤', '🎵', '🔥', '⚡', '🌟', '🎮',
    '🦊', '🐱', '🐶', '🦄', '🐼', '🦁', '🐸', '🦋',
    '🚀', '💎', '🌈', '👻', '🤖', '👽', '🎯', '🍕',
];

const ToastProvider = ({ toasts }) => (
    <div className="fixed bottom-24 right-6 flex flex-col gap-3 z-50 pointer-events-none">
        {toasts.map(t => (
            <div key={t.id} className={`xp-toast flex items-center gap-3 px-4 py-3 bg-[#0a0d17] border ${t.type === 'xp' ? 'border-[#39FF14] text-[#39FF14]' : t.type === 'achievement' ? 'border-[#00BFFF] text-[#00BFFF]' : 'border-slate-600 text-slate-300'}`}>
                {t.type === 'xp' && <span className="font-bold text-lg">+</span>}
                {t.type === 'achievement' && <span className="font-bold text-lg">🏆</span>}
                <div className="flex flex-col">
                    <span className="text-sm font-bold uppercase tracking-widest">{t.title}</span>
                    {t.desc && <span className="text-[10px] opacity-80 uppercase font-sans tracking-wide">{t.desc}</span>}
                </div>
            </div>
        ))}
    </div>
);

const RemoteGridCard = ({ socketId, stream, name, emoji, isMuted, isSpeaking, isHost, onKick }) => {
    const audioRef = useRef(null);
    useEffect(() => {
        if (stream && audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(err => console.error('Audio play error:', err));
        }
    }, [stream]);

    return (
        <div className={`relative flex flex-col items-center justify-center p-4 sm:p-6 h-48 sm:h-64 bg-[#0a0d17]/40 backdrop-blur-md border-[2px] transition-all duration-500 rounded-lg group ${isSpeaking ? 'border-primary shadow-[0_0_30px_rgba(0_191_255_0.2)] scale-[1.02]' : 'border-primary/10 hover:border-primary/30'}`}>
            <audio ref={audioRef} autoPlay playsInline />

            <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${stream ? 'bg-primary' : 'bg-[#FFD700] anim-pulse'}`}></div>
                <span className="text-[8px] font-black tracking-[0.2em] text-primary/60 uppercase">Remote_Peer</span>
            </div>

            {/* Host Kick Button */}
            {isHost && (
                <button
                    onClick={() => onKick(socketId)}
                    className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors z-20"
                    title="Terminate Node"
                >
                    <Trash2 size={14} />
                </button>
            )}

            <div className={`relative flex items-center justify-center w-16 h-16 sm:w-24 sm:h-24 bg-[#05070D] border-2 rounded-full mb-4 sm:mb-6 transition-all duration-500 ${isSpeaking ? 'border-[#39FF14] animate-speech-ring scale-110' : 'border-primary/10'}`}>
                <div className="text-3xl sm:text-5xl drop-shadow-[0_0_10px_rgba(255_255_255_0.1)]">{emoji || '😎'}</div>
                {isMuted && (
                    <div className="absolute -bottom-1 -right-1 bg-[#05070D] p-1.5 border border-primary/40 rounded-full text-primary z-10">
                        <MicOff size={14} />
                    </div>
                )}
            </div>

            <div className="text-center space-y-1 w-full px-2">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary truncate">{name}</h3>
                <div className="flex items-center justify-center h-4">
                    {!stream ? (
                        <span className="text-[8px] text-[#FFD700] uppercase tracking-[0.2em] animate-pulse">Establishing...</span>
                    ) : isSpeaking ? (
                        <div className="flex items-center gap-1.5 text-[#39FF14] animate-pulse">
                            <Activity size={10} />
                            <span className="text-[8px] uppercase tracking-[0.2em] font-black">Connected</span>
                        </div>
                    ) : (
                        <span className="text-[8px] text-primary/30 uppercase tracking-[0.2em] font-medium">Link_Active</span>
                    )}
                </div>
            </div>
        </div>
    );
};

const Room = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const queryParams = new URLSearchParams(location.search);
    const urlName = queryParams.get('name') || '';
    const roomType = queryParams.get('type') || 'public';
    const urlEmoji = queryParams.get('emoji') || '';

    const [nameInput, setNameInput] = useState('');
    const [confirmedName, setConfirmedName] = useState(urlName || '');
    const [selectedEmoji, setSelectedEmoji] = useState(urlEmoji || '😎');
    const [confirmedEmoji, setConfirmedEmoji] = useState(urlEmoji || '');

    const {
        remotePeers, isConnected, isMuted, toggleMute, error,
        isWaitingApproval, joinRequests, approveJoin, declineJoin,
        isHost, currentRoomType, isSpeaking, kickUser
    } = useWebRTC(roomId, confirmedName || null, roomType, confirmedEmoji || null);

    const [copied, setCopied] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [showSidebar, setShowSidebar] = useState(false);

    const addToast = useCallback((title, desc, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, title, desc, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    // Initial join/host XP
    useEffect(() => {
        if (isConnected && confirmedName) {
            addToast('SYS_UPLINK ESTABLISHED', 'Node linked successfully.', 'achievement');
        }
    }, [isConnected, confirmedName, addToast]);

    const prevPeers = useRef({});
    useEffect(() => {
        if (!isConnected) return;
        const currentIds = Object.keys(remotePeers);
        const prevIds = Object.keys(prevPeers.current);

        currentIds.forEach(id => {
            if (!prevPeers.current[id]) {
                addToast('5 XP', `Node joined: ${remotePeers[id].name}`, 'xp');
            }
        });

        prevIds.forEach(id => {
            if (!remotePeers[id]) {
                addToast('NODE DISCONNECTED', prevPeers.current[id].name, 'info');
            }
        });

        prevPeers.current = remotePeers;
    }, [remotePeers, isConnected, addToast]);

    const handleCopyLink = () => {
        const link = `${window.location.origin}/room/${roomId}`;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(link).then(() => {
                setCopied(true);
                addToast('10 XP', 'Share link acquired', 'xp');
                setTimeout(() => setCopied(false), 2000);
            }).catch(() => {
                fallbackCopy(link);
            });
        } else {
            fallbackCopy(link);
        }
    };

    const fallbackCopy = (text) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            setCopied(true);
            addToast('10 XP', 'Share link acquired', 'xp');
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            addToast('ERROR', 'Could not copy link', 'info');
        }
        document.body.removeChild(textarea);
    };

    const handleNameSubmit = (e) => {
        e.preventDefault();
        if (nameInput.trim()) {
            setConfirmedName(nameInput.trim());
            setConfirmedEmoji(selectedEmoji);
        }
    };

    // ── ENTRY GATE ──
    if (!confirmedName) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#05070D] font-mono">
                <div className="max-w-md w-full bg-[#0a0d17] p-8 space-y-8 border border-primary shadow-[0_0_20px_rgba(0_191_255_0.15)]">
                    <div className="flex items-center justify-between border-b border-primary/30 pb-4">
                        <h2 className="text-xl font-bold uppercase tracking-widest text-primary">Join Network</h2>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-1">ID: {roomId.toUpperCase()}</span>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] text-slate-500 uppercase tracking-widest">Select Avatar</label>
                        <div className="flex items-center gap-4 border border-primary/30 p-3">
                            <div className="w-12 h-12 flex items-center justify-center text-3xl border border-primary/50 shrink-0">
                                {selectedEmoji}
                            </div>
                            <div className="grid grid-cols-6 gap-2 height-[68px] overflow-y-auto w-full custom-scrollbar">
                                {EMOJI_OPTIONS.map(em => (
                                    <button key={em} type="button" onClick={() => setSelectedEmoji(em)}
                                        className={`transition-all ${selectedEmoji === em ? 'scale-125 opacity-100' : 'opacity-40 hover:opacity-100'}`}>
                                        {em}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleNameSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest">Dev Identity</label>
                            <input type="text" placeholder="Alias..." value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus
                                className="input-neon text-sm uppercase" />
                        </div>
                        <button type="submit" disabled={!nameInput.trim()}
                            className="btn-neon w-full py-4 font-black uppercase tracking-widest transition-all">
                            Initialize Node
                        </button>
                    </form>

                    <button onClick={() => navigate('/')} className="w-full text-xs text-slate-500 hover:text-neon-red uppercase tracking-widest transition-colors duration-300">Abort_Process</button>
                </div>
            </div>
        );
    }

    const userName = confirmedName;
    const userEmoji = confirmedEmoji || selectedEmoji;
    const handleHangUp = () => navigate('/');

    // ── ERROR ──
    if (error) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#05070D] font-mono">
                <div className="max-w-md w-full bg-[#0a0d17] p-8 border border-primary text-center space-y-6 shadow-[0_0_20px_rgba(0_191_255_0.15)]">
                    <ShieldAlert size={48} className="mx-auto text-primary" />
                    <h2 className="text-2xl font-black uppercase text-primary tracking-widest">Access Denied</h2>
                    <p className="text-slate-400 capitalize">{error}</p>
                    <button onClick={() => navigate('/')} className="w-full py-4 bg-transparent border border-primary text-primary hover:bg-primary/5 font-black uppercase tracking-widest mt-4 transition-all">Return Home</button>
                </div>
            </div>
        );
    }

    // ── WAITING ──
    if (isWaitingApproval) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#05070D] font-mono">
                <div className="max-w-md w-full bg-[#0a0d17] p-8 border border-[#FFD700] text-center space-y-8 shadow-[0_0_20px_rgba(255_215_0_0.15)]">
                    <Lock size={48} className="mx-auto text-[#FFD700] animate-pulse" />
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold uppercase text-[#FFD700] tracking-widest">Restricted Area</h2>
                        <p className="text-sm text-slate-400">Awaiting Host Authorization</p>
                    </div>
                    <div className="flex justify-center flex-col items-center gap-4">
                        <div className="flex items-center gap-3 border border-[#FFD700]/30 px-4 py-2 text-[#FFD700] text-xs uppercase tracking-widest">
                            {userName} <span className="opacity-50">||</span> {userEmoji}
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="text-xs text-slate-500 hover:text-white uppercase tracking-widest w-full">Cancel Request</button>
                </div>
            </div>
        );
    }

    const peersList = Object.entries(remotePeers);

    return (
        <div className="flex flex-col h-screen w-screen bg-[#05070D] text-slate-200 font-mono overflow-hidden scanline">
            <ToastProvider toasts={toasts} />

            {/* Top Navigation Bar */}
            <div className="h-12 sm:h-14 flex items-center justify-between px-3 sm:px-8 border-b border-primary/20 bg-[#0a0d17]/50 backdrop-blur-md shrink-0 relative z-30">
                <div className="flex items-center gap-3 sm:gap-8">
                    <div className="flex items-center gap-2 sm:gap-3 text-primary group cursor-pointer" onClick={() => navigate('/')}>
                        <img src="/favicon.png" alt="Logo" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
                        <span className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-primary animate-glitch">VChat</span>
                    </div>
                    <div className="hidden md:flex items-center gap-4 text-[10px] uppercase tracking-widest text-slate-500 border-l border-white/5 pl-8">
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-primary shadow-[0_0_8px_rgba(0_191_255_0.8)]' : 'bg-[#FFD700]'}`} />
                            <span className={isConnected ? 'text-primary/80' : 'text-[#FFD700]'}>{isConnected ? 'SECURE_UPLINK' : 'LINKING...'}</span>
                        </div>
                        <span className="opacity-20">|</span>
                        <span>ENC: AES-256</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-6">
                    <div className="flex items-center gap-1.5 sm:gap-3">
                        <span className="hidden sm:inline text-xs font-bold text-slate-400">ID:</span>
                        <span className="text-[10px] sm:text-sm font-bold text-primary uppercase tracking-wider sm:tracking-widest max-w-[80px] sm:max-w-none truncate">{roomId}</span>
                        <button onClick={handleCopyLink} className="p-1 sm:p-1.5 text-slate-400 hover:text-white transition-colors" title="Copy Link">
                            {copied ? <Check size={14} className="text-primary" /> : <LinkIcon size={14} />}
                        </button>
                    </div>
                    {/* Mobile sidebar toggle */}
                    <button onClick={() => setShowSidebar(!showSidebar)} className="md:hidden p-1.5 text-primary/60 hover:text-primary border border-primary/20 transition-colors">
                        <Users size={16} />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Central Voice Arena - Grid View */}
                <div className="flex-1 overflow-auto bg-[#05070D] custom-scrollbar p-3 sm:p-6 pt-6 sm:pt-10 pb-32 sm:pb-40">
                    <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">

                        {/* Local User Tile */}
                        <div className="relative group">
                            <div className={`relative flex flex-col items-center justify-center p-4 sm:p-6 h-48 sm:h-64 bg-[#0a0d17]/40 backdrop-blur-md border-[2px] transition-all duration-500 rounded-lg ${isSpeaking ? 'border-primary shadow-[0_0_30px_rgba(0_191_255_0.2)] scale-[1.02]' : 'border-primary/20 hover:border-primary/40'}`}>
                                <div className="absolute top-4 left-4 flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
                                    <span className="text-[8px] font-black tracking-[0.2em] text-primary/60 uppercase">Local_Host</span>
                                </div>

                                <div className={`relative flex items-center justify-center w-16 h-16 sm:w-24 sm:h-24 bg-[#05070D] border-2 rounded-full mb-4 sm:mb-6 transition-all duration-500 ${isSpeaking ? 'border-primary animate-speech-ring scale-110' : 'border-primary/20'}`}>
                                    <div className="text-3xl sm:text-5xl drop-shadow-[0_0_10px_rgba(0_191_255_0.3)]">{userEmoji}</div>
                                    {isMuted && (
                                        <div className="absolute -bottom-1 -right-1 bg-[#05070D] p-1.5 border border-primary/40 rounded-full text-primary z-10 shadow-xl">
                                            <MicOff size={14} />
                                        </div>
                                    )}
                                </div>

                                <div className="text-center space-y-1">
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary">{userName} (You)</h3>
                                    <p className="text-[9px] text-primary/40 font-mono tracking-widest uppercase">Encryption: Active</p>
                                </div>

                                {isHost && (
                                    <div className="absolute top-4 right-4 text-[#FFD700] drop-shadow-[0_0_8px_rgba(255_215_0_0.4)]">
                                        <Crown size={16} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Remote Peer Tiles */}
                        {peersList.map(([socketId, peer]) => (
                            <div key={socketId} className="h-48 sm:h-64">
                                <RemoteGridCard
                                    socketId={socketId}
                                    stream={peer.stream}
                                    name={peer.name}
                                    emoji={peer.emoji}
                                    isMuted={peer.isMuted}
                                    isSpeaking={peer.isSpeaking}
                                    isHost={isHost}
                                    onKick={(id) => { kickUser(id); addToast('5 XP', 'Moderator Action', 'xp'); }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar Overlay (mobile) */}
                {showSidebar && (
                    <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setShowSidebar(false)} />
                )}

                {/* Right Sidebar */}
                <div className={`fixed md:relative top-0 right-0 h-full w-72 border-l border-primary/10 bg-[#0a0d17]/95 md:bg-[#0a0d17]/30 backdrop-blur-sm flex flex-col shrink-0 z-50 md:z-auto transition-transform duration-300 ${showSidebar ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                    <div className="p-4 border-b border-primary/10 flex items-center justify-between bg-[#05070D]/50">
                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-primary/60">Participants</span>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-2 py-0.5 border border-primary/20 text-primary/80 bg-primary/5">
                                <Users size={10} />
                                <span className="text-[9px] font-black">{peersList.length + 1}</span>
                            </div>
                            <button onClick={() => setShowSidebar(false)} className="md:hidden text-primary/40 hover:text-primary transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                        {/* Local peer */}
                        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-3 shadow-inner">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="text-xl w-8 text-center shrink-0 drop-shadow-md">{userEmoji}</div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary truncate">{userName} (You)</span>
                                    <span className="text-[8px] text-primary/40 uppercase tracking-tighter">LOCAL_NODE</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-primary/60 shrink-0">
                                {isHost && <Crown size={12} className="text-[#FFD700]" title="Host" />}
                                {isMuted ? <MicOff size={14} className="text-neon-red/60" /> : <div className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-neon-green shadow-[0_0_8px_rgba(57_255_20_0.6)]' : 'bg-neon-green/60'}`} />}
                            </div>
                        </div>

                        {/* Remote peers */}
                        {peersList.map(([socketId, peer]) => (
                            <div key={socketId} className="flex items-center justify-between border border-white/5 bg-[#05070D]/40 p-3 transition-all hover:bg-white/5 group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="text-xl w-8 text-center shrink-0">{peer.emoji}</div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 truncate">{peer.name}</span>
                                        <span className="text-[8px] text-white/20 uppercase tracking-tighter">REMOTE_PEER</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 shrink-0">
                                    {isHost && (
                                        <button onClick={() => { kickUser(socketId); addToast('5 XP', 'Moderator Action', 'xp'); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-primary transition-all"><X size={12} /></button>
                                    )}
                                    {peer.isMuted ? <MicOff size={14} className="text-neon-red/40" /> : <div className={`w-1.5 h-1.5 rounded-full ${peer.isSpeaking ? 'bg-neon-green shadow-[0_0_8px_rgba(57_255_20_0.6)]' : 'bg-neon-green/60'}`} />}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pending Requests Panel */}
                    {isHost && currentRoomType === 'private' && (
                        <div className="p-4 border-t border-[#39FF14]/20 bg-[#05070D]">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield size={14} className="text-[#FFD700]" />
                                <span className="text-[10px] uppercase font-bold tracking-widest text-[#FFD700]">System Firewalls</span>
                            </div>

                            {joinRequests.length === 0 ? (
                                <p className="text-[10px] text-slate-600 uppercase tracking-widest">No pending connections.</p>
                            ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {joinRequests.map(req => (
                                        <div key={req.socketId} className="flex items-center justify-between bg-[#0a0d17] border border-[#FFD700]/30 p-2">
                                            <span className="text-[10px] font-bold text-white uppercase truncate px-2">{req.name}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => declineJoin(req.socketId)} className="w-6 h-6 flex items-center justify-center text-[#FF3366] hover:bg-[#FF3366]/10 border border-transparent hover:border-[#FF3366]"><X size={12} /></button>
                                                <button onClick={() => { approveJoin(req.socketId); addToast('5 XP', 'Request Approved', 'xp') }} className="w-6 h-6 flex items-center justify-center text-[#FF4500] hover:bg-[#FF4500]/10 border border-transparent hover:border-[#FF4500]"><Check size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed bottom-0 sm:bottom-6 flex items-center justify-center gap-4 w-full px-2 sm:px-4 pointer-events-none z-40 pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-center gap-2 sm:gap-3 p-2 bg-[#05070D]/90 sm:bg-transparent border border-primary/20 backdrop-blur-xl shadow-2xl pointer-events-auto w-full sm:w-auto">
                    <button
                        onClick={toggleMute}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-8 py-3 border transition-all duration-500 uppercase font-black tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-[10px] whitespace-nowrap sm:min-w-[180px] bg-transparent
                            ${isMuted
                                ? 'border-neon-red/40 text-neon-red hover:bg-neon-red/5 hover:border-neon-red shadow-[inset_0_0_10px_rgba(255_51_102_0.1)]'
                                : 'border-primary/80 text-primary hover:bg-primary/5 shadow-[inset_0_0_15px_rgba(0_191_255_0.05)] hover:border-primary'
                            }`}
                    >
                        {isMuted ? <MicOff size={14} className="shrink-0 animate-pulse" /> : <Mic size={14} className="shrink-0" />}
                        <span className="hidden xs:inline">{isMuted ? 'MIC_OFFLINE' : 'MIC_LIVE'}</span>
                        <span className="xs:hidden">{isMuted ? 'MUTED' : 'LIVE'}</span>
                    </button>

                    <button
                        onClick={handleHangUp}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-8 py-3 bg-transparent text-neon-red/60 hover:text-neon-red border border-neon-red/30 hover:border-neon-red transition-all uppercase font-black tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-[10px] whitespace-nowrap sm:min-w-[180px] group hover:bg-neon-red/5 hover:shadow-[0_0_20px_rgba(255_51_102_0.2),_inset_0_0_10px_rgba(255_51_102_0.05)]"
                    >
                        <LogOut size={14} className="shrink-0 transition-transform group-hover:-translate-x-1" />
                        <span className="hidden xs:inline">TERM_LINK</span>
                        <span className="xs:hidden">LEAVE</span>
                    </button>
                </div>
            </div>

        </div >
    );
};

export default Room;
