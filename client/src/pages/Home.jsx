import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Plus, LogIn, Globe, Lock, Code, Cpu } from 'lucide-react';

const EMOJI_OPTIONS = [
    '😎', '🎧', '🎤', '🎵', '🔥', '⚡', '🌟', '🎮',
    '🦊', '🐱', '🐶', '🦄', '🐼', '🦁', '🐸', '🦋',
    '🚀', '💎', '🌈', '👻', '🤖', '👽', '🎯', '🍕',
];

const Home = () => {
    const navigate = useNavigate();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);

    const [createName, setCreateName] = useState('');
    const [roomType, setRoomType] = useState('public');
    const [selectedEmoji, setSelectedEmoji] = useState('😎');

    const [joinLink, setJoinLink] = useState('');
    const [joinError, setJoinError] = useState('');

    const handleCreate = () => {
        if (!createName.trim()) return;
        const newRoomId = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
        navigate(`/room/${newRoomId}?name=${encodeURIComponent(createName.trim())}&type=${roomType}&emoji=${encodeURIComponent(selectedEmoji)}`);
    };

    const handleJoin = () => {
        setJoinError('');
        const input = joinLink.trim();
        if (!input) return;

        let roomId = '';
        try {
            const url = new URL(input);
            const match = url.pathname.match(/\/room\/([a-zA-Z0-9]+)/);
            if (match) roomId = match[1];
        } catch {
            roomId = input.replace(/[^a-zA-Z0-9]/g, '');
        }

        if (!roomId) {
            setJoinError('Invalid room link or code. Please check and try again.');
            return;
        }

        navigate(`/room/${roomId}`);
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-dark text-primary overflow-hidden font-sans scanline">
            <div className="relative z-10 max-w-4xl w-full flex flex-col items-center">
                {/* Brand */}
                <div className="flex flex-col items-center mb-12 sm:mb-20">
                    <div className="flex items-center gap-3 sm:gap-5 mb-4">
                        <img src="/favicon.png" alt="Logo" className="w-8 h-8 sm:w-12 sm:h-12 object-contain drop-shadow-[0_0_15px_rgba(0_191_255_0.4)]" />
                        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-[0.15em] sm:tracking-[0.2em] uppercase animate-glitch">
                            VChat
                        </h1>
                    </div>
                    <div className="h-px w-32 bg-gradient-to-r from-transparent via-primary/50 to-transparent mb-6"></div>
                    <p className="text-secondary text-sm md:text-base max-w-[500px] mx-auto leading-relaxed text-center lowercase tracking-[0.15em] font-mono opacity-80">
                        // secure voice links for development teams.
                    </p>
                </div>

                {/* Two Action Panels */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 sm:gap-10 w-full max-w-2xl">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="group flex flex-col items-center bg-transparent p-6 sm:p-10 transition-all duration-500 border border-primary/20 hover:border-primary/80 btn-neon h-auto relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-500"></div>
                        <Plus size={32} className="text-primary mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-500 shrink-0 relative z-10" />
                        <h3 className="text-base sm:text-xl font-bold text-primary mb-2 sm:mb-3 uppercase tracking-[0.15em] sm:tracking-[0.2em] whitespace-nowrap relative z-10">Init Channel</h3>
                        <p className="text-[8px] sm:text-[10px] text-muted font-mono text-center uppercase tracking-widest relative z-10 opacity-60">Deploy new frequency</p>
                    </button>

                    <button
                        onClick={() => setShowJoinModal(true)}
                        className="group flex flex-col items-center bg-transparent p-6 sm:p-10 transition-all duration-500 border border-primary/20 hover:border-primary/80 btn-neon h-auto relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-500"></div>
                        <LogIn size={32} className="text-primary mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-500 shrink-0 relative z-10" />
                        <h3 className="text-base sm:text-xl font-bold text-primary mb-2 sm:mb-3 uppercase tracking-[0.15em] sm:tracking-[0.2em] whitespace-nowrap relative z-10">Uplink</h3>
                        <p className="text-[8px] sm:text-[10px] text-muted font-mono text-center uppercase tracking-widest relative z-10 opacity-60">Join active stream</p>
                    </button>
                </div>

                <div className="mt-16 text-center opacity-40 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted">
                    <Cpu size={14} /> p2p encrypted
                </div>
            </div>

            {/* ═══ CREATE MODAL ═══ */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
                    <div className="relative z-10 w-full sm:max-w-md bg-[#05070D]/95 backdrop-blur-xl p-6 sm:p-8 border border-primary/30 space-y-6 sm:space-y-8 shadow-[0_0_40px_rgba(0_0_0_0.8)] rounded-t-2xl sm:rounded-none" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-primary/10 pb-4">
                            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-primary">Session_Init</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-primary/40 hover:text-neon-red transition-colors">✕</button>
                        </div>

                        {/* Config Name */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] text-muted uppercase tracking-widest">Dev Identity</label>
                                <input
                                    type="text"
                                    placeholder="Enter your alias..."
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    autoFocus
                                    className="w-full px-4 py-3 bg-transparent border border-primary/30 input-neon transition-all placeholder:text-muted text-primary font-mono text-sm"
                                />
                            </div>

                            {/* Config Avatar */}
                            <div className="space-y-3">
                                <label className="text-[10px] text-primary/40 uppercase tracking-[0.2em]">Select_Avatar</label>
                                <div className="flex items-center gap-5 bg-primary/5 p-4 border border-primary/10">
                                    <div className="text-3xl shrink-0 w-14 h-14 flex items-center justify-center border border-primary/20 bg-[#05070D]">
                                        {selectedEmoji}
                                    </div>
                                    <div className="grid grid-cols-6 gap-3 flex-grow h-20 overflow-y-auto pr-2 custom-scrollbar">
                                        {EMOJI_OPTIONS.map(em => (
                                            <button
                                                key={em}
                                                type="button"
                                                onClick={() => setSelectedEmoji(em)}
                                                className={`text-xl transition-all duration-300 hover:scale-125 ${selectedEmoji === em ? 'opacity-100 scale-125 text-primary drop-shadow-[0_0_8px_rgba(0_191_255_0.6)]' : 'opacity-30 hover:opacity-100 grayscale hover:grayscale-0'}`}
                                            >
                                                {em}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Config Type */}
                            <div className="space-y-4 pb-4 border-b border-primary/20">
                                <label className="text-[10px] text-muted uppercase tracking-widest">Network Type</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button type="button" onClick={() => setRoomType('public')}
                                        className={`flex flex-col items-center justify-center p-3 border transition-all duration-300 ${roomType === 'public' ? 'bg-transparent border-primary text-primary shadow-[inset_0_0_10px_rgba(0_191_255_0.1)]' : 'bg-transparent border-muted text-muted hover:border-primary/50'}`}>
                                        <Globe size={18} className="mb-1" />
                                        <span className="text-xs">Public</span>
                                    </button>
                                    <button type="button" onClick={() => setRoomType('private')}
                                        className={`flex flex-col items-center justify-center p-3 border transition-all duration-300 ${roomType === 'private' ? 'bg-transparent border-primary text-primary shadow-[inset_0_0_10px_rgba(0_191_255_0.1)]' : 'bg-transparent border-muted text-muted hover:border-primary/50'}`}>
                                        <Lock size={18} className="mb-1" />
                                        <span className="text-xs">Private</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button onClick={handleCreate} disabled={!createName.trim()}
                            className="w-full py-4 text-primary font-black uppercase tracking-widest transition-all btn-neon">
                            Execute
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ JOIN MODAL ═══ */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-sm" onClick={() => { setShowJoinModal(false); setJoinError(''); }}>
                    <div className="relative z-10 w-full sm:max-w-md bg-[#05070D]/95 backdrop-blur-xl p-6 sm:p-8 border border-primary/30 space-y-6 sm:space-y-8 shadow-[0_0_40px_rgba(0_0_0_0.8)] rounded-t-2xl sm:rounded-none" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-primary/10 pb-4">
                            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-primary">Link_Establish</h2>
                            <button onClick={() => { setShowJoinModal(false); setJoinError(''); }} className="text-primary/40 hover:text-neon-red transition-colors">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] text-muted uppercase tracking-widest">URI or Code</label>
                                <input type="text" placeholder="Paste link..." value={joinLink}
                                    onChange={(e) => { setJoinLink(e.target.value); setJoinError(''); }} autoFocus
                                    className="w-full px-4 py-3 bg-transparent border border-primary/30 input-neon transition-all placeholder:text-muted text-primary font-mono text-sm" />
                            </div>

                            {joinError && (
                                <div className="text-xs neon-text-red mt-2 font-mono uppercase">
                                    ERR: {joinError}
                                </div>
                            )}
                        </div>

                        <button onClick={handleJoin} disabled={!joinLink.trim()}
                            className="w-full py-4 text-primary font-black uppercase tracking-[0.3em] text-xs transition-all btn-neon">
                            Connect
                        </button>
                    </div>
                </div>
            )}

            {/* Version Footer */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-6 text-[8px] font-mono text-primary/30 uppercase tracking-[0.4em]">
                <span>VChat_Terminal_v4.2.0</span>
                <span className="opacity-20">|</span>
                <span>Node_Status: ACTIVE</span>
            </div>
        </div>
    );
};

export default Home;
