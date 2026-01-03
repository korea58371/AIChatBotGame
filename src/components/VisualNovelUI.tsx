'use client';

import { useRouter } from 'next/navigation';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGameStore } from '@/lib/store';
import { createClient } from '@/lib/supabase';
import { serverGenerateResponse, serverGenerateGameLogic, serverGenerateSummary, getExtraCharacterImages, serverPreloadCache, serverAgentTurn, serverGenerateCharacterMemorySummary } from '@/app/actions/game';
import { getCharacterImage } from '@/lib/image-mapper';
import { resolveBackground } from '@/lib/background-manager';
import { RelationshipManager } from '@/lib/relationship-manager'; // Added import // Added import
import { MODEL_CONFIG, PRICING_RATES } from '@/lib/model-config';
import { parseScript, ScriptSegment } from '@/lib/script-parser';
import { findBestMatch } from '@/lib/name-utils'; // [NEW] Fuzzy Match Helper
import martialArtsLevels from '@/data/games/wuxia/jsons/martial_arts_levels.json'; // Import Wuxia Ranks
import { WUXIA_BGM_MAP, WUXIA_BGM_ALIASES } from '@/data/games/wuxia/bgm_mapping';
import { FAME_TITLES, FATIGUE_LEVELS } from '@/data/games/wuxia/constants'; // [New] UI Constants


import { submitGameplayLog } from '@/app/actions/log';


