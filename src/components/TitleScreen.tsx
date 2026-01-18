'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useGameStore } from '@/lib/store';
import { MODEL_CONFIG } from '@/lib/model-config';
import { Settings, Play, Database, ShoppingBag, RotateCcw, Save, X, Cpu, Zap, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Login from '@/components/Login';
import LanguageSelector from '@/components/LanguageSelector';
import SettingsModal from '@/components/visual_novel/ui/SettingsModal';
import StoreModal from '@/components/visual_novel/ui/StoreModal';
import SaveLoadModal from '@/components/visual_novel/ui/SaveLoadModal';
import { useAuthSession } from '@/hooks/useAuthSession';
import { stopGlobalAudio } from './visual_novel/hooks/useVNAudio'; // [Fix] Import Audio Cleanup
import { get as idbGet } from 'idb-keyval';

import { translations } from '@/data/translations';

// ... (existing imports)

interface TitleScreenProps {
    onLoginSuccess?: () => void;
}

export default function TitleScreen({ onLoginSuccess }: TitleScreenProps) {
    const router = useRouter();
    // Use the singleton client instance
    const [supabase] = useState(() => createClient());
    const [user, setUser] = useState<any>(null);
    const [session, setSession] = useState<any>(null); // [Fix] Add session state
    const [coins, setCoins] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [showLogin, setShowLogin] = useState(false);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showStore, setShowStore] = useState(false);

    // Game State Checks
    const [hasActiveGame, setHasActiveGame] = useState(false);
    // const [saveSlots, setSaveSlots] = useState<{ id: number; date: string; summary: string }[]>([]); // Deprecated localstorage logic
    const [hasManualSlots, setHasManualSlots] = useState(false); // [NEW]

    const resetGameStore = useGameStore(state => state.resetGame);
    const activeGameId = useGameStore(state => state.activeGameId);
    const setGameId = useGameStore(state => state.setGameId);
    const storyModel = useGameStore(state => state.storyModel);
    const setStoryModel = useGameStore(state => state.setStoryModel);
    const language = useGameStore(state => state.language);
    const setLanguage = useGameStore(state => state.setLanguage);
    const userCoins = useGameStore(state => state.userCoins);
    const setUserCoins = useGameStore(state => state.setUserCoins);

    const setSessionUser = useGameStore(state => state.setSessionUser);

    // Check Auth State using Shared Hook
    const { session: authSession, user: authUser, loading: authLoading, coins: authCoins } = useAuthSession();

    useEffect(() => {
        if (!authLoading) {
            setUser(authUser);
            setSession(authSession); // [Fix] Sync session
            setCoins(authCoins);
            setUserCoins(authCoins || 0); // [Sync] Sync DB coins to Store
            setSessionUser(authUser); // [Fix] Sync User to Global Store for Cloud Ops
            setIsLoading(false);
        }
    }, [authUser, authSession, authLoading, authCoins, setUserCoins, setSessionUser]);

    // [Localization]
    const t = (language && translations[language as keyof typeof translations]) || translations.ko;

    // [Fix] Enforce Global Audio Cleanup on Title Screen Mount
    useEffect(() => {
        stopGlobalAudio();
    }, []);

    // Auto-login success trigger
    useEffect(() => {
        if (authUser && onLoginSuccess && !authLoading) {
            onLoginSuccess();
            setShowLogin(false);
        }
    }, [authUser, onLoginSuccess, authLoading]);


    // Game Modes Configuration
    const GAME_MODES = [
        {
            id: 'wuxia',
            title: '천하제일',
            subtitle: 'Infinite Martial Arts',
            desc: language === 'ko' ? '무한한 성장과 자유도, 정통 무협의 세계' : 'Infinite growth and freedom in the world of martial arts.',
            video: '/assets/wuxia/Movies/Main.mp4',
            logo: '/assets/wuxia/interface/title/Title.png',
            themeColor: 'from-amber-700 to-red-900',
            accentColor: 'text-amber-500'
        },
        {
            id: 'god_bless_you',
            title: '갓블레스유',
            subtitle: 'God Bless You',
            desc: language === 'ko' ? '현대 판타지와 헌터물의 결합' : 'A fusion of modern fantasy and hunter stories.',
            video: '/assets/god_bless_you/Movies/Main.mp4',
            logo: '/assets/god_bless_you/interface/title/Title.png',
            themeColor: 'from-blue-700 to-purple-900',
            accentColor: 'text-cyan-400'
        }
    ];

    const [selectedGameIndex, setSelectedGameIndex] = useState(0);
    const selectedGame = GAME_MODES[selectedGameIndex];

    // Check Game State on Mount & Game Change
    useEffect(() => {
        const checkState = async () => {
            const state = useGameStore.getState();
            // Check Active Game (Decoupled Auto Save persistence)
            // Even if memory is empty, if we have a persisted auto-save, we can continue.
            const autoKey = `vn_autosave_${selectedGame.id}`;
            try {
                const localAuto = await idbGet(autoKey);
                if (localAuto) {
                    setHasActiveGame(true);
                } else {
                    // Fallback: Check memory if it happens to match (redundant but safe)
                    if (state.chatHistory && state.chatHistory.length > 0 && state.activeGameId === selectedGame.id) {
                        setHasActiveGame(true);
                    } else {
                        setHasActiveGame(false);
                    }
                }
            } catch (e) {
                console.warn("TitleScreen AutoCheck Failed", e);
                setHasActiveGame(false);
            }

            // Check Manual Slots (IDB)
            try {
                const slots = await state.listSaveSlots(selectedGame.id);
                setHasManualSlots(slots.length > 0);
            } catch (e) {
                console.error("Failed to list slots", e);
                setHasManualSlots(false);
            }
        };
        checkState();
    }, [selectedGame.id]); // Re-run when game changes

    const handleNextGame = () => {
        setSelectedGameIndex((prev) => (prev + 1) % GAME_MODES.length);
    };

    const handlePrevGame = () => {
        setSelectedGameIndex((prev) => (prev - 1 + GAME_MODES.length) % GAME_MODES.length);
    };

    const [hasCloudSave, setHasCloudSave] = useState(false);

    // Check Cloud Save availability when game selection changes
    useEffect(() => {
        const checkCloudSave = async () => {
            setHasCloudSave(false);
            if (!authUser || !selectedGame.id) return;

            const { data, error } = await supabase
                .from('game_saves')
                .select('turn_count')
                .eq('user_id', authUser.id)
                .eq('game_id', selectedGame.id)
                .single();

            if (data && !error) {
                // console.log(`[TitleScreen] Found cloud save for ${selectedGame.id}`);
                setHasCloudSave(true);
            }
        };

        checkCloudSave();
    }, [authUser, selectedGame.id, supabase]);

    const canContinue = hasActiveGame || hasCloudSave || hasManualSlots;

    const handleContinue = async () => {
        if (!user) {
            setShowLogin(true);
            return;
        }
        console.log('[TitleScreen] Continue Request:', selectedGame.id);

        // Always open the Load Modal now, as we have multiple potential sources (Auto, Cloud, Manual)
        // This satisfies: "이어하기를 눌렀을 때, 데이터가 여러개 있을 경우 이어할 데이터 선택 가능"
        // We can just open the Load Modal with the correct Game ID context.
        setShowLoadModal(true);
    };

    const handleNewGame = async () => {
        if (!user) {
            setShowLogin(true);
            return;
        }

        if (canContinue) {
            if (!confirm("새로운 게임을 시작하면 현재 진행 중인 게임 데이터가 초기화됩니다.\n계속하시겠습니까?")) {
                return;
            }
        }

        console.log('[TitleScreen] Starting NEW game:', selectedGame.id);
        sessionStorage.setItem('selected_game_id', selectedGame.id);

        // [Fix] Pass true to force reset
        await setGameId(selectedGame.id, true);
        router.push('/game');
    };

    // Preload videos
    useEffect(() => {
        GAME_MODES.forEach(mode => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'video';
            link.href = mode.video;
            document.head.appendChild(link);
        });
    }, []);

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none flex justify-center">
            {/* Aspect Ratio Container (Max 16:9) */}
            <div className="relative w-full h-full max-w-[177.78vh] shadow-2xl overflow-hidden bg-black">

                {/* Dynamic Background Video */}
                <AnimatePresence mode="wait">
                    <motion.video
                        key={selectedGame.video}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    >
                        <source src={selectedGame.video} type="video/mp4" />
                    </motion.video>
                </AnimatePresence>

                {/* Overlay Gradient: Removed color overlay as per request */}
                {/* <div className={`absolute inset-0 bg-gradient-to-b ${selectedGame.themeColor} mix-blend-multiply opacity-60 pointer-events-none`} /> */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />

                {/* Top Right: Settings & Shop */}
                <div className="absolute top-6 right-6 flex items-center gap-4 z-20">
                    {/* Store Button & Coins */}
                    {user && (
                        <button
                            onClick={() => setShowStore(true)}
                            className="hidden md:flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/10 hover:border-white/30 transition-all group mr-2"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-amber-400 text-lg">🪙</span>
                                <span className="text-white font-bold leading-none mt-0.5">{userCoins.toLocaleString()}</span>
                            </div>
                            <div className="w-[1px] h-4 bg-white/20" />
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-white/70 group-hover:text-amber-400 transition-colors" />
                                <span className="text-sm text-white/70 group-hover:text-white transition-colors font-medium">상점</span>
                            </div>
                        </button>
                    )}

                    <LanguageSelector />
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/10 transition-all group"
                    >
                        <Settings className="w-6 h-6 text-white/70 group-hover:text-cyan-400 group-hover:rotate-90 transition-all duration-500" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="absolute inset-0 flex flex-col justify-between z-10 p-8 pb-12">

                    {/* 1. Top Section: Logo (Positioned at approx 35% height) */}
                    <div className="flex-1 flex items-start justify-center pt-[25vh]">
                        <AnimatePresence mode="wait">
                            <motion.img
                                key={selectedGame.logo}
                                src={selectedGame.logo}
                                alt={selectedGame.title}
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                                transition={{ duration: 0.6, ease: "backOut" }}
                                className="h-48 max-w-full object-contain filter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                            />
                        </AnimatePresence>
                    </div>

                    {/* 2. Bottom Section: Description & Actions */}
                    <div className="flex flex-col items-center gap-8 mb-30">
                        {/* Game Description */}
                        <motion.div
                            key={selectedGame.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-center max-w-xl"
                        >
                            <h2 className={`text-2xl font-bold mb-2 tracking-widest uppercase ${selectedGame.accentColor}`}>
                                {selectedGame.subtitle}
                            </h2>
                            <p className="text-white/70 text-lg leading-relaxed font-light">
                                {selectedGame.desc}
                            </p>
                        </motion.div>

                        {/* Start / Continue Actions */}
                        <div className="flex flex-col items-center gap-3 w-full">
                            {canContinue ? (
                                <div className="flex flex-col gap-3 w-full max-w-sm items-center">
                                    {/* Primary: Continue */}
                                    <motion.button
                                        key={`btn-continue-${selectedGame.id}`}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleContinue}
                                        className={`w-full px-12 py-4 bg-white text-black text-xl font-black tracking-widest uppercase rounded-full shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:shadow-[0_0_50px_rgba(255,255,255,0.6)] transition-all flex items-center justify-center gap-3 relative overflow-hidden group`}
                                    >
                                        <span className="relative z-10">{language === 'ko' ? '이어하기' : 'CONTINUE'}</span>
                                        <div className={`absolute inset-0 bg-gradient-to-r ${selectedGame.themeColor} opacity-0 group-hover:opacity-20 transition-opacity`} />
                                    </motion.button>

                                    {/* Secondary: New Game */}
                                    <button
                                        onClick={handleNewGame}
                                        className="text-white/40 text-sm hover:text-red-400 transition-colors flex items-center gap-1 hover:underline decoration-red-400/50 underline-offset-4"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        {language === 'ko' ? '새로 시작하기 (초기화)' : 'New Game (Reset)'}
                                    </button>
                                </div>
                            ) : (
                                <motion.button
                                    key={`btn-start-${selectedGame.id}`}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleNewGame}
                                    className={`px-12 py-4 bg-white text-black text-xl font-black tracking-widest uppercase rounded-full shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:shadow-[0_0_50px_rgba(255,255,255,0.6)] transition-all flex items-center gap-3 relative overflow-hidden group`}
                                >
                                    <span className="relative z-10">{language === 'ko' ? '게임 시작' : 'GAME START'}</span>
                                    <Play className="w-6 h-6 relative z-10" fill="currentColor" />
                                    <div className={`absolute inset-0 bg-gradient-to-r ${selectedGame.themeColor} opacity-0 group-hover:opacity-20 transition-opacity`} />
                                </motion.button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Navigation Arrows (Fixed Center) */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-20">
                    <button
                        onClick={handlePrevGame}
                        className="pointer-events-auto p-4 rounded-full bg-black/20 backdrop-blur hover:bg-white/10 transition-all text-white/50 hover:text-white hover:scale-110"
                    >
                        <span className="sr-only">Previous Game</span>
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={handleNextGame}
                        className="pointer-events-auto p-4 rounded-full bg-black/20 backdrop-blur hover:bg-white/10 transition-all text-white/50 hover:text-white hover:scale-110"
                    >
                        <span className="sr-only">Next Game</span>
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Auth Status Check (Floating over bottom area) */}
                <div className="absolute bottom-6 left-8 z-30">
                    {isLoading ? (
                        <div className="flex items-center gap-3 px-6 py-2 bg-black/40 backdrop-blur rounded-full border border-white/5">
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                            <span className="text-white/50 text-sm">Connecting...</span>
                        </div>
                    ) : user ? (
                        <div className="flex flex-col items-center gap-2 group cursor-default">
                            <div className="px-6 py-2 bg-black/60 backdrop-blur rounded-full border border-white/10 flex items-center gap-3 hover:border-white/30 transition-colors">
                                <div className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_10px_#4ade80]" />
                                <span className="text-white/90 font-medium">
                                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                                </span>
                                <div className="h-4 w-[1px] bg-white/10" />
                                <span className="text-amber-400 font-bold flex items-center gap-1">
                                    <div className="w-1 h-1 bg-amber-400 rounded-full" />
                                    {coins.toLocaleString()} C
                                </span>
                            </div>
                            <button
                                onClick={() => supabase.auth.signOut().then(() => { setUser(null); setCoins(0); setSession(null); })}
                                className="text-xs text-white/30 hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowLogin(true)}
                            className="px-8 py-3 bg-white/5 hover:bg-white/10 backdrop-blur rounded-full border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all flex items-center gap-2 group"
                        >
                            <span>Login to Save Progress</span>
                            <div className="w-2 h-2 bg-transparent border-2 border-white/30 rounded-full group-hover:bg-white/30 transition-all" />
                        </button>
                    )}
                </div>

            </div>

            {/* Footer Info */}
            <div className="absolute bottom-6 w-full text-center z-10 pointer-events-none">
                <p className="text-xs text-white/20">
                    Powered by Gemini 3.0 • Developed by A.I. Novel Engine
                </p>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    t={t}
                    session={session}
                    onResetGame={resetGameStore}
                    coins={userCoins}
                />
            )}

            {/* Store Modal */}
            {showStore && (
                <StoreModal
                    isOpen={showStore}
                    onClose={() => setShowStore(false)}
                />
            )}

            {/* Login Modal */}
            {showLogin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-md"
                    >
                        <Login onSuccess={() => setShowLogin(false)} />
                        <div className="mt-4 text-center">
                            <button onClick={() => setShowLogin(false)} className="text-white/50 hover:text-white text-sm">
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Save/Load Modal for "Continue" */}
            <SaveLoadModal
                isOpen={showLoadModal}
                onClose={() => setShowLoadModal(false)}
                mode="load"
                gameId={selectedGame.id}
                t={t}
                onLoadSuccess={() => router.push('/game')}
            />
        </div>

    );
}
