'use client';

import { useRouter } from 'next/navigation';

import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store';
import { createClient } from '@/lib/supabase';
import { serverGenerateResponse, serverGenerateGameLogic, serverGenerateSummary, getExtraCharacterImages, serverPreloadCache } from '@/app/actions/game';
import { getCharacterImage } from '@/lib/image-mapper';
import { resolveBackground } from '@/lib/background-manager'; // Added import // Added import
import { MODEL_CONFIG, PRICING_RATES } from '@/lib/model-config';
import { parseScript, ScriptSegment } from '@/lib/script-parser';
import martialArtsLevels from '@/data/games/wuxia/jsons/martial_arts_levels.json'; // Import Wuxia Ranks
import { WUXIA_BGM_MAP, WUXIA_BGM_ALIASES } from '@/data/games/wuxia/bgm_mapping'; // [New] BGM Mapping


import { submitGameplayLog } from '@/app/actions/log';


import { Send, Save, RotateCcw, History, SkipForward, Package, Settings, Bolt, Maximize, Minimize, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { EventManager } from '@/lib/event-manager';
import WikiSystem from './WikiSystem';
import TextMessage from './features/TextMessage';
import PhoneCall from './features/PhoneCall';
import TVNews from './features/TVNews';
import SmartphoneApp from './features/SmartphoneApp';
import Article from './features/Article';

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
        emptySlot: "Empty",
        noSummary: "No summary",
        confirmLoad: "Load Slot {0}? Current progress will be lost.",
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
        emptySlot: "비어있음",
        noSummary: "요약 없음",
        confirmLoad: "슬롯 {0}을(를) 불러오시겠습니까? 현재 진행 상황은 저장되지 않습니다.",
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

export default function VisualNovelUI() {
    const [isFullscreen, setIsFullscreen] = useState(false);
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
        time
    } = useGameStore();

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
    const [debugInput, setDebugInput] = useState('');
    const [lastLogicResult, setLastLogicResult] = useState<any>(null);
    const [pendingLogic, setPendingLogic] = useState<any>(null);
    const [lastStoryOutput, setLastStoryOutput] = useState<string>(''); // [Logging] Store last story output

    // Toast State
    const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'warning' }[]>([]);

    const addToast = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
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

    // Track Session & Fetch Coins on Mount
    useEffect(() => {
        let mounted = true;

        // Initial Fetch (Race condition protected)
        const fetchInitialSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (mounted && data.session) {
                setSession(data.session);
                // Fetch coins
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('coins')
                    .eq('id', data.session.user.id)
                    .single();
                if (mounted && profile) setUserCoins(profile.coins);
            }
        };
        fetchInitialSession();

        // Listen for changes
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

            // [Startup Warmup] Preload Cache in Background
            if (isWarmupTriggered.current) return;
            isWarmupTriggered.current = true;

            try {
                console.log("[System] Triggering Cache Warmup...");
                // Pass current state (Initial)
                serverPreloadCache(useGameStore.getState()).then((usageMetadata) => {
                    if (usageMetadata) {
                        const cachedTokens = (usageMetadata as any).cachedContentTokenCount || 0;
                        const inputTokens = usageMetadata.promptTokenCount - cachedTokens;
                        const outputTokens = usageMetadata.candidatesTokenCount;

                        // [DYNAMIC PRICING] Use Shared Config
                        const modelName = MODEL_CONFIG.STORY;
                        const rate = PRICING_RATES[modelName] || PRICING_RATES['gemini-2.5-flash'];

                        const costPer1M_Input = rate.input;
                        const costPer1M_Output = rate.output;
                        // Cache hit pricing is typically cheaper or same inputs. 
                        // For Pro it is $0.3125 (Input is $1.25). 
                        // For Flash it is $0.01875 (Input is $0.075).
                        // Since we don't have this in PRICING_RATES fully, we can approximate or add it there.
                        // Assuming 25% of input cost for cached input (Standard Google Ratio).
                        const costPer1M_Cached = rate.input * 0.25;

                        const costInput = (inputTokens / 1_000_000) * costPer1M_Input;
                        const costCached = (cachedTokens / 1_000_000) * costPer1M_Cached;
                        const costOutput = (outputTokens / 1_000_000) * costPer1M_Output;
                        const totalCost = costInput + costCached + costOutput;
                        const totalCostKRW = totalCost * 1480;

                        console.log(`Token Usage (Cache Warmup - ${modelName}):`);
                        console.log(`- New Input: ${inputTokens} ($${costInput.toFixed(6)})`);
                        console.log(`- Cached:    ${cachedTokens} ($${costCached.toFixed(6)})`);
                        console.log(`- Output:    ${outputTokens} ($${costOutput.toFixed(6)})`);
                        console.log(`- Total:     $${totalCost.toFixed(6)} (₩${Math.round(totalCostKRW)})`);

                        const cacheMsg = cachedTokens > 0 ? ` (Cached: ${cachedTokens})` : '';
                        addToast(`Warmup Tokens: ${usageMetadata.promptTokenCount}${cacheMsg} / Cost: ₩${Math.round(totalCostKRW)}`, 'info');
                    }
                });
            } catch (e) {
                console.error("Warmup Failed:", e);
            }
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
        const saveData = {
            timestamp: Date.now(),
            summary: state.scenarioSummary || `Chapter ${state.chatHistory.length}`,
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
                    addToast("Login required or not enough coins.", "warning");
                    setIsProcessing(false);
                    return;
                }
            }

            // 2. Coin Check
            if (currentCoins < 1) {
                console.warn("handleSend: Not enough coins");
                addToast("Not enough coins! Please recharge.", "warning");
                setIsProcessing(false);
                return;
            }

            // 3. OPTIMISTIC Deduct Coin
            const newCoinCount = currentCoins - 1;
            setUserCoins(newCoinCount);

            // Background DB Sync (Fire-and-forget)
            if (activeSession?.user) {
                const userId = activeSession.user.id;
                supabase.rpc('decrement_coin', { user_id: userId })
                    .then(({ error }: { error: any }) => {
                        if (error) {
                            // Fallback to direct update if RPC fails
                            supabase.from('profiles').update({ coins: newCoinCount }).eq('id', userId)
                                .then(({ error: updateError }: { error: any }) => {
                                    if (updateError) console.error("Coin update failed:", updateError);
                                });
                        }
                    });
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
                isGodMode: currentState.isGodMode // Pass God Mode Flag to Server
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

            const responsePromise = serverGenerateResponse(
                currentHistory,
                text,
                prunedStateForStory, // Send pruned state
                language,
                isDirectInput // [FIX] Pass Checked Flag
            );

            const result: any = await Promise.race([responsePromise, timeoutPromise]);

            // Handle both string (legacy) and object (new) return types
            const responseText = typeof result === 'string' ? result : result.text;
            const usageMetadata = typeof result === 'string' ? null : result.usageMetadata;
            const usedModel = typeof result === 'string' ? 'Unknown' : (result as any).usedModel || 'Unknown';

            // Log Story Model Debug Info
            // [DEBUG] Log the full response text to console as requested
            console.log("%c[STORY MODEL OUTPUT]", "color: green; font-weight: bold; font-size: 14px;");
            console.log(responseText);
            setLastStoryOutput(responseText); // [Logging] Capture for analytics

            if (typeof result !== 'string' && (result as any).systemPrompt) {
                console.log("%c[Story Model Input - System Prompt (Static)]", "color: cyan; font-weight: bold;");
                console.log((result as any).systemPrompt);

                if ((result as any).finalUserMessage) {
                    console.log("%c[Story Model Input - FINAL USER MESSAGE (Includes Dynamic Prompt)]", "color: magenta; font-weight: bold;");
                    console.log((result as any).finalUserMessage);
                } else {
                    console.log("%c[Story Model Input - User Message (Raw)]", "color: cyan; font-weight: bold;");
                    console.log(text);
                }
            }

            if (usageMetadata) {
                // Pricing Calculation with Context Caching
                // Gemini 1.5 Pro: Input $1.25, Output $5.00, Cached Input $0.3125 (per 1M)
                // Gemini 1.5 Flash: Input $0.075, Output $0.30, Cached Input $0.01875 (per 1M)

                const cachedTokens = (usageMetadata as any).cachedContentTokenCount || 0;
                const inputTokens = usageMetadata.promptTokenCount - cachedTokens; // Non-cached input
                const outputTokens = usageMetadata.candidatesTokenCount;

                let costPer1M_Input = 0;
                let costPer1M_Cached = 0;
                let costPer1M_Output = 0;
                let modelType = 'Pro';

                // Pricing Table (Based on Google AI Studio Pricing) - Per 1M Tokens
                const PRICING_TABLE = [
                    // Gemini 3 Series (Preview)
                    { id: 'gemini-3-flash', input: 0.50, output: 3.00, cache: 0.05, name: 'Gemini 3 Flash' },
                    { id: 'gemini-3-pro', input: 2.00, output: 12.00, cache: 0.20, name: 'Gemini 3 Pro' },

                    // Gemini 2.5 Series
                    { id: 'gemini-2.5-flash-lite', input: 0.10, output: 0.40, cache: 0.01, name: 'Gemini 2.5 Flash-Lite' },
                    { id: 'gemini-2.5-flash', input: 0.30, output: 2.50, cache: 0.03, name: 'Gemini 2.5 Flash' },
                    { id: 'gemini-2.5-pro', input: 1.25, output: 10.00, cache: 0.125, name: 'Gemini 2.5 Pro' },

                    // Gemini 2.0 Series
                    { id: 'gemini-2.0-flash-lite', input: 0.075, output: 0.30, cache: 0.00, name: 'Gemini 2.0 Flash-Lite' },
                    { id: 'gemini-2.0-flash', input: 0.10, output: 0.40, cache: 0.025, name: 'Gemini 2.0 Flash' },

                    // Legacy (Gemini 1.5)
                    { id: 'gemini-1.5-flash', input: 0.075, output: 0.30, cache: 0.01875, name: 'Gemini 1.5 Flash' },
                    { id: 'gemini-1.5-pro', input: 1.25, output: 5.00, cache: 0.3125, name: 'Gemini 1.5 Pro' },
                ];

                // Dynamic Lookup
                const priceConfig = PRICING_TABLE.find(p => usedModel.includes(p.id)) ||
                    PRICING_TABLE.find(p => p.id === 'gemini-2.5-flash'); // Default Fallback

                costPer1M_Input = priceConfig?.input || 0;
                costPer1M_Output = priceConfig?.output || 0;
                costPer1M_Cached = priceConfig?.cache || 0;
                modelType = priceConfig?.name || 'Unknown Model';

                const costInput = (inputTokens / 1_000_000) * costPer1M_Input;
                const costCached = (cachedTokens / 1_000_000) * costPer1M_Cached;
                const costOutput = (outputTokens / 1_000_000) * costPer1M_Output;
                const totalCost = costInput + costCached + costOutput;
                storyCost = totalCost; // [Logging] Capture for total
                const totalCostKRW = totalCost * 1480; // Exchange rate

                // [Verification Log]
                console.log(`Token Usage (${usedModel}):`);
                if (cachedTokens > 0) {
                    console.log(`%c[🔥 CACHE HIT] Saved ${cachedTokens} tokens!`, 'color: #00ff00; font-weight: bold; font-size: 14px;');
                } else {
                    console.log(`%c[⚠️ MISS] Full prompt generated (${usageMetadata.promptTokenCount} tokens). Cache may be created now.`, 'color: orange;');
                }
                console.log(`- New Input: ${inputTokens} ($${costInput.toFixed(6)})`);
                console.log(`- Cached:    ${cachedTokens} ($${costCached.toFixed(6)}) [SAVED]`);
                console.log(`- Output:    ${outputTokens} ($${costOutput.toFixed(6)})`);
                console.log(`- Total:     $${totalCost.toFixed(6)} (₩${Math.round(totalCostKRW)})`);

                const cacheMsg = cachedTokens > 0 ? ` (Cached: ${cachedTokens})` : '';
                addToast(`Tokens: ${usageMetadata.promptTokenCount}${cacheMsg} / Cost: ₩${Math.round(totalCostKRW)}`, 'info');
            }

            // [UX Improvement] Clear Character Image at start of new turn
            // This prevents the previous turn's character from lingering during narration.
            // It will reappear when <대사> tag is processed.
            setCharacterExpression('');

            const segments = parseScript(responseText);
            setLastStoryOutput(responseText); // [Logging] Capture response for next turn logic

            // 2. Generate Logic (Async)
            setIsLogicPending(true); // [Logic Lock] Lock input
            // [OPTIMIZATION] Prune state to reduce payload size (Server re-hydrates lore/events)
            // Sending 300KB+ JSON causes "Server Components render" error or timeouts
            const rawState = useGameStore.getState();
            const {
                lore: _l, events: _e, wikiData: _w, backgroundMappings: _b,
                scriptQueue: _sq, displayHistory: _dh, chatHistory: _ch,
                characterCreationQuestions: _ccq, constants: _c,
                ...prunedState
            } = rawState;

            console.log("[Client] Sending Pruned State to Logic Model...");

            serverGenerateGameLogic(
                text,
                responseText,
                prunedState // Pass pruned state for context-aware spawning
            ).then(logic => {
                // Log Logic Model Debug Info
                if (logic) {
                    if (logic._debug_static_prompt) {
                        console.log("%c[Logic Model Input - System Prompt (Static/Cached)]", "color: violet; font-weight: bold;");
                        console.log(logic._debug_static_prompt);
                    }
                    if (logic._debug_prompt) {
                        console.log("%c[Logic Model Input - Dynamic Prompt]", "color: violet; font-weight: bold;");
                        console.log(logic._debug_prompt);
                    }
                    if (logic._debug_raw_response) {
                        console.log("%c[Logic Model Output - Raw Response]", "color: violet; font-weight: bold;");
                        console.log(logic._debug_raw_response);
                    }
                }

                // [Logging] Calculate Logic Cost independently
                let totalLogicCost = 0;
                if (logic && logic._usageMetadata) {
                    const usageMetadata = logic._usageMetadata;
                    const modelName = MODEL_CONFIG.LOGIC;
                    const rate = PRICING_RATES[modelName] || PRICING_RATES['gemini-2.5-flash'];

                    const cachedTokens = (usageMetadata as any).cachedContentTokenCount || 0;
                    const inputTokens = usageMetadata.promptTokenCount - cachedTokens;
                    const outputTokens = usageMetadata.candidatesTokenCount;

                    // Assuming same ratio 25% for cache for now or 0.01875 if explicit
                    // Flash: Input 0.075, Cached ~0.01875
                    const costPer1M_Input = rate.input;
                    const costPer1M_Output = rate.output;
                    const costPer1M_Cached = rate.input * 0.25;

                    const costInput = (inputTokens / 1_000_000) * costPer1M_Input;
                    const costCached = (cachedTokens / 1_000_000) * costPer1M_Cached;
                    const costOutput = (outputTokens / 1_000_000) * costPer1M_Output;

                    totalLogicCost = costInput + costCached + costOutput;
                    const totalCostKRW = totalLogicCost * 1480;

                    console.log(`Token Usage (Logic - ${modelName}):`);
                    if (cachedTokens > 0) {
                        console.log(`%c[🔥 CACHE HIT] Saved ${cachedTokens} tokens!`, 'color: #00ff00; font-weight: bold; font-size: 14px;');
                    } else {
                        console.log(`%c[⚠️ MISS] Full prompt generated (${usageMetadata.promptTokenCount} tokens). Cache may be created now.`, 'color: orange;');
                    }
                    console.log(`- New Input: ${inputTokens} ($${costInput.toFixed(6)})`);
                    console.log(`- Cached:    ${cachedTokens} ($${costCached.toFixed(6)})`);
                    console.log(`- Output:    ${outputTokens} ($${costOutput.toFixed(6)})`);
                    console.log(`- Total:     $${totalLogicCost.toFixed(6)} (₩${Math.round(totalCostKRW)})`);

                    const cacheMsg = cachedTokens > 0 ? ` (Cached: ${cachedTokens})` : '';
                    addToast(`Logic Tokens: ${usageMetadata.promptTokenCount}${cacheMsg} / Cost: ₩${Math.round(totalCostKRW)}`, 'info');
                }

                // [Logging] Submit Final Log with Grand Total Cost (Always run)
                const grandTotalCost = storyCost + totalLogicCost;

                submitGameplayLog({
                    session_id: sessionId || '00000000-0000-0000-0000-000000000000',
                    game_mode: useGameStore.getState().activeGameId,
                    turn_count: turnCount,
                    choice_selected: text,
                    player_rank: useGameStore.getState().playerStats.playerRank,
                    location: useGameStore.getState().currentLocation,
                    timestamp: new Date().toISOString(),
                    // New Fields
                    player_name: useGameStore.getState().playerName,
                    cost: grandTotalCost,
                    input_type: isDirectInput ? 'direct' : 'choice',
                    meta: {
                        hp: useGameStore.getState().playerStats.hp,
                        mp: useGameStore.getState().playerStats.mp,
                        neigong: useGameStore.getState().playerStats.neigong,
                        scenario_summary: useGameStore.getState().scenarioSummary, // [Log] Dump Summary
                        memories: useGameStore.getState().activeCharacters.reduce((acc: any, charName: string) => {
                            const cData = useGameStore.getState().characterData[charName];
                            if (cData && cData.memories) acc[charName] = cData.memories;
                            return acc;
                        }, {}) // [Log] Dump Memories of Active Characters
                    },
                    story_output: responseText
                }).then(() => console.log(`📝 [Log Sent] Total Cost: $${grandTotalCost.toFixed(6)}`));

                if (segments.length === 0) {
                    applyGameLogic(logic);
                } else {
                    setPendingLogic(logic);
                }
            })
                .catch(err => {
                    console.error("Logic Generation Failed:", err);

                    // [Logging] Fallback: Log even if Logic failed
                    const fallbackTotalCost = storyCost; // Logic cost is 0
                    submitGameplayLog({
                        session_id: sessionId || '00000000-0000-0000-0000-000000000000',
                        game_mode: useGameStore.getState().activeGameId,
                        turn_count: turnCount,
                        choice_selected: text,
                        player_rank: useGameStore.getState().playerStats.playerRank,
                        location: useGameStore.getState().currentLocation,
                        timestamp: new Date().toISOString(),
                        player_name: useGameStore.getState().playerName,
                        cost: fallbackTotalCost,
                        input_type: isDirectInput ? 'direct' : 'choice',
                        meta: {
                            hp: useGameStore.getState().playerStats.hp,
                            mp: useGameStore.getState().playerStats.mp,
                            neigong: useGameStore.getState().playerStats.neigong,
                            error: `LogicFailed: ${err.message}`, // Record error
                            scenario_summary: useGameStore.getState().scenarioSummary, // [Log] Dump Summary (Fallback)
                            memories: useGameStore.getState().activeCharacters.reduce((acc: any, charName: string) => {
                                const cData = useGameStore.getState().characterData[charName];
                                if (cData && cData.memories) acc[charName] = cData.memories;
                                return acc;
                            }, {}) // [Log] Dump Memories (Fallback)
                        },
                        story_output: responseText
                    }).then(() => console.log(`📝 [Log Sent - Fallback] Cost: $${fallbackTotalCost.toFixed(6)}`));

                })
                .finally(() => {
                    setIsLogicPending(false); // [Logic Lock] Unlock input
                });

            // 3. Update State
            addMessage({ role: 'model', text: responseText });

            // Update Average Response Time (Weighted: 70% history, 30% recent)
            const duration = Date.now() - startTime;
            setAvgResponseTime(prev => Math.round((prev * 0.7) + (duration * 0.3)));

            // Start playing
            if (segments.length > 0) {
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
                            useGameStore.getState().setTime(seg.content);
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
        console.log('applyGameLogic called with:', logicResult);
        if (!logicResult) {
            console.warn('applyGameLogic: logicResult is null or undefined');
            return;
        }
        setLastLogicResult(logicResult);

        // Update Stats
        const currentStats = useGameStore.getState().playerStats;
        console.log('Current Stats before update:', currentStats);

        const newStats = { ...currentStats };

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

        // Initialize if missing (Redundant but safe)
        if (!newStats.relationships) newStats.relationships = {};

        if (logicResult.hpChange) newStats.hp = Math.min(Math.max(0, newStats.hp + logicResult.hpChange), newStats.maxHp);
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
        }

        // [Fix] Update Fame & Fate (Was missing!)
        if (logicResult.fameChange) {
            newStats.fame = (newStats.fame || 0) + logicResult.fameChange;
        }
        if (logicResult.fateChange) {
            newStats.fate = (newStats.fate || 0) + logicResult.fateChange;
        }

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
            let currentInjuries = [...(newStats.injuries || [])];

            // Add
            if (logicResult.injuriesUpdate.add) {
                logicResult.injuriesUpdate.add.forEach((injury: string) => {
                    if (!currentInjuries.includes(injury)) {
                        currentInjuries.push(injury);
                        addToast(`부상 발생(Injury): ${injury}`, 'warning');
                    }
                });
            }

            // Remove
            if (logicResult.injuriesUpdate.remove) {
                logicResult.injuriesUpdate.remove.forEach((injury: string) => {
                    const initialLen = currentInjuries.length;
                    currentInjuries = currentInjuries.filter(i => i !== injury);
                    if (currentInjuries.length < initialLen) {
                        addToast(`부상 회복(Healed): ${injury}`, 'success');
                    }
                });
            }
            newStats.injuries = currentInjuries;
        }

        setPlayerStats(newStats);

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
                    const label = trait.charAt(0).toUpperCase() + trait.slice(1);
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

                useGameStore.getState().updateCharacter(char.id, updateData);
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
            useGameStore.getState().setActiveCharacters(logicResult.activeCharacters);
            console.log("Active Characters Updated:", logicResult.activeCharacters);
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
                    className="relative w-full bg-black shrink-0 mx-auto visual-container transition-all duration-500 ease-out"
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
                                animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
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
                </div>

                <div className="absolute top-0 left-0 right-0 p-[2vw] md:p-6 flex justify-between items-start pointer-events-none">
                    {/* Left: Player Info & Stats */}
                    <div className="flex flex-col gap-[1vh] pointer-events-none">
                        <div className="flex items-center gap-[3vw] md:gap-4 z-40 relative pointer-events-auto">
                            {/* Restored Portrait Button */}
                            <div
                                className="w-[15vw] h-[15vw] md:w-[min(4vw,96px)] md:h-[min(4vw,96px)] rounded-full border-2 border-yellow-500 overflow-hidden cursor-pointer hover:scale-110 transition-transform shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowCharacterInfo(true);
                                }}
                            >
                                {isMounted ? (
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`} alt="Avatar" className="w-full h-full object-cover bg-gray-800" />
                                ) : (
                                    <div className="w-full h-full bg-gray-700 animate-pulse" />
                                )}
                            </div>

                            <h1 className="text-[4vw] md:text-[min(1.5vw,36px)] font-bold text-white drop-shadow-md tracking-wider">
                                {isMounted ? playerName : "Loading..."}
                            </h1>
                        </div>

                        <div className="flex flex-col gap-[1vh] md:gap-3 mt-[1vh] md:mt-4 items-start opacity-95 hover:opacity-100 transition-opacity w-[35vw] md:w-[15vw] z-20 relative pointer-events-auto">
                            {/* HP Bar */}
                            <div className="relative w-full h-[2.5vh] md:h-[min(2.5vh,36px)] transform -skew-x-6 overflow-hidden rounded-lg border border-red-900/60 bg-black/70 backdrop-blur-md shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                                <div className="absolute inset-0 bg-red-900/20" />
                                <div
                                    className="h-full bg-gradient-to-r from-red-800 via-red-600 to-red-500 transition-all duration-500 ease-out shadow-[0_0_20px_rgba(220,38,38,0.7)]"
                                    style={{ width: `${(playerStats.hp / playerStats.maxHp) * 100}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-between px-[2vw] md:px-6 transform skew-x-6">
                                    <span className="text-[2.5vw] md:text-[min(0.8vw,21px)] font-bold text-red-100 drop-shadow-md">체력 (HP)</span>
                                    <span className="text-[2.5vw] md:text-[min(0.8vw,21px)] font-bold text-white drop-shadow-md">{Math.round((playerStats.hp / playerStats.maxHp) * 100)}%</span>
                                </div>
                            </div>

                            {/* MP Bar */}
                            <div className="relative w-full h-[2vh] md:h-[min(2vh,30px)] transform -skew-x-6 overflow-hidden rounded-lg border border-blue-900/60 bg-black/70 backdrop-blur-md shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                                <div className="absolute inset-0 bg-blue-900/20" />
                                <div
                                    className="h-full bg-gradient-to-r from-blue-800 via-blue-600 to-blue-500 transition-all duration-500 ease-out shadow-[0_0_20px_rgba(37,99,235,0.7)]"
                                    style={{ width: `${(playerStats.mp / playerStats.maxMp) * 100}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-between px-[2vw] md:px-6 transform skew-x-6">
                                    <span className="text-[2vw] md:text-[min(0.7vw,19px)] font-bold text-blue-100 drop-shadow-md">정신력 (MP)</span>
                                    <span className="text-[2vw] md:text-[min(0.7vw,19px)] font-bold text-white drop-shadow-md">{Math.round((playerStats.mp / playerStats.maxMp) * 100)}%</span>
                                </div>
                            </div>

                            {/* Fatigue Bar (Slimmer) */}
                            <div className="relative w-full h-[1.2vh] md:h-[1.2vh] overflow-hidden rounded-full border border-purple-900/40 bg-black/60 backdrop-blur-sm mt-[0.5vh]">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-900 via-purple-700 to-purple-500 transition-all duration-500 ease-out"
                                    style={{ width: `${Math.min(100, (playerStats.fatigue || 0))}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[1.8vw] md:text-[0.6vw] font-bold text-purple-200/80 drop-shadow-sm tracking-widest">FATIGUE {playerStats.fatigue || 0}%</span>
                                </div>
                            </div>

                            {/* Status Grid (2x2) */}
                            <div className="grid grid-cols-2 gap-[1vw] md:gap-3 w-full mt-[0.5vh]">
                                {/* Rank */}
                                <div className="bg-gradient-to-br from-zinc-900/90 to-black/90 border border-yellow-700/30 p-[1vw] md:p-3 rounded-lg flex flex-col items-center justify-center shadow-lg backdrop-blur-md min-h-[8vh] md:min-h-[min(6vh,90px)]">
                                    <span className="text-yellow-600/80 text-[2.5vw] md:text-[min(0.6vw,18px)] font-bold tracking-widest mb-[0.5vh] uppercase">경지</span>
                                    <span className="text-yellow-100 font-bold text-[3vw] md:text-[min(0.8vw,24px)] text-center leading-tight break-keep">
                                        {(() => {
                                            const rankKey = playerStats.playerRank || '';
                                            const hierarchy = martialArtsLevels as any;
                                            const rankData = hierarchy[rankKey] || hierarchy[rankKey.toLowerCase()];
                                            return (rankData?.name || rankKey || '미정').split('(')[0].trim();
                                        })()}
                                    </span>
                                </div>

                                {/* Neigong */}
                                <div className="bg-gradient-to-br from-zinc-900/90 to-black/90 border border-blue-700/30 p-[1vw] md:p-3 rounded-lg flex flex-col items-center justify-center shadow-lg backdrop-blur-md min-h-[8vh] md:min-h-[min(6vh,90px)]">
                                    <span className="text-blue-500/80 text-[2.5vw] md:text-[min(0.6vw,18px)] font-bold tracking-widest mb-[0.5vh] uppercase">내공</span>
                                    <span className="text-blue-100 font-bold text-[3vw] md:text-[min(0.8vw,24px)]">
                                        {playerStats.neigong < 60
                                            ? `${(playerStats.neigong || 0).toFixed(0)}년`
                                            : `${Math.floor(playerStats.neigong / 60)}갑자`
                                        }
                                    </span>
                                </div>

                                {/* Faction */}
                                <div className="bg-gradient-to-br from-zinc-900/90 to-black/90 border border-indigo-700/30 p-[1vw] md:p-3 rounded-lg flex flex-col items-center justify-center shadow-lg backdrop-blur-md min-h-[8vh] md:min-h-[min(6vh,90px)]">
                                    <span className="text-indigo-500/80 text-[2.5vw] md:text-[min(0.6vw,18px)] font-bold tracking-widest mb-[0.5vh] uppercase">소속</span>
                                    <span className="text-indigo-100 font-bold text-[3vw] md:text-[min(0.8vw,24px)] text-center">
                                        {(playerStats.faction || '방랑객').split(' ')[0]}
                                    </span>
                                </div>

                                {/* Time (Wuxia Style) */}
                                <div className="bg-gradient-to-br from-zinc-900/90 to-black/90 border border-emerald-700/30 p-[1vw] md:p-3 rounded-lg flex flex-col items-center justify-center shadow-lg backdrop-blur-md min-h-[8vh] md:min-h-[min(6vh,90px)]">
                                    <span className="text-emerald-600/80 text-[2.5vw] md:text-[min(0.6vw,18px)] font-bold tracking-widest mb-[0.5vh] uppercase">{day || 1}일차</span>
                                    <span className="text-emerald-100 font-bold text-[2.5vw] md:text-[min(0.7vw,21px)] font-serif flex flex-col items-center">
                                        {(() => {
                                            const wuxiaTime: Record<string, { name: string, time: string }> = {
                                                morning: { name: '진시(辰)', time: '07:00 ~ 09:00' },
                                                afternoon: { name: '미시(未)', time: '13:00 ~ 15:00' },
                                                evening: { name: '술시(戌)', time: '19:00 ~ 21:00' },
                                                night: { name: '자시(子)', time: '23:00 ~ 01:00' },
                                                dawn: { name: '인시(寅)', time: '03:00 ~ 05:00' }
                                            };
                                            const timeKey = (time || 'morning').toLowerCase();
                                            const t = wuxiaTime[timeKey];

                                            // [New] Support Custom Time String (e.g. "14:40 낮")
                                            if (!t) {
                                                return <span className="text-[2.5vw] md:text-[0.8vw]">{time}</span>;
                                            }

                                            return (
                                                <>
                                                    <span>{t.name}</span>
                                                    <span className="text-[2vw] md:text-[0.6vw] text-emerald-400/70 font-sans tracking-tight">({t.time})</span>
                                                </>
                                            );
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Resources & Settings */}
                    <div className="pointer-events-auto flex flex-col items-end gap-[1vh] md:gap-3 z-40">
                        {/* Resource Container */}
                        <div className="flex items-center gap-[2vw] md:gap-3 bg-black/40 backdrop-blur-md px-[3vw] py-[1vh] md:px-6 md:py-3 rounded-xl border border-white/10 shadow-2xl">
                            {/* Gold */}
                            <div className="flex items-center gap-[1vw] md:gap-3 border-r border-white/10 pr-[2vw] md:pr-6">
                                <div className="w-[4vw] h-[4vw] md:w-8 md:h-8 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                                    <span className="text-[2.5vw] md:text-xl">🟡</span>
                                </div>
                                <span className="text-yellow-100 font-bold font-mono text-[2.5vw] md:text-[min(0.8vw,24px)]">{playerStats.gold.toLocaleString()} G</span>
                            </div>

                            {/* Fame */}
                            <div className="flex items-center gap-[1vw] md:gap-3 border-r border-white/10 pr-[2vw] md:pr-6">
                                <span className="text-[3vw] md:text-2xl drop-shadow-sm">👑</span>
                                <span className="text-purple-100 font-bold font-mono text-[2.5vw] md:text-[min(0.8vw,24px)]">{playerStats.fame}</span>
                            </div>

                            {/* Cash (Coins) */}
                            <div className="flex items-center gap-[1vw] md:gap-3 pl-[1vw] md:pl-3">
                                <div className="w-[3.5vw] h-[3.5vw] md:w-8 md:h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-[1.5vw] md:text-[14px] text-black font-extrabold shadow-sm ring-1 ring-yellow-300">
                                    C
                                </div>
                                <span className="text-yellow-400 font-bold font-mono text-[2.5vw] md:text-[min(0.8vw,24px)]">{userCoins.toLocaleString()}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        /**
                                         * [SECURITY NOTICE - REAL PAYMENTS]
                                         * This "Optimistic Update" is for PROTOTYPING & FREE CHARGING only.
                                         * In production: Integrated PG Window -> Server Webhook -> DB Update.
                                         * Client should NEVER update coins directly.
                                         */

                                        const currentUser = session?.user;

                                        // [Dev Mode] Allow charging without login for testing
                                        if (!currentUser) {
                                            console.warn("[Dev] Charging coins without active session (Guest Mode)");
                                        }

                                        // 2. OPTIMISTIC UPDATE: Update UI immediately
                                        const newCoins = userCoins + 50;
                                        setUserCoins(newCoins);
                                        addToast("Charged 50 Coins! (Test)", 'success');

                                        // 3. Background DB Sync (Only if logged in)
                                        if (currentUser) {
                                            supabase.from('profiles').update({ coins: newCoins }).eq('id', currentUser.id)
                                                .then(({ error }: { error: any }) => {
                                                    if (error) {
                                                        console.error("Background DB Sync Failed:", error);
                                                    } else {
                                                        console.log("DB Sync Success");
                                                    }
                                                });
                                        }
                                    }}
                                    className="ml-[0.5vw] md:ml-1 w-[3.5vw] h-[3.5vw] md:w-5 md:h-5 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center text-[2vw] md:text-xs shadow hover:scale-110 transition-transform"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Top Right Controls */}
                        <div className="flex gap-[1vw] md:gap-2">
                            {/* Phone Button */}
                            <button
                                className="w-[10vw] h-[10vw] md:w-[min(2.5vw,72px)] md:h-[min(2.5vw,72px)] flex items-center justify-center bg-gray-800/60 backdrop-blur-md hover:bg-gray-700/80 rounded-[2vw] md:rounded-lg text-gray-300 hover:text-white border border-gray-600 transition-all shadow-lg"
                                onClick={(e) => { e.stopPropagation(); setIsPhoneOpen(true); }}
                                title="Smartphone"
                            >
                                <div className="text-[4vw] md:text-3xl">📱</div>
                            </button>

                            {/* Inventory Button */}
                            <button
                                className="w-[10vw] h-[10vw] md:w-[min(2.5vw,72px)] md:h-[min(2.5vw,72px)] flex items-center justify-center bg-gray-800/60 backdrop-blur-md hover:bg-gray-700/80 rounded-[2vw] md:rounded-lg text-gray-300 hover:text-white border border-gray-600 transition-all shadow-lg"
                                onClick={(e) => { e.stopPropagation(); setShowInventory(true); }}
                                title="Inventory"
                            >
                                <Package className="w-[5vw] h-[5vw] md:w-8 md:h-8" />
                            </button>

                            {/* Settings Button */}
                            <button
                                className="w-[10vw] h-[10vw] md:w-[min(2.5vw,72px)] md:h-[min(2.5vw,72px)] flex items-center justify-center bg-gray-800/60 backdrop-blur-md hover:bg-gray-700/80 rounded-[2vw] md:rounded-lg text-gray-300 hover:text-white border border-gray-600 transition-all shadow-lg"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowResetConfirm(true);
                                }}
                                title="Settings"
                            >
                                <Settings className="w-[5vw] h-[5vw] md:w-8 md:h-8" />
                            </button>

                            {/* Fullscreen Button */}
                            <button
                                className="w-[10vw] h-[10vw] md:w-[min(2.5vw,72px)] md:h-[min(2.5vw,72px)] flex items-center justify-center bg-gray-800/60 backdrop-blur-md hover:bg-gray-700/80 rounded-[2vw] md:rounded-lg text-gray-300 hover:text-white border border-gray-600 transition-all shadow-lg"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!document.fullscreenElement) {
                                        document.documentElement.requestFullscreen().catch(err => {
                                            console.error(`Error attempting to enable fullscreen: ${err.message}`);
                                        });
                                    } else {
                                        if (document.exitFullscreen) {
                                            document.exitFullscreen();
                                        }
                                    }
                                }}
                                title="Toggle Fullscreen"
                            >
                                {isFullscreen ? <Minimize className="w-[5vw] h-[5vw] md:w-8 md:h-8" /> : <Maximize className="w-[5vw] h-[5vw] md:w-8 md:h-8" />}
                            </button>

                            {/* Wiki Button */}
                            <button
                                className="w-[10vw] h-[10vw] md:w-[min(2.5vw,72px)] md:h-[min(2.5vw,72px)] flex items-center justify-center bg-gray-800/60 backdrop-blur-md hover:bg-[#00A495]/80 rounded-[2vw] md:rounded-lg text-gray-300 hover:text-white border border-gray-600 transition-all shadow-lg pointer-events-auto"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    console.log("🖱️ Wiki Button Clicked");
                                    setShowWiki(true);
                                }}
                                title="Wiki"
                            >
                                <div className="font-bold text-[3vw] md:text-xl">W</div>
                            </button>
                        </div>
                    </div>
                </div>

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

                {/* Reset Confirmation Modal */}
                <AnimatePresence>
                    {showResetConfirm && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                            onClick={(e) => e.stopPropagation()} // Prevent click-through
                        >
                            <div className="bg-slate-900 border border-slate-600 w-full max-w-md p-6 rounded-xl shadow-2xl flex flex-col gap-4">
                                <h3 className="text-xl font-bold text-white text-center">게임 초기화</h3>
                                <p className="text-gray-300 text-center text-sm md:text-base whitespace-pre-line">
                                    현재 진행 상황을 초기화하고{'\n'}메인 화면으로 돌아가시겠습니까?
                                </p>
                                <div className="flex gap-3 justify-center mt-2">
                                    <button
                                        onClick={() => setShowResetConfirm(false)}
                                        className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold transition-colors"
                                    >
                                        아니오 (취소)
                                    </button>
                                    <button
                                        onClick={() => {
                                            useGameStore.getState().resetGame();
                                            router.push('/');
                                        }}
                                        className="px-6 py-2 rounded-lg bg-red-800 hover:bg-red-700 text-red-100 font-bold transition-colors border border-red-600"
                                    >
                                        예 (초기화)
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-auto z-30 p-4">
                            <div className="flex flex-col gap-3 md:gap-4 w-[85vw] md:w-[min(50vw,800px)] items-center">
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
                            </div>
                        </div>
                    )
                }

                {/* Fallback for stuck state or Start Screen */}
                {
                    isMounted && !currentSegment && choices.length === 0 && scriptQueue.length === 0 && !isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-30">
                            {chatHistory.length === 0 ? (
                                // Creation or Start Screen
                                (() => {
                                    const creationQuestions = useGameStore.getState().characterCreationQuestions;
                                    const { playerName } = useGameStore.getState();

                                    // If we have creation questions and we haven't finished creation (checked by simple local state or similar)
                                    // Actually, we use 'creationStep' state. If it's < creationQuestions.length, show question.
                                    if (creationQuestions && creationQuestions.length > 0) {
                                        const currentQuestion = creationQuestions[creationStep];

                                        const handleOptionSelect = (qId: string, value: string) => {
                                            const updatedData = { ...creationData, [qId]: value };
                                            setCreationData(updatedData);

                                            if (creationStep < creationQuestions.length - 1) {
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
4. Output the first scene now.
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
                                                };

                                                // Map creation keys to stats if needed
                                                // creationData keys: 'identity', 'goal', 'specialty', 'personality', 'story_perspective'
                                                if (updatedData['narrative_perspective']) {
                                                    newStats.narrative_perspective = updatedData['narrative_perspective'];
                                                }
                                                // Update Name (Handled via useGameStore.getState().setPlayerName below)
                                                // newStats.name is invalid as per lint. playerName is separate state.

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
                                                <h1 className="text-3xl font-bold text-yellow-400 mb-2">캐릭터 생성</h1>

                                                {/* Progress */}
                                                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-yellow-500 transition-all duration-300"
                                                        style={{ width: `${((creationStep + 1) / creationQuestions.length) * 100}%` }}
                                                    />
                                                </div>

                                                {/* Name Input (Only on first step or separate?) 
                                                    Let's put name input at the top always or just on step 0
                                                  */}
                                                {creationStep === 0 && (
                                                    <div className="flex flex-col gap-2 w-full max-w-xs mb-4">
                                                        <label className="text-yellow-500 text-sm font-bold text-left">이름 (Name)</label>
                                                        <input
                                                            type="text"
                                                            className="bg-gray-800 border border-yellow-600 text-white px-4 py-2 rounded focus:outline-none focus:border-yellow-400 text-center"
                                                            placeholder="이름을 입력하세요"
                                                            onChange={(e) => useGameStore.getState().setPlayerName(e.target.value)}
                                                            defaultValue={playerName}
                                                        />
                                                    </div>
                                                )}

                                                <h2 className="text-xl text-white font-bold leading-relaxed whitespace-pre-wrap">
                                                    {currentQuestion.question}
                                                </h2>

                                                <div className="grid grid-cols-1 w-full gap-3 mt-4">
                                                    {currentQuestion.options.map((opt: any) => {
                                                        // Check Condition
                                                        if (opt.condition) {
                                                            const { key, value } = opt.condition;
                                                            if (creationData[key] !== value) return null;
                                                        }

                                                        return (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => handleOptionSelect(currentQuestion.id, opt.value)}
                                                                className="px-6 py-4 bg-gray-800 hover:bg-yellow-900/50 border border-gray-600 hover:border-yellow-500 rounded-lg text-left text-gray-200 hover:text-white transition-all shadow-md group"
                                                            >
                                                                <span className="font-bold text-yellow-500 mr-2 group-hover:text-yellow-300">▶</span>
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

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
                                                supabase.from('profiles').update({ coins: newCoins }).eq('id', session.user.id).then();
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
                        <div className="fixed inset-0 bg-black/90 z-50 flex items-start justify-center px-4 pb-4 pt-[140px] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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
                        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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
                        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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
                            className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/80 border border-yellow-500 text-yellow-400 px-6 py-2 rounded-full shadow-lg z-50 pointer-events-none"
                        >
                            {statusMessage}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Character Info Modal */}
                <AnimatePresence>
                    {showCharacterInfo && (
                        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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
                                <div className="flex-1 overflow-y-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                    {/* Left Column: Basic Info & Personality */}
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
                                            </div>
                                        </div>

                                        {/* Personality Section */}
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

                                    {/* Right Column: Relationships & Skills */}
                                    <div className="space-y-8">
                                        <div className="bg-black/40 p-6 rounded-lg border border-gray-700">
                                            <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-600 pb-2">{t.relationships}</h3>
                                            {Object.keys(playerStats.relationships || {}).length === 0 ? (
                                                <p className="text-gray-500 italic">{t.noRelationships}</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {Object.entries(playerStats.relationships || {}).map(([charId, affinity]) => (
                                                        <div key={charId} className="flex items-center justify-between">
                                                            <span className="font-bold text-gray-200">{charId}</span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-32 bg-gray-700 rounded-full h-2">
                                                                    <div
                                                                        className={`h-2 rounded-full ${affinity > 0 ? 'bg-pink-500' : 'bg-gray-500'}`}
                                                                        style={{ width: `${Math.min(100, Math.abs(affinity))}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className={`text-sm font-bold ${affinity > 0 ? 'text-pink-400' : 'text-gray-400'}`}>{affinity}</span>
                                                            </div>
                                                        </div>
                                                    ))}
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
                            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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
                                                    <div className="text-sm text-gray-500 italic">{slot.summary === 'No summary' ? t.noSummary : slot.summary}</div>
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
                            className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm"
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
                        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 pb-8 md:pb-12 flex justify-center items-end z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent min-h-[25vh] md:h-[min(18vh,375px)]">
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
        </div >
    );
}