import { Send, Save, RotateCcw, History, SkipForward, Package, Settings, Bolt, Maximize, Minimize, Loader2, X, Book, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { EventManager } from '@/lib/event-manager';
import WikiSystem from './WikiSystem';
import TextMessage from './features/TextMessage';
import PhoneCall from './features/PhoneCall';
import TVNews from './features/TVNews';
import SmartphoneApp from './features/SmartphoneApp';
import Article from './features/Article';
import DebugPopup from './features/DebugPopup';

const translations = {
    en: {
        chatHistory: "Chat History",
        close: "Close",
        you: "You",
        system: "System",
        inventory: "Inventory",
        empty: "Empty...",
        yourAction: "Your Action",
        placeholderAction: "What do you want to do?",
        cancel: "Cancel",
        action: "Action",
        charInfo: "Character Information",
        wiki: "Wiki",
        heroism: "Heroism",
        morality: "Morality",
        selfishness: "Selfishness",
        relationships: "Relationships",
        noRelationships: "No relationships yet.",
        skills: "Skills",
        noSkills: "No skills learned.",
        scenePaused: "Scene Paused / Lost",
        noActiveDialogue: "No active dialogue. What would you like to do?",
        resetGame: "Reset Game",
        continueInput: "Continue (Input)",
        thinking: "Thinking...",
        directInput: "⌨️ Direct Input...",
        inputBtn: "INPUT",
        debugBtn: "DEBUG",
        saveLoad: "Save / Load",
        save: "Save",
        load: "Load",
        delete: "Delete",
        emptySlot: "Empty",
        noSummary: "No summary",
        confirmLoad: "Load Slot {0}? Current progress will be lost.",
        confirmDelete: "Are you sure you want to delete Slot {0}?",
        gameDeleted: "Slot {0} deleted.",
        confirmNewGame: "Are you sure you want to start a new game? Current progress will be lost.",
        gameStartMessage: "Game Start. Please introduce the world and the main character.",
        gameSaved: "Game saved to Slot {0}",
        gameLoaded: "Game loaded from Slot {0}",
        errorGenerating: "Error generating response",
        acquired: "Acquired: {0}",
        usedLost: "Used/Lost: Item {0}",
        hp: "HP",
        mp: "MP",
        gold: "Gold",
        exp: "EXP",
        baseStats: "Base Stats",
        str: "STR (Strength)",
        agi: "AGI (Agility)",
        int: "INT (Intelligence)",
        vit: "VIT (Vitality)",
        luk: "LUK (Luck)"
    },
    ko: {
        chatHistory: "대화 기록",
        close: "닫기",
        you: "당신",
        system: "시스템",
        inventory: "인벤토리",
        empty: "비어있음...",
        yourAction: "행동하기",
        placeholderAction: "무엇을 하시겠습니까?",
        cancel: "취소",
        action: "실행",
        charInfo: "캐릭터 정보",
        wiki: "위키",
        heroism: "영웅심",
        morality: "도덕성",
        selfishness: "이기심",
        relationships: "관계도",
        noRelationships: "아직 관계가 없습니다.",
        skills: "보유 스킬",
        noSkills: "배운 스킬이 없습니다.",
        scenePaused: "장면 일시정지 / 길을 잃음",
        noActiveDialogue: "진행 중인 대화가 없습니다. 무엇을 하시겠습니까?",
        resetGame: "게임 초기화",
        continueInput: "계속하기 (입력)",
        thinking: "생각 중...",
        directInput: "⌨️ 직접 입력...",
        inputBtn: "입력",
        debugBtn: "디버그",
        saveLoad: "저장 / 불러오기",
        save: "저장",
        load: "로드",
        delete: "삭제",
        emptySlot: "비어있음",
        noSummary: "요약 없음",
        confirmLoad: "슬롯 {0}을(를) 불러오시겠습니까? 현재 진행 상황은 저장되지 않습니다.",
        confirmDelete: "정말로 슬롯 {0}을(를) 삭제하시겠습니까?",
        gameDeleted: "슬롯 {0}이(가) 삭제되었습니다.",
        confirmNewGame: "새 게임을 시작하시겠습니까? 현재 진행 상황은 저장되지 않습니다.",
        gameStartMessage: "게임 시작. 세계관과 주인공을 소개해줘.",
        gameSaved: "슬롯 {0}에 게임 저장됨",
        gameLoaded: "슬롯 {0}에서 게임 불러옴",
        errorGenerating: "응답 생성 중 오류 발생",
        acquired: "획득: {0}",
        usedLost: "사용/분실: 아이템 {0}",
        hp: "체력",
        mp: "마나",
        gold: "골드",
        exp: "경험치",
        baseStats: "기본 스탯",
        str: "STR (힘)",
        agi: "AGI (민첩)",
        int: "INT (지능)",
        vit: "VIT (체력)",
        luk: "LUK (운)"
    }
};

// getKoreanExpression removed in favor of getCharacterImage utility

// Game Tips Library
const LOADING_TIPS = [
    "운(LUK) 스탯이 높으면 길가에서 돈을 줍거나, 위기 상황에서 기적적으로 탈출할 수 있습니다.",
    "지능(INT)이 높으면 상대방의 거짓말을 간파하거나, 마법적인 현상을 이해할 수 있습니다.",
    "도덕성(Morality)이 낮으면 범죄 조직과 협력하기 쉬워지지만, 시민들의 신뢰를 얻기 힘듭니다.",
    "체력(VIT)은 전투 시 버틸 수 있는 맷집뿐만 아니라, 질병이나 독에 대한 저항력도 의미합니다.",
    "민첩(AGI)이 높으면 은신, 소매치기, 도주 확률이 대폭 상승합니다.",
    "매력(Speech/Eloquence)이 높으면 말싸움으로 적을 제압하거나, 물건을 싸게 살 수 있습니다.",
    "명성(Fame)이 오르면 유명인사가 되어 팬이 생기지만, 동시에 적들의 표적이 될 수도 있습니다.",
    "NPC와의 '호감도'는 단순한 숫자가 아닙니다. 위급할 때 그들이 당신을 위해 목숨을 걸 수도 있습니다.",
    "특정 장소에는 밤에만 나타나는 비밀 상점이나 인물이 존재합니다.",
    "아이템 '스마트폰'을 통해 정보를 수집하거나 다른 인물에게 연락할 수 있습니다.",
    "음식을 먹으면 체력이 소량 회복되며, 기분이 전환되어 '무드'가 바뀔 수 있습니다.",
    "정신력(MP)이 0이 되면 캐릭터가 미쳐버리거나, 자살 충동을 느끼는 등 '배드 엔딩' 직행입니다.",
    "영웅심(Heroism)이 높으면 시민들이 당신을 추앙하지만, 악당들은 당신을 눈엣가시로 여깁니다.",
    "이기심(Selfishness)이 높으면 자신의 이익을 위해 동료를 배신하는 선택지가 해금될 수 있습니다.",
    "전투 중 '도주'는 비겁한 것이 아닙니다. 살아남는 것이 강한 것입니다.",
    "돈(Gold)으로 대부분의 문제를 해결할 수 있습니다. 심지어 사람의 마음까지도요.",
    "비 오는 날에는 은신 확률이 올라가지만, 체온 저하로 체력이 조금씩 깎일 수 있습니다.",
    "어떤 선택지는 되돌릴 수 없습니다. 신중하게 선택하세요.",
    "세이브 슬롯은 3개입니다. 중요한 분기점 앞에서는 반드시 저장하세요.",
    "개발자 팁: 사실 운 스탯만 믿고 막 나가도 꽤 재미있는 상황이 벌어집니다."
];

// Internal Component for Response Timer
function ResponseTimer({ avgTime }: { avgTime: number }) {
    const [progress, setProgress] = useState(0);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        // Reset whenever avgTime changes or mount
        setProgress(0);
        setElapsed(0);

        const interval = setInterval(() => {
            setElapsed(prev => {
                const newElapsed = prev + 100;
                // Calculate percentage: (elapsed / avgTime) * 100
                // Cap at 95% to allow for "finishing" jump
                // If elapsed > avgTime, we slow down the increment drastically or just cap at 98%
                let newProgress = (newElapsed / avgTime) * 100;
                if (newProgress > 95) newProgress = 95 + ((newElapsed - avgTime) / 10000); // Very slow creep after 95%
                if (newProgress > 99) newProgress = 99;

                setProgress(newProgress);
                return newElapsed;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [avgTime]);

    // Format time MM:SS
    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full mt-4 flex flex-col gap-2 min-w-[300px]">
            <div className="flex justify-between text-xs text-yellow-500 font-mono">
                <span className="animate-pulse">WARPING REALITY...</span>
                <span>{formatTime(elapsed)} / {formatTime(avgTime)} EST</span>
            </div>
            <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-yellow-900/50 shadow-inner relative">
                {/* Grid Background Effect */}
                <div className="absolute inset-0 bg-black opacity-20 pointer-events-none"></div>

                <motion.div
                    className="h-full bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "tween", ease: "linear", duration: 0.1 }}
                />
            </div>

        </div>
    );
}

// Internal Component for Ad Simulation
function AdButton({ onReward }: { onReward: () => void }) {
    const [status, setStatus] = useState<'idle' | 'playing' | 'rewarded'>('idle');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let interval: any;
        if (status === 'playing') {
            interval = setInterval(() => {
                setProgress(prev => {
                    const next = prev + 10;
                    return next > 100 ? 100 : next;
                });
            }, 500);
        }
        return () => clearInterval(interval);
    }, [status]);

    useEffect(() => {
        if (status === 'playing' && progress >= 100) {
            setStatus('rewarded');
            onReward();
        }
    }, [progress, status, onReward]);

    if (status === 'rewarded') {
        return (
            <button disabled className="w-full py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-gray-400 font-bold cursor-not-allowed flex items-center justify-center gap-2">
                <span className="text-green-500">✓</span> 보상 지급 완료
            </button>
        );
    }

    if (status === 'playing') {
        return (
            <div className="w-full bg-gray-800 rounded-xl border border-yellow-500/50 p-4 relative overflow-hidden">
                <div className="flex justify-between items-center mb-2 z-10 relative">
                    <span className="text-yellow-500 font-bold text-sm animate-pulse">광고 시청 중...</span>
                    <span className="text-white text-xs">{Math.floor(progress)}%</span>
                </div>
                {/* Progress Bar Background */}
                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden z-10 relative">
                    <motion.div
                        className="h-full bg-yellow-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                    />
                </div>
                {/* Fake Ad Content (Overlay) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <span className="text-4xl">📺</span>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={() => setStatus('playing')}
            className="w-full py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-xl border border-yellow-400 text-white font-bold shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-2"
        >
            <span>📺</span> 광고 보고 50 골드 받기
        </button>
    );
}

// Helper to format text (Bold support)
const formatText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-yellow-400 font-extrabold">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

// [Localization]
const TRAIT_KO_MAP: Record<string, string> = {
    morality: '도덕성',
    courage: '용기',
    energy: '에너지',
    decision: '의사결정',
    lifestyle: '생활양식',
    openness: '수용성',
    warmth: '대인온도',
    eloquence: '화술',
    leadership: '통솔력',
    humor: '유머',
    lust: '색욕',
    // Fallback for others if needed
    hp: '체력',
    mp: '정신력',
    neigong: '내공',
    str: '근력',
    agi: '민첩',
    int: '지력',
    vit: '체격',
    luk: '운'
};

export default function VisualNovelUI() {
    const [isFullscreen, setIsFullscreen] = useState(false);
    // [New] Profile Tab State
    const [activeProfileTab, setActiveProfileTab] = useState<'basic' | 'martial_arts' | 'relationships'>('basic');
    const router = useRouter();
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Core Game Store
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Core Game Store
    const {
        chatHistory,
        addMessage,
        currentBackground,
        setBackground,
        characterExpression,
        setCharacterExpression,
        addTextMessage,
        playerStats,
        setPlayerStats,
        inventory,
        addItem,
        removeItem,
        resetGame,
        scriptQueue,
        setScriptQueue,
        currentSegment,
        setCurrentSegment,
        choices,
        setChoices,
        language,
        setLanguage,
        scenarioSummary,
        playerName, // Add playerName from hook
        userCoins,
        setUserCoins,
        availableExtraImages,
        turnCount,
        incrementTurnCount,
        initialScenario,
        characterCreationQuestions, // Added
        day,
        time,
        characterData // [New] Get character data for UI
    } = useGameStore();

    const creationQuestions = characterCreationQuestions; // Alias for UI Usage

    const supabase = createClient();

    // VN State
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLogicPending, setIsLogicPending] = useState(false); // [Logic Lock] Track background logic
    const [showHistory, setShowHistory] = useState(false);
    const [showInventory, setShowInventory] = useState(false);
    const [showCharacterInfo, setShowCharacterInfo] = useState(false);
    const [showWiki, setShowWiki] = useState(false);
    const [isPhoneOpen, setIsPhoneOpen] = useState(false); // [New] Phone App State
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // [New] BGM State
    const [currentBgm, setCurrentBgm] = useState<string | null>(null);
    const bgmRef = useRef<HTMLAudioElement | null>(null);

    // [New] Cleanup BGM on unmount
    useEffect(() => {
        return () => {
            if (bgmRef.current) {
                bgmRef.current.pause();
                bgmRef.current.src = "";
                bgmRef.current = null;
            }
        };
    }, []);

    // [Transition Logic] Track previous character name to determine animation type
    // If name matches last ref => dissolve only (expression change).
    // If name differs => full animation (character switch).
    const getCurrentCharName = (expr: string | null) => expr ? expr.split('_')[0] : '';
    const lastCharNameRef = useRef<string>('');

    const currentCharName = getCurrentCharName(characterExpression);
    const isSameCharacter = lastCharNameRef.current === currentCharName && !!characterExpression;

    useEffect(() => {
        if (characterExpression) {
            lastCharNameRef.current = getCurrentCharName(characterExpression);
        } else {
            // Reset when character disappears so next appearance animates fully
            lastCharNameRef.current = '';
        }
    }, [characterExpression]);

    // Tip Rotation Logic
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    // UseRef to track if processing just started to randomize only once per load if desired, 
    // but useEffect check is enough.
    useEffect(() => {
        if (isProcessing) {
            // Random start
            setCurrentTipIndex(Math.floor(Math.random() * LOADING_TIPS.length));
            const interval = setInterval(() => {
                setCurrentTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
            }, 8000); // Rotate every 8 seconds
            return () => clearInterval(interval);
        }
    }, [isProcessing]);

    // Input State
    const [isInputOpen, setIsInputOpen] = useState(false);
    const [userInput, setUserInput] = useState('');

    // Debug State
    const [isDebugOpen, setIsDebugOpen] = useState(false);
    const [isLocalhost, setIsLocalhost] = useState(false);
    const [debugInput, setDebugInput] = useState('');
    const [lastLogicResult, setLastLogicResult] = useState<any>(null);
    const [pendingLogic, setPendingLogic] = useState<any>(null);
    const [lastStoryOutput, setLastStoryOutput] = useState<string>(''); // [Logging] Store last story output



    // [New] Effect State (Damage / Feedback)
    const [damageEffect, setDamageEffect] = useState<{ intensity: number; duration: number } | null>(null);
    const damageAudioRef = useRef<HTMLAudioElement | null>(null); // [New] Audio Ref

    // [New] Shared Helper for Visual Damage
    const handleVisualDamage = useCallback((changeAmount: number, currentHp: number, maxHp: number) => {
        // Only trigger on DAMAGE (Negative Change)
        if (changeAmount >= 0) return;

        console.log(`[VisualEffects] Checking Damage. Amount: ${changeAmount}, Current: ${currentHp}, Max: ${maxHp}`);

        const damage = Math.abs(changeAmount);
        // Intensity Calculation: 5% HP = Low (0.2), 20% HP = Max (1.0)
        const ratio = Math.min(1, Math.max(0.2, damage / (maxHp * 0.2)));

        console.log(`[VisualEffects] TRIGGERED! Damage: ${damage}, Ratio: ${ratio}`);
        setDamageEffect({
            intensity: ratio,
            duration: 400 // ms
        });

        // [New] Play Random Damage Audio
        // Files: damage1.mp3 ~ damage7.mp3 in /assets/Common/fx/
        const randomIdx = Math.floor(Math.random() * 7) + 1;
        const audioPath = `/assets/Common/fx/damage${randomIdx}.mp3`;

        try {
            const audio = new Audio(audioPath);
            audio.volume = 0.5; // Adjust volume as needed
            audio.play().catch(e => console.warn(`[Audio] Failed to play damage fx: ${audioPath}`, e));
            // No need to store in ref if we just fire and forget, but if we want to stop overlapping...
            // For damage, overlapping is usually fine/better.
        } catch (e) {
            console.warn("[Audio] Error initializing audio", e);
        }

        setTimeout(() => setDamageEffect(null), 400);
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            console.log("Debug: Hostname detected:", hostname);
            // Relaxed check: allow 127.0.0.1, localhost, OR if user adds ?debug=true
            const isDebugParam = new URLSearchParams(window.location.search).get('debug') === 'true';
            setIsLocalhost(hostname === 'localhost' || hostname === '127.0.0.1' || isDebugParam);
        }
    }, []);

    // Toast State
    const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'warning' | 'error' }[]>([]);

    const addToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    // Auth State (Event-Based)
    const [session, setSession] = useState<any>(null);

    // Character Creation State
    const [creationStep, setCreationStep] = useState(0);
    const [creationData, setCreationData] = useState<Record<string, string>>({});

    // [New] Recharge Popup State
    const [showRechargePopup, setShowRechargePopup] = useState(false);

    const handleRecharge = async () => {
        const newCoins = userCoins + 50;
        setUserCoins(newCoins);
        setShowRechargePopup(false);
        addToast("50 토큰이 충전되었습니다! (테스트)", "success");

        if (session?.user && supabase) {
            const { error } = await supabase.from('profiles').update({ coins: newCoins }).eq('id', session.user.id);
            if (error) console.error("Recharge Update Failed:", error);
        }
    };

    // Track Session & Fetch Coins on Mount
    useEffect(() => {
        let mounted = true;

        // Initial Fetch (Robust)
        const fetchInitialSession = async () => {
            // 1. Try getSession (Local Storage)
            if (!supabase) return;

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

            if (mounted && sessionData.session) {
                console.log("VN: Session found via getSession");
                setSession(sessionData.session);
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('coins')
                    .eq('id', sessionData.session.user.id)
                    .single();
                if (mounted && profile) setUserCoins(profile.coins);
                return;
            }

            // 2. Fallback to getUser (Server Verification) - vital for persistence issues
            if (!sessionData.session || sessionError) {
                console.log("VN: getSession failed/empty, trying getUser...");
                const { data: userData, error: userError } = await supabase.auth.getUser();

                if (mounted && userData.user) {
                    console.log("VN: User found via getUser");
                    // Construct a pseudo-session or just get session again (it might be refreshed)
                    const { data: refreshedSession } = await supabase.auth.getSession();
                    if (refreshedSession.session) {
                        setSession(refreshedSession.session);
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('coins')
                            .eq('id', refreshedSession.session.user.id)
                            .single();
                        if (mounted && profile) setUserCoins(profile.coins);
                    }
                } else {
                    console.log("VN: No user found (Guest Mode)");
                }
            }
        };
        fetchInitialSession();

        // Listen for changes
        if (!supabase) return;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, currentSession: any) => {
            if (mounted) {
                setSession(currentSession);
                if (currentSession?.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('coins')
                        .eq('id', currentSession.user.id)
                        .single();
                    if (mounted && profile) setUserCoins(profile.coins);
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // ... (Hydration Fix & Asset Loading) ...

    // ... (Rest of component) ...


    // Hydration Fix & Asset Loading
    const [sessionId, setSessionId] = useState<string>('');
    const [isMounted, setIsMounted] = useState(false);
    const [turnSummary, setTurnSummary] = useState<string | null>(null); // [NEW] Summary State

    // Initialize Session ID
    // [Logging] Hydrate lastStoryOutput from history on mount (in case of refresh)
    useEffect(() => {
        if (chatHistory && chatHistory.length > 0) {
            // Find last model message
            for (let i = chatHistory.length - 1; i >= 0; i--) {
                if (chatHistory[i].role === 'model') {
                    setLastStoryOutput(chatHistory[i].text);
                    break;
                }
            }
        }
    }, []); // Run once on mount (after hydration)

    // Initialize Session ID
    useEffect(() => {
        const generateUUID = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            } else {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
                    return v.toString(16);
                });
            }
        };

        try {
            let sid = sessionStorage.getItem('vn_session_id');
            if (!sid) {
                sid = generateUUID();
                sessionStorage.setItem('vn_session_id', sid);
            }
            setSessionId(sid);
        } catch (e) {
            console.warn("Session Storage Access failed:", e);
            // In-memory fallback if storage fails - MUST be valid UUID for DB
            // We use the same UUID generator but don't persist it
            setSessionId(generateUUID());
        }
    }, []);
    // Prevent double-firing in Strict Mode
    const isWarmupTriggered = useRef(false);

    useEffect(() => {
        setIsMounted(true);
        // Load Assets
        const loadAssets = async () => {
            console.log("Loading Assets...");
            try {
                const gameId = useGameStore.getState().activeGameId; // Get current game ID
                const extraChars = await getExtraCharacterImages(gameId);
                console.log("Loaded Extra Characters:", extraChars);
                useGameStore.getState().setAvailableExtraImages(extraChars);
            } catch (e) {
                console.error("Failed to load extra assets:", e);
                useGameStore.getState().setAvailableExtraImages([]);
            }

            // [Startup Warmup] Preload Cache in Background - DISABLED (Cost Saving)
            // if (isWarmupTriggered.current) return;
            // isWarmupTriggered.current = true;

            // try {
            //     console.log("[System] Triggering Cache Warmup...");
            //     // Pass current state (Initial)
            //     serverPreloadCache(useGameStore.getState()).then((usageMetadata) => {
            //         if (usageMetadata) {
            //             const cachedTokens = (usageMetadata as any).cachedContentTokenCount || 0;
            //             const inputTokens = usageMetadata.promptTokenCount - cachedTokens;
            //             const outputTokens = usageMetadata.candidatesTokenCount;

            //             // [DYNAMIC PRICING] Use Shared Config
            //             const modelName = MODEL_CONFIG.STORY;
            //             const rate = PRICING_RATES[modelName] || PRICING_RATES['gemini-2.5-flash'];

            //             const costPer1M_Input = rate.input;
            //             const costPer1M_Output = rate.output;
            //             // Cache hit pricing is typically cheaper or same inputs. 
            //             // For Pro it is $0.3125 (Input is $1.25). 
            //             // For Flash it is $0.01875 (Input is $0.075).
            //             // Since we don't have this in PRICING_RATES fully, we can approximate or add it there.
            //             // Assuming 25% of input cost for cached input (Standard Google Ratio).
            //             const costPer1M_Cached = rate.input * 0.25;

            //             const costInput = (inputTokens / 1_000_000) * costPer1M_Input;
            //             const costCached = (cachedTokens / 1_000_000) * costPer1M_Cached;
            //             const costOutput = (outputTokens / 1_000_000) * costPer1M_Output;
            //             const totalCost = costInput + costCached + costOutput;
            //             const totalCostKRW = totalCost * 1480;

            //             console.log(`Token Usage (Cache Warmup - ${modelName}):`);
            //             console.log(`- New Input: ${inputTokens} ($${costInput.toFixed(6)})`);
            //             console.log(`- Cached:    ${cachedTokens} ($${costCached.toFixed(6)})`);
            //             console.log(`- Output:    ${outputTokens} ($${costOutput.toFixed(6)})`);
            //             console.log(`- Total:     $${totalCost.toFixed(6)} (₩${Math.round(totalCostKRW)})`);

            //             const cacheMsg = cachedTokens > 0 ? ` (Cached: ${cachedTokens})` : '';
            //             addToast(`Warmup Tokens: ${usageMetadata.promptTokenCount}${cacheMsg} / Cost: ₩${Math.round(totalCostKRW)}`, 'info');
            //         }
            //     });
            // } catch (e) {
            //     console.error("Warmup Failed:", e);
            // }
        };
        loadAssets();
    }, []);



    // Save/Load State
    const [showSaveLoad, setShowSaveLoad] = useState(false);
    const [saveSlots, setSaveSlots] = useState<{ id: number; date: string; summary: string }[]>([]);

    // Load slots on mount
    useEffect(() => {
        const slots = [];
        for (let i = 1; i <= 3; i++) {
            const data = localStorage.getItem(`vn_save_${i}`);
            if (data) {
                const parsed = JSON.parse(data);
                slots.push({ id: i, date: new Date(parsed.timestamp).toLocaleString(), summary: parsed.summary || 'No summary' });
            } else {
                slots.push({ id: i, date: 'Empty', summary: '-' });
            }
        }
        setSaveSlots(slots);
    }, [showSaveLoad]);

    const saveGame = (slotId: number) => {
        const state = useGameStore.getState();
        const summary = `${state.playerName || 'Unknown'} / Turn: ${state.turnCount || 0} / ${state.playerStats?.realm || 'Unknown'}`;

        const saveData = {
            timestamp: Date.now(),
            summary: summary,
            state: state
        };
        localStorage.setItem(`vn_save_${slotId}`, JSON.stringify(saveData));
        addToast(t.gameSaved.replace('{0}', slotId.toString()), 'success');
        setShowSaveLoad(false);
    };

    const loadGame = (slotId: number) => {
        const data = localStorage.getItem(`vn_save_${slotId}`);
        if (!data) return;

        if (confirm(t.confirmLoad.replace('{0}', slotId.toString()))) {
            const parsed = JSON.parse(data);
            useGameStore.setState(parsed.state);
            addToast(t.gameLoaded.replace('{0}', slotId.toString()), 'success');
            setShowSaveLoad(false);
        }
    };

    const deleteGame = (slotId: number) => {
        if (confirm(t.confirmDelete.replace('{0}', slotId.toString()))) {
            localStorage.removeItem(`vn_save_${slotId}`);
            setSaveSlots(prev => prev.map(s => s.id === slotId ? { ...s, date: 'Empty', summary: '-' } : s));
            addToast(t.gameDeleted.replace('{0}', slotId.toString()), 'info');
        }
    };

    const handleNewGame = () => {
        if (confirm(t.confirmNewGame)) {
            resetGame();
            // Explicitly clear storage using Zustand's API
            useGameStore.persist.clearStorage();
            // Force reload to ensure fresh data (JSONs) are loaded if they were changed
            setTimeout(() => {
                window.location.reload();
            }, 100);
        }
    };

    const t = translations[language || 'en'];

    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll history
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatHistory, showHistory]);

    // Status Message Timer
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => setStatusMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    // Auto-apply pending logic if script is finished
    useEffect(() => {
        if (scriptQueue.length === 0 && !currentSegment && pendingLogic) {
            console.log("Auto-applying pending logic (Script finished early)");
            applyGameLogic(pendingLogic);
            setPendingLogic(null);
        }
    }, [scriptQueue, currentSegment, pendingLogic]);

    // Helper Functions
    const getBgUrl = (bg: string) => {
        const gameId = useGameStore.getState().activeGameId || 'god_bless_you';
        if (!bg) return `/assets/${gameId}/backgrounds/Home_Entrance.jpg`; // Default fallback
        if (bg.startsWith('http') || bg.startsWith('/')) return bg; // Return absolute paths directly
        return `/assets/${gameId}/backgrounds/${encodeURIComponent(bg)}.jpg`; // Fallback for legacy simple names
    };

    const getCharUrl = (charExpression: string) => {
        if (!charExpression) return '';
        if (charExpression.startsWith('http')) return charExpression;

        // Note: charExpression is expected to be "Name_Emotion" or just "Name"
        // But getCharacterImage takes (name, emotion).
        // If we store the full path in state, we can just return it.
        // However, the state logic below stores "Name_Emotion".

        // Let's check how it's stored.
        // In advanceScript, we setCharacterExpression(`${charName}_${expr}`);
        // Wait, if we use getCharacterImage, we should probably store the PATH directly?
        // OR, we parse it here.

        // The user request: "getCharacterImage("천서윤", "기쁨") returns path".
        // My previous code in VisualNovelUI constructed the path manually: `/assets/characters/${charId}_${emotion}.png`

        // If I change the state to store the PATH, then getCharUrl just returns it.
        // Let's modify advanceScript to call getCharacterImage and store the RESULT path.
        // Then getCharUrl simply checks for http or returns the string (if relative).

        // But wait, ExtraCharacters logic is also here.
        // If I store path, I need to handle Extra logic in advanceScript OR getCharacterImage?
        // Extra characters are handled by `availableExtraImages.includes`.
        // The prompt says "getCharacterImage" handles the mapping.

        // If I update advanceScript to use getCharacterImage, then `characterExpression` state will hold the PATH.
        // Then `getCharUrl` should just return it.

        return charExpression;
    };

    // [New] BGM Playback Helper
    const playBgm = (moodKey: string) => {
        if (!moodKey) return;
        let validKey = moodKey.trim();
        // Check Alias (if partial key used)
        if (WUXIA_BGM_ALIASES[validKey]) validKey = WUXIA_BGM_ALIASES[validKey];

        const candidates = WUXIA_BGM_MAP[validKey];
        if (!candidates || candidates.length === 0) {
            console.warn(`[BGM] No BGM found for key: ${moodKey}`);
            return;
        }

        const filename = candidates[Math.floor(Math.random() * candidates.length)];
        const bgmPath = `/assets/wuxia/BGM/${filename}.mp3`;

        console.log(`[BGM] Switching to: ${bgmPath} (Mood: ${moodKey})`);

        // If same file is playing, do nothing (prevent restart)
        if (bgmRef.current && bgmRef.current.src.includes(encodeURIComponent(filename))) {
            return;
        }

        // Crossfade Logic
        const newAudio = new Audio(bgmPath);
        newAudio.loop = true;
        newAudio.volume = 0;

        const playPromise = newAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.error("[BGM] Audio Play Failed (Simulated in specific env?):", e));
        }

        const fadeDuration = 2000; // 2s Fade
        const interval = 50;
        const volumeStep = interval / fadeDuration;

        // Fade In
        let vol = 0;
        const fadeIn = setInterval(() => {
            vol = Math.min(1, vol + volumeStep);
            newAudio.volume = vol;
            if (vol >= 1) clearInterval(fadeIn);
        }, interval);

        // Fade Out Old
        if (bgmRef.current) {
            const oldAudio = bgmRef.current;
            let oldVol = oldAudio.volume || 1;
            const fadeOut = setInterval(() => {
                oldVol = Math.max(0, oldVol - volumeStep);
                oldAudio.volume = oldVol;
                if (oldVol <= 0) {
                    clearInterval(fadeOut);
                    oldAudio.pause();
                    oldAudio.src = "";
                }
            }, interval);
        }

        bgmRef.current = newAudio;
        setCurrentBgm(moodKey);
    };

    const advanceScript = () => {
        // Handle Character Exit (Exit Tag Logic)
        if (currentSegment?.characterLeave) {
            console.log("Character leaving based on <떠남> tag.");
            setCharacterExpression(''); // Clear character (use empty string as per type definition)
        }

        // Use a local copy of the queue to process immediately
        let currentQueue = [...scriptQueue];

        if (currentQueue.length === 0) {
            setCurrentSegment(null);
            // Check for pending logic
            if (pendingLogic) {
                applyGameLogic(pendingLogic);
                setPendingLogic(null);
            }
            return;
        }

        let nextSegment = currentQueue[0];

        // Process background, command, and BGM segments iteratively to avoid recursion
        while (nextSegment && (nextSegment.type === 'background' || nextSegment.type === 'command' || nextSegment.type === 'bgm')) {
            console.log(`[ScriptLoop] Processing Segment: Type=${nextSegment.type}, Content=${nextSegment.content}`);

            if (nextSegment.type === 'background') {
                // Resolve fuzzy tag to actual file path
                console.log(`[Background Debug] AI Tag: "${nextSegment.content}"`);
                const resolvedBg = resolveBackground(nextSegment.content);
                console.log(`[Background Debug] Resolved to: "${resolvedBg}"`);
                setBackground(resolvedBg);
                setCharacterExpression(''); // Clear character on scene change
            } else if (nextSegment.type === 'command') {
                // [New] Handle Commands
                if (nextSegment.commandType === 'set_time') {
                    console.log(`[Command] Updating Time: ${nextSegment.content}`);
                    useGameStore.getState().setTime(nextSegment.content);
                } else if (nextSegment.commandType === 'update_stat') {
                    try {
                        const changes = JSON.parse(nextSegment.content);
                        console.log(`[Command] Update Stat:`, changes);
                        const currentStats = useGameStore.getState().playerStats;
                        const newStats = { ...currentStats };

                        Object.keys(changes).forEach(originalKey => {
                            const key = originalKey.toLowerCase(); // [Fix] Normalize key to handle 'Morality' vs 'morality'

                            if (['hp', 'mp', 'gold', 'fame', 'morality'].includes(key)) return; // Handled above (assuming changes.hp check uses original key? No, changes.hp is case-sensitive!)

                            // Wait, if I access `changes.hp` explicitly above, and changes has "HP", `changes.hp` is undefined.
                            // I should probably iterate ALL keys and handle them dynamically to be safe, 
                            // OR map changes to a lower-cased object first.

                        });

                        // Better approach: Normalize entire changes object first
                        const normalizedChanges: Record<string, any> = {};
                        Object.keys(changes).forEach(k => normalizedChanges[k.toLowerCase()] = changes[k]);

                        // Now use normalizedChanges for everything
                        if (normalizedChanges.hp !== undefined) {
                            const val = Number(normalizedChanges.hp);
                            if (!isNaN(val)) {
                                newStats.hp = Math.min(Math.max(0, newStats.hp + val), newStats.maxHp);
                                addToast(`HP ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');

                                // [Fix] Trigger Visual Damage for Inline Tag
                                if (val < 0) {
                                    handleVisualDamage(val, newStats.hp, newStats.maxHp);
                                }
                            }
                        }
                        if (normalizedChanges.mp !== undefined) {
                            const val = Number(normalizedChanges.mp);
                            if (!isNaN(val)) {
                                newStats.mp = Math.min(Math.max(0, newStats.mp + val), newStats.maxMp);
                                addToast(`MP ${val > 0 ? '+' : ''}${val}`, 'info');
                            }
                        }
                        if (normalizedChanges.gold !== undefined) {
                            const val = Number(normalizedChanges.gold);
                            if (!isNaN(val)) {
                                newStats.gold = Math.max(0, newStats.gold + val);
                                addToast(`Gold ${val > 0 ? '+' : ''}${val}`, 'success');
                            }
                        }
                        if (normalizedChanges.fame !== undefined) {
                            const val = Number(normalizedChanges.fame);
                            if (!isNaN(val)) {
                                newStats.fame = Math.max(0, (newStats.fame || 0) + val);
                                addToast(`Fame ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');
                            }
                        }
                        if (normalizedChanges.morality !== undefined) {
                            const val = Number(normalizedChanges.morality);
                            if (!isNaN(val)) {
                                newStats.personality = { ...newStats.personality, morality: Math.min(100, Math.max(-100, (newStats.personality?.morality || 0) + val)) };
                                addToast(`Morality ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');
                            }
                        }

                        // Generic Fallback
                        Object.keys(normalizedChanges).forEach(key => {
                            if (['hp', 'mp', 'gold', 'fame', 'morality'].includes(key)) return;

                            const val = Number(normalizedChanges[key]);
                            if (!isNaN(val)) {
                                if (typeof (newStats as any)[key] === 'number') {
                                    (newStats as any)[key] = ((newStats as any)[key] as number) + val;
                                    addToast(`${key.toUpperCase()} ${val > 0 ? '+' : ''}${val}`, 'info');
                                } else if (newStats.personality && typeof (newStats.personality as any)[key] === 'number') {
                                    (newStats.personality as any)[key] = ((newStats.personality as any)[key] as number) + val;
                                    addToast(`${key.toUpperCase()} ${val > 0 ? '+' : ''}${val}`, 'info');
                                }
                            }
                        });


                        useGameStore.getState().setPlayerStats(newStats);

                    } catch (e) {
                        console.error("Failed to parse update_stat command:", e);
                    }
                } else if (nextSegment.commandType === 'update_relationship') {
                    try {
                        const data = JSON.parse(nextSegment.content);
                        if (data.charId && data.value) {
                            const val = Number(data.value);
                            console.log(`[Command] Update Rel: ${data.charId} += ${val}`);

                            // [Fix] Update PlayerStats (Primary Data Source for UI)
                            const currentStats = useGameStore.getState().playerStats;
                            const currentRel = currentStats.relationships[data.charId] || 0;
                            const newRel = currentRel + val;

                            useGameStore.getState().setPlayerStats({
                                relationships: {
                                    ...currentStats.relationships,
                                    [data.charId]: newRel
                                }
                            });

                            // [Fix] Sync CharacterData (Secondary)
                            useGameStore.getState().updateCharacterRelationship(data.charId, newRel);

                            // Try to resolve name for toast
                            const charData = useGameStore.getState().characterData[data.charId];
                            const name = charData ? charData.name : data.charId;
                            addToast(`${name} 호감도 ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');
                        }
                    } catch (e) {
                        console.error("Failed to parse update_relationship command:", e);
                    }
                }
            } else if (nextSegment.type === 'bgm') {
                // [New] Handle BGM
                playBgm(nextSegment.content);
            }

            currentQueue.shift(); // Remove processed segment
            if (currentQueue.length === 0) break;
            nextSegment = currentQueue[0];
        }

        // If queue is empty after processing backgrounds
        if (currentQueue.length === 0) {
            setScriptQueue([]);
            setCurrentSegment(null);
            if (pendingLogic) {
                applyGameLogic(pendingLogic);
                setPendingLogic(null);
            }
            return;
        }

        // Handle Text Messages (Store)
        if (nextSegment.type === 'text_message') {
            console.log(`[Script] Text Message from ${nextSegment.character}: ${nextSegment.content}`);
            addTextMessage(nextSegment.character || 'Unknown', {
                sender: nextSegment.character || 'Unknown',
                content: nextSegment.content,
                timestamp: Date.now()
            });
            addToast(`📩 ${nextSegment.character}: ${nextSegment.content.substring(0, 15)}...`, 'info');
            setScriptQueue(currentQueue.slice(1));
            setCurrentSegment(nextSegment); // [Changed] Show Popup
            return;
        }

        // Handle Text Replies (Player)
        if (nextSegment.type === 'text_reply') {
            const receiver = nextSegment.character || 'Unknown';
            console.log(`[Script] Text Reply to ${receiver}: ${nextSegment.content}`);
            addTextMessage(receiver, {
                sender: '주인공',
                content: nextSegment.content,
                timestamp: Date.now()
            });
            addToast(`📤 답장 전송: ${receiver}`, 'info');
            setScriptQueue(currentQueue.slice(1));
            setCurrentSegment(null);
            return;
        }

        // Handle Phone Call
        if (nextSegment.type === 'phone_call') {
            console.log(`[Script] Phone Call: ${nextSegment.content}`);
            // Logic for phone call (UI component)
            // Falls through to default segment handling
        }

        // If queue is empty after processing backgrounds
        if (currentQueue.length === 0) {
            setScriptQueue([]);
            setCurrentSegment(null);
            if (pendingLogic) {
                applyGameLogic(pendingLogic);
                setPendingLogic(null);
            }
            return;
        }

        // Handle Choices
        if (nextSegment.type === 'choice') {
            const newChoices = [];
            let i = 0;
            while (i < currentQueue.length && currentQueue[i].type === 'choice') {
                newChoices.push(currentQueue[i]);
                i++;
            }
            setChoices(newChoices);
            setScriptQueue(currentQueue.slice(i));
            setCurrentSegment(null);
            return;
        }

        // Handle Normal Segment (Dialogue/Narration)
        setScriptQueue(currentQueue.slice(1));
        setCurrentSegment(nextSegment);

        if (nextSegment.type === 'dialogue' && nextSegment.expression) {
            // [New] Dynamic Override for Extra Characters
            const charMap = useGameStore.getState().characterMap || {};
            const isMainCharacter = !!charMap[nextSegment.character || ''];

            // Prevent override if it is a Main Character
            if (nextSegment.characterImageKey && nextSegment.character && !isMainCharacter) {
                useGameStore.getState().setExtraOverride(nextSegment.character, nextSegment.characterImageKey);
            }

            if (nextSegment.character && nextSegment.expression) {
                // Determine Name and Emotion from AI output
                // AI is instructed to output Korean Name and Korean Emotion.
                const charName = nextSegment.character === playerName ? '주인공' : nextSegment.character;
                const emotion = nextSegment.expression; // AI output (e.g., '기쁨', 'Happy')

                let imagePath = '';

                // Prevent Protagonist Image from showing (Immersion)
                if (charName === '주인공' || charName === playerName) {
                    setCharacterExpression('');
                    return;
                }

                const combinedKey = `${charName}_${emotion}`;
                const gameId = useGameStore.getState().activeGameId || 'god_bless_you';
                const extraMap = useGameStore.getState().extraMap; // Get extraMap from store

                // [Fix] Explicit Key Lookup (Priority)
                // Only use characterImageKey if NOT a Main Character
                if (nextSegment.characterImageKey && !isMainCharacter) {
                    if (extraMap && extraMap[nextSegment.characterImageKey]) {
                        imagePath = `/assets/${gameId}/ExtraCharacters/${extraMap[nextSegment.characterImageKey]}`;
                    } else {
                        // Fallback for direct matches?
                        imagePath = getCharacterImage(nextSegment.characterImageKey, emotion);
                    }
                }
                // Existing Logic
                else if (availableExtraImages && availableExtraImages.includes(combinedKey)) {
                    // Check direct file match (name_emotion)
                    imagePath = `/assets/${gameId}/ExtraCharacters/${combinedKey}.png`;
                } else if (extraMap && extraMap[charName]) {
                    // Check exact name match in extraMap (e.g. "점소이(비굴한)" -> "점소이_비굴한.png")
                    imagePath = `/assets/${gameId}/ExtraCharacters/${extraMap[charName]}`;
                } else {
                    // Clean up emotion input (remove parens if any, though system prompt forbids them)
                    // The mapper expects clean distinct Korean words.
                    imagePath = getCharacterImage(charName, emotion);
                }

                setCharacterExpression(imagePath);
            }
        }
    }

    // Response Time Tracking
    const [avgResponseTime, setAvgResponseTime] = useState(60000); // Default 1 minute as per request

    const handleSend = async (text: string, isDirectInput: boolean = false, isHidden: boolean = false) => {
        if (!text.trim()) return;

        setIsProcessing(true);
        const startTime = Date.now();
        console.log(`handleSend: "${text}", coins: ${userCoins}, session: ${!!session}, isDirectInput: ${isDirectInput}`);

        try {
            let activeSession = session;
            let currentCoins = userCoins;

            // 1. Ensure Session (Use local state)
            if (!activeSession?.user) {
                console.warn("handleSend: No session found, but allowing guest/optimistic play if coins > 0");
                if (currentCoins < 1) {
                    // addToast("Login required or not enough coins.", "warning");
                    setShowRechargePopup(true); // Trigger Popup for Guests too
                    setIsProcessing(false);
                    return;
                }
            }

            // 2. Coin Check
            if (currentCoins < 1) {
                console.warn("handleSend: Not enough coins");
                // addToast("Not enough coins! Please recharge.", "warning");
                setShowRechargePopup(true); // Trigger Popup
                setIsProcessing(false);
                return;
            }

            // 3. OPTIMISTIC Deduct Coin
            const newCoinCount = currentCoins - 1;
            setUserCoins(newCoinCount);

            // Background DB Sync (Fire-and-forget)
            if (activeSession?.user) {
                const userId = activeSession.user.id;
                if (supabase) { // Guard supabase call
                    supabase.rpc('decrement_coin', { user_id: userId })
                        .then(({ error }: { error: any }) => {
                            if (error) {
                                // Fallback to direct update if RPC fails
                                if (supabase) { // Guard supabase call
                                    supabase.from('profiles').update({ coins: newCoinCount }).eq('id', userId)
                                        .then(({ error: updateError }: { error: any }) => {
                                            if (updateError) console.error("Coin update failed:", updateError);
                                        });
                                }
                            }
                        });
                }
            }

            if (!isHidden) {
                addMessage({ role: 'user', text });
            }
            setChoices([]);

            const currentState = useGameStore.getState();
            let currentHistory = currentState.chatHistory;

            // 0. Update Logic & Turn Count
            incrementTurnCount();
            const nextTurnCount = useGameStore.getState().turnCount; // Get updated value
            const SUMMARY_THRESHOLD = 10;

            console.log(`[VisualNovelUI] Turn: ${nextTurnCount}`);

            // 5. [Core] Memory Summarization Logic (Turn-Based)
            if (nextTurnCount > 0 && nextTurnCount % SUMMARY_THRESHOLD === 0) {
                console.log(`Triggering Memory Summarization (Turn ${nextTurnCount})...`);
                addToast(`Summarizing memories (Turn ${nextTurnCount})...`, "info");

                // Summarize recent dialogue (Last 20 messages approx for 10 turns)
                // We keep the history buffer intact for display, but summarize for 'scenarioSummary'.
                // If history is very long, we might truncate it here too.

                // Assuming history has user+model pairs, 10 turns = 20 messages.
                // We want to summarize the *latest* chunk or the *accumulated* history?
                // The prompt says "Current Summary + Recent Dialogue".
                // So we take the recent dialogue.

                const messagesToSummarize = currentHistory.slice(-SUMMARY_THRESHOLD * 2);

                const newSummary = await serverGenerateSummary(
                    currentState.scenarioSummary,
                    messagesToSummarize
                );

                useGameStore.getState().setScenarioSummary(newSummary);
                console.log("%c[Scenario Summary Updated]", "color: orange; font-weight: bold;");
                console.log(newSummary);

                // Optional: Truncate history for optimization if it gets too long
                // But generally users like to scroll back. 
                // We can keep displayHistory, but truncate chatHistory (for API context) if we want.
                // For now, let's keep the user's snippet logic: "Trigger on Turn Count".

                // If we want to save tokens, we should truncate chatHistory.
                if (currentHistory.length > 30) {
                    useGameStore.getState().truncateHistory(20);
                }

                // Update local reference for this turn
                currentHistory = useGameStore.getState().chatHistory;
                addToast("Memory updated!", "success");
            }

            // 1. Generate Narrative
            console.log(`[VisualNovelUI] Sending state to server.`);

            // Sanitize state to remove functions and circular references
            const sanitizedState = JSON.parse(JSON.stringify({
                chatHistory: currentState.chatHistory,
                playerStats: currentState.playerStats,
                inventory: currentState.inventory,
                currentLocation: currentState.currentLocation,
                scenarioSummary: currentState.scenarioSummary,
                currentEvent: currentState.currentEvent,
                currentMood: currentState.currentMood,
                playerName: currentState.playerName,
                activeCharacters: currentState.activeCharacters,
                characterData: currentState.characterData,
                worldData: currentState.worldData,
                availableBackgrounds: currentState.availableBackgrounds,
                availableCharacterImages: currentState.availableCharacterImages,
                availableExtraImages: currentState.availableExtraImages,
                activeGameId: currentState.activeGameId, // [FIX] Pass GameID for Server Re-hydration
                constants: currentState.constants, // [CRITICAL] Helper constants (Rules/Famous Chars)
                lore: currentState.lore, // [CRITICAL] Full Lore Data
                isDirectInput: isDirectInput, // Inject Flag
                isGodMode: currentState.isGodMode, // Pass God Mode Flag to Server
                lastTurnSummary: turnSummary // [NEW] Pass Last Turn Summary
            }));

            // Race Condition for Timeout
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timed Out")), 300000));
            // [Logging] Track costs across steps
            let storyCost = 0;

            // [OPTIMIZATION] Prune state for Story Model too (just in case)
            const rawStateForStory = useGameStore.getState();
            const {
                lore, events, wikiData, backgroundMappings,
                scriptQueue, displayHistory, chatHistory,
                characterCreationQuestions, constants,
                ...prunedStateForStory
            } = rawStateForStory;
            const storyModel = useGameStore.getState().storyModel;
            console.log(`[VisualNovelUI] Using Story Model: ${storyModel}`);

            const responsePromise = serverAgentTurn(
                currentHistory,
                text,
                prunedStateForStory, // Send pruned state
                language,
                storyModel || MODEL_CONFIG.STORY, // [FIX] 5th Arg: Model Name
                isDirectInput // [FIX] 6th Arg: Direct Input Flag
            );

            const result: any = await Promise.race([responsePromise, timeoutPromise]);

            // [Agent] Destructure Output
            const responseText = result.reply;
            const usageMetadata = result.usageMetadata;
            const routerOut = result.router;
            const preLogic = result.logic;
            const postLogic = result.post_logic;

            // [Summary Agent] Update UI
            if (result.summary) {
                setTurnSummary(result.summary);
            } else {
                setTurnSummary(null);
            }

            if (usageMetadata || (result as any).allUsage) {
                // [Detailed Agent Logging]
                const routerDebug = (result as any).router;
                const preLogicDebug = (result as any).logic;
                const postLogicDebug = (result as any).post_logic;

                // 0. Latency & Cost Log (New)
                const latencies = (result as any).latencies || {};
                console.log(`%c[Telemetry] Total: ${latencies.total}ms | Cost: $${(result as any).cost?.toFixed(6)}`, 'color: gray;');

                // 1. Router Log
                console.groupCollapsed(`%c[Step 1] Router (${latencies.router}ms) (${routerDebug.type})`, 'color: cyan; font-weight: bold;');
                console.log(`%c[Input]`, 'color: gray; font-weight: bold;', routerDebug._debug_prompt);
                console.log(`%c[Output]`, 'color: cyan; font-weight: bold;', {
                    Intent: routerDebug.intent,
                    Target: routerDebug.target || "None",
                    Keywords: routerDebug.keywords.join(', ')
                });
                console.groupEnd();

                // 1.5 Casting Log (New)
                const castingDebug = (result as any).casting;
                if (castingDebug) {
                    const candidateCount = castingDebug.length;
                    console.groupCollapsed(`%c[Step 1.5] Casting Director (${candidateCount} candidates scanned)`, candidateCount > 0 ? 'color: purple; font-weight: bold;' : 'color: gray;');

                    if (candidateCount === 0) {
                        console.log("No candidates found (All filtered by Phase/Region/Active). check AgentCasting logic.");
                    } else {
                        // Display Top 15
                        console.log(`%c[Leaderboard (Top 15)]`, 'color: purple; font-weight: bold;', castingDebug.slice(0, 15).map((c: any) => ({
                            Name: c.name,
                            Score: c.score.toFixed(2),
                            Reasons: c.reasons.join(', ')
                        })));
                    }
                    console.groupEnd();
                }

                // 2. Pre-Logic Log
                // [Modified] Show Score in Header
                const scoreText = preLogicDebug.plausibility_score ? `Score: ${preLogicDebug.plausibility_score}/10` : (preLogicDebug.success ? 'Success' : 'Failure');
                console.groupCollapsed(`%c[Step 2] Pre-Logic (${latencies.preLogic}ms) (${scoreText})`, 'color: magenta; font-weight: bold;');
                console.log(`%c[Input]`, 'color: gray; font-weight: bold;', preLogicDebug._debug_prompt);
                console.log(`%c[Output]`, 'color: magenta; font-weight: bold;', {
                    Score: preLogicDebug.plausibility_score,
                    Analysis: preLogicDebug.judgment_analysis,
                    Guide: preLogicDebug.narrative_guide,
                    Mechanics: preLogicDebug.mechanics_log,
                    Changes: preLogicDebug.state_changes
                });
                console.groupEnd();

                // 3. Story Log
                console.groupCollapsed(`%c[Step 3] Story Writer (${latencies.story}ms)`, 'color: green; font-weight: bold;');
                if ((result as any).systemPrompt) {
                    console.log(`%c[Input - Static (Cached)]`, 'color: gray; font-weight: bold;', (result as any).systemPrompt);
                }
                if ((result as any).finalUserMessage) {
                    console.log(`%c[Input - Dynamic (Logic + User)]`, 'color: blue; font-weight: bold;', (result as any).finalUserMessage);
                }
                console.log(`%c[Output]`, 'color: green; font-weight: bold;', (result as any).raw_story || responseText);
                console.groupEnd();

                console.groupCollapsed(`%c[Final Script]`, 'color: cyan; font-weight: bold;');
                console.log(responseText || (result as any).raw_story);
                console.groupEnd();

                // 4. Post-Logic Log
                console.groupCollapsed(`%c[Step 4] Post-Logic (${latencies.postLogic}ms)`, 'color: orange; font-weight: bold;');
                console.log(`%c[Input]`, 'color: gray; font-weight: bold;', postLogicDebug._debug_prompt);
                console.log(`%c[Output]`, 'color: orange; font-weight: bold;', {
                    Mood: postLogicDebug.mood_update,
                    Relations: postLogicDebug.relationship_updates,
                    Stats: postLogicDebug.stat_updates,
                    Tension: postLogicDebug.tension_update, // [NEW]
                    NewGoals: postLogicDebug.new_goals, // [NEW]
                    GoalUpdates: postLogicDebug.goal_updates, // [NEW]
                    Memories: postLogicDebug.new_memories
                });
                console.groupEnd();

                // 5. Martial Arts (New)
                const maDebug = (result as any).martial_arts_debug;
                if (maDebug) {
                    // Check logic result for actual changes
                    const maResult = (result as any).martial_arts;
                    console.groupCollapsed(`%c[Step 4.5] Martial Arts (${latencies.martial_arts}ms)`, 'color: red; font-weight: bold;');
                    console.log(`%c[Input]`, 'color: gray; font-weight: bold;', maDebug._debug_prompt);
                    console.log(`%c[Output]`, 'color: red; font-weight: bold;', {
                        Realm: maResult?.realm_update,
                        Progress: maResult?.realm_progress_delta,
                        NewArgs: maResult?.new_arts,
                        UpdatedArts: maResult?.updated_arts,
                        Stagnation: maResult?.growthStagnation,
                        Audit: maResult?.stat_updates
                    });
                    console.groupEnd();
                }

                // 4.5. Summary Log
                if ((result as any).summaryDebug) {
                    console.groupCollapsed(`%c[Step 5.5] Turn Summarizer`, 'color: yellow; font-weight: bold;');
                    console.log(`%c[Input]`, 'color: gray; font-weight: bold;', (result as any).summaryDebug._debug_prompt);
                    console.log(`%c[Output]`, 'color: yellow; font-weight: bold;', result.summary);
                    console.groupEnd();
                }

                // [Cost Aggregation] Sum up all 5 Steps
                const allUsage = (result as any).allUsage || { story: usageMetadata };

                let grandTotalTokens = 0;
                let grandTotalCost = 0;
                let cacheHitCount = 0;

                // Model Pricing Mappings
                const pricingMap: Record<string, any> = {
                    router: PRICING_RATES[MODEL_CONFIG.ROUTER],
                    preLogic: PRICING_RATES[MODEL_CONFIG.PRE_LOGIC],
                    postLogic: PRICING_RATES[MODEL_CONFIG.LOGIC], // Use LOGIC config for PostLogic
                    story: PRICING_RATES[result.usedModel || MODEL_CONFIG.STORY] || PRICING_RATES[MODEL_CONFIG.STORY],
                    summary: PRICING_RATES[MODEL_CONFIG.SUMMARY || 'gemini-2.5-flash'] || PRICING_RATES['gemini-2.5-flash'],
                    martial_arts: PRICING_RATES[MODEL_CONFIG.LOGIC] // Uses same model as Logic usually
                };

                Object.entries(allUsage).forEach(([step, usage]: [string, any]) => {
                    if (!usage) return;

                    const rate = pricingMap[step] || PRICING_RATES[MODEL_CONFIG.LOGIC];

                    const cached = (usage as any).cachedContentTokenCount || 0;
                    const input = usage.promptTokenCount - cached;
                    const output = usage.candidatesTokenCount;

                    const stepCost =
                        ((input / 1_000_000) * rate.input) +
                        ((cached / 1_000_000) * (rate.input * 0.25)) +
                        ((output / 1_000_000) * rate.output);

                    grandTotalTokens += usage.promptTokenCount;
                    grandTotalCost += stepCost;
                    if (cached > 0) cacheHitCount++;

                    console.log(`[Cost] ${step}: Input ${input}, Cached ${cached}, Output ${output}, Cost $${stepCost.toFixed(6)}`);
                });

                storyCost = grandTotalCost; // Update Main Cost Variable
                const totalCostKRW = grandTotalCost * 1480;

                // [Verification Log]
                console.log(`%c[TOTAL COST] $${grandTotalCost.toFixed(6)} (₩${Math.round(totalCostKRW)})`, 'color: yellow; font-weight: bold;');

                const cacheMsg = cacheHitCount > 0 ? ` (Cache HIT x${cacheHitCount})` : '';
                addToast(`Total Tokens: ${grandTotalTokens}${cacheMsg} / Cost: ₩${Math.round(totalCostKRW)}`, 'info');
            }

            // [UX Improvement] Clear Character Image
            setCharacterExpression('');

            // [Fix] Data Flow Consistency
            // We fixed the parser to handle tags + text correctly (no clumping).
            // Now we MUST usage responseText (which has tags) to ensure Stat Notifications work.
            // result.raw_story has NO tags, so playing it effectively disables inline events live.
            const textToParse = responseText || result.raw_story;
            const segments = parseScript(textToParse);

            // Keep responseText for lastStoryOutput? Or use textToParse?
            // Usually lastStoryOutput is for display if segments fail?
            // Let's use clean text for safety.
            setLastStoryOutput(textToParse);

            // [Agent] Construct Logic Result for Application
            // Apply PreLogic (Stats) and PostLogic (Mood/Rel)

            // [Fix] Deduplication Logic: Calculate Deltas from Inline Tags
            const inlineDeltas: Record<string, number> = {};
            if (postLogic.inline_triggers && postLogic.inline_triggers.length > 0) {
                postLogic.inline_triggers.forEach((trigger: any) => {
                    // trigger.tag format examples: 
                    // <Stat hp='-5'> 
                    // <Rel char='Name' val='5'>
                    // We need to parse this string to extract key/val.
                    // Simple Regex Parser
                    const statMatch = trigger.tag.match(/<Stat\s+([^=]+)=['"]?(-?\d+)['"]?.*?>/i);
                    if (statMatch) {
                        const key = statMatch[1].toLowerCase();
                        const val = parseInt(statMatch[2], 10);
                        if (!isNaN(val)) {
                            inlineDeltas[key] = (inlineDeltas[key] || 0) + val;
                        }
                    }
                });
                console.log("[Deduplication] Detected Inline Deltas:", inlineDeltas);
            }

            // 1. Deduct Inline HP/MP from PreLogic (Mechanic) + MartialArts (Combat) Totals

            // Source HP = PreLogic + MartialArts
            const maHp = result.martial_arts?.stat_updates?.hp || 0;
            const sourceHp = (preLogic.state_changes?.hpChange || 0) + maHp;

            const inlineHp = inlineDeltas['hp'] || 0;
            const inlineMp = inlineDeltas['mp'] || 0;

            let finalHpChange = sourceHp;
            // Logic: If Source != 0, Block = Source - Inline. (Backend Authority - Deduct Visuals)
            //        If Source == 0, Block = 0.
            if (sourceHp !== 0) {
                finalHpChange = sourceHp - inlineHp;
            } else {
                finalHpChange = 0;
            }

            const maMp = result.martial_arts?.stat_updates?.mp || 0;
            const sourceMp = (preLogic.state_changes?.mpChange || 0) + maMp;
            let finalMpChange = 0;
            if (sourceMp !== 0) {
                finalMpChange = sourceMp - inlineMp;
            }

            // 2. Filter Personality Stats (Remove HP/MP) and Deduct Inline
            // Deduction for Personality (Source: PostLogic.stat_updates)
            const plPersonality: Record<string, number> = {};
            if (postLogic.stat_updates) {
                Object.entries(postLogic.stat_updates).forEach(([k, v]) => {
                    const key = k.toLowerCase();
                    if (key === 'hp' || key === 'mp') return; // Handled above

                    const totalVal = v as number;
                    const inlineVal = inlineDeltas[key] || 0;

                    // Deduct
                    plPersonality[key] = totalVal - inlineVal;
                });
            }

            // 3. Transform Relationships (Record -> Array)
            const plRelationships = undefined; // Relationships handled by Inline generally

            const combinedLogic = {
                ...preLogic.state_changes,

                // [Refined] Deduplicated HP/MP
                hpChange: finalHpChange,
                mpChange: finalMpChange,

                // [Refined] Pass Transformed Personality (Deduplicated)
                personalityChange: plPersonality,
                relationshipChange: plRelationships,


                mood: postLogic.mood_update,
                location: postLogic.location_update, // [NEW]
                new_memories: postLogic.new_memories,
                // [Fix] Propagate Active Characters
                activeCharacters: postLogic.activeCharacters,

                // [Narrative Systems]
                tension_update: postLogic.tension_update,
                goal_updates: postLogic.goal_updates,
                new_goals: postLogic.new_goals,

                // [Fix] Propagate deduplicated stats for persistence
                post_logic: {
                    ...postLogic,
                    stat_updates: plPersonality // Override with deduplicated (HP excluded from here anyway)
                },
                character_memories: postLogic.character_memories,

                // [Wuxia] Martial Arts Logic
                // We must NULLIFY the stat_updates.hp in martial_arts to avoid ApplyGameLogic applying it again!
                martial_arts: result.martial_arts ? {
                    ...result.martial_arts,
                    stat_updates: {
                        ...(result.martial_arts.stat_updates || {}),
                        hp: 0, // Handled by hpChange (Deduplicated)
                        mp: 0  // Handled by mpChange (Deduplicated)
                    }
                } : result.martial_arts,

                _debug_router: routerOut
            };

            // [Logging] Submit Global Log
            submitGameplayLog({
                session_id: sessionId || '00000000-0000-0000-0000-000000000000',
                game_mode: useGameStore.getState().activeGameId,
                turn_count: turnCount,
                choice_selected: text,
                player_rank: useGameStore.getState().playerStats.playerRank,
                location: useGameStore.getState().currentLocation,
                timestamp: new Date().toISOString(),
                player_name: useGameStore.getState().playerName,
                cost: storyCost,
                input_type: isDirectInput ? 'direct' : 'choice',
                meta: {
                    hp: useGameStore.getState().playerStats.hp,
                    mp: useGameStore.getState().playerStats.mp,
                    neigong: useGameStore.getState().playerStats.neigong,
                    agent_router: routerOut.intent, // [Log] Agent Intent
                    scenario_summary: useGameStore.getState().scenarioSummary,
                    memories: useGameStore.getState().activeCharacters.reduce((acc: any, charName: string) => {
                        const cData = useGameStore.getState().characterData[charName] as any;
                        if (cData && cData.memories) acc[charName] = cData.memories;
                        return acc;
                    }, {})
                },
                story_output: responseText
            }).then(() => console.log(`📝 [Log Sent] Total Cost: $${storyCost.toFixed(6)}`));

            if (segments.length === 0) {
                applyGameLogic(combinedLogic);
            } else {
                setPendingLogic(combinedLogic);
            }

            setIsLogicPending(false); // [Logic Lock] Unlock input explicitly just in case

            // 3. Update State
            // [Context Separation] Use raw_story (clean) for history if available, fall back to responseText
            const historyText = result.raw_story || responseText;
            addMessage({ role: 'model', text: historyText });

            // Update Average Response Time (Weighted: 70% history, 30% recent)
            const duration = Date.now() - startTime;
            setAvgResponseTime(prev => Math.round((prev * 0.7) + (duration * 0.3)));

            // Start playing
            if (segments.length > 0) {
                console.log(`[VisualNovelUI] Setting Script Queue (Size: ${segments.length})`);
                // Skip initial background, command, AND BGM segments
                let startIndex = 0;
                while (startIndex < segments.length && (segments[startIndex].type === 'background' || segments[startIndex].type === 'command' || segments[startIndex].type === 'bgm')) {
                    const seg = segments[startIndex];
                    if (seg.type === 'background') {
                        // [Fix] Resolve background properly before setting
                        const resolvedBg = resolveBackground(seg.content);
                        setBackground(resolvedBg);
                    } else if (seg.type === 'command') {
                        if (seg.commandType === 'set_time') {
                            const timeStr = seg.content;
                            useGameStore.getState().setTime(timeStr);

                            // [New] Auto-Parse Day from String (e.g. "2일차")
                            // Format: "2일차 14:00 (낮)"
                            const dayMatch = timeStr.match(/(\d+)일차/);
                            if (dayMatch) {
                                const newDay = parseInt(dayMatch[1], 10);
                                if (!isNaN(newDay)) {
                                    useGameStore.getState().setDay(newDay);
                                    console.log(`[Time] Auto-update Day: ${newDay}`);
                                }
                            }
                        }
                    } else if (seg.type === 'bgm') {
                        // [Fix] Play BGM immediately if it's at the start
                        playBgm(seg.content);
                    }

                    startIndex++;
                }

                if (startIndex < segments.length) {
                    // Check if the restart point is a CHOICE
                    if (segments[startIndex].type === 'choice') {
                        const newChoices = [];
                        let i = startIndex;
                        while (i < segments.length && segments[i].type === 'choice') {
                            newChoices.push(segments[i]);
                            i++;
                        }
                        setChoices(newChoices);
                        setScriptQueue(segments.slice(i));
                        setCurrentSegment(null);
                    } else {
                        // Normal Segment
                        const first = segments[startIndex];
                        setCurrentSegment(first);
                        setScriptQueue(segments.slice(startIndex + 1));

                        if (first.type === 'dialogue' && first.expression) {
                            if (first.character && first.expression) {
                                const charName = first.character === playerName ? '주인공' : first.character;
                                const emotion = first.expression;

                                let imagePath = '';
                                const combinedKey = `${charName}_${emotion}`;

                                if (availableExtraImages && availableExtraImages.includes(combinedKey)) {
                                    imagePath = `/assets/ExtraCharacters/${combinedKey}.png`;
                                } else {
                                    imagePath = getCharacterImage(charName, emotion);
                                }

                                setCharacterExpression(imagePath);
                            }
                        }
                    }
                } else {
                    // All segments were backgrounds
                    setScriptQueue([]);
                    setCurrentSegment(null);
                }
            } else {
                console.warn("handleSend: No segments generated.");
                addToast("AI returned no content.", "warning");
                setScriptQueue([]);
                setCurrentSegment(null);
            }

        } catch (error) {
            console.error(error);
            addToast(t.errorGenerating, 'warning');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUserSubmit = () => {
        const inputToLog = userInput; // Capture immediately
        if (!inputToLog.trim()) return; // Prevent empty logs

        // [Logging] Debug Toast for Mobile
        console.log("📝 Sending Direct Input Log:", inputToLog);

        // [Logging] Handled in handleSend to capture costs and results
        console.log("📝 Sending Direct Input:", inputToLog);

        handleSend(inputToLog, true);
        setUserInput('');
        setIsInputOpen(false);
    };

    const handleDebugSubmit = () => {
        const segments = parseScript(debugInput);
        setScriptQueue(segments);
        setDebugInput('');
        setIsDebugOpen(false);
        if (segments.length > 0) advanceScript();
    };

    const lastClickTime = useRef(0);

    const handleScreenClick = (e: React.MouseEvent) => {
        if (isProcessing || isInputOpen || isDebugOpen || showHistory || showInventory || showCharacterInfo || showSaveLoad || showWiki) return;
        if (choices.length > 0) return;

        const now = Date.now();
        if (now - lastClickTime.current < 100) return; // 500ms Debounce
        lastClickTime.current = now;

        advanceScript();
    };

    // Keyboard Navigation (Space / Enter)
    // [Fix] Use Ref to access latest advanceScript without triggering re-renders or HMR dependency length errors
    const advanceScriptRef = useRef(advanceScript);
    useEffect(() => {
        advanceScriptRef.current = advanceScript;
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if active element is an input or textarea
            const target = document.activeElement as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault(); // Prevent default scrolling for Space

                // Same validation as handleScreenClick
                if (isProcessing || isInputOpen || isDebugOpen || showHistory || showInventory || showCharacterInfo || showSaveLoad || showWiki) return;
                if (choices.length > 0) return;

                const now = Date.now();
                if (now - lastClickTime.current < 500) return; // 500ms Debounce
                lastClickTime.current = now;

                // Call the latest function via ref
                advanceScriptRef.current();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isProcessing, isInputOpen, isDebugOpen, showHistory, showInventory, showCharacterInfo, showSaveLoad, showWiki, choices.length]);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.deltaY < -30 && !showHistory && !isInputOpen && !isDebugOpen && !showInventory && !showCharacterInfo && !showSaveLoad && !showWiki) {
            setShowHistory(true);
        }
    };

    const handleStartGame = () => {
        // [GOD MODE CHECK]
        if (playerName === '김현준갓모드') {
            useGameStore.getState().setPlayerName('김현준');
            useGameStore.getState().setGodMode(true);
            addToast("😇 God Mode Activated", "success");
        }

        // Replace Placeholder with Real Name
        const effectiveName = (playerName === '김현준갓모드' ? '김현준' : playerName) || '성현우';
        const processedScenario = (initialScenario || "").replace(/{{PLAYER_NAME}}/g, effectiveName);
        setLastStoryOutput(processedScenario); // [Logging] Capture initial scenario

        // Parse the raw text scenario
        const segments = parseScript(processedScenario);

        // 1. Construct text for History & AI Context
        const historyText = segments.map(seg => {
            if (seg.type === 'background') return `<배경>${seg.content}`;
            if (seg.type === 'system_popup') return `<시스템팝업>${seg.content}`;
            if (seg.type === 'narration') return `<나레이션>${seg.content}`;
            if (seg.type === 'choice') return `<선택지${seg.choiceId || ''}>${seg.content}`;
            if (seg.type === 'dialogue') {
                return `<대사>${seg.character}_${seg.expression}: ${seg.content}`;
            }
            return seg.content;
        }).join('\n\n');

        // 2. Add to History (Silently, so it's in the log and available for AI)
        addMessage({ role: 'model', text: historyText });

        // 3. Play Script
        // Skip initial background segments and set background immediately
        let startIndex = 0;
        while (startIndex < segments.length && segments[startIndex].type === 'background') {
            const resolvedBg = resolveBackground(segments[startIndex].content);
            setBackground(resolvedBg);
            startIndex++;
        }

        if (startIndex < segments.length) {
            const first = segments[startIndex];
            setCurrentSegment(first);
            setScriptQueue(segments.slice(startIndex + 1));

            // Set character expression if the first segment is dialogue
            if (first.type === 'dialogue' && first.expression && first.character) {
                const charMap = useGameStore.getState().characterMap || {};
                const isMainCharacter = !!charMap[first.character];

                // [New] Override check for first segment
                // Prevent override if it is a Main Character (AI descriptions in parens shouldn't hijack the image)
                if (first.characterImageKey && first.character && !isMainCharacter) {
                    useGameStore.getState().setExtraOverride(first.character, first.characterImageKey);
                }

                const charName = first.character === playerName ? '주인공' : first.character;
                const emotion = first.expression;
                const gameId = useGameStore.getState().activeGameId || 'god_bless_you';
                const extraMap = useGameStore.getState().extraMap;

                let imagePath = '';
                const combinedKey = `${charName}_${emotion}`;

                // [Fix] Explicit Key Lookup (Priority)
                // Only use characterImageKey if NOT a Main Character (unless we add a costume system later)
                if (first.characterImageKey && !isMainCharacter) {
                    if (extraMap && extraMap[first.characterImageKey]) {
                        imagePath = `/assets/${gameId}/ExtraCharacters/${extraMap[first.characterImageKey]}`;
                    } else {
                        imagePath = getCharacterImage(first.characterImageKey, emotion);
                    }
                }
                else if (availableExtraImages && availableExtraImages.includes(combinedKey)) {
                    imagePath = `/assets/${gameId}/ExtraCharacters/${combinedKey}.png`;
                } else if (extraMap && extraMap[charName]) {
                    imagePath = `/assets/${gameId}/ExtraCharacters/${extraMap[charName]}`;
                } else {
                    imagePath = getCharacterImage(charName, emotion);
                }
                setCharacterExpression(imagePath);
            }
        } else {
            // Fallback if scenario is just backgrounds (unlikely)
            setScriptQueue([]);
            setCurrentSegment(null);
        }
    };

    const applyGameLogic = (logicResult: any) => {
        console.log("▶ [applyGameLogic] Received:", JSON.stringify(logicResult, null, 2)); // [DEBUG] Raw payload
        if (!logicResult) {
            console.warn('applyGameLogic: logicResult is null or undefined');
            return;
        }
        setLastLogicResult(logicResult);

        // Update Stats
        const currentStats = useGameStore.getState().playerStats;
        console.log('Current Stats before update:', currentStats);

        const newStats = { ...currentStats };
        let hasInjuryChanges = false;

        // [Fix] Deep clone nested objects to prevent mutation of INITIAL_STATS
        newStats.relationships = { ...(newStats.relationships || {}) };
        newStats.personality = {
            ...(newStats.personality || {
                morality: 0, courage: 0, energy: 0, decision: 0, lifestyle: 0,
                openness: 0, warmth: 0, eloquence: 0, leadership: 0,
                humor: 0, lust: 0
            })
        };
        newStats.skills = [...(newStats.skills || [])];
        // Initialize stagnation if missing
        if (typeof newStats.growthStagnation !== 'number') newStats.growthStagnation = 0;

        // [Growth Monitoring] Detect significant growth to reset Stagnation
        const isGrowthEvent =
            (logicResult.neigongChange && logicResult.neigongChange > 0) ||
            logicResult.realmChange || // Hypothetical field, but let's assume specific realm update logic down below covers it
            logicResult.new_martial_art || // Check if logic returns this
            (logicResult.expChange && logicResult.expChange > 10); // Major EXP gain

        if (isGrowthEvent) {
            newStats.growthStagnation = 0;
            // console.log("[Growth] Stagnation Reset!");
        }

        // Initialize if missing (Redundant but safe)
        if (!newStats.relationships) newStats.relationships = {};

        if (logicResult.hpChange) {
            newStats.hp = Math.min(Math.max(0, newStats.hp + logicResult.hpChange), newStats.maxHp);
            handleVisualDamage(logicResult.hpChange, newStats.hp, newStats.maxHp);
        }
        if (logicResult.mpChange) newStats.mp = Math.min(Math.max(0, newStats.mp + logicResult.mpChange), newStats.maxMp);
        if (logicResult.goldChange) newStats.gold = Math.max(0, newStats.gold + logicResult.goldChange);

        if (logicResult.expChange) newStats.exp += logicResult.expChange;
        if (logicResult.fameChange) newStats.fame = Math.max(0, (newStats.fame || 0) + logicResult.fameChange);
        if (logicResult.fateChange) newStats.fate = Math.max(0, (newStats.fate || 0) + logicResult.fateChange); // Handle Fate Change

        // Base Stats
        if (logicResult.statChange) {
            newStats.str = (newStats.str || 10) + (logicResult.statChange.str || 0);
            newStats.agi = (newStats.agi || 10) + (logicResult.statChange.agi || 0);
            newStats.int = (newStats.int || 10) + (logicResult.statChange.int || 0);
            newStats.vit = (newStats.vit || 10) + (logicResult.statChange.vit || 0);
            newStats.luk = (newStats.luk || 10) + (logicResult.statChange.luk || 0);
        }

        // [New] Sleep Logic (Overrides Time Consumed if present)
        if (logicResult.isSleep) {
            newStats.fatigue = 0; // Reset Fatigue
            const currentState = useGameStore.getState();
            currentState.setDay((currentState.day || 1) + 1); // Advance Day
            currentState.setTime('Morning'); // Reset Time to Morning
            addToast("휴식을 취했습니다. (피로도 초기화)", 'success');
            console.log("[Logic] isSleep: True -> Day Advanced, Fatigue Reset");
        }

        // [New] Location Update (From PostLogic)
        if (logicResult.location) {
            const currentLoc = useGameStore.getState().currentLocation;
            // Only update if changed (ignoring null/undefined)
            if (logicResult.location && currentLoc !== logicResult.location) {
                useGameStore.getState().setCurrentLocation(logicResult.location);
                console.log(`[Logic] Location Updated: ${currentLoc} -> ${logicResult.location}`);
            }
        }

        // [New] Time Progression Logic (Only if not sleeping)
        else if (logicResult.timeConsumed) {
            const timeMap = ['morning', 'afternoon', 'evening', 'night'];
            const currentState = useGameStore.getState();
            // Normalize & Legacy Fallback
            let currentTime = (currentState.time || 'morning').toLowerCase();
            const koMap: Record<string, string> = { '아침': 'morning', '점심': 'afternoon', '저녁': 'evening', '밤': 'night' };
            if (koMap[currentTime]) currentTime = koMap[currentTime];

            let timeIndex = timeMap.indexOf(currentTime);
            if (timeIndex === -1) timeIndex = 0; // Default

            const consumed = logicResult.timeConsumed; // 1=Small, 2=Medium, 4=Long
            const totalIndex = timeIndex + consumed;

            const daysPassed = Math.floor(totalIndex / 4);
            const newTimeIndex = totalIndex % 4;

            if (daysPassed > 0) {
                const newDay = (currentState.day || 1) + daysPassed;
                currentState.setDay(newDay);
                addToast(`${daysPassed}일이 지났습니다. (Day ${newDay})`, 'info');
            }

            const newTime = timeMap[newTimeIndex];
            if (newTime !== currentTime) {
                currentState.setTime(newTime);
                console.log(`[Time] ${currentTime} -> ${newTime} (+${daysPassed} days)`);
            }

            // [Growth Monitoring] Increment Stagnation if time passed AND no growth this turn
            if (!isGrowthEvent) {
                // Increment by 1 per logic execution (Turn)
                newStats.growthStagnation = (newStats.growthStagnation || 0) + 1;
            }
        }

        // [Fix] REMOVED Redundant Fame & Fate Logic Update
        // Similar to HP/MP, these are now handled via tags or were duplicated above.
        // if (logicResult.fameChange) {
        //     newStats.fame = (newStats.fame || 0) + logicResult.fameChange;
        // }
        // if (logicResult.fateChange) {
        //     newStats.fate = (newStats.fate || 0) + logicResult.fateChange;
        // }

        // Personality
        if (logicResult.personalityChange) {
            const p = newStats.personality;
            const c = logicResult.personalityChange;
            if (c.morality) p.morality = Math.min(100, Math.max(-100, (p.morality || 0) + c.morality));
            if (c.courage) p.courage = Math.min(100, Math.max(-100, (p.courage || 0) + c.courage));
            if (c.energy) p.energy = Math.min(100, Math.max(-100, (p.energy || 0) + c.energy));
            if (c.decision) p.decision = Math.min(100, Math.max(-100, (p.decision || 0) + c.decision));
            if (c.lifestyle) p.lifestyle = Math.min(100, Math.max(-100, (p.lifestyle || 0) + c.lifestyle));
            if (c.openness) p.openness = Math.min(100, Math.max(-100, (p.openness || 0) + c.openness));
            if (c.warmth) p.warmth = Math.min(100, Math.max(-100, (p.warmth || 0) + c.warmth));
            if (c.eloquence) p.eloquence = Math.min(100, Math.max(-100, (p.eloquence || 0) + c.eloquence));
            if (c.leadership) p.leadership = Math.min(100, Math.max(-100, (p.leadership || 0) + c.leadership));
        }

        // [Wuxia] Neigong Update
        if (logicResult.neigongChange) {
            newStats.neigong = Math.max(0, (newStats.neigong || 0) + logicResult.neigongChange);
            addToast(`내공(Internal Energy) ${logicResult.neigongChange > 0 ? '+' : ''}${logicResult.neigongChange}년`, logicResult.neigongChange > 0 ? 'success' : 'warning');
        }

        // Skills
        if (logicResult.newSkills) {
            logicResult.newSkills.forEach((skill: string) => {
                if (!newStats.skills.includes(skill)) newStats.skills.push(skill);
            });
        }

        // Relationships
        if (logicResult.relationshipChange) {
            logicResult.relationshipChange.forEach((rel: any) => {
                newStats.relationships[rel.characterId] = (newStats.relationships[rel.characterId] || 0) + rel.change;
            });
        }

        console.log('New Stats after update:', newStats);

        // [New] Injuries Update
        if (logicResult.injuriesUpdate) {
            let currentInjuries = [...(newStats.active_injuries || [])];
            let changed = false;

            // Add
            if (logicResult.injuriesUpdate.add) {
                logicResult.injuriesUpdate.add.forEach((injury: string) => {
                    if (!currentInjuries.includes(injury)) {
                        currentInjuries.push(injury);
                        addToast(`부상 발생(Injury): ${injury}`, 'warning');
                        changed = true;
                    }
                });
            }

            // Remove
            if (logicResult.injuriesUpdate.remove) {
                const initialLen = currentInjuries.length;
                currentInjuries = currentInjuries.filter(inj => !logicResult.injuriesUpdate.remove.includes(inj));
                if (currentInjuries.length !== initialLen) {
                    addToast("부상 회복!", 'success');
                    changed = true;
                }
            }

            if (changed) {
                newStats.active_injuries = currentInjuries;
                hasInjuryChanges = true;
            }
        }

        // [Wuxia] Martial Arts Processing (Realm, Skills, Stagnation)
        if (logicResult.martial_arts) {
            const ma = logicResult.martial_arts;
            let hasGrowth = false;

            // 1. Realm Update
            if (ma.realm_update) {
                newStats.realm = ma.realm_update; // e.g., '일류'
                addToast(`경지 돌파! [${ma.realm_update}]에 도달했습니다.`, 'success');
                hasGrowth = true;
            }

            // 2. Realm Progress
            if (ma.realm_progress_delta) {
                const currentProg = newStats.realmProgress || 0;
                newStats.realmProgress = Math.min(100, Math.max(0, currentProg + ma.realm_progress_delta));
                // Wait, if progress reaches 100, logic should probably flag it? 
                // Currently usually handled by Agent deciding "Realm Update".
                if (ma.realm_progress_delta > 0) hasGrowth = true;
                console.log(`[MartialArts] Progress: ${currentProg} -> ${newStats.realmProgress} (+${ma.realm_progress_delta})`);
            }

            // 3. New Arts
            if (ma.new_arts && ma.new_arts.length > 0) {
                if (!newStats.martialArts) newStats.martialArts = [];
                ma.new_arts.forEach((art: any) => {
                    // Check duplicate ID
                    if (!newStats.martialArts.find((a: any) => a.id === art.id)) {
                        newStats.martialArts.push(art);
                        addToast(`새로운 무공 습득: ${art.name}`, 'success');
                        hasGrowth = true;
                    }
                });
            }

            // 4. Updated Arts
            if (ma.updated_arts && ma.updated_arts.length > 0) {
                if (!newStats.martialArts) newStats.martialArts = [];
                ma.updated_arts.forEach((update: any) => {
                    const idx = newStats.martialArts.findIndex((a: any) => a.id === update.id);
                    if (idx !== -1) {
                        const art = newStats.martialArts[idx];
                        art.proficiency = Math.min(100, Math.max(0, (art.proficiency || 0) + update.proficiency_delta));
                        if (update.proficiency_delta > 0) hasGrowth = true;
                    }
                });
            }

            // 5. Stat Updates (Penalties/Injuries from Audit)
            if (ma.stat_updates) {
                if (ma.stat_updates.hp) {
                    newStats.hp = Math.max(0, (newStats.hp || 0) + ma.stat_updates.hp);
                    handleVisualDamage(ma.stat_updates.hp, newStats.hp, newStats.maxHp);
                }
                if (ma.stat_updates.mp) newStats.mp = Math.max(0, (newStats.mp || 0) + ma.stat_updates.mp);
                // [Fix] Connect Neigong Update from Martial Arts Agent
                if (ma.stat_updates.neigong) {
                    newStats.neigong = Math.max(0, (newStats.neigong || 0) + ma.stat_updates.neigong);
                    addToast(`내공(Internal Energy) ${ma.stat_updates.neigong > 0 ? '+' : ''}${ma.stat_updates.neigong}년`, 'success');
                }

                // Merge Injuries
                if (ma.stat_updates.active_injuries) {
                    const currentInj = newStats.active_injuries || [];
                    ma.stat_updates.active_injuries.forEach((inj: string) => {
                        if (!currentInj.includes(inj)) {
                            currentInj.push(inj);
                            addToast(`내상(Internal Injury): ${inj}`, 'warning');
                        }
                    });
                    newStats.active_injuries = currentInj;
                }
            }

            // 6. Growth Stagnation Logic
            if (hasGrowth) {
                newStats.growthStagnation = 0;
            } else {
                newStats.growthStagnation = (newStats.growthStagnation || 0) + 1;
            }
            console.log(`[MartialArts] Stagnation: ${newStats.growthStagnation}`);
        } else {
            // No MA output (non-combat turn?), increment stagnation if it's Wuxia mode?
            // Actually, keep it safe. Only increment if explicit logic ran.
            // If explicit logic ran (martial_arts exists) but empty, it hits the else above? 
            // AgentMartialArts always returns empty object {} if no change?
            // If empty object, hasGrowth = false -> Stagnation +1. Correct.
        }



        // [Narrative Systems: Tension & Goals]
        if (logicResult.tension_update) {
            useGameStore.getState().updateTensionLevel(logicResult.tension_update);
            console.log(`[Narrative] Tension Updated: ${logicResult.tension_update}`);
        }

        if (logicResult.new_goals) {
            logicResult.new_goals.forEach((g: any) => {
                const newGoal = {
                    id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    description: g.description,
                    type: g.type,
                    status: 'ACTIVE',
                    createdTurn: useGameStore.getState().turnCount
                };
                // @ts-ignore
                useGameStore.getState().addGoal(newGoal);
                addToast(`New Goal: ${g.description}`, 'info');
            });
        }

        if (logicResult.goal_updates) {
            logicResult.goal_updates.forEach((u: any) => {
                // @ts-ignore
                useGameStore.getState().updateGoal(u.id, { status: u.status });
                if (u.status === 'COMPLETED') addToast(`Goal Completed!`, 'success');
                if (u.status === 'FAILED') addToast(`Goal Failed!`, 'warning');
            });
        }

        // Final Commit
        if (Object.keys(logicResult).some(k => k === 'hpChange' || k === 'mpChange' || k === 'statChange' || k === 'personalityChange' || k === 'relationshipChange') || hasInjuryChanges) {
            useGameStore.getState().setPlayerStats(newStats);
        }



        // Toasts
        if (logicResult.hpChange) addToast(`${t.hp} ${logicResult.hpChange > 0 ? '+' : ''}${logicResult.hpChange}`, logicResult.hpChange > 0 ? 'success' : 'warning');
        if (logicResult.mpChange) addToast(`${t.mp} ${logicResult.mpChange > 0 ? '+' : ''}${logicResult.mpChange}`, 'info');
        if (logicResult.goldChange) addToast(`${t.gold} ${logicResult.goldChange > 0 ? '+' : ''}${logicResult.goldChange}`, 'success');
        if (logicResult.fameChange) addToast(`Fame ${logicResult.fameChange > 0 ? '+' : ''}${logicResult.fameChange}`, logicResult.fameChange > 0 ? 'success' : 'warning');
        if (logicResult.fateChange) addToast(`Fate ${logicResult.fateChange > 0 ? '+' : ''}${logicResult.fateChange}`, logicResult.fateChange > 0 ? 'info' : 'warning');

        // Stat Toasts
        if (logicResult.statChange) {
            Object.entries(logicResult.statChange).forEach(([stat, value]: [string, any]) => {
                if (value !== 0) addToast(`${stat.toUpperCase()} ${value > 0 ? '+' : ''}${value}`, 'info');
            });
        }

        // Inventory
        if (logicResult.newItems && logicResult.newItems.length > 0) {
            logicResult.newItems.forEach((item: any) => {
                addItem(item);
                addToast(t.acquired.replace('{0}', item.name), 'success');
            });
        }
        if (logicResult.removedItemIds && logicResult.removedItemIds.length > 0) {
            logicResult.removedItemIds.forEach((id: string) => {
                removeItem(id);
                addToast(t.usedLost.replace('{0}', id), 'info');
            });
        }

        // Personality Toasts (Dynamic)
        if (logicResult.personalityChange) {
            Object.entries(logicResult.personalityChange).forEach(([trait, value]: [string, any]) => {
                if (value !== 0) {
                    // Try to map trait to Korean if possible, or capitalize
                    const label = TRAIT_KO_MAP[trait] || trait.charAt(0).toUpperCase() + trait.slice(1);
                    addToast(`${label} ${value > 0 ? '+' : ''}${value}`, value > 0 ? 'success' : 'warning');
                }
            });
        }

        // [New] Player Rank Update
        if (logicResult.playerRank) {
            const currentRank = useGameStore.getState().playerStats.playerRank;
            if (currentRank !== logicResult.playerRank) {
                // Update Rank
                setPlayerStats({ ...newStats, playerRank: logicResult.playerRank });
                addToast(`Rank Up: ${logicResult.playerRank}`, 'success');
                console.log(`Rank updated from ${currentRank} to ${logicResult.playerRank}`);
            }
        }

        // [New] Faction Update
        if (logicResult.factionChange) {
            const currentFaction = useGameStore.getState().playerStats.faction;
            if (currentFaction !== logicResult.factionChange) {
                newStats.faction = logicResult.factionChange;
                useGameStore.getState().setPlayerStats(newStats);
                addToast(`소속 변경: ${logicResult.factionChange}`, 'success');
                console.log(`Faction updated from ${currentFaction} to ${logicResult.factionChange}`);
            }
        }

        // Debug Fame Change
        if (logicResult.fameChange !== undefined) {
            console.log(`[Logic] Fame Change: ${logicResult.fameChange}`);
        }

        // Character Updates (Bio & Memories)
        if (logicResult.characterUpdates && logicResult.characterUpdates.length > 0) {
            logicResult.characterUpdates.forEach((char: any) => {
                // If memories are provided, they REPLACE the old list (AI manages the list)
                // Otherwise, keep existing memories
                const updateData = { ...char };
                if (!updateData.memories) {
                    delete updateData.memories; // Don't overwrite with undefined
                } else {
                    addToast(`Memories Updated: ${char.name}`, 'info');
                }

                useGameStore.getState().updateCharacterData(char.id, updateData);
                if (!updateData.memories) addToast(`Character Updated: ${char.name}`, 'info');
            });
        }

        // Location Update
        if (logicResult.newLocation) {
            useGameStore.getState().setCurrentLocation(logicResult.newLocation);
            // Optional: Add toast or log
            console.log(`Location updated to: ${logicResult.newLocation}`);
        }

        // Location Updates (Description & Secrets)
        if (logicResult.locationUpdates && logicResult.locationUpdates.length > 0) {
            logicResult.locationUpdates.forEach((loc: any) => {
                // If secrets are provided, they REPLACE the old list
                const updateData: any = {};
                if (loc.description) updateData.description = loc.description;
                if (loc.secrets) {
                    updateData.secrets = loc.secrets;
                    addToast(`Secrets Updated: ${loc.id}`, 'info');
                }

                if (Object.keys(updateData).length > 0) {
                    useGameStore.getState().updateLocation(loc.id, updateData);
                }
            });
        }

        // [Moved] Post-Logic Processing (Apply Outcomes)
        if (logicResult.post_logic) {
            const postLogic = logicResult.post_logic;

            if (postLogic.mood_update) {
                useGameStore.getState().setMood(postLogic.mood_update as any);
            }

            if (postLogic.relationship_updates) {
                console.log("Relations Update:", postLogic.relationship_updates);
                // TODO: Implement actual relationship update in store if needed
            }

            // [NEW] Injury Management (Healing & Mutation)
            if (postLogic.resolved_injuries || postLogic.new_injuries) {
                useGameStore.setState(state => {
                    const currentInjuries = state.playerStats.active_injuries || [];
                    let updatedInjuries = [...currentInjuries];

                    // 1. Resolve (Remove) Injuries
                    if (postLogic.resolved_injuries && postLogic.resolved_injuries.length > 0) {
                        postLogic.resolved_injuries.forEach((resolved: string) => {
                            // Fuzzy removal: remove if strictly equal or if string contains/is contained (simple fuzzy)
                            const initialLength = updatedInjuries.length;
                            updatedInjuries = updatedInjuries.filter(injury => {
                                const iNorm = injury.toLowerCase().replace(/\s+/g, '');
                                const rNorm = resolved.toLowerCase().replace(/\s+/g, '');
                                // If they match closely, REMOVE it (return false)
                                return !(iNorm.includes(rNorm) || rNorm.includes(iNorm));
                            });

                            if (updatedInjuries.length < initialLength) {
                                // Indeed removed
                                addToast(`상태 회복: ${resolved}`, 'success');
                            } else {
                                // Match Failed - Warn User (Debug)
                                addToast(`회복 실패(명칭 불일치): AI가 '${resolved}' 치유를 시도했으나, 목록에 없습니다.`, 'error');
                            }
                        });
                    }

                    // 2. Add New Injuries (Mutation/New)
                    if (postLogic.new_injuries && postLogic.new_injuries.length > 0) {
                        postLogic.new_injuries.forEach((newInjury: string) => {
                            if (!updatedInjuries.includes(newInjury)) {
                                updatedInjuries.push(newInjury);
                                addToast(`부상 발생/악화: ${newInjury}`, 'warning');
                            }
                        });
                    }

                    return {
                        playerStats: {
                            ...state.playerStats,
                            active_injuries: updatedInjuries
                        }
                    };
                });
            }

            // [NEW] Persist Personality Stats
            if (postLogic.stat_updates) {
                const currentStats = useGameStore.getState().playerStats;
                const newPersonality = { ...currentStats.personality };
                let hasChanges = false;

                Object.entries(postLogic.stat_updates).forEach(([key, val]) => {
                    if (key in newPersonality) {
                        // Clamp between -100 and 100
                        const newValue = Math.max(-100, Math.min(100, (newPersonality as any)[key] + (val as number)));
                        (newPersonality as any)[key] = newValue;
                        hasChanges = true;
                        if (Math.abs(val as number) >= 1) {
                            const label = TRAIT_KO_MAP[key] || key;
                            addToast(`${label} ${(val as number) > 0 ? '+' : ''}${val}`, 'info');
                        }
                    }
                });

                if (hasChanges) {
                    useGameStore.getState().setPlayerStats({ personality: newPersonality });
                    console.log("Updated Personality:", newPersonality);
                }
            }

            if (postLogic.new_memories && postLogic.new_memories.length > 0) {
                // Initial stub for memory handling
            }

            // [Deleted] Duplicate/Broken Memory Logic
            // The correct logic is implemented below (after activeCharacters)
        }

        // [NEW] Martial Arts & Realm Updates (Sync with Server)
        if (logicResult.martial_arts) {
            const ma = logicResult.martial_arts;
            console.log("[MartialArts] Update Received:", ma);

            useGameStore.setState(state => {
                const currentStats = { ...state.playerStats };
                let hasUpdates = false;

                // 1. Realm Update
                if (ma.realm_update) {
                    // Update both specific Realm field and generic PlayerRank
                    currentStats.realm = ma.realm_update;
                    currentStats.playerRank = ma.realm_update.split('(')[0].trim(); // Normalize "이류 (2nd Rate)" -> "이류"
                    currentStats.realmProgress = 0; // Reset progress on breakthrough
                    hasUpdates = true;
                    addToast(`경지 등극: ${ma.realm_update}`, 'success');
                }

                // 2. Realm Progress Delta
                if (ma.realm_progress_delta !== undefined) {
                    const currentProg = currentStats.realmProgress || 0;
                    currentStats.realmProgress = Math.min(100, Math.max(0, currentProg + ma.realm_progress_delta));
                    hasUpdates = true;
                    // Only toast for significant gain
                    if (ma.realm_progress_delta >= 5) {
                        addToast(`깨달음: 경지 진행도 +${ma.realm_progress_delta}%`, 'info');
                    }
                }

                // 3. Neigong (Internal Energy) Update
                if (ma.stat_updates?.neigong) {
                    const delta = ma.stat_updates.neigong;
                    currentStats.neigong = (currentStats.neigong || 0) + delta;
                    // Float correction (optional, but display usually handles it)
                    currentStats.neigong = Math.round(currentStats.neigong * 100) / 100;
                    hasUpdates = true;
                }

                // 4. Martial Arts List Update
                // Add New Arts
                if (ma.new_arts && ma.new_arts.length > 0) {
                    const currentArts = currentStats.martialArts || [];
                    const newArts = ma.new_arts.filter((n: any) => !currentArts.find((e: any) => e.name === n.name));
                    if (newArts.length > 0) {
                        currentStats.martialArts = [...currentArts, ...newArts];
                        // Also update string list of skills for easy access
                        currentStats.skills = [...(currentStats.skills || []), ...newArts.map((a: any) => a.name)];
                        hasUpdates = true;
                        newArts.forEach((art: any) => addToast(`신규 무공 습득: ${art.name}`, 'success'));
                    }
                }

                // Update Existing Arts (Proficiency)
                if (ma.updated_arts && ma.updated_arts.length > 0) {
                    const currentArts = currentStats.martialArts || [];
                    let artUpdated = false;
                    const updatedList = currentArts.map((art: any) => {
                        const update = ma.updated_arts.find((u: any) => u.id === art.id || u.name === art.name); // Support Name or ID
                        if (update) {
                            artUpdated = true;
                            // Update Proficiency
                            const newProf = Math.min(100, (art.proficiency || 0) + update.proficiency_delta);
                            return { ...art, proficiency: newProf };
                        }
                        return art;
                    });

                    if (artUpdated) {
                        currentStats.martialArts = updatedList;
                        hasUpdates = true;
                    }
                }

                if (hasUpdates) {
                    console.log("[MartialArts] State Updated:", currentStats);
                    // Also update top-level playerRealm if a realm update occurred
                    if (ma.realm_update) {
                        return { playerStats: currentStats, playerRealm: ma.realm_update };
                    }
                    return { playerStats: currentStats };
                }
                return {};
            });
        }



        // Mood Update
        if (logicResult.newMood) {
            const currentMood = useGameStore.getState().currentMood;
            if (currentMood !== logicResult.newMood) {
                useGameStore.getState().setMood(logicResult.newMood);
                addToast(`Mood Changed: ${logicResult.newMood.toUpperCase()}`, 'info');
                console.log(`Mood changed from ${currentMood} to ${logicResult.newMood}`);
            }
        }

        if (logicResult.activeCharacters) {
            // [Safety] Ensure it's an array (AI might return single string)
            const activeList = Array.isArray(logicResult.activeCharacters)
                ? logicResult.activeCharacters
                : [logicResult.activeCharacters];

            // [Fix] Fuzzy Match & Normalize Logic
            const store = useGameStore.getState();
            const availableChars = store.availableCharacterImages || [];

            // Map AI output names to Valid Image Keys
            const resolvedChars = activeList.map((rawName: string) => {
                // [Clean] Strip emotion suffixes (e.g. "_Anger_Lv1", "_Smile")
                // Assumption: Character ID is the first part before the first underscore acting as a delimiter for emotion
                // BUT: Some IDs actully have underscores (e.g. "jun_seo_yeon"). 
                // Hybrid Strategy:
                const playerName = useGameStore.getState().playerName || 'Player';

                // Use Regex to remove _Emotion or _Lv patterns for cleaning
                // Example: BaekSoYu_Anger_Lv1 -> BaekSoYu
                const cleaned = rawName.replace(/(_[A-Z][a-z]+)+(_Lv\d+)?$/, '');

                // 1. Check if it's the Player (Exact name or Alias)
                const isPlayer = rawName === playerName
                    || ['player', 'me', 'i', 'myself', '나', '자신', '플레이어', '본인'].includes(cleaned.toLowerCase())
                    || cleaned === playerName;

                if (isPlayer) {
                    return playerName;
                }

                // 2. Check exact match in assets
                if (availableChars.includes(rawName)) return rawName;

                // Check if cleaned version exists
                // We also need to handle cases like "baek_so_yu" vs "BaekSoYu" -> normalize to lowercase for check

                if (['player', 'me', 'i', 'myself', '나', '자신', '플레이어', '본인'].includes(cleaned.toLowerCase())) {
                    return useGameStore.getState().playerName || 'Player';
                }

                // Try fuzzy match on Cleaned Name first
                const matchClean = findBestMatch(cleaned, availableChars);
                if (matchClean) {
                    console.log(`[ActiveChar] Cleaned Match: "${rawName}" -> "${cleaned}" -> "${matchClean}"`);
                    return matchClean;
                }

                // 3. Fuzzy match against available characters
                const match = findBestMatch(rawName, availableChars);
                if (match) {
                    console.log(`[ActiveChar] Fuzzy Request: "${rawName}" -> Resolved: "${match}"`);
                    return match;
                }

                return rawName;
            });

            // De-duplicate & Remove Player
            const playerName = useGameStore.getState().playerName || 'Player';
            const uniqueChars = Array.from(new Set(resolvedChars)).filter(c => c !== playerName) as string[];

            useGameStore.getState().setActiveCharacters(uniqueChars);
            console.log("Active Characters Updated:", uniqueChars);
        }

        // [New] Dead Character Processing
        if (logicResult.post_logic?.dead_character_ids) {
            const deadList = logicResult.post_logic.dead_character_ids;
            if (Array.isArray(deadList) && deadList.length > 0) {
                const store = useGameStore.getState();
                deadList.forEach((id: string) => {
                    // Prevent duplicates in logic (Store handles it too but safe to check)
                    if (!store.deadCharacters?.includes(id)) {
                        if (store.addDeadCharacter) {
                            store.addDeadCharacter(id);
                            addToast(`Character Defeated: ${id}`, 'warning');
                            console.log(`[Death] Character ${id} marked as dead.`);
                        }
                    }
                });
            }
        }

        // [New] Character Memories Update
        // Fix: content is nested in post_logic
        const memorySource = logicResult.post_logic?.character_memories || logicResult.character_memories;

        if (memorySource) {
            console.log("Processing Character Memories:", logicResult.character_memories); // [DEBUG]
            const store = useGameStore.getState();
            const availableChars = store.availableCharacterImages || [];
            const playerStats = store.playerStats;

            Object.entries(memorySource).forEach(([charId, memories]) => {
                if (!Array.isArray(memories) || memories.length === 0) return;

                // Resolve ID (Fuzzy Match + Player Map)
                let targetId = charId;

                // Handle Player Aliases
                if (['player', 'me', 'i', 'myself', '나', '자신', '플레이어', '본인'].includes(charId.toLowerCase())) {
                    targetId = useGameStore.getState().playerName || 'Player'; // Use actual player name
                } else {
                    // [Fix] Resolve ID against Character Data Keys (Primary) to prevent Phantom Entries
                    const dataKeys = Object.keys(store.characterData);

                    // 1. Try match against Data Keys first (Name-based)
                    let match = findBestMatch(charId, dataKeys);

                    // 2. Reverse Lookup via Maps (Asset ID -> Data Key)
                    // If the AI output an Asset ID (e.g. "NamgungSeAh") instead of Name ("남궁세아")
                    if (!match) {
                        const potentialAssetId = findBestMatch(charId, availableChars) || charId;

                        // Helper to find key for value
                        const findKeyForValue = (map: Record<string, string> | undefined, val: string) => {
                            if (!map) return null;
                            return Object.keys(map).find(key => map[key] === val && dataKeys.includes(key));
                        };

                        const mappedKey = findKeyForValue(store.characterMap, potentialAssetId)
                            || findKeyForValue(store.extraMap, potentialAssetId);

                        if (mappedKey) {
                            match = mappedKey;
                            console.log(`[ID Resolution] Resolved ${charId} -> ${potentialAssetId} -> ${mappedKey}`);
                        }
                    }

                    // 3. Fallback: Asset ID
                    if (!match) {
                        match = findBestMatch(charId, availableChars);
                    }

                    if (match) targetId = match;
                }

                console.log(`[MemoryUpdate] Adding memory to ${targetId} (raw: ${charId}):`, memories);

                // Update Store
                store.addCharacterMemory(targetId, memories[0]);
                if (memories.length > 1) {
                    for (let i = 1; i < memories.length; i++) {
                        store.addCharacterMemory(targetId, memories[i]);
                    }
                }

                // [Optimization] Check & Summarize Memory if > 10
                // We use fire-and-forget async call
                const freshState = useGameStore.getState();
                const currentMemories = freshState.characterData[targetId]?.memories || [];
                if (currentMemories.length > 10) {
                    serverGenerateCharacterMemorySummary(targetId, currentMemories)
                        .then((summaryList) => {
                            if (Array.isArray(summaryList)) {
                                useGameStore.getState().updateCharacterData(targetId, { memories: summaryList });
                                console.log(`[Memory] Summarized ${targetId}: ${currentMemories.length} -> ${summaryList.length}`);
                                // Optional: addToast(`Memories Consolidated: ${targetId}`, 'info');
                            }
                        })
                        .catch(err => console.warn(`[Memory] Summary Failed for ${targetId}:`, err));
                }
            });
        }

        // [New] Status & Personality Description Updates (Natural Language)
        if (logicResult.statusDescription) {
            useGameStore.getState().setStatusDescription(logicResult.statusDescription);
        }
        if (logicResult.personalityDescription) {
            useGameStore.getState().setPersonalityDescription(logicResult.personalityDescription);
        }

        // [New] Event System Check
        // Check events based on the NEW stats
        const triggeredEvents = EventManager.checkEvents({
            ...useGameStore.getState(),
            playerStats: newStats // Use the updated stats for checking
        });

        // [CRITICAL FIX] Merge Server-Side Logic Events with Client-Side triggers
        // If Logic Model explicitly returned a 'triggerEventId' and 'currentEvent' prompt, we MUST process it.
        // This fixes the issue where 'wuxia_intro' (triggered by LLM) was ignored by client.

        let activeEventPrompt = '';
        let hasActiveEvent = false;

        // 1. Prioritize Server-Side Event (Narrative Logic)
        // 1. Prioritize Server-Side Event (Narrative Logic)
        if (logicResult.triggerEventId) { // [Fix] Removed check for .currentEvent which is usually null
            console.log(`[Validating Logic] Server triggered event ID: ${logicResult.triggerEventId}`);

            // Lookup the event prompt from the Store
            const storedEvents = useGameStore.getState().events || [];
            const matchedEvent = storedEvents.find((e: any) => e.id === logicResult.triggerEventId);

            if (matchedEvent) {
                // Add to triggered list (so it doesn't trigger again if 'once')
                useGameStore.getState().addTriggeredEvent(logicResult.triggerEventId);

                // Set as current prompt
                activeEventPrompt = matchedEvent.prompt;
                hasActiveEvent = matchedEvent.id; // Store ID as truthy value

                addToast(`Event Triggered: ${matchedEvent.id}`, 'info');
                console.log(`[Event Found] Prompt Length: ${matchedEvent.prompt.length}`);
            } else {
                console.warn(`[Logic Error] Triggered ID '${logicResult.triggerEventId}' not found in Event Registry.`);
            }
        }

        // 2. Client-Side Stat Events (e.g. Low HP, Injuries)
        if (triggeredEvents.length > 0) {
            console.log("Client Events Triggered:", triggeredEvents.map(e => e.id));

            triggeredEvents.forEach(event => {
                // If it's the SAME event as server (duplicate), skip adding prompt again
                if (event.id === logicResult.triggerEventId) return;

                if (event.once) {
                    useGameStore.getState().addTriggeredEvent(event.id);
                }

                // Append prompt
                activeEventPrompt += (activeEventPrompt ? '\n\n' : '') + event.prompt;
                hasActiveEvent = true;
            });

            if (!logicResult.triggerEventId) {
                addToast(`${triggeredEvents.length} Event(s) Triggered`, 'info');
            }
        }

        if (hasActiveEvent) {
            console.log(`[VisualNovelUI] Setting Current Event Prompt (Length: ${activeEventPrompt.length})`);
            useGameStore.getState().setCurrentEvent(activeEventPrompt);
            // Optionally set active event object if needed for UI, prioritizing Server one if available
            // For now, just ensuring the PROMPT is set is key for the Story Model.
        } else {
            // Clear active event if none triggered
            useGameStore.getState().setActiveEvent(null);
            useGameStore.getState().setCurrentEvent('');
        }
    };

    // [New] Text Message Auto-Save Logic
    const lastSavedMessageRef = useRef<string | null>(null);

    useEffect(() => {
        if (currentSegment && currentSegment.type === 'text_message') {
            const msgId = `${currentSegment.character}-${currentSegment.content.slice(0, 10)}`;
            if (lastSavedMessageRef.current !== msgId) {
                lastSavedMessageRef.current = msgId;
                useGameStore.getState().addTextMessage(
                    currentSegment.character || 'Unknown',
                    {
                        sender: currentSegment.character || 'Unknown',
                        content: currentSegment.content,
                        timestamp: Date.now()
                    }
                );
                console.log(`[TextHistory] Saved message from ${currentSegment.character}`);
            }
        }
    }, [currentSegment]);

    return (
        <div
            className="relative w-full h-screen bg-black overflow-hidden font-sans select-none flex justify-center"
            onClick={(e) => {
                handleScreenClick(e);
            }}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Game Container - Enforce Max 16:9 Aspect Ratio (Landscape) & Max 2:3 (Portrait) */}
            <div className="relative w-full h-full max-w-[177.78vh] shadow-2xl overflow-hidden bg-black flex flex-col">

                {/* Visual Area (Background + Character) */}
                {/* Visual Area (Background + Character) */}
                {/* Visual Area (Background + Character) */}
                <div
                    className="relative w-full bg-black shrink-0 mx-auto visual-container transition-all duration-500 ease-out overflow-hidden"
                    style={{
                        filter: choices.length > 0 ? 'blur(8px)' : 'none',
                        transform: choices.length > 0 ? 'scale(1.02)' : 'scale(1)' // Slight zoom for effect
                    }}
                >
                    <style jsx>{`
                        .visual-container {
                            width: 100%;
                            /* Default: 16:9 aspect ratio */
                            aspect-ratio: 16/9;
                        }
                        @media (max-aspect-ratio: 16/9) {
                            .visual-container {
                                /* In portrait/narrow, fill height fully */
                                aspect-ratio: unset;
                                height: 100%;
                                width: 100%;
                            }
                        }
                    `}</style>

                    {/* [Fixed] Inner Motion Wrapper for Shake Effect (Decoupled from Scale) */}
                    <motion.div
                        className="absolute inset-0 w-full h-full"
                        animate={damageEffect ? {
                            x: [0, -20 * damageEffect.intensity, 20 * damageEffect.intensity, -10 * damageEffect.intensity, 10 * damageEffect.intensity, 0],
                            transition: { duration: damageEffect.duration / 1000 }
                        } : { x: 0 }}
                    >

                        {/* Background Layer */}
                        <div
                            className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out"
                            style={{
                                backgroundImage: `url(${getBgUrl(currentBackground)})`,
                                filter: 'brightness(0.6)'
                            }}
                        />

                        {/* Character Layer */}
                        <AnimatePresence>
                            {characterExpression && (
                                <motion.div
                                    key={characterExpression}
                                    initial={isSameCharacter ? { opacity: 0, scale: 1, y: 0, x: "-50%" } : { opacity: 0, scale: 0.95, y: 20, x: "-50%" }}
                                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                                    exit={{ opacity: 0, scale: 1, y: 0, x: "-50%" }}
                                    transition={{ duration: 0.5 }}
                                    className="absolute bottom-0 left-1/2 h-[90%] z-0 pointer-events-none"
                                >
                                    <img
                                        src={getCharUrl(characterExpression)}
                                        alt="Character"
                                        className="h-full w-auto max-w-none object-contain drop-shadow-2xl"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            console.warn(`Failed to load character image: ${getCharUrl(characterExpression)}`);
                                        }}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>


                    {/* [New] Damage Flash Overlay (Outside shake, covers entire view) */}
                    <AnimatePresence>
                        {damageEffect && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.6 * damageEffect.intensity }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                                className="absolute inset-0 bg-red-600 z-10 pointer-events-none mix-blend-overlay"
                            />
                        )}
                    </AnimatePresence>
                </div>

                {/* [WUXIA UI OVERHAUL] Top Layer */}
                <div className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-start pointer-events-none z-50 font-sans">

                    {/* LEFT: Player Status (Avatar, Rank, Info, Stats) */}
                    <div className="relative pointer-events-auto z-50">
                        {/* Profile Background Image */}
                        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[350px] h-[270px] md:w-[520px] md:h-[390px] z-0 pointer-events-none -ml-16 md:-ml-24 -mt-4">
                            <img
                                src="/assets/wuxia/interface/UI_ProfileBG.png"
                                alt="Profile BG"
                                className="w-full h-full object-contain drop-shadow-2xl"
                            />
                        </div>

                        <div className="flex gap-3 md:gap-5 items-start relative z-10">

                            {/* Column 1: Avatar & Rank */}
                            <div className="flex flex-col items-center gap-[-10px]">
                                {/* Avatar */}
                                <div
                                    className="relative group cursor-pointer transition-transform hover:scale-105 z-20"
                                    onClick={() => setShowCharacterInfo(true)}
                                >
                                    <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border-2 border-zinc-500/30 overflow-hidden shadow-2xl relative bg-black">
                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600">
                                            {isMounted ? (
                                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-2xl">👤</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Rank Box - Below Avatar */}
                                <div className="relative z-30 -mt-6 md:-mt-8">
                                    <div className="relative flex items-center justify-center w-14 h-14 md:w-20 md:h-16">
                                        <img
                                            src="/assets/wuxia/interface/UI_RankBG.png"
                                            alt="Rank BG"
                                            className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement!.classList.add('bg-red-900/90', 'border-2', 'border-red-500', 'rounded', 'px-2');
                                            }}
                                        />
                                        <span className="relative z-10 text-base md:text-2xl font-bold text-white drop-shadow-md whitespace-nowrap font-serif tracking-widest pt-1">
                                            {(() => {
                                                const rankKey = playerStats.playerRank || '삼류';
                                                const hierarchy = martialArtsLevels as any;
                                                const rankData = hierarchy[rankKey] || hierarchy[rankKey.toLowerCase()];
                                                return (rankData?.name || rankKey).split('(')[0];
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Name, Info, Bars */}
                            <div className="flex flex-col justify-start pt-1 gap-1">

                                {/* Line 1: Name & Title */}
                                <div className="flex items-baseline gap-2 md:gap-3">
                                    <span className="text-xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-stone-200 via-amber-200 to-yellow-600 drop-shadow-sm font-serif tracking-widest leading-none pb-1">
                                        {playerName || '이름 없음'}
                                    </span>

                                    {/* Fame Title */}
                                    {(() => {
                                        const fame = playerStats.fame || 0;
                                        let titleObj = FAME_TITLES[0];
                                        for (let i = FAME_TITLES.length - 1; i >= 0; i--) {
                                            if (fame >= FAME_TITLES[i].threshold) {
                                                titleObj = FAME_TITLES[i];
                                                break;
                                            }
                                        }
                                        return (
                                            <span className="text-sm md:text-xl text-zinc-500 font-serif font-bold tracking-wide">
                                                {titleObj.title}
                                            </span>
                                        );
                                    })()}
                                </div>

                                {/* Line 2: Faction & Neigong */}
                                <div className="flex items-center gap-2 text-xs md:text-base text-zinc-400 font-medium tracking-wide -mt-1">
                                    <span>소속: {(playerStats.faction || '무소속').split(' ')[0]}</span>
                                    <span className="text-zinc-600">|</span>
                                    <span>내공 {(playerStats.neigong || 0).toLocaleString()}년</span>
                                </div>

                                {/* Line 3: Stats Bars (HP & MP) */}
                                <div className="flex flex-col gap-1 mt-1 md:mt-2">
                                    {/* HP Bar */}
                                    <div className="w-32 md:w-56 h-2 md:h-3 rounded-full overflow-hidden relative shadow-inner flex bg-black/50">
                                        {/* Background */}
                                        <div className="absolute inset-0 bg-red-900/20" />
                                        {/* Fill */}
                                        <div
                                            className="h-full bg-gradient-to-r from-red-800 via-red-600 to-red-500 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                                            style={{ width: `${Math.min(100, (playerStats.hp / playerStats.maxHp) * 100)}%` }}
                                        />
                                    </div>

                                    {/* MP Beads */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-0.5 md:gap-1">
                                            {Array.from({ length: 10 }).map((_, i) => {
                                                const currentMpPerc = (playerStats.mp / playerStats.maxMp) * 100;
                                                const beadThreshold = (i + 1) * 10;
                                                // More lenient checking for full beads
                                                const isActive = currentMpPerc >= beadThreshold - 5;
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`w-2.5 h-2.5 md:w-4 md:h-4 rounded-full transition-all duration-300
                                                    ${isActive
                                                                ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)] scale-100'
                                                                : 'bg-zinc-800/80 border border-zinc-700/50 scale-90'
                                                            }`}
                                                        style={isActive ? {
                                                            background: 'radial-gradient(circle at 30% 30%, #60a5fa 0%, #2563eb 60%, #1d4ed8 100%)'
                                                        } : {}}
                                                    />
                                                );
                                            })}
                                        </div>

                                        {/* Fatigue Icon (Small) */}
                                        <div className="relative group cursor-help ml-1">
                                            {(() => {
                                                const fat = playerStats.fatigue || 0;
                                                const level = FATIGUE_LEVELS.find(l => fat >= l.min && fat <= l.max) || FATIGUE_LEVELS[2];
                                                return (
                                                    <span className="text-sm md:text-lg animate-pulse" title={`피로도: ${fat}%`}>
                                                        {level.icon}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* [New] Active Injuries Row (Integrated below stats) */}
                                {playerStats.active_injuries && playerStats.active_injuries.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1 max-w-[200px] md:max-w-xs">
                                        {playerStats.active_injuries.map((injury, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-1 px-1.5 py-0.5 bg-red-950/80 border border-red-500/50 rounded text-xs text-red-100"
                                            >
                                                <span>🩹</span>
                                                <span>{injury}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Resources & Time */}
                    <div className="pointer-events-auto flex flex-col items-end gap-1 md:gap-2">

                        {/* Row 1: Resources & Settings */}
                        <div className="flex items-center gap-2 md:gap-3">
                            {/* Gold (Yeopjeon) */}
                            <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-black/40 backdrop-blur-sm rounded-full border border-yellow-900/30">
                                <span className="text-sm md:text-lg">💰</span>
                                <span className="text-yellow-100 font-mono font-bold text-xs md:text-sm">
                                    {(playerStats.gold || 0).toLocaleString()}
                                </span>
                            </div>

                            {/* Cash (Wonbo/Spirit Stone) */}
                            <div className="flex items-center gap-1.5 px-2 md:px-3 py-1 bg-black/40 backdrop-blur-sm rounded-full border border-blue-900/30 cursor-pointer hover:bg-black/60"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newCoins = userCoins + 50;
                                    setUserCoins(newCoins);
                                    addToast("영석 50개 충전 (테스트)", 'success');
                                }}
                            >
                                <span className="text-sm md:text-lg">💎</span>
                                <span className="text-blue-200 font-mono font-bold text-xs md:text-sm">
                                    {userCoins.toLocaleString()}
                                </span>
                            </div>

                            {/* Settings Button */}
                            <button
                                aria-label="Settings"
                                onClick={() => setShowResetConfirm(true)}
                                className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-white/10 transition-colors shadow-lg"
                            >
                                <Settings className="w-4 h-4 md:w-5 md:h-5" />
                            </button>

                            {/* Debug Button (Localhost Only) */}
                            {isLocalhost && (
                                <>
                                    <button
                                        onClick={() => {
                                            console.log("[Debug] Manually triggering damage effect");
                                            setDamageEffect({ intensity: 1.0, duration: 500 });
                                            setTimeout(() => setDamageEffect(null), 500);
                                            addToast("테스트 데미지 효과 발동", 'warning');
                                        }}
                                        className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-900/50 backdrop-blur-md flex items-center justify-center text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors shadow-lg"
                                        title="Test Damage Effect"
                                    >
                                        ⚡
                                    </button>
                                    <button
                                        onClick={() => setIsDebugOpen(true)}
                                        className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-900/50 backdrop-blur-md flex items-center justify-center text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors shadow-lg"
                                    >
                                        <Bolt className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Row 2: Date & Time */}
                        <div className="flex items-center gap-2 font-serif tracking-wide text-zinc-300 text-sm md:text-xl relative z-10 backdrop-blur-[2px] bg-black/20 rounded px-2 py-1">
                            <span className="text-emerald-400 font-bold drop-shadow-sm">{day || 1}일차</span>
                            <span className="w-px h-3 bg-zinc-600/60" />
                            <span className="drop-shadow-sm">
                                {(() => {
                                    const wuxiaTime: Record<string, { name: string, time: string }> = {
                                        morning: { name: '진시(辰)', time: '09:00' },
                                        afternoon: { name: '미시(未)', time: '14:00' },
                                        evening: { name: '술시(戌)', time: '20:00' },
                                        night: { name: '자시(子)', time: '00:00' },
                                        dawn: { name: '인시(寅)', time: '04:00' }
                                    };
                                    const t = wuxiaTime[(time || 'morning').toLowerCase()];
                                    return t ? `${t.name} ${t.time}` : (time || '').replace(/^\d+일차\s*/, '');
                                })()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Status Message (Center Toast) */}
                <AnimatePresence>
                    {statusMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="absolute top-[20%] left-1/2 transform -translate-x-1/2 z-[80] pointer-events-none"
                        >
                            <div className="bg-black/80 backdrop-blur-md text-white border border-white/20 px-6 py-2 rounded-full shadow-2xl flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-sm md:text-base font-medium tracking-wide">{statusMessage}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Persistent Bottom Controls (History/Save) - Always visible Z-50 -> Z-20 (Basic UI) */}
                <div className="absolute bottom-[5vh] right-[4vw] md:bottom-10 md:right-8 flex gap-[1vw] md:gap-2 z-40 opacity-50 hover:opacity-100 transition-opacity pointer-events-auto">
                    <button
                        className="px-[3vw] py-[1vh] md:px-3 md:py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-[2.5vw] md:text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-[1vw] md:gap-1"
                        onClick={(e) => { e.stopPropagation(); setShowHistory(true); }}
                    >
                        <History className="w-[3vw] h-[3vw] md:w-[14px] md:h-[14px]" />
                        {t.chatHistory}
                    </button>
                    <button
                        className="px-[3vw] py-[1vh] md:px-3 md:py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-[2.5vw] md:text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-[1vw] md:gap-1"
                        onClick={(e) => { e.stopPropagation(); setShowSaveLoad(true); }}
                    >
                        <Save className="w-[3vw] h-[3vw] md:w-[14px] md:h-[14px]" />
                        {t.save}
                    </button>
                    <button
                        className="px-[3vw] py-[1vh] md:px-3 md:py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-[2.5vw] md:text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-[1vw] md:gap-1"
                        onClick={(e) => { e.stopPropagation(); setShowWiki(true); }}
                    >
                        <Book className="w-[3vw] h-[3vw] md:w-[14px] md:h-[14px]" />
                        {(t as any).wiki || "Wiki"}
                    </button>
                </div>

                {/* Wiki Modal */}
                <WikiSystem
                    isOpen={showWiki}
                    onClose={() => setShowWiki(false)}
                    initialCharacter={useGameStore.getState().activeGameId === 'wuxia' ? "연화린" : "고하늘"}
                />

                {/* Smartphone App */}
                <SmartphoneApp
                    isOpen={isPhoneOpen}
                    onClose={() => setIsPhoneOpen(false)}
                />

                {/* Settings Modal (Replaces Reset Confirm) */}
                <AnimatePresence>
                    {showResetConfirm && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-white/95 border border-white/20 w-full max-w-lg p-6 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex flex-col gap-6 max-h-[90vh] overflow-y-auto backdrop-blur-xl">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <Settings className="w-5 h-5 text-blue-600" />
                                        </div>
                                        {(t as any).settings || "Settings"}
                                    </h3>
                                    <button onClick={() => setShowResetConfirm(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Account Section */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                        <span>👤</span> {(t as any).account || "Account"}
                                    </h4>

                                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200/60 shadow-inner">
                                        {/* Model Selector */}
                                        <div className="mb-4 pb-4 border-b border-gray-200">
                                            <label className="text-secondary text-xs uppercase font-bold tracking-wider mb-2 block">Story Model</label>
                                            <div className="grid grid-cols-1 gap-2">
                                                {[
                                                    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', desc: 'Highest Quality', cost: '$12.00/1M' },
                                                    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', desc: 'High Speed', cost: '$3.00/1M' }
                                                ].map((model) => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => useGameStore.getState().setStoryModel(model.id)}
                                                        className={`p-3 rounded-lg border text-left transition-all flex justify-between items-center ${useGameStore.getState().storyModel === model.id
                                                            ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <div>
                                                            <div className="font-bold text-sm">{model.name}</div>
                                                            <div className="text-xs opacity-70">{model.desc}</div>
                                                        </div>
                                                        <div className="text-xs font-mono bg-black/5 px-2 py-1 rounded">{model.cost}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {session?.user ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    {session.user.user_metadata?.avatar_url ? (
                                                        <img
                                                            src={session.user.user_metadata.avatar_url}
                                                            alt="Avatar"
                                                            className="w-10 h-10 rounded-full border border-gray-600"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg">
                                                            👤
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col text-sm overflow-hidden">
                                                        <span className="text-gray-900 font-bold truncate text-base">{session.user.email}</span>
                                                        <span className="text-gray-400 text-xs truncate font-mono">ID: {session.user.id.slice(0, 8)}...</span>
                                                    </div>
                                                    <div className="ml-auto flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100/50 shadow-sm shrink-0">
                                                        <span className="text-xs">💰</span>
                                                        <span className="font-mono text-sm font-bold">{userCoins?.toLocaleString() || 0}</span>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-gray-200" />

                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm("정말 로그아웃 하시겠습니까?")) {
                                                                if (!supabase) {
                                                                    console.warn("Supabase client not available for logout.");
                                                                    return;
                                                                }
                                                                const { error } = await supabase.auth.signOut();
                                                                if (error) {
                                                                    alert("로그아웃 중 오류가 발생했습니다: " + error.message);
                                                                    console.error("Logout error:", error);
                                                                } else {
                                                                    setSession(null);
                                                                    window.location.href = '/';
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
                                                                    setIsProcessing(true);
                                                                    try {
                                                                        const { deleteAccount } = await import('@/app/actions/auth');
                                                                        const result = await deleteAccount();
                                                                        if (result.success) {
                                                                            localStorage.clear(); // [CLEANUP] Clear all local data to prevent ghost state
                                                                            alert("탈퇴가 완료되었습니다. 모든 데이터가 삭제되었습니다.");
                                                                            window.location.href = '/';
                                                                        } else {
                                                                            alert("오류가 발생했습니다: " + result.error);
                                                                        }
                                                                    } catch (e) {
                                                                        console.error("Delete failed:", e);
                                                                        alert("처리 중 알 수 없는 오류가 발생했습니다.");
                                                                    } finally {
                                                                        setIsProcessing(false);
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
                                            <div className="text-center py-2 text-gray-500 text-sm">
                                                Guest Mode (Login required for cloud save)
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Danger Zone */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                                        <span>⚠</span> Danger Zone
                                    </h4>
                                    <div className="bg-red-50 p-5 rounded-xl border border-red-100 shadow-inner">
                                        <p className="text-gray-500 text-sm mb-4">
                                            현재 진행 상황을 모두 잃고 메인 화면으로 돌아갑니다.
                                        </p>
                                        <button
                                            onClick={() => {
                                                if (confirm("정말 게임을 초기화하시겠습니까? 저장되지 않은 진행 상황은 잃게 됩니다.")) {
                                                    useGameStore.getState().resetGame();
                                                    router.push('/');
                                                }
                                            }}
                                            className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                                        >
                                            게임 초기화 (Reset Game)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Top Right Menu (Removed - Merged into Top Resources Row & Profile Click) */}

                {/* Toast Notifications */}
                <div className="fixed top-24 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                    <AnimatePresence>
                        {toasts.map(toast => (
                            <motion.div
                                key={toast.id}
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 50 }}
                                className={`px-6 py-3 rounded-lg shadow-lg backdrop-blur-md border-l-4 text-white font-bold min-w-[200px]
                                ${toast.type === 'success' ? 'bg-green-900/80 border-green-500' :
                                        toast.type === 'warning' ? 'bg-red-900/80 border-red-500' :
                                            'bg-blue-900/80 border-blue-500'}`}
                            >
                                {toast.message}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Center: Choices */}
                {
                    choices.length > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-auto z-[60] p-4">
                            <div className="flex flex-col gap-3 md:gap-4 w-[85vw] md:w-[min(50vw,800px)] items-center">
                                {/* [NEW] Turn Summary Display */}
                                {turnSummary && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="w-full bg-black/80 border-l-4 border-yellow-500 rounded-r-lg p-4 mb-2 backdrop-blur-sm shadow-lg max-w-2xl"
                                    >
                                        <h4 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-1">Current Situation</h4>
                                        <p className="text-gray-200 text-sm leading-relaxed">{turnSummary}</p>
                                    </motion.div>
                                )}
                                {choices.map((choice, idx) => (
                                    <motion.button
                                        key={idx}
                                        initial={{ opacity: 0, y: 20, skewX: -12 }}
                                        animate={{ opacity: 1, y: 0, skewX: -12 }}
                                        whileHover={!isProcessing ? { scale: 1.05, skewX: -12 } : {}}
                                        transition={{ delay: idx * 0.1 }}
                                        disabled={isProcessing || isLogicPending}
                                        /* 
                                         * [Responsive Logic]
                                         * Mobile: Scaled down to ~60% size
                                         * Width: 85vw, Text: 2.5vw, Padding: 1.2vh
                                         * Desktop: Unchanged
                                         */
                                        className={`w-full bg-gradient-to-r from-white/50 to-slate-100/70 backdrop-blur-md rounded-2xl border border-white/80 text-slate-700 font-bold 
                                            w-[85vw] md:w-[min(50vw,1200px)] 
                                            py-[1.2vh] px-[5vw] md:py-[1.5vh] md:px-[min(2vw,48px)] 
                                            text-[2.5vw] md:text-[min(0.9vw,27px)] leading-tight 
                                            shadow-[0_0_15px_rgba(71,85,105,0.5)] transition-all duration-300
                                            ${(isProcessing || isLogicPending) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-white/90 hover:text-slate-900 hover:border-white'}
                                        `}
                                        onClick={(e) => {
                                            if (isProcessing || isLogicPending) return;
                                            console.log("Choice clicked:", choice.content);
                                            e.stopPropagation();

                                            // [LOGGING] Handled in handleSend


                                            handleSend(choice.content);
                                        }}
                                    >
                                        <span className="block transform skew-x-12">
                                            {choice.content}
                                        </span>
                                    </motion.button>
                                ))}

                                {/* Direct Input Option */}
                                <motion.button
                                    initial={{ opacity: 0, y: 20, skewX: -12 }}
                                    animate={{ opacity: 1, y: 0, skewX: -12 }}
                                    whileHover={{ scale: 1.05, skewX: -12 }}
                                    transition={{ delay: choices.length * 0.1 }}
                                    className={`w-full bg-gradient-to-r from-slate-100/50 to-white/50 backdrop-blur-md rounded-2xl border border-white/60 text-slate-700 font-bold 
                                        w-[85vw] md:w-[min(50vw,1200px)] 
                                        py-[1.2vh] px-[5vw] md:py-[1.5vh] md:px-[min(2vw,48px)] 
                                        text-[2.5vw] md:text-[min(0.9vw,27px)] leading-tight 
                                        shadow-[0_0_15px_rgba(71,85,105,0.5)] transition-all duration-300
                                        ${(isProcessing || isLogicPending) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-white/80 hover:border-white'}
                                    `}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isProcessing || isLogicPending) return;
                                        setIsInputOpen(true);
                                    }}
                                >
                                    <span className="block transform skew-x-12">
                                        {t.directInput}
                                    </span>
                                </motion.button>

                                {/* [NEW] System Menu Bar (Profile, History, Wiki, Save, Settings) */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="flex w-[85vw] md:w-[min(50vw,1200px)] justify-center gap-3 md:gap-4 mt-2"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {[
                                        { icon: <User size={20} />, label: "프로필", onClick: () => setShowCharacterInfo(true) },
                                        { icon: <History size={20} />, label: "지난 대화", onClick: () => setShowHistory(true) },
                                        { icon: <Book size={20} />, label: "위키", onClick: () => setShowWiki(true) },
                                        { icon: <Save size={20} />, label: "저장/로드", onClick: () => setShowSaveLoad(true) },
                                        { icon: <Settings size={20} />, label: "설정", onClick: () => setShowResetConfirm(true) },
                                    ].map((btn, i) => (
                                        <button
                                            key={i}
                                            onClick={(e) => { e.stopPropagation(); btn.onClick(); }}
                                            className="p-3 md:p-3 rounded-full bg-black/60 border border-white/20 text-white hover:bg-white/20 hover:scale-110 hover:border-white transition-all backdrop-blur-md shadow-lg group relative"
                                            title={btn.label}
                                        >
                                            {btn.icon}
                                            {/* Tooltip */}
                                            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 border border-white/20 px-2 py-1 rounded pointer-events-none">
                                                {btn.label}
                                            </span>
                                        </button>
                                    ))}
                                </motion.div>
                            </div>
                        </div>
                    )
                }

                {/* Fallback for stuck state or Start Screen */}
                {
                    isMounted && !currentSegment && choices.length === 0 && scriptQueue.length === 0 && !isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-[100]">
                            {chatHistory.length === 0 ? (
                                // Creation or Start Screen
                                (() => {
                                    const creationQuestions = useGameStore.getState().characterCreationQuestions;
                                    const { playerName } = useGameStore.getState();

                                    // If we have creation questions and we haven't finished creation (checked by simple local state or similar)
                                    // Actually, we use 'creationStep' state. If it's < creationQuestions.length, show question.
                                    if (creationQuestions && creationQuestions.length > 0) {
                                        // [Refactor] Step 0 is Name Input, Questions start at Step 1
                                        const isNameStep = creationStep === 0;
                                        const questionIndex = creationStep - 1;
                                        const currentQuestion = isNameStep ? null : creationQuestions[questionIndex];

                                        const handleOptionSelect = (qId: string, value: string) => {
                                            const updatedData = { ...creationData, [qId]: value };
                                            setCreationData(updatedData);

                                            if (questionIndex < creationQuestions.length - 1) {
                                                setCreationStep(prev => prev + 1);
                                            } else {
                                                // Finished
                                                // Construct Prompt
                                                // 1. Format Profile
                                                let profileText = "사용자 캐릭터 프로필:\n";
                                                Object.entries(updatedData).forEach(([key, val]) => {
                                                    // Find label for better context? Or just use value.
                                                    // Let's use the value codes for simplicity, AI understands context if I provide key.
                                                    // Better: Find the label corresponding to value
                                                    const q = creationQuestions.find(q => q.id === key);
                                                    const opt = q?.options.find((o: any) => o.value === val);
                                                    profileText += `- ${q?.id}: ${opt?.label || val}\n`;
                                                });

                                                // [Default Name Logic]
                                                const activeGameId = useGameStore.getState().activeGameId;
                                                let finalName = playerName;
                                                if (activeGameId === 'wuxia') {
                                                    if (!finalName || finalName.trim() === '' || finalName === '주인공') {
                                                        finalName = '무명';
                                                        useGameStore.getState().setPlayerName(finalName);
                                                    }
                                                }

                                                // [GOD MODE CHECK]
                                                if (finalName === '김현준갓모드') {
                                                    finalName = '김현준';
                                                    useGameStore.getState().setPlayerName(finalName);
                                                    useGameStore.getState().setGodMode(true);
                                                    addToast("😇 God Mode Activated", "success");
                                                }

                                                profileText += `이름: ${finalName || playerName || '성현우'}\n`;

                                                const prompt = `
[SYSTEM: Game Start Protocol]
The player has created a new character with the following profile:
${profileText}

Instructions:
1. Ignore any previous static Start Scenario.
2. Start the story immediately from the Prologue or Chapter 1.
3. Reflect the chosen Identity, Goal, Specialty, and Personality in the narrative.
4. STRICTLY RESPECT the chosen 'Narrative Perspective' (e.g., if '1인칭', use '나'/'내' (I/My) exclusively. Do NOT use '당신' (You)).
5. Output the first scene now.
`;
                                                // Call handleSend with isDirectInput=true (hidden from history usually? No, handleSend adds to history)
                                                // We want this to be a system instruction.
                                                // But handleSend treats input as User Message.
                                                // Let's manually add a system message to history OR just send it as user message but formatted as System.
                                                // The AI prompt handles [SYSTEM] tags well usually.

                                                // [Fix] handleSend(prompt, true) adds it as user message.
                                                // We will add a "System" message to history manually first? 
                                                // Actually, let's just use handleSend but maybe show a different toast.

                                                // [Fix] Update Player Stats with Start Choices (Optimistic)
                                                // [CRITICAL] RESET ALL PERSISTENT DATA FOR NEW GAME
                                                const newStats = {
                                                    ...useGameStore.getState().playerStats,
                                                    skills: [],        // Clear Skills
                                                    inventory: [],     // Clear Inventory
                                                    relationships: {}, // Clear Relationships
                                                    fame: 0,           // Reset Fame
                                                    fate: 0,           // Reset Fate
                                                    level: 1,          // Reset Level
                                                    exp: 0,            // Reset EXP
                                                    hp: useGameStore.getState().playerStats.maxHp, // Full HP
                                                    mp: useGameStore.getState().playerStats.maxMp, // Full MP
                                                    martialArts: [] as any[],   // Clear Martial Arts (Fix Type)
                                                    neigong: 0,        // Reset Neigong
                                                    gold: 0,           // Reset Gold
                                                };

                                                // [보너스 적용] 욕망 (4번째 질문)
                                                const desire = updatedData['desire_type'];
                                                if (desire === 'money') {
                                                    newStats.gold = (newStats.gold || 0) + 500;
                                                    addToast("보너스: 초기 자금 500냥 획득!", "success");
                                                } else if (desire === 'neigong') {
                                                    newStats.neigong = (newStats.neigong || 0) + 10;
                                                    addToast("보너스: 초기 내공 10년 획득!", "success");
                                                } else if (desire === 'martial_arts') {
                                                    const basicSword = {
                                                        id: 'basic_sword',
                                                        name: '삼재검법',
                                                        rank: '삼류',
                                                        type: '검법',
                                                        description: '기초적인 검법. 찌르기, 베기, 막기의 기본이 담겨있다.',
                                                        proficiency: 50,
                                                        effects: ['기본 공격력 상승'],
                                                        createdTurn: 0
                                                    };
                                                    newStats.martialArts = [...(newStats.martialArts || []), basicSword];
                                                    // Also add to skills string list
                                                    newStats.skills = [...(newStats.skills || []), '삼재검법'];
                                                    addToast("보너스: 삼재검법 습득!", "success");
                                                } else if (desire === 'love') {
                                                    // [Randomize Heroine]
                                                    const HEROINE_CANDIDATES = [
                                                        '연화린', '백소유', '화영', '남궁세아', '모용예린',
                                                        '당소율', '제갈연주', '주예서', '천예령', '한설희'
                                                    ];
                                                    const randomHeroine = HEROINE_CANDIDATES[Math.floor(Math.random() * HEROINE_CANDIDATES.length)];

                                                    newStats.relationships = { [randomHeroine]: 30 };
                                                    addToast(`보너스: ${randomHeroine}와의 소꿉친구 인연 형성!`, "success");
                                                } else if (desire === 'fame') {
                                                    newStats.fame = (newStats.fame || 0) + 500;
                                                    addToast("보너스: 초기 명성 500 획득!", "success");
                                                }

                                                // [Bonus Application] Personality (1문)
                                                const pLink = newStats.personality || {};
                                                const pTone = updatedData['personality_tone'];
                                                if (pTone === 'humorous') {
                                                    pLink.warmth = (pLink.warmth || 0) + 10;
                                                    pLink.energy = (pLink.energy || 0) + 10;
                                                    pLink.humor = (pLink.humor || 0) + 20; // Explicitly humorous
                                                } else if (pTone === 'serious') {
                                                    pLink.decision = (pLink.decision || 0) + 10;
                                                    pLink.lifestyle = (pLink.lifestyle || 0) + 5;
                                                } else if (pTone === 'cynical') {
                                                    pLink.decision = (pLink.decision || 0) + 5;
                                                    pLink.morality = (pLink.morality || 0) - 5;
                                                } else if (pTone === 'timid') {
                                                    pLink.lifestyle = (pLink.lifestyle || 0) + 10;
                                                    pLink.courage = (pLink.courage || 0) - 5;
                                                } else if (pTone === 'domineering') {
                                                    pLink.leadership = (pLink.leadership || 0) + 10;
                                                    pLink.warmth = (pLink.warmth || 0) - 5;
                                                }
                                                newStats.personality = pLink;

                                                // [Bonus Application] Final Goal (5문)
                                                // Stored for Narrative Guidance in PreLogic
                                                if (updatedData['final_goal']) {
                                                    newStats.final_goal = updatedData['final_goal'];
                                                }

                                                // Map creation keys to stats if needed
                                                // creationData keys: 'identity', 'goal', 'specialty', 'personality', 'story_perspective'
                                                if (updatedData['narrative_perspective']) {
                                                    newStats.narrative_perspective = updatedData['narrative_perspective'];
                                                }

                                                // Commit to Store
                                                useGameStore.getState().setPlayerStats(newStats);
                                                console.log("[Start] Applied Initial Stats:", newStats);

                                                // Update Player Name if valid
                                                // (Already updated in store via input below)

                                                // [Fix] Pass isDirectInput=false so we don't trigger "You cannot control..." constraints
                                                // isHidden=true keeps it out of the visible chat bubble history (but logic sees it)
                                                handleSend(prompt, false, true);
                                            }
                                        };

                                        if (!isMounted) return null; // [Fix] Prevent Hydration Mismatch for Client-Only UI

                                        return (
                                            <div className="bg-black/90 p-8 rounded-xl border-2 border-yellow-500 text-center shadow-2xl backdrop-blur-md flex flex-col gap-6 items-center max-w-2xl w-full">


                                                {/* Progress */}
                                                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-yellow-500 transition-all duration-300"
                                                        style={{ width: `${((creationStep + 1) / (creationQuestions.length + 1)) * 100}%` }}
                                                    />
                                                </div>

                                                {/* Name Input (Only on first step or separate?) 
                                                    Let's put name input at the top always or just on step 0
                                                  */}
                                                {isNameStep ? (
                                                    <div className="flex flex-col items-center gap-6 w-full max-w-md animate-in fade-in zoom-in duration-500 my-4">
                                                        <h2 className="text-2xl text-yellow-400 font-bold mb-2">당신의 이름은 무엇입니까?</h2>
                                                        <div className="flex flex-col gap-2 w-full">
                                                            <label className="text-yellow-500/80 text-xs font-bold text-left uppercase tracking-wider ml-1">Name</label>
                                                            <input
                                                                type="text"
                                                                className="bg-gray-800/80 border-2 border-yellow-600/50 text-white px-6 py-4 rounded-xl focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/20 text-center text-xl font-bold placeholder-gray-500 transition-all shadow-inner"
                                                                placeholder="이름을 입력하세요"
                                                                onChange={(e) => useGameStore.getState().setPlayerName(e.target.value)}
                                                                defaultValue={playerName || ''}
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        setCreationStep(prev => prev + 1);
                                                                    }
                                                                }}
                                                            />
                                                        </div>

                                                        <button
                                                            onClick={() => setCreationStep(prev => prev + 1)}
                                                            className="mt-2 w-full px-8 py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 rounded-xl font-bold text-black text-lg shadow-lg hover:shadow-yellow-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <span>운명 시작하기</span>
                                                            <span>→</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <h2 className="text-base md:text-lg text-white font-bold leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-right-4 duration-300">
                                                            {currentQuestion?.question}
                                                        </h2>

                                                        <div className="grid grid-cols-1 w-full gap-3 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                                                            {currentQuestion?.options.map((opt: any) => {
                                                                // Check Condition
                                                                if (opt.condition) {
                                                                    const { key, value } = opt.condition;
                                                                    if (creationData[key] !== value) return null;
                                                                }

                                                                return (
                                                                    <button
                                                                        key={opt.value}
                                                                        onClick={() => currentQuestion && handleOptionSelect(currentQuestion.id, opt.value)}
                                                                        className="px-6 py-4 bg-gray-800 hover:bg-yellow-900/50 border border-gray-600 hover:border-yellow-500 rounded-lg text-left text-gray-200 hover:text-white transition-all shadow-md group active:scale-[0.99]"
                                                                    >
                                                                        <span className="font-bold text-yellow-500 mr-2 group-hover:text-yellow-300">▶</span>
                                                                        {opt.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                )}

                                                {creationStep > 0 && (
                                                    <button
                                                        onClick={() => setCreationStep(prev => prev - 1)}
                                                        className="mt-4 text-gray-500 hover:text-white text-sm"
                                                    >
                                                        이전 단계로
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }

                                    // Fallback to Standard Start Screen
                                    return (
                                        <div className="bg-black/80 p-12 rounded-xl border-2 border-yellow-500 text-center shadow-2xl backdrop-blur-md flex flex-col gap-6 items-center">
                                            <h1 className="text-4xl font-bold text-yellow-400 mb-2">Game Title</h1>
                                            <p className="text-gray-300 text-lg">Welcome to the interactive story.</p>

                                            <div className="flex flex-col gap-2 w-full max-w-xs">
                                                <label className="text-yellow-500 text-sm font-bold text-left">Player Name</label>
                                                <input
                                                    type="text"
                                                    className="bg-gray-800 border border-yellow-600 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-400 text-center"
                                                    placeholder="주인공"
                                                    onChange={(e) => useGameStore.getState().setPlayerName(e.target.value)}
                                                    defaultValue={useGameStore.getState().playerName}
                                                />
                                            </div>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleStartGame(); }}
                                                className="px-8 py-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-black text-xl shadow-[0_0_20px_rgba(234,179,8,0.5)] hover:scale-105 transition-transform animate-pulse"
                                            >
                                                Game Start
                                            </button>
                                        </div>
                                    );
                                })()
                            ) : (
                                // Error/Paused Screen
                                <div className="bg-black/80 p-8 rounded-xl border border-red-500 text-center shadow-2xl backdrop-blur-md">
                                    <h2 className="text-2xl font-bold text-red-500 mb-4">{t.scenePaused}</h2>
                                    <p className="text-gray-300 mb-6">{t.noActiveDialogue}</p>
                                    <div className="flex gap-4 justify-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleNewGame(); }}
                                            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded font-bold text-white shadow-lg hover:scale-105 transition-transform"
                                        >
                                            {t.resetGame}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsInputOpen(true); }}
                                            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded font-bold text-white shadow-lg hover:scale-105 transition-transform"
                                        >
                                            {t.continueInput}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }



                {/* Interactive Loading Indicator (Ad/Tip Overlay) */}
                <AnimatePresence>
                    {isProcessing && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 pointer-events-auto backdrop-blur-sm"
                        >
                            <div className="flex flex-col items-center gap-6 max-w-xl w-full p-8 rounded-2xl border border-yellow-500/30 bg-gray-900/90 shadow-2xl relative overflow-hidden">
                                {/* Background Glow */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />

                                {/* Spinner & Title */}
                                <div className="flex flex-col items-center gap-2 z-10">
                                    <div className="w-full flex flex-col items-center">
                                        <h3 className="text-2xl font-bold text-yellow-400 animate-pulse mb-4 tracking-widest uppercase text-center">
                                            FATE IS WEAVING
                                        </h3>
                                        <ResponseTimer avgTime={avgResponseTime} />
                                        <p className="text-xs text-gray-500 mt-4 font-mono">
                                            Average Response Time: {Math.round(avgResponseTime / 1000)}s
                                        </p>
                                    </div>
                                </div>



                                {/* Dynamic Tips (Simple Random Implementation) */}
                                <div className="bg-black/50 p-4 rounded-lg border border-gray-700 w-full text-center z-10 transition-all duration-500">
                                    <span className="text-gray-400 text-xs uppercase tracking-widest block mb-1">TIP</span>
                                    <p key={currentTipIndex} className="text-gray-200 text-sm italic animate-in fade-in slide-in-from-bottom-2 duration-700">
                                        "{LOADING_TIPS[currentTipIndex]}"
                                    </p>
                                </div>

                                {/* Interactive Ad Button */}
                                <div className="w-full z-10">
                                    {/* Local state for ad simulation would be ideal, but we can't add state inside this block easily without refactoring the whole component.
                                        So we'll use a self-contained component logic or just simple immediate reward for now?
                                        Actually, we can use a small inner component if we defined it outside, but we are inside the render.
                                        Let's try to keep it simple: Click -> 3s fake delay -> Reward. 
                                        Since I can't add state variables easily in this tool call (I'd have to edit the top of the file),
                                        I will assume I can edit the top of the file in a separate call if needed.
                                        BUT, I can use a simple trick: use state variables if I added them.
                                        
                                        Wait, I haven't added `showAd` state yet.
                                        I should have added State first.
                                        Refactoring Plan:
                                        1. Add `adState` (idle, playing, rewarded) to VisualNovelUI state.
                                        2. Implement the UI here.
                                    */}
                                    <AdButton
                                        onReward={() => {
                                            const newCoins = userCoins + 50;
                                            setUserCoins(newCoins);

                                            // Update DB
                                            if (session?.user) {
                                                if (supabase && session?.user?.id) {
                                                    supabase.from('profiles').update({ coins: newCoins }).eq('id', session.user.id).then();
                                                }
                                            }
                                            addToast("광고 보상: 50 골드 지급 완료!", "success");
                                        }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* History Modal */}
                <AnimatePresence>
                    {showHistory && (
                        <div className="fixed inset-0 bg-black/90 z-[70] flex items-start justify-center px-4 pb-4 pt-[140px] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="bg-gray-900 w-full max-w-3xl h-full rounded-xl flex flex-col border border-gray-700">
                                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-white">{t.chatHistory}</h2>
                                    <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white">{t.close}</button>
                                </div>
                                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {(useGameStore.getState().displayHistory || chatHistory).map((msg, idx, arr) => {
                                        let segments = parseScript(msg.text);
                                        // Filter future segments if this is the active message
                                        if (idx === arr.length - 1 && msg.role === 'model') {
                                            const queueLength = useGameStore.getState().scriptQueue.length;
                                            if (queueLength > 0) {
                                                const visibleCount = Math.max(0, segments.length - queueLength);
                                                segments = segments.slice(0, visibleCount);
                                            }
                                        }
                                        // [Rewind Logic]
                                        // Only allow rewind on the LATEST model message (Current Turn)
                                        // to prevent state inconsistencies (Cannot go back past choices).
                                        const canRewind = idx === arr.length - 1 && msg.role === 'model';

                                        return (
                                            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                <span className="text-sm text-gray-500 mb-2 font-bold">{msg.role === 'user' ? t.you : t.system}</span>
                                                <div className={`rounded-xl max-w-[95%] overflow-hidden ${msg.role === 'user' ? 'bg-blue-900/30 border border-blue-500/50' : 'bg-gray-800/50 border border-gray-700'}`}>
                                                    {msg.role === 'user' ? (
                                                        <div className="p-4 text-blue-100 text-lg">{msg.text}</div>
                                                    ) : (
                                                        <div className="flex flex-col divide-y divide-gray-700/50">
                                                            {segments.map((seg, sIdx) => {
                                                                if (['background', 'bgm', 'command', 'system_popup', 'choice'].includes(seg.type) && seg.type !== 'system_popup' && seg.type !== 'choice') return null;
                                                                // Allow system_popup? Existing code handles it.
                                                                // Allow choice? Maybe not in history text flow.

                                                                // Refined Logic:
                                                                if (seg.type === 'background' || seg.type === 'bgm' || seg.type === 'command') return null;

                                                                return (
                                                                    <div key={sIdx} className="p-4 relative group">
                                                                        {canRewind && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (confirm("이 시점으로 되돌아가시겠습니까?")) {
                                                                                        // 1. Re-parse full text
                                                                                        const allSegments = parseScript(msg.text);

                                                                                        // 2. Restore State Snapshot (Best Effort)
                                                                                        // Find last background/char up to this point
                                                                                        let bestBg = currentBackground;
                                                                                        let bestChar = characterExpression;

                                                                                        // Scan from 0 to sIdx to find visual state
                                                                                        for (let i = 0; i <= sIdx; i++) {
                                                                                            if (allSegments[i].type === 'background') bestBg = resolveBackground(allSegments[i].content);
                                                                                            // For char, it's harder as we need to map name_expr -> path
                                                                                            // but we can try basic check if segment has char info
                                                                                            if (allSegments[i].type === 'dialogue' && allSegments[i].character && allSegments[i].expression) {
                                                                                                // Approx: usage of general logic or just clear it?
                                                                                                // Let's rely on the script playing to set it, 
                                                                                                // BUT if we jump to middle, we might miss the 'set'
                                                                                                // Actually, if we jump to sIdx, the NEXT update happens when we play sIdx.
                                                                                                // So we just need to set the state PREVIOUS to sIdx?
                                                                                                // No, we are STARTING at sIdx.
                                                                                                // The VisualNovelUI renders based on `currentSegment`.
                                                                                                // So effectively, we just setQueue and let it play.
                                                                                                // Ideally we set BG if a specific BG tag was skipped?
                                                                                                // Let's just set Queue and Current.
                                                                                            }
                                                                                        }

                                                                                        // 3. Reset Queue
                                                                                        setCurrentSegment(allSegments[sIdx]);
                                                                                        setScriptQueue(allSegments.slice(sIdx + 1));
                                                                                        useGameStore.getState().setChoices([]); // Clear any active choices

                                                                                        // 4. Restore Background if found in previous segments of THIS turn
                                                                                        // (If we crossed a BG tag in this turn, we should ensure it's applied)
                                                                                        // Iterate 0 to sIdx and apply last found BG
                                                                                        for (let i = 0; i <= sIdx; i++) {
                                                                                            if (allSegments[i].type === 'background') {
                                                                                                setBackground(resolveBackground(allSegments[i].content));
                                                                                            }
                                                                                        }

                                                                                        setShowHistory(false);
                                                                                        addToast("이전 시점으로 되돌아갔습니다.", "success");
                                                                                    }
                                                                                }}
                                                                                className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-yellow-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
                                                                                title="이 대사부터 다시 보기 (Rewind)"
                                                                            >
                                                                                <RotateCcw size={14} />
                                                                            </button>
                                                                        )}

                                                                        {seg.type === 'dialogue' && (
                                                                            <div className="mb-1">
                                                                                <span className="text-yellow-500 font-bold text-lg">
                                                                                    {(seg.character || 'Unknown').split('(')[0].trim()}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {seg.type === 'system_popup' && (
                                                                            <div className="text-purple-400 font-bold text-center border border-purple-500/30 bg-purple-900/20 p-2 rounded">
                                                                                [SYSTEM] {seg.content}
                                                                            </div>
                                                                        )}
                                                                        <div className={`text-lg leading-relaxed ${seg.type === 'narration' ? 'text-gray-400 italic' : 'text-gray-200'}`}>
                                                                            {seg.content}
                                                                        </div>
                                                                    </div>

                                                                );
                                                            })}
                                                            {segments.length === 0 && (
                                                                <div className="p-4 text-gray-400 italic">
                                                                    {msg.text}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Inventory Modal */}
                <AnimatePresence>
                    {showInventory && (
                        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="bg-gray-900 w-full max-w-2xl h-[60vh] rounded-xl flex flex-col border border-yellow-600">
                                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-xl">
                                    <h2 className="text-xl font-bold text-yellow-400">{t.inventory}</h2>
                                    <button onClick={() => setShowInventory(false)} className="text-gray-400 hover:text-white">{t.close}</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4">
                                    {inventory.length === 0 ? (
                                        <div className="col-span-2 text-center text-gray-500 italic mt-10">{t.empty}</div>
                                    ) : (
                                        inventory.map((item, idx) => (
                                            <div key={idx} className="bg-gray-800 p-4 rounded border border-gray-600 flex flex-col">
                                                <div className="flex justify-between mb-2">
                                                    <span className="font-bold text-white">{item.name}</span>
                                                    <span className="text-yellow-500">x{item.quantity}</span>
                                                </div>
                                                <p className="text-sm text-gray-400">{item.description}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Input Modal */}
                <AnimatePresence>
                    {isInputOpen && (
                        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-gray-900 p-6 rounded-xl w-full max-w-lg border border-green-500 shadow-2xl"
                            >
                                <h2 className="text-xl font-bold text-green-400 mb-4">{t.yourAction}</h2>
                                <textarea
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value.slice(0, 256))}
                                    className="w-full h-32 bg-black/50 border border-gray-700 rounded p-4 text-white text-lg mb-4 focus:outline-none focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder={t.placeholderAction}
                                    disabled={isProcessing || isLogicPending}
                                    onKeyDown={(e) => {
                                        if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) {
                                            e.preventDefault();
                                            if (!isProcessing && !isLogicPending) handleUserSubmit();
                                        }
                                    }}
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => { if (!isProcessing && !isLogicPending) setIsInputOpen(false); }}
                                        className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50"
                                        disabled={isProcessing || isLogicPending}
                                    >
                                        {t.cancel}
                                    </button>
                                    <button
                                        onClick={handleUserSubmit}
                                        className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 font-bold disabled:opacity-50 flex items-center gap-2"
                                        disabled={isProcessing || isLogicPending}
                                    >
                                        {isLogicPending ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16} />
                                                <span>Logic...</span>
                                            </>
                                        ) : (
                                            t.action
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Status Notification */}
                <AnimatePresence>
                    {statusMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-black/90 border border-yellow-500 text-yellow-400 px-6 py-3 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.5)] z-[9999] pointer-events-none flex items-center gap-2"
                        >
                            <span className="text-xl">🔔</span>
                            <span className="font-bold">{statusMessage}</span>
                        </motion.div>
                    )}
                </AnimatePresence>



                {/* Recharge Popup */}
                <AnimatePresence>
                    {showRechargePopup && (
                        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-gray-900 border-2 border-yellow-500 rounded-xl p-8 max-w-sm w-full shadow-[0_0_30px_rgba(234,179,8,0.3)] text-center relative overflow-hidden"
                            >
                                {/* Background Glow */}
                                <div className="absolute inset-0 bg-yellow-500/5 pointer-events-none" />

                                <div className="relative z-10 flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mb-2 animate-pulse">
                                        <span className="text-3xl">🪙</span>
                                    </div>

                                    <h3 className="text-xl font-bold text-yellow-400">토큰 부족 (Insufficient Tokens)</h3>
                                    <p className="text-gray-300 text-sm leading-relaxed">
                                        행동을 위한 토큰이 부족합니다.<br />
                                        무료로 충전하시겠습니까?
                                    </p>

                                    <div className="w-full h-px bg-gray-700 my-2" />

                                    <div className="flex gap-3 w-full">
                                        <button
                                            onClick={() => setShowRechargePopup(false)}
                                            className="flex-1 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold transition-colors"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={handleRecharge}
                                            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold shadow-lg hover:shadow-yellow-500/20 transition-all active:scale-95"
                                        >
                                            충전하기 (+50)
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">* 현재 테스트 버전에서는 무료로 제공됩니다.</p>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Character Info Modal */}
                <AnimatePresence>
                    {showCharacterInfo && (
                        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-gray-900 w-full max-w-4xl h-[80vh] rounded-xl flex flex-col border border-yellow-600 shadow-2xl overflow-hidden"
                            >
                                <div className="p-4 md:p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-2xl font-bold text-yellow-400">{t.charInfo}</h2>
                                        <div className="px-3 py-1 bg-gray-700 rounded-full border border-gray-600">
                                            <span className="text-gray-300 text-sm font-mono">Turn: {turnCount}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowCharacterInfo(false)} className="text-gray-400 hover:text-white text-xl">×</button>
                                </div>
                                {/* Tab Navigation */}
                                <div className="flex border-b border-gray-700 bg-black/40">
                                    <button
                                        onClick={() => setActiveProfileTab('basic')}
                                        className={`flex-1 py-3 text-center font-bold transition-colors ${activeProfileTab === 'basic' ? 'bg-yellow-600/20 text-yellow-400 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        기본 정보 (Basic)
                                    </button>
                                    <button
                                        onClick={() => setActiveProfileTab('martial_arts')}
                                        className={`flex-1 py-3 text-center font-bold transition-colors ${activeProfileTab === 'martial_arts' ? 'bg-yellow-600/20 text-yellow-400 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        무공 정보 (Martial Arts)
                                    </button>
                                    <button
                                        onClick={() => setActiveProfileTab('relationships')}
                                        className={`flex-1 py-3 text-center font-bold transition-colors ${activeProfileTab === 'relationships' ? 'bg-yellow-600/20 text-yellow-400 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        호감도 (Affinity)
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                                    {/* Tab Content: Basic Info */}
                                    {activeProfileTab === 'basic' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                            {/* Left Column: Stats & Personality */}
                                            <div className="space-y-8">
                                                {/* Base Stats Section */}
                                                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                                    <h3 className="text-blue-400 font-bold mb-4 border-b border-gray-600 pb-2">{t.baseStats}</h3>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-300">{t.str}</span>
                                                            <span className="text-white font-mono bg-black/30 px-2 py-1 rounded">{playerStats.str || 10}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-300">{t.agi}</span>
                                                            <span className="text-white font-mono bg-black/30 px-2 py-1 rounded">{playerStats.agi || 10}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-300">{t.int}</span>
                                                            <span className="text-white font-mono bg-black/30 px-2 py-1 rounded">{playerStats.int || 10}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-300">{t.vit}</span>
                                                            <span className="text-white font-mono bg-black/30 px-2 py-1 rounded">{playerStats.vit || 10}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-300">{t.luk}</span>
                                                            <span className="text-white font-mono bg-black/30 px-2 py-1 rounded">{playerStats.luk || 10}</span>
                                                        </div>
                                                        {/* [Wuxia] Neigong Display */}
                                                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-700">
                                                            <span className="text-yellow-400 font-bold">내공 (Neigong)</span>
                                                            <span className="text-yellow-200 font-mono bg-yellow-900/30 px-2 py-1 rounded border border-yellow-700/50">
                                                                {playerStats.neigong || 0}년 (Years)
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Personality Section */}
                                                <div className="space-y-2">
                                                    {[
                                                        { key: 'morality', label: '도덕성', color: 'text-green-400', bar: 'bg-green-600' },
                                                        { key: 'courage', label: '용기', color: 'text-red-400', bar: 'bg-red-600' },
                                                        { key: 'energy', label: '에너지', color: 'text-yellow-400', bar: 'bg-yellow-600' },
                                                        { key: 'decision', label: '의사결정', color: 'text-blue-400', bar: 'bg-blue-600' },
                                                        { key: 'lifestyle', label: '생활양식', color: 'text-purple-400', bar: 'bg-purple-600' },
                                                        { key: 'openness', label: '수용성', color: 'text-indigo-400', bar: 'bg-indigo-600' },
                                                        { key: 'warmth', label: '대인온도', color: 'text-pink-400', bar: 'bg-pink-600' },
                                                        { key: 'eloquence', label: '화술', color: 'text-teal-400', bar: 'bg-teal-600' },
                                                        { key: 'leadership', label: '통솔력', color: 'text-orange-400', bar: 'bg-orange-600' },
                                                    ].map((trait) => (
                                                        <div key={trait.key}>
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-gray-300 text-xs">{trait.label}</span>
                                                                <span className={`text-xs ${trait.color}`}>
                                                                    {/* @ts-ignore */}
                                                                    {playerStats.personality?.[trait.key] || 0}
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-gray-700 rounded-full h-1.5 relative">
                                                                {/* Center line */}
                                                                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-500"></div>
                                                                <div
                                                                    className={`${trait.bar} h-1.5 rounded-full absolute top-0 bottom-0 transition-all duration-500`}
                                                                    style={{
                                                                        /* @ts-ignore */
                                                                        left: (playerStats.personality?.[trait.key] || 0) < 0 ? `${50 + (playerStats.personality?.[trait.key] || 0) / 2}%` : '50%',
                                                                        /* @ts-ignore */
                                                                        width: `${Math.abs((playerStats.personality?.[trait.key] || 0)) / 2}%`
                                                                    }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Right Column (Basic): Active Chars & Skills */}
                                            <div className="space-y-8">
                                                {/* Active Characters Section */}
                                                <div className="bg-gray-800 p-6 rounded-lg border border-green-500/50">
                                                    <h3 className="text-xl font-bold text-green-400 mb-4 border-b border-green-500/30 pb-2">
                                                        현장 인물 (Active Characters)
                                                    </h3>
                                                    {useGameStore.getState().activeCharacters.length === 0 ? (
                                                        <p className="text-gray-500 italic">현재 장면에 다른 인물이 없습니다.</p>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {useGameStore.getState().activeCharacters.map((charId: string) => {
                                                                const charInfo = useGameStore.getState().characterData[charId];
                                                                return (
                                                                    <div key={charId} className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-green-900/50">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden border border-gray-600">
                                                                                {/* Placeholder or actual image if we had access easy */}
                                                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                                                                                    {charInfo?.name?.[0] || charId[0]}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <div className="font-bold text-green-300">{charInfo?.name || charId}</div>
                                                                                <div className="text-xs text-green-500/70">
                                                                                    {charInfo?.memories?.length || 0} memories recorded
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        {/* Status Tag (Optional) */}
                                                                        <div className="px-2 py-1 bg-green-900/30 rounded text-xs text-green-400">
                                                                            Present
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="bg-black/40 p-6 rounded-lg border border-gray-700">
                                                    <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-600 pb-2">{t.skills}</h3>
                                                    {(playerStats.skills || []).length === 0 ? (
                                                        <p className="text-gray-500 italic">{t.noSkills}</p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2">
                                                            {playerStats.skills.map((skill, idx) => (
                                                                <span key={idx} className="px-3 py-1 bg-blue-900/50 border border-blue-500 rounded-full text-blue-200 text-sm">
                                                                    {skill}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab Content: Martial Arts */}
                                    {activeProfileTab === 'martial_arts' && (
                                        <div className="space-y-8">
                                            {/* Martial Arts Section (Wuxia Mode) */}
                                            {/* Always show if manually selected, or show empty state */}
                                            <div className="bg-gray-800 p-6 rounded-lg border border-yellow-600/50">
                                                <div className="flex justify-between items-center mb-4 border-b border-yellow-600/30 pb-2">
                                                    <div className="flex flex-col">
                                                        <h3 className="text-xl font-bold text-yellow-400">
                                                            무공 (Martial Arts)
                                                        </h3>
                                                        <span className="text-xs text-yellow-500/80 mt-1">
                                                            누적 내공: <strong className="text-yellow-300 text-sm">{playerStats.neigong || 0}년 (Years)</strong>
                                                        </span>
                                                    </div>
                                                    <div className="px-3 py-1 bg-yellow-900/40 rounded border border-yellow-600/50 flex flex-col items-end">
                                                        <span className="text-yellow-200 font-bold font-mono text-sm md:text-base">
                                                            {playerStats.realm || '삼류(3rd Rate)'}
                                                        </span>
                                                        {playerStats.realmProgress !== undefined && (
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-yellow-500"
                                                                        style={{ width: `${playerStats.realmProgress}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-yellow-500">
                                                                    {playerStats.realmProgress}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {(!playerStats.martialArts || playerStats.martialArts.length === 0) ? (
                                                    <div className="text-center py-6 border border-dashed border-gray-700 rounded-lg">
                                                        <p className="text-gray-500 italic mb-2">익힌 무공이 없습니다.</p>
                                                        <p className="text-xs text-gray-600">수련이나 깨달음을 통해 무공을 습득하세요.</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {playerStats.martialArts.map((art: any, idx: number) => (
                                                            <div key={idx} className="bg-black/30 p-4 rounded border border-gray-700 hover:border-yellow-500/50 transition-colors">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div>
                                                                        <span className="font-bold text-gray-200 text-lg">{art.name}</span>
                                                                        <span className="text-xs text-gray-500 ml-2">[{art.rank || 'Unknown'}]</span>
                                                                    </div>
                                                                    <span className="text-xs font-mono text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded">
                                                                        {art.type}
                                                                    </span>
                                                                </div>

                                                                {/* Proficiency Bar */}
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-gradient-to-r from-yellow-700 to-yellow-500"
                                                                            style={{ width: `${art.proficiency || 0}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-xs text-gray-400 font-mono w-10 text-right">
                                                                        {art.proficiency || 0}%
                                                                    </span>
                                                                </div>

                                                                {/* Description & Effects */}
                                                                <p className="text-sm text-gray-400 line-clamp-2 mb-2 min-h-[2.5em]">{art.description}</p>
                                                                {art.effects && art.effects.length > 0 && (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {art.effects.map((eff: string, i: number) => (
                                                                            <span key={i} className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700">
                                                                                {eff}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab Content: Relationships */}
                                    {activeProfileTab === 'relationships' && (
                                        <div className="space-y-8">
                                            <div className="bg-black/40 p-6 rounded-lg border border-gray-700">
                                                <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-600 pb-2">{t.relationships}</h3>
                                                {Object.keys(playerStats.relationships || {}).length === 0 ? (
                                                    <p className="text-gray-500 italic text-center py-8">{t.noRelationships}</p>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {Object.entries(playerStats.relationships || {}).map(([charId, affinity]) => {
                                                            const charMemories = characterData?.[charId]?.memories || [];
                                                            const tierInfo = RelationshipManager.getTier(affinity);

                                                            return (
                                                                <div key={charId} className="flex flex-col bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 hover:bg-gray-800 transition-colors">
                                                                    <div className="flex flex-col gap-2 mb-3">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-bold text-gray-200 text-lg">{charId}</span>
                                                                            <span className={`text-xl font-bold ${affinity > 0 ? 'text-pink-400' : 'text-gray-400'}`}>{affinity}</span>
                                                                        </div>

                                                                        {/* Tier Badge & Progress */}
                                                                        <div className="flex flex-col gap-1">
                                                                            <div className="flex justify-between items-end">
                                                                                <span className="text-xs text-yellow-500 font-mono font-bold uppercase tracking-wider">
                                                                                    {tierInfo.tier}
                                                                                </span>
                                                                            </div>
                                                                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                                                                <div
                                                                                    className={`h-full rounded-full transition-all duration-500 ${affinity > 0 ? 'bg-gradient-to-r from-pink-600 to-pink-400' : 'bg-gray-500'}`}
                                                                                    style={{ width: `${Math.min(100, Math.abs(affinity))}%` }}
                                                                                />
                                                                            </div>
                                                                            <p className="text-xs text-gray-400 mt-1 italic leading-relaxed">
                                                                                "{tierInfo.description}"
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    {/* Memories Display */}
                                                                    {charMemories.length > 0 && (
                                                                        <div className="mt-auto pl-2 border-l-2 border-yellow-700/50 pt-2">
                                                                            <p className="text-xs text-yellow-500 font-bold mb-1">기억 (Read-Only):</p>
                                                                            <ul className="list-disc list-inside space-y-0.5">
                                                                                {charMemories.slice(-3).map((mem, i) => (
                                                                                    <li key={i} className="text-xs text-gray-400 line-clamp-1" title={mem}>
                                                                                        {mem}
                                                                                    </li>
                                                                                ))}
                                                                                {charMemories.length > 3 && (
                                                                                    <li className="text-xs text-gray-500 italic">...외 {charMemories.length - 3}개</li>
                                                                                )}
                                                                            </ul>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Debug Modal */}
                <AnimatePresence>
                    {
                        isDebugOpen && (
                            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="bg-gray-900 p-6 rounded-xl w-full max-w-6xl border border-purple-500 shadow-2xl h-[90vh] flex flex-col"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-xl font-bold text-purple-400">Debug Menu</h2>
                                        <button onClick={() => setIsDebugOpen(false)} className="text-gray-400 hover:text-white text-xl">×</button>
                                    </div>

                                    <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
                                        {/* Column 1: Injection & Logic */}
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col h-1/3">
                                                <h3 className="text-white font-bold mb-2">Inject Script</h3>
                                                <textarea
                                                    value={debugInput}
                                                    onChange={(e) => setDebugInput(e.target.value)}
                                                    className="flex-1 bg-black/50 border border-gray-700 rounded p-4 text-white font-mono text-sm mb-2 focus:outline-none focus:border-purple-500 resize-none"
                                                    placeholder="<배경> home&#10;<나레이션> ...&#10;<대사>Name: ..."
                                                />
                                                <button onClick={handleDebugSubmit} className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-500 font-bold text-white">Inject</button>
                                            </div>
                                            <div className="flex flex-col h-2/3">
                                                <h3 className="text-white font-bold mb-2">Last Logic Result (Gemini 2.5)</h3>
                                                <div className="flex-1 bg-black/50 border border-gray-700 rounded p-4 text-green-400 font-mono text-xs overflow-auto">
                                                    {lastLogicResult ? (
                                                        <pre>{JSON.stringify(lastLogicResult, null, 2)}</pre>
                                                    ) : (
                                                        <span className="text-gray-500">No logic executed yet.</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 2: Scenario & Context */}
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col h-1/2">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h3 className="text-white font-bold">Scenario Summary (Memory)</h3>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(scenarioSummary || "");
                                                            addToast("Summary copied", "success");
                                                        }}
                                                        className="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-xs text-black font-bold"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                                <div className="flex-1 bg-black/50 border border-yellow-600/50 rounded p-4 text-yellow-200 font-mono text-xs overflow-auto whitespace-pre-wrap">
                                                    {scenarioSummary || "No summary generated yet."}
                                                </div>
                                            </div>
                                            <div className="flex flex-col h-1/2">
                                                <h3 className="text-white font-bold mb-2">Active Context</h3>
                                                <div className="flex-1 bg-black/50 border border-gray-700 rounded p-4 text-blue-300 font-mono text-xs overflow-auto">
                                                    <div className="mb-2"><span className="text-gray-400">Location:</span> {useGameStore.getState().currentLocation}</div>
                                                    <div className="mb-2"><span className="text-gray-400">Event:</span> {useGameStore.getState().currentEvent || "None"}</div>
                                                    <div className="mb-2"><span className="text-gray-400">Active Chars:</span> {JSON.stringify(useGameStore.getState().activeCharacters)}</div>
                                                    <div><span className="text-gray-400">History Length:</span> {chatHistory.length} msgs</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 3: Full State Dump */}
                                        <div className="flex flex-col h-full min-h-0">
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="text-white font-bold">Current State (Saved)</h3>
                                                <button
                                                    onClick={() => {
                                                        // This is a placeholder for serverAgentTurn, it should not be here.
                                                        // The instruction seems to have misplaced this code.
                                                        // Assuming the intent was to show the updated arguments for serverAgentTurn
                                                        // if it were called here, but it's not.
                                                        // The original code defines a 'state' object and copies it.
                                                        // I will keep the original functionality of copying the state.
                                                        const state = {
                                                            playerStats,
                                                            inventory,
                                                            characterData: useGameStore.getState().characterData,
                                                            worldData: useGameStore.getState().worldData,
                                                            currentSegment,
                                                            scriptQueue: scriptQueue.length
                                                        };
                                                        navigator.clipboard.writeText(JSON.stringify(state, null, 2));
                                                        addToast("State copied to clipboard", "success");
                                                    }}
                                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white"
                                                >
                                                    Copy JSON
                                                </button>
                                            </div>
                                            <div className="flex-1 bg-black/50 border border-gray-700 rounded p-4 text-blue-300 font-mono text-xs overflow-auto custom-scrollbar">
                                                <pre className="whitespace-pre-wrap break-all">
                                                    {JSON.stringify({
                                                        playerStats,
                                                        inventory,
                                                        characterData: useGameStore.getState().characterData,
                                                        worldData: useGameStore.getState().worldData,
                                                        currentSegment,
                                                        scriptQueue: scriptQueue.length
                                                    }, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )
                    }
                </AnimatePresence >

                {/* Save/Load Modal */}
                <AnimatePresence>
                    {
                        showSaveLoad && (
                            <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="bg-gray-900 w-full max-w-2xl rounded-xl flex flex-col border border-blue-500 shadow-2xl overflow-hidden"
                                >
                                    <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                                        <h2 className="text-2xl font-bold text-blue-400">{t.saveLoad}</h2>
                                        <button onClick={() => setShowSaveLoad(false)} className="text-gray-400 hover:text-white text-xl">×</button>
                                    </div>
                                    <div className="p-8 grid gap-4">
                                        {saveSlots.map((slot) => (
                                            <div key={slot.id} className="bg-black/40 p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                                                <div>
                                                    <div className="text-lg font-bold text-white mb-1">Slot {slot.id}</div>
                                                    <div className="text-sm text-gray-400">{slot.date === 'Empty' ? t.emptySlot : slot.date}</div>
                                                    <div className="text-sm text-gray-500 italic line-clamp-2">{slot.summary === 'No summary' ? t.noSummary : slot.summary}</div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => saveGame(slot.id)}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold text-white transition-colors"
                                                    >
                                                        {t.save}
                                                    </button>
                                                    <button
                                                        onClick={() => loadGame(slot.id)}
                                                        disabled={slot.date === 'Empty'}
                                                        className={`px-4 py-2 rounded font-bold text-white transition-colors ${slot.date === 'Empty' ? 'bg-gray-700 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                                                    >
                                                        {t.load}
                                                    </button>
                                                    <button
                                                        onClick={() => deleteGame(slot.id)}
                                                        disabled={slot.date === 'Empty'}
                                                        className={`px-4 py-2 rounded font-bold text-white transition-colors ${slot.date === 'Empty' ? 'bg-gray-700 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                                                    >
                                                        {t.delete}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            </div>
                        )
                    }
                </AnimatePresence >

                {/* System Popup Layer */}
                <AnimatePresence>
                    {currentSegment?.type === 'system_popup' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute inset-0 flex items-center justify-center z-[70] bg-black/60 backdrop-blur-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                advanceScript();
                            }}
                        >
                            <div className="bg-gradient-to-b from-gray-900 to-black border-2 border-yellow-500 rounded-lg p-8 max-w-4xl w-full shadow-[0_0_50px_rgba(234,179,8,0.3)] text-center relative overflow-hidden">
                                {/* Decorative Elements */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />

                                <h2 className="text-2xl font-bold text-yellow-400 mb-6 tracking-widest uppercase border-b border-gray-700 pb-4">
                                    SYSTEM NOTIFICATION
                                </h2>

                                <div className="text-xl text-white leading-relaxed font-medium whitespace-pre-wrap">
                                    {formatText(currentSegment.content)}
                                </div>

                                <div className="mt-8 text-sm text-gray-500 animate-pulse">
                                    Click to continue
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* New Feature Operations Layers */}
                <AnimatePresence>
                    {currentSegment?.type === 'text_message' && (
                        <div className="absolute inset-0 z-50">
                            <TextMessage
                                sender={currentSegment.character || 'Unknown'}
                                header={currentSegment.expression || '지금'}
                                content={currentSegment.content}
                                onClose={() => advanceScript()}
                            />
                        </div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {currentSegment?.type === 'phone_call' && (
                        <div className="absolute inset-0 z-50" onClick={() => advanceScript()}>
                            <PhoneCall
                                caller={currentSegment.character || 'Unknown'}
                                status={currentSegment.expression || '통화중'}
                                content={currentSegment.content}
                            />
                        </div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {currentSegment?.type === 'tv_news' && (
                        <div className="absolute inset-0 z-50" onClick={() => advanceScript()}>
                            <TVNews
                                anchor={currentSegment.character || 'News'}
                                background={currentSegment.expression} // Pass expression as background key
                                content={currentSegment.content}
                            />
                        </div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {currentSegment?.type === 'article' && (
                        <div className="absolute inset-0 z-50" onClick={() => advanceScript()}>
                            <Article
                                title={currentSegment.character || 'News'} // Used char field for Title
                                source={currentSegment.expression || 'Internet'} // Used expr field for Source
                                content={currentSegment.content}
                                onClose={() => advanceScript()}
                            />
                        </div>
                    )}
                </AnimatePresence>

                {/* Dialogue / Narration Layer */}
                {
                    currentSegment && !['system_popup', 'text_message', 'phone_call', 'tv_news', 'article'].includes(currentSegment.type) && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 pb-20 md:pb-16 flex justify-center items-end z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent min-h-[40vh] md:h-[min(30vh,600px)]">
                            <div className="w-full max-w-screen-2xl pointer-events-auto relative">
                                {/* Dialogue Control Bar */}

                                <div
                                    className="w-full relative flex flex-col items-center cursor-pointer"
                                    onClick={handleScreenClick}
                                >
                                    {/* Name Tag */}
                                    {currentSegment.type === 'dialogue' && (
                                        <div className="absolute -top-[3vh] md:-top-[6vh] w-full text-center px-2">
                                            <span className="text-[4.5vw] md:text-[min(1.4vw,47px)] font-bold text-yellow-500 tracking-wide drop-shadow-md">
                                                {(() => {
                                                    const { characterData, playerName } = useGameStore.getState();

                                                    // Handle Protagonist Name
                                                    if (currentSegment.character === '주인공') {
                                                        return playerName;
                                                    }

                                                    const charList = Array.isArray(characterData) ? characterData : Object.values(characterData);
                                                    const charName = currentSegment.character || '';
                                                    const found = charList.find((c: any) => c.englishName === charName || c.name === charName);
                                                    if (found) return found.name;
                                                    return charName.split('_')[0];
                                                })()}
                                            </span>
                                        </div>
                                    )}

                                    {/* Text Content */}
                                    <div className="text-[3.7vw] md:text-[min(1.3vw,39px)] leading-relaxed text-gray-100 min-h-[10vh] whitespace-pre-wrap text-center w-full drop-shadow-sm px-[4vw] md:px-0">
                                        {currentSegment.type === 'narration' ? (
                                            <span className="text-gray-300 italic block">
                                                {formatText(currentSegment.content)}
                                            </span>
                                        ) : (
                                            <span>
                                                {formatText(currentSegment.content)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
            {/* Debug Popup */}
            {
                isLocalhost && (
                    <DebugPopup
                        isOpen={isDebugOpen}
                        onClose={() => setIsDebugOpen(false)}
                    />
                )
            }
        </div >
    );
}
