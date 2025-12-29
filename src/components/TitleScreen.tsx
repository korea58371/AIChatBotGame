'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useGameStore } from '@/lib/store';
import { Settings, Play, Database, ShoppingBag, RotateCcw, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Login from '@/components/Login';

interface TitleScreenProps {
    onLoginSuccess?: () => void;
}

export default function TitleScreen({ onLoginSuccess }: TitleScreenProps) {
    const router = useRouter();
    // Use the singleton client instance
    const [supabase] = useState(() => createClient());
    const [user, setUser] = useState<any>(null);
    const [coins, setCoins] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [showLogin, setShowLogin] = useState(false);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Game State Checks
    const [hasActiveGame, setHasActiveGame] = useState(false);
    const [saveSlots, setSaveSlots] = useState<{ id: number; date: string; summary: string }[]>([]);

    const resetGameStore = useGameStore(state => state.resetGame);
    const activeGameId = useGameStore(state => state.activeGameId);
    const setGameId = useGameStore(state => state.setGameId);

    // Check Auth State
    useEffect(() => {
        let mounted = true;

        const checkUser = async () => {
            try {
                // Hybrid Approach:
                // 1. Race getSession against a 1s timeout
                // 2. Also listen for onAuthStateChange (below)

                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise<{ data: { session: null }, error: any }>((resolve) => {
                    setTimeout(() => resolve({ data: { session: null }, error: 'timeout' }), 1000);
                });

                const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

                if (!mounted) return;

                if (session?.user) {
                    setUser(session.user);
                    setIsLoading(false); // Found user, unlock immediately

                    // Fetch Coins (Non-blocking)
                    supabase.from('profiles').select('coins').eq('id', session.user.id).single()
                        .then(({ data, error }: { data: any; error: any }) => {
                            if (mounted && data) setCoins(data.coins);
                        });
                } else {
                    // If no session found or timeout, we DON'T force loading=false yet
                    // unless we are sure. But here we can't be sure if it's just slow.
                    // However, to prevent infinite load, if timeout hit, we might want to unlock.
                    if (error === 'timeout') {
                        console.warn("Auth check timeout - waiting for event or defaulting");
                        setIsLoading(false);
                    }
                    // If regular null session, wait for event or just show guest
                    if (session === null && !error) {
                        setIsLoading(false);
                    }
                }

            } catch (error) {
                console.error("Auth check failed:", error);
                if (mounted) setIsLoading(false);
            }
        };

        checkUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
            if (!mounted) return;

            if (session?.user) {
                setUser(session.user);
                setIsLoading(false); // Ensure loading stops
                if (onLoginSuccess) onLoginSuccess();
                setShowLogin(false);

                // Fetch coins
                const { data } = await supabase.from('profiles').select('coins').eq('id', session.user.id).single();
                if (mounted && data) setCoins(data.coins);
            } else {
                setUser(null);
                setIsLoading(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [supabase, onLoginSuccess]);

    // Check Game State on Mount
    useEffect(() => {
        const state = useGameStore.getState();
        if (state.chatHistory && state.chatHistory.length > 0) {
            setHasActiveGame(true);
        }

        // Load Save Slots Info
        const slots = [];
        for (let i = 1; i <= 3; i++) {
            const data = localStorage.getItem(`vn_save_${i}`);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    slots.push({
                        id: i,
                        date: new Date(parsed.timestamp).toLocaleString(),
                        summary: parsed.summary || 'No summary'
                    });
                } catch (e) {
                    slots.push({ id: i, date: 'Corrupted', summary: 'Error reading save' });
                }
            } else {
                slots.push({ id: i, date: 'Empty', summary: '-' });
            }
        }
        setSaveSlots(slots);
    }, [showLoadModal]);

    const handleContinue = () => {
        if (user) {
            router.push('/game');
        } else {
            setShowLogin(true);
        }
    };

    const handleNewGame = () => {
        if (!user) {
            setShowLogin(true);
            return;
        }

        const proceed = () => {
            resetGameStore();
            useGameStore.persist.clearStorage();
            setTimeout(() => {
                router.push('/game');
            }, 100);
        };

        if (hasActiveGame) {
            if (confirm("새 게임을 시작하시겠습니까? 현재 진행 중인 게임은 사라집니다.\n(중요한 진행 상황은 저장 슬롯에 저장해주세요!)")) {
                proceed();
            }
        } else {
            proceed();
        }
    };

    const handleLoadGame = (slotId: number) => {
        const data = localStorage.getItem(`vn_save_${slotId}`);
        if (!data) return;

        if (confirm(`슬롯 ${slotId}을(를) 불러오시겠습니까?`)) {
            try {
                const parsed = JSON.parse(data);
                useGameStore.setState(parsed.state);
                router.push('/game');
            } catch (e) {
                alert("세이브 파일을 불러오는 중 오류가 발생했습니다.");
            }
        }
    };

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none flex justify-center">
            {/* Aspect Ratio Container (Max 16:9) */}
            <div className="relative w-full h-full max-w-[177.78vh] shadow-2xl overflow-hidden bg-black">

                {/* Background Video */}
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-100"
                    key={`video-${activeGameId}`} // Re-render video on game switch
                >
                    <source src={`/assets/${activeGameId}/Movies/Main.mp4`} type="video/mp4" />
                </video>

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />

                {/* Top Right: Settings Button */}
                <div className="absolute top-6 right-6 z-50">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-3 bg-gray-800/50 hover:bg-gray-700/80 rounded-full text-white/70 hover:text-white border border-white/10 hover:border-white/30 transition-all backdrop-blur-md"
                    >
                        <Settings className="w-6 h-6" />
                    </button>
                </div>

                {/* Logo Area */}
                <div className={`absolute top-[30%] w-full flex z-10 pointer-events-none transform -translate-y-1/2 ${activeGameId === 'wuxia' ? 'justify-center' : 'right-0 justify-end pr-10 md:pr-32'}`}>
                    <motion.img
                        key={`title-${activeGameId}`} // Re-animate on switch
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        src={`/assets/${activeGameId}/interface/title/Title.png`}
                        onError={(e) => {
                            // Fallback to God Bless You if Wuxia title missing (optional, or just show broken)
                            // For now, let's allow it to break or fallback to generic if we had one.
                            // e.currentTarget.src = "/assets/god_bless_you/interface/title/Title.png";
                        }}
                        alt="Title"
                        className={`object-contain ${activeGameId === 'wuxia' ? 'w-[80vw] max-w-[500px] md:w-[730px]' : 'w-[60vw] max-w-[400px] md:w-[560px]'}`}
                    />
                </div>

                {/* Main Action Buttons - Using Navy Tones */}
                <div className="absolute right-10 md:right-32 bottom-[35vh] md:bottom-[280px] z-20 flex flex-col items-end gap-3">

                    {isLoading ? (
                        /* Loading State */
                        <div className="flex flex-col items-end gap-3 animate-pulse py-6">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" />
                                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce delay-75" />
                                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce delay-150" />
                            </div>
                            <span className="text-blue-200 font-mono tracking-[0.2em] text-sm mt-2">SYSTEM IDENTIFYING...</span>
                        </div>
                    ) : !user ? (
                        /* Guest / Login Trigger */
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowLogin(true)}
                            className="w-[80vw] md:w-[min(30vw,500px)] px-12 py-[2.5vh] md:py-[2.5vh] bg-gradient-to-r from-blue-900/50 to-indigo-900/50 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl flex items-center justify-center gap-4 group transition-all duration-300 hover:bg-white/10 hover:border-white/40"
                        >
                            <span className="text-[5vw] md:text-[min(1.5vw,36px)] font-bold text-white tracking-widest uppercase drop-shadow-md group-hover:text-blue-200">
                                Touch to Start
                            </span>
                            <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse shadow-[0_0_10px_#60a5fa]" />
                        </motion.button>
                    ) : (
                        /* Logged In Menu */
                        <>
                            {/* Continue Button */}
                            <AnimatePresence>
                                {hasActiveGame && (
                                    <motion.button
                                        initial={{ opacity: 0, x: 50, skewX: -12 }}
                                        animate={{ opacity: 1, x: 0, skewX: -12 }}
                                        exit={{ opacity: 0, x: 50, skewX: -12 }}
                                        whileHover={{ scale: 1.05, x: -10, skewX: -12 }}
                                        whileTap={{ scale: 0.95, skewX: -12 }}
                                        onClick={handleContinue}
                                        className="w-[80vw] md:w-[min(25vw,400px)] px-6 py-[2vh] md:py-[1.5vh] bg-gradient-to-r from-blue-950/60 to-slate-900/60 backdrop-blur-md rounded-2xl border border-blue-400/30 group shadow-lg hover:bg-blue-900/60 hover:border-blue-400/70 transition-all duration-300"
                                    >
                                        <div className="w-full flex items-center justify-between skew-x-12">
                                            <span className="text-[4vw] md:text-[min(1.2vw,28px)] font-bold text-white tracking-widest uppercase group-hover:text-blue-200">
                                                이어하기
                                            </span>
                                            <Play className="w-5 h-5 text-blue-400 group-hover:text-white transition-colors" />
                                        </div>
                                    </motion.button>
                                )}
                            </AnimatePresence>

                            {/* New Game Button */}
                            <motion.button
                                initial={{ opacity: 0, x: 50, skewX: -12 }}
                                animate={{ opacity: 1, x: 0, skewX: -12 }}
                                whileHover={{ scale: 1.05, x: -10, skewX: -12 }}
                                whileTap={{ scale: 0.95, skewX: -12 }}
                                transition={{ delay: 0.1 }}
                                onClick={handleNewGame}
                                className="w-[80vw] md:w-[min(25vw,400px)] px-6 py-[2vh] md:py-[1.5vh] bg-gradient-to-r from-slate-900/60 to-blue-950/60 backdrop-blur-md rounded-2xl border border-white/10 group shadow-lg hover:bg-slate-800/60 hover:border-white/30 transition-all duration-300"
                            >
                                <div className="w-full flex items-center justify-between skew-x-12">
                                    <span className="text-[4vw] md:text-[min(1.2vw,28px)] font-bold text-white tracking-widest uppercase group-hover:text-gray-200">
                                        새로 시작
                                    </span>
                                    <RotateCcw className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                                </div>
                            </motion.button>

                            {/* Load Game Button */}
                            <motion.button
                                initial={{ opacity: 0, x: 50, skewX: -12 }}
                                animate={{ opacity: 1, x: 0, skewX: -12 }}
                                whileHover={{ scale: 1.05, x: -10, skewX: -12 }}
                                whileTap={{ scale: 0.95, skewX: -12 }}
                                transition={{ delay: 0.2 }}
                                onClick={() => setShowLoadModal(true)}
                                className="w-[80vw] md:w-[min(25vw,400px)] px-6 py-[2vh] md:py-[1.5vh] bg-gradient-to-r from-slate-900/60 to-blue-950/60 backdrop-blur-md rounded-2xl border border-white/10 group shadow-lg hover:bg-slate-800/60 hover:border-white/30 transition-all duration-300"
                            >
                                <div className="w-full flex items-center justify-between skew-x-12">
                                    <span className="text-[4vw] md:text-[min(1.2vw,28px)] font-bold text-gray-300 tracking-widest uppercase group-hover:text-white">
                                        불러오기
                                    </span>
                                    <Save className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                                </div>
                            </motion.button>
                        </>
                    )}
                </div>

                {/* Game Selector UI */}
                <div className="absolute bottom-[16vh] md:bottom-24 w-full flex justify-center gap-6 z-30">
                    <button
                        onClick={() => setGameId('god_bless_you')}
                        className={`group relative flex flex-col items-center gap-2 transition-all duration-300 ${activeGameId === 'god_bless_you' ? 'scale-110 opacity-100' : 'scale-100 opacity-50 hover:opacity-80'}`}
                    >
                        <div className={`p-4 rounded-full border-2 transition-all duration-300 ${activeGameId === 'god_bless_you' ? 'bg-blue-900/80 border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.5)]' : 'bg-black/50 border-gray-600'}`}>
                            <span className="text-2xl">🏰</span>
                        </div>
                        <span className={`text-sm font-bold tracking-widest uppercase transition-colors ${activeGameId === 'god_bless_you' ? 'text-blue-300' : 'text-gray-500'}`}>
                            God Bless You
                        </span>
                        {activeGameId === 'god_bless_you' && (
                            <motion.div
                                layoutId="activeIndicator"
                                className="absolute -bottom-2 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_10px_#60a5fa]"
                            />
                        )}
                    </button>

                    <div className="w-px h-16 bg-gradient-to-b from-transparent via-gray-600 to-transparent" />

                    <button
                        onClick={() => setGameId('wuxia')}
                        className={`group relative flex flex-col items-center gap-2 transition-all duration-300 ${activeGameId === 'wuxia' ? 'scale-110 opacity-100' : 'scale-100 opacity-50 hover:opacity-80'}`}
                    >
                        <div className={`p-4 rounded-full border-2 transition-all duration-300 ${activeGameId === 'wuxia' ? 'bg-red-900/80 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-black/50 border-gray-600'}`}>
                            <span className="text-2xl">⚔️</span>
                        </div>
                        <span className={`text-sm font-bold tracking-widest uppercase transition-colors ${activeGameId === 'wuxia' ? 'text-red-400' : 'text-gray-500'}`}>
                            천하제일
                        </span>
                        {activeGameId === 'wuxia' && (
                            <motion.div
                                layoutId="activeIndicator"
                                className="absolute -bottom-2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_10px_#ef4444]"
                            />
                        )}
                    </button>
                </div>

                {/* Bottom Navigation */}
                <div className="absolute bottom-[3vh] md:bottom-10 w-full flex justify-center gap-4 z-20">
                    <div className="text-xs text-gray-500 font-mono tracking-widest">
                        Selected World: {activeGameId} | SYSTEM READY...
                    </div>
                </div>

                {/* Login Modal Overlay */}
                <AnimatePresence>
                    {showLogin && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        >
                            <div className="relative w-full max-w-sm">
                                <button
                                    onClick={() => setShowLogin(false)}
                                    className="absolute -top-10 right-0 text-white/50 hover:text-white"
                                >
                                    Close
                                </button>
                                <Login />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Load Game Modal */}
                <AnimatePresence>
                    {showLoadModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        >
                            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl p-6 rounded-lg shadow-2xl relative">
                                <button
                                    onClick={() => setShowLoadModal(false)}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                                >
                                    <Settings className="w-6 h-6 rotate-45" /> {/* Close Icon */}
                                </button>

                                <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-700 pb-2">불러오기</h2>

                                <div className="grid gap-4">
                                    {saveSlots.map((slot) => (
                                        <button
                                            key={slot.id}
                                            disabled={slot.date === 'Empty'}
                                            onClick={() => handleLoadGame(slot.id)}
                                            className={`flex flex-col text-left p-4 rounded border transition-all ${slot.date === 'Empty'
                                                ? 'bg-slate-800/50 border-slate-800 text-gray-600 cursor-not-allowed'
                                                : 'bg-slate-800 border-slate-600 hover:bg-slate-700 hover:border-blue-500/50 text-white'
                                                }`}
                                        >
                                            <div className="flex justify-between w-full mb-1">
                                                <span className="font-bold text-blue-400">SLOT {slot.id}</span>
                                                <span className="text-xs text-gray-400">{slot.date}</span>
                                            </div>
                                            <p className="text-sm text-gray-300 truncate w-full">
                                                {slot.summary}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Settings / Account Modal */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                            onClick={() => setShowSettings(false)}
                        >
                            <div
                                className="bg-white/95 border border-white/20 w-full max-w-lg p-6 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] relative flex flex-col gap-6 backdrop-blur-xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <Settings className="w-5 h-5 text-blue-600" />
                                        </div>
                                        설정 <span className="text-sm font-normal text-gray-400 font-mono self-end mb-0.5">Settings</span>
                                    </h3>
                                    <button onClick={() => setShowSettings(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2 ml-1">
                                        <span>👤</span> My Account
                                    </h4>

                                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200/60 shadow-inner">
                                        {user ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    {user.user_metadata?.avatar_url ? (
                                                        <img
                                                            src={user.user_metadata.avatar_url}
                                                            alt="Avatar"
                                                            className="w-10 h-10 rounded-full border border-gray-300"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg">
                                                            👤
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col text-sm overflow-hidden">
                                                        <span className="text-gray-900 font-bold truncate text-base">{user.email}</span>
                                                        <span className="text-gray-400 text-xs truncate font-mono">ID: {user.id.slice(0, 8)}...</span>
                                                    </div>
                                                    <div className="ml-auto flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100/50 shadow-sm shrink-0">
                                                        <span className="text-xs">💰</span>
                                                        <span className="font-mono text-sm font-bold">{coins.toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-gray-200" />

                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm("정말 로그아웃 하시겠습니까?")) {
                                                                const { error } = await supabase.auth.signOut();
                                                                if (error) {
                                                                    alert("로그아웃 중 오류가 발생했습니다: " + error.message);
                                                                    console.error("Logout error:", error);
                                                                } else {
                                                                    setUser(null);
                                                                    setShowSettings(false);
                                                                    window.location.reload();
                                                                }
                                                            }
                                                        }}
                                                        className="flex-1 py-2.5 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 rounded-lg text-sm font-bold transition-all border border-gray-200 shadow-sm hover:shadow-md"
                                                    >
                                                        로그아웃
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const confirmMsg = "⚠ 정말 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 진행 데이터와 구매 내역이 영구적으로 삭제됩니다.";
                                                            if (confirm(confirmMsg)) {
                                                                if (prompt("삭제를 원하시면 '삭제'라고 입력해주세요.") === '삭제') {
                                                                    try {
                                                                        const { deleteAccount } = await import('@/app/actions/auth');
                                                                        const result = await deleteAccount();
                                                                        if (result.success) {
                                                                            localStorage.clear(); // [CLEANUP] Clear all local data
                                                                            alert("탈퇴가 완료되었습니다. 모든 데이터가 삭제되었습니다.");
                                                                            window.location.reload();
                                                                        } else {
                                                                            alert("오류가 발생했습니다: " + result.error);
                                                                        }
                                                                    } catch (e) {
                                                                        console.error("Delete failed:", e);
                                                                        alert("처리 중 알 수 없는 오류가 발생했습니다.");
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                                                    >
                                                        회원 탈퇴
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-gray-500 text-sm">
                                                <p className="mb-2">로그인되어 있지 않습니다.</p>
                                                <button
                                                    onClick={() => { setShowSettings(false); setShowLogin(true); }}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm"
                                                >
                                                    로그인 / 회원가입
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-center text-xs text-gray-600 font-mono mt-4">
                                    Visual Novel AI Engine v2.5.0
                                </div>
                            </div>
                        </motion.div>
                    )
                    }
                </AnimatePresence >
            </div >
        </div >
    );
}
