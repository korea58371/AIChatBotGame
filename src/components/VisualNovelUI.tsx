'use client';

import { useRouter } from 'next/navigation';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGameStore, GameState, Skill } from '@/lib/store';
import { createClient } from '@/lib/supabase';
import { serverGenerateResponse, serverGenerateGameLogic, serverGenerateSummary, getExtraCharacterImages, serverPreloadCache, serverAgentTurn, serverAgentTurnPhase1, serverAgentTurnPhase2, serverGenerateCharacterMemorySummary } from '@/app/actions/game';
import { getCharacterImage } from '@/lib/image-mapper';
import { isHiddenProtagonist } from '@/lib/utils/character-utils';
import { resolveBackground } from '@/lib/background-manager';
import { RelationshipManager } from '@/lib/relationship-manager'; // Added import // Added import
import { MODEL_CONFIG, PRICING_RATES, KRW_PER_USD } from '@/lib/model-config';
import { parseScript, ScriptSegment } from '@/lib/script-parser';
import { findBestMatch, findBestMatchDetail, normalizeName } from '@/lib/name-utils'; // [NEW] Fuzzy Match Helper
import martialArtsLevels from '@/data/games/wuxia/jsons/martial_arts_levels.json'; // Import Wuxia Ranks
import { WUXIA_BGM_MAP, WUXIA_BGM_ALIASES } from '@/data/games/wuxia/bgm_mapping';
import { FAME_TITLES, FATIGUE_LEVELS, LEVEL_TO_REALM_MAP, WUXIA_IM_SEONG_JUN_SCENARIO, WUXIA_NAM_GANG_HYEOK_SCENARIO } from '@/data/games/wuxia/constants'; // [New] UI Constants
import { LEVEL_TO_RANK_MAP } from '@/data/games/god_bless_you/constants'; // [New] UI Constants
import wikiData from '@/data/games/wuxia/wiki_data.json'; // [NEW] Wiki Data Import


import { submitGameplayLog } from '@/app/actions/log';
import { deleteAccount } from '@/app/actions/auth';
import { translations } from '@/data/translations';
import { checkNameValidity, getHiddenSettings } from '@/data/games/wuxia/character_creation';

// [Refactoring] New Components & Hooks
import SaveLoadModal from './visual_novel/ui/SaveLoadModal';
import InventoryModal from './visual_novel/ui/InventoryModal';
import HistoryModal from './visual_novel/ui/HistoryModal';
import SystemPopup from './visual_novel/ui/SystemPopup';
import { useGameInitialization } from './visual_novel/hooks/useGameInitialization';
import { useSaveLoad } from './visual_novel/hooks/useSaveLoad';




import { Send, Save, RotateCcw, History, SkipForward, Package, Settings, Bolt, Maximize, Minimize, Loader2, X, Book, User, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { EventManager } from '@/lib/event-manager';
import WikiSystem from './WikiSystem';
import TextMessage from './features/TextMessage';
import PhoneCall from './features/PhoneCall';
import TVNews from './features/TVNews';
import SmartphoneApp from './features/SmartphoneApp';
import Article from './features/Article';
import DebugPopup from './features/DebugPopup';
import Link from 'next/link';

// [Refactoring] New Components & Hooks
import { useVNState } from './visual_novel/hooks/useVNState';
import { useVNAudio } from './visual_novel/hooks/useVNAudio';
import ModernHUD from './visual_novel/ui/ModernHUD';
import WuxiaHUD from './visual_novel/ui/WuxiaHUD';
import CharacterProfile from './visual_novel/ui/CharacterProfile';
import SettingsModal from './visual_novel/ui/SettingsModal';
import ResponseTimer from './visual_novel/ui/common/ResponseTimer';
import AdButton from './visual_novel/ui/common/AdButton';



// getKoreanExpression removed in favor of getCharacterImage utility



// Game Tips Library
import { LOADING_TIPS } from '@/data/loading_tips';

// ResponseTimer moved to common/ResponseTimer.tsx

// Internal Component for Ad Simulation
// AdButton moved to common/AdButton.tsx

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


// Helper to select Protagonist Image based on Personality Tone
function selectProtagonistImage(personality: string): string {
    // Mappings based on extra_map.json
    const mappings: Record<string, string[]> = {
        'humorous': ['유쾌한주인공1', '유쾌한주인공2', '유쾌한주인공3', '유쾌한주인공4'],
        'serious': ['원칙적주인공', '성실한주인공', '냉철한주인공'],
        'cynical': ['계산적주인공1', '계산적주인공2', '계산적주인공3', '영악한주인공1', '영악한주인공2'],
        'timid': ['소심형주인공'],
        'domineering': ['패도형주인공1', '패도형주인공2', '패도형주인공3', '패도형주인공4', '패도형주인공5']
    };

    const candidates = mappings[personality];
    if (candidates && candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    // Fallback default
    return '성실한주인공';
}

// [New] Helper to Determine Realm Order
const REALM_ORDER = ["삼류", "이류", "일류", "절정", "초절정", "화경", "현경", "생사경"];


export default function VisualNovelUI() {
    // [Refactor] UI State Hook
    const {
        showHistory, setShowHistory,
        showInventory, setShowInventory,
        showCharacterInfo, setShowCharacterInfo,
        showWiki, setShowWiki,
        isPhoneOpen, setIsPhoneOpen,
        showSaveLoad, setShowSaveLoad,
        showResetConfirm, setShowResetConfirm,
        statusMessage, setStatusMessage,
        wikiTargetCharacter, setWikiTargetCharacter,
        isFullscreen, setIsFullscreen,
        activeProfileTab, setActiveProfileTab,
        isInputOpen, setIsInputOpen,
        userInput, setUserInput,
        debugInput, setDebugInput,
        isDebugOpen, setIsDebugOpen,
        isMounted, setIsMounted
    } = useVNState();
    // [리팩토링 메모] UI 상태 관리 로직(모달, 입력, 디버그 등)은 `hooks/useVNState.ts`로 이동되었습니다.

    const [fateUsage, setFateUsage] = useState<number>(0);
    const router = useRouter();
    const wikiKeys = useMemo(() => Object.keys(wikiData), []); // [Performance] Memoize keys


    // Core Game Store
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // [New] Realm Progression Logic
    const processRealmProgression = useCallback((currentStats: any, addToastCallback: (msg: string, type: any) => void) => {
        let stats = { ...currentStats };
        const currentRankName = stats.playerRank || "삼류";
        const currentRankIdx = REALM_ORDER.indexOf(currentRankName);

        // Safety check
        if (currentRankIdx === -1) return { stats, narrativeEvent: null }; // Unknown rank, skip logic

        // 1. Get Limits for Current Realm
        const currentRealmConfig = (martialArtsLevels as any)[currentRankName];

        // Use LEVEL_TO_REALM_MAP for Level Limits (Index matches REALM_ORDER)
        const currentLevelMap = LEVEL_TO_REALM_MAP[currentRankIdx];
        const maxLevelForRealm = currentLevelMap ? currentLevelMap.max : 999;

        // 2. Get Requirements for Next Realm
        const nextRankIdx = currentRankIdx + 1;
        const nextRankName = REALM_ORDER[nextRankIdx];

        if (nextRankName) {
            const nextRealmConfig = (martialArtsLevels as any)[nextRankName];
            // [Fix] Handle 0 correctly with ?? operator (though constant has 10 for Second Rate)
            const energyReq = nextRealmConfig?.조건?.최소_내공 ?? 9999;

            // [Rule 1: Energy Cap] 
            // "Internal energy cannot pile up beyond what level allows."
            // const energyCap = energyReq;

            // [Rule 2: Level Cap Enforcement]
            // STRICT Enforcement: If not promoted, Level CANNOT exceed maxLevelForRealm.
            if (stats.level > maxLevelForRealm) {
                // Check if we qualify for promotion
                const canPromote = (stats.neigong >= energyReq);

                if (canPromote) {
                    console.log(`[Realm] Promoting ${currentRankName} -> ${nextRankName}. Neigong: ${stats.neigong} (Req: ${energyReq})`);
                    // PROMOTE!
                    stats.playerRank = nextRankName;
                    stats.level = Math.max(stats.level, currentLevelMap.max + 1); // Ensure we bump up

                    addToastCallback(`✨ 경지 상승! [${nextRankName}] 달성!`, 'success');
                    return {
                        stats,
                        narrativeEvent: `[SYSTEM EVENT: REALM_BREAKTHROUGH] Player successfully promoted from ${currentRankName} to ${nextRankName}! Current Level: ${stats.level}, Neigong: ${stats.neigong}y. **NARRATIVE INSTRUCTION**: The next turn MUST describe this breakthrough with epic flair ("뽕차는 멘트"). Describe the feeling of breaking the wall.`
                    };
                } else {
                    // [Fix] FORCE Level Cap
                    // If you have Level 45 but Neigong 45 (Req 60), you are stuck at Peak (Max 39).
                    // We must correct the level down to preserve data integrity.
                    if (stats.level > maxLevelForRealm) {
                        const originalLevel = stats.level;
                        stats.level = maxLevelForRealm;

                        // Notify user of the correction (only if significant change)
                        if (originalLevel > maxLevelForRealm) {
                            addToastCallback(`경지 정체: 내공(${stats.neigong}년)이 부족하여 레벨이 ${maxLevelForRealm}로 제한됩니다. (필요: ${energyReq}년)`, 'warning');
                        }
                    }
                }
            }

            // [Rule 3: Enforce Energy Cap if not promoted]
            // If Level is stuck at Cap, Energy is also capped at Next Req?
            if (stats.playerRank === currentRankName && stats.neigong > energyReq) {
                console.warn(`[Realm] Capping Neigong. Rank: ${currentRankName}, Neigong: ${stats.neigong} -> ${energyReq}`);
                stats.neigong = energyReq;
                // addToastCallback(`내공 과잉: 현재 경지에서는 ${energyReq}년 이상 쌓을 수 없습니다.`, 'warning');
            }
        }

        return { stats, narrativeEvent: null };
    }, []);

    // Core Game Store
    const {
        chatHistory,
        addMessage,
        addChoiceToHistory,
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
        characterData, // [New] Get character data for UI
        lastTurnSummary,
        setLastTurnSummary,
        activeGameId, // [Refactor] Add activeGameId
        currentLocation, // [Fix] Add currentLocation for HUD updates
        isDataLoaded,
    } = useGameStore();

    useEffect(() => {

        // [Fix] Ensure Game Data is Loaded on Mount (especially after New Game reset)
        if (!isDataLoaded) {
            console.log("[Initialization] Data not loaded, triggering setGameId for:", activeGameId);
            useGameStore.getState().setGameId(activeGameId);
        }
    }, [turnCount, characterCreationQuestions, activeGameId, isDataLoaded, scriptQueue, choices]);



    // [Localization]
    const t = translations[language as keyof typeof translations] || translations.en;


    const creationQuestions = characterCreationQuestions; // Alias for UI Usage

    const supabase = createClient();

    // VN State
    const [isProcessing, setIsProcessing] = useState(false);

    const [isTyping, setIsTyping] = useState(false); // [Fix] Missing State
    const [isLogicPending, setIsLogicPending] = useState(false); // [Logic Lock] Track background logic
    const [showHistory_OLD, setShowHistory_OLD] = useState(false); // Placeholder to ensure clean delete if lines shift, but strictly 291-311 should be targeted.
    // [New] BGM State (Moved to Store)
    // const [currentBgm, setCurrentBgm] = useState<string | null>(null);
    const { currentBgm, setBgm } = useGameStore();
    // [Hook] Audio
    const { playSfx } = useVNAudio(currentBgm);
    // [리팩토링 메모] 오디오 및 BGM 로직은 `hooks/useVNAudio.ts`로 이동되었습니다.

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

    // [New] Sticky Extra Character Logic
    // Intercepts character changes to assign and persist images for generic extras
    useEffect(() => {
        if (!currentSegment?.character) return;
        const charName = currentSegment.character;

        // 1. Skip if Main Character (handled by characterMap) or already assigned override
        // Note: access Store directly to get latest state without dependency lag
        const state = useGameStore.getState();
        if (state.characterMap && state.characterMap[charName]) return;
        if (state.extraOverrides && state.extraOverrides[charName]) return;

        // [New] Skip if this is the Hidden Protagonist
        // If the current character matches the override name (e.g. "남강혁"), do NOT treat as random extra
        if (state.protagonistImageOverride && (charName === state.protagonistImageOverride || charName === state.playerName)) return;

        // 2. Find Best Match in availableExtraImages
        // We need a custom loose match because findBestMatch is strict
        const availableExtras = state.availableExtraImages || [];

        // Strategy: Filter those that contain the charName (e.g. "산적" matches "산적A", "산적두목")
        // But prefer exact startsWith if possible.

        const normCharName = normalizeName ? normalizeName(charName) : charName;

        let candidates = availableExtras.filter(img => img.includes(charName));

        // If no direct string match, try normalized
        if (candidates.length === 0 && normalizeName) {
            candidates = availableExtras.filter(img => normalizeName(img).includes(normCharName));
        }

        if (candidates.length > 0) {
            // Pick deterministic or random?
            // Random adds variety for "Passerby A" vs "Passerby B" if input is just "Passerby".
            // We use a simple hash of the name to be deterministic per session if we wanted, 
            // but for "new" characters, random is better to avoid everyone looking like Bandit A.
            const bestImage = candidates[Math.floor(Math.random() * candidates.length)];

            console.log(`[StickyExtra] Assigning '${bestImage}' to '${charName}'`);
            state.setExtraOverride(charName, bestImage);
        }

    }, [currentSegment?.character]);

    // Input State
    const [isLocalhost, setIsLocalhost] = useState(false);
    const [lastLogicResult, setLastLogicResult] = useState<any>(null);
    const [pendingLogic, setPendingLogic] = useState<any>(null);
    const [lastStoryOutput, setLastStoryOutput] = useState<string>(''); // [Logging] Store last story output



    // [New] Effect State (Damage / Feedback)
    const [damageEffect, setDamageEffect] = useState<{ intensity: number; duration: number } | null>(null);
    const damageAudioRef = useRef<HTMLAudioElement | null>(null); // [New] Audio Ref

    // [Refactor] Inline Stat Accumulator (Shared across Turn)
    // Tracks stats applied via <Stat> tags during playback to prevent double-counting in Post-Logic
    const inlineAccumulatorRef = useRef<{
        hp: number;
        mp: number;
        relationships: Record<string, number>;
        personality: Record<string, number>;
    }>({ hp: 0, mp: 0, relationships: {}, personality: {} });


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
    // [리팩토링 메모] 세션 관리 로직 중 일부는 Store로 통합되었으나, 호환성을 위해 로컬 session 상태도 유지됩니다.
    // [리팩토링 메모] 모달/팝업 관련 상태(`showSaveLoad` 등)는 `useVNState`로 통합되어 제거되었습니다.
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
    // Hydration Fix & Asset Loading
    const [sessionId, setSessionId] = useState<string>('');
    // const [isMounted, setIsMounted] = useState(false); // Moved to useVNState
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

        // [Safeguard] Enforce Data Loading (Fix for Character Creation Bypass)
        const checkDataLoaded = async () => {
            const state = useGameStore.getState();
            // If activeGameId exists but important data is missing, force reload
            // (especially characterCreationQuestions which are critical for start)
            if (state.activeGameId && (!state.characterCreationQuestions || state.characterCreationQuestions.length === 0)) {
                console.warn("[VisualNovelUI] Initialization Data Missing! Force reloading...");
                await state.setGameId(state.activeGameId);
            }
        };
        checkDataLoaded();

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
    // Initialization Hook
    useGameInitialization({ setIsMounted });

    // Save/Load Hook
    const { saveSlots, saveGame, loadGame, deleteGame } = useSaveLoad({
        showSaveLoad,
        setShowSaveLoad,
        t,
        resetGame,
        addToast
    });





    const handleNewGame = () => {
        if (confirm(t.confirmNewGame)) {
            resetGame();
            // Explicitly clear storage using Zustand's API
            useGameStore.persist.clearStorage();

            // [Fix] Clear Session ID to ensure fresh telemetry/log session
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('vn_session_id');
            }

            // Force reload to ensure fresh data (JSONs) are loaded if they were changed
            setTimeout(() => {
                window.location.reload();
            }, 100);
        }
    };



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

    // [Fix] Choice Recovery Mechanism (Lost Path Prevention)
    useEffect(() => {
        if (isDataLoaded && !currentSegment && scriptQueue.length === 0 && choices.length === 0 && chatHistory.length > 0) {
            const lastMsg = chatHistory[chatHistory.length - 1];
            if (lastMsg.role === 'model' && lastMsg.text.includes('<선택지')) {
                console.log("[Recovery] Found lost choices in history. Restoring...");
                const recoveredChoices = [];
                const regex = /<선택지(\d+)>\s*(.*?)(?=(<선택지|$))/g; // Simple regex, or reuse parse logic
                // Better: Reuse the exact same parsing logic as advanceScript if possible, 
                // but here we have text, not segments.
                // Let's manually parse.
                let match;
                while ((match = regex.exec(lastMsg.text)) !== null) {
                    recoveredChoices.push({ type: 'choice' as const, content: match[2].trim() });
                }

                if (recoveredChoices.length > 0) {
                    console.log("[Recovery] Restored choices:", recoveredChoices);
                    setChoices(recoveredChoices);
                }
            }
        }
    }, [isDataLoaded, currentSegment, scriptQueue, choices, chatHistory]);

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

    // [리팩토링] BGM 재생 헬퍼 함수
    const playBgm = (moodKey: string) => {
        if (!moodKey) return;
        let validKey = moodKey.trim();
        // 별칭 확인 (부분 키가 사용된 경우)
        if (WUXIA_BGM_ALIASES[validKey]) validKey = WUXIA_BGM_ALIASES[validKey];

        const candidates = WUXIA_BGM_MAP[validKey];
        if (!candidates || candidates.length === 0) {
            console.warn(`[BGM] 해당 분위기 키에 대한 BGM을 찾을 수 없음: ${moodKey}`);
            return;
        }

        const filename = candidates[Math.floor(Math.random() * candidates.length)];
        // 참고: useVNAudio는 경로가 '/'로 시작하면 그대로 사용하고, 그렇지 않으면 /bgm/을 접두어로 붙임
        const bgmPath = `/assets/wuxia/BGM/${filename}.mp3`;

        console.log(`[BGM] 재생 전환: ${filename} (무드: ${moodKey})`);

        setBgm(bgmPath);
    };

    // [Fix] Self-Correction for Stale Save State (Hidden Protagonist Image)
    // This ensures that even if the save file has the wrong image path, it corrects itself on load.
    useEffect(() => {
        if (!currentSegment || !currentSegment.character) return;

        const state = useGameStore.getState();
        const pOverride = state.protagonistImageOverride;

        if (!pOverride) return;

        const charName = currentSegment.character;
        const isHiddenProtagonist =
            charName === '주인공' ||
            charName === '나' ||
            charName === 'Me' ||
            charName === state.playerName ||
            charName === pOverride;

        if (isHiddenProtagonist) {
            const gameId = state.activeGameId || 'wuxia';
            const expectedPath = `/assets/${gameId}/characters/${pOverride}.png`;

            // If current display is wrong (different path or empty), force update
            if (characterExpression !== expectedPath) {
                console.log("[Auto-Fix] Correcting Stale Protagonist Image:", expectedPath);
                setCharacterExpression(expectedPath);
            }
        }
    }, [currentSegment, characterExpression, useGameStore.getState().protagonistImageOverride]);

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
                                addToast(`${t.hp} ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');

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
                                addToast(`${t.mp} ${val > 0 ? '+' : ''}${val}`, 'info');
                            }
                        }
                        if (normalizedChanges.gold !== undefined) {
                            const val = Number(normalizedChanges.gold);
                            if (!isNaN(val)) {
                                newStats.gold = Math.max(0, newStats.gold + val);
                                addToast(`${t.gold} ${val > 0 ? '+' : ''}${val}`, 'success');
                            }
                        }
                        if (normalizedChanges.fame !== undefined) {
                            const val = Number(normalizedChanges.fame);
                            if (!isNaN(val)) {
                                newStats.fame = Math.max(0, (newStats.fame || 0) + val);
                                addToast(`${t.fame} ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');
                            }
                        }
                        if (normalizedChanges.morality !== undefined) {
                            const val = Number(normalizedChanges.morality);
                            if (!isNaN(val)) {
                                newStats.personality = { ...newStats.personality, morality: Math.min(100, Math.max(-100, (newStats.personality?.morality || 0) + val)) };
                                addToast(`${t.morality} ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');
                            }
                        }
                        // [Fix] Explicit Neigong Handling (Years)
                        if (normalizedChanges.neigong !== undefined) {
                            const val = Number(normalizedChanges.neigong);
                            if (!isNaN(val)) {
                                const oldVal = newStats.neigong || 0;
                                newStats.neigong = Math.max(0, oldVal + val);

                                console.log(`[Stat] Neigong Update: ${oldVal} -> ${newStats.neigong} (Change: ${val})`);

                                // Distinct Toast for Years
                                if (val > 0) {
                                    addToast(`내공(갑자) ${val}년 증가!`, 'success');
                                } else if (val < 0) {
                                    addToast(`내공(갑자) ${Math.abs(val)}년 손실! (심각한 부상)`, 'error');
                                }
                            }
                        }

                        // Generic Fallback
                        Object.keys(normalizedChanges).forEach(key => {
                            if (['hp', 'mp', 'gold', 'fame', 'morality', 'neigong'].includes(key)) return;

                            const val = Number(normalizedChanges[key]);
                            if (!isNaN(val)) {
                                if (typeof (newStats as any)[key] === 'number') {
                                    (newStats as any)[key] = ((newStats as any)[key] as number) + val;
                                    // @ts-ignore
                                    const label = t[key] || key.toUpperCase();
                                    addToast(`${label} ${val > 0 ? '+' : ''}${val}`, 'info');
                                } else if (newStats.personality && typeof (newStats.personality as any)[key] === 'number') {
                                    (newStats.personality as any)[key] = ((newStats.personality as any)[key] as number) + val;
                                    // @ts-ignore
                                    const label = t[key] || key.toUpperCase();
                                    addToast(`${label} ${val > 0 ? '+' : ''}${val}`, 'info');
                                }
                            }
                        });



                        // [New] Apply Realm/Level Logic
                        const progression = processRealmProgression(newStats, addToast);
                        if (progression.narrativeEvent) {
                            console.log("[Progression] Event Triggered:", progression.narrativeEvent);
                            // Append to LastTurnSummary for PreLogic to see next turn
                            const currentSummary = useGameStore.getState().lastTurnSummary || "";
                            setLastTurnSummary(currentSummary + "\n" + progression.narrativeEvent);
                        }

                        useGameStore.getState().setPlayerStats(progression.stats);


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

        if (nextSegment.type === 'dialogue') {
            // [New] Dynamic Override for Extra Characters
            const charMap = useGameStore.getState().characterMap || {};
            const isMainCharacter = !!charMap[nextSegment.character || ''];

            // Prevent override if it is a Main Character
            if (nextSegment.characterImageKey && nextSegment.character && !isMainCharacter) {
                useGameStore.getState().setExtraOverride(nextSegment.character, nextSegment.characterImageKey);
            }

            if (nextSegment.character) {
                // Determine Name and Emotion from AI output
                // AI is instructed to output Korean Name and Korean Emotion.
                const charName = nextSegment.character === playerName ? '주인공' : nextSegment.character;
                const emotion = nextSegment.expression || 'Default'; // AI output (e.g., '기쁨', 'Happy')

                let imagePath = '';

                // Prevent Protagonist Image from showing (Immersion)
                // [Modified] Allow if Override exists (Persisted Choice)
                const state = useGameStore.getState();
                // [Fix] Priority 0: Hidden Protagonist Override
                // If this is a hidden character, we MUST show their specific image.
                if (isHiddenProtagonist(charName, playerName, state.protagonistImageOverride)) {
                    // [Fix] Force distinct image for hidden protagonist
                    // We can now safely rely on getCharacterImage because image-mapper also checks isHiddenProtagonist
                    imagePath = getCharacterImage(charName, emotion);
                    setCharacterExpression(imagePath);
                    return; // Skip standard hiding logic
                }

                if (charName === '주인공' || charName === playerName) {
                    const state = useGameStore.getState();
                    // [Fix] Check PlayerName key (Standard) OR '주인공' key (Legacy/Fallback)
                    const overrideKey = state.extraOverrides?.[playerName] || state.extraOverrides?.['주인공'];

                    if (overrideKey) {
                        const extraMap = state.extraMap;
                        let finalImage = '';

                        if (extraMap && extraMap[overrideKey]) {
                            finalImage = extraMap[overrideKey];
                        } else {
                            finalImage = `${overrideKey}.png`;
                        }

                        // Set full path
                        imagePath = `/assets/${useGameStore.getState().activeGameId || 'wuxia'}/ExtraCharacters/${finalImage}`;
                        setCharacterExpression(imagePath);
                        return;
                    }

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

                    // [Fallback] Fuzzy Match for Missing Images
                    // If imagePath is empty, try to find the best match from availableExtraImages
                    if (!imagePath && availableExtraImages && availableExtraImages.length > 0) {
                        // Priority 1: Match defined image key (e.g. "냉철한사파무인남")
                        let targetKey = nextSegment.characterImageKey || charName;

                        // Clean target key (remove brackets if any remaining)
                        targetKey = targetKey.replace(/\(.*\)/, '').trim();

                        const candidates = availableExtraImages;
                        // Use Detail version for Score Access
                        const bestMatch = findBestMatchDetail(targetKey, candidates);

                        if (bestMatch && bestMatch.rating > 0.4) { // 40% similarity threshold
                            console.log(`[Image Fallback] Fuzzy Match: ${targetKey} -> ${bestMatch.target}`);
                            imagePath = `/assets/${gameId}/ExtraCharacters/${bestMatch.target}.png`; // Simplified assumption: extra images are flat
                            // Wait, availableExtraImages might be full filenames or keys? 
                            // Usually they are keys like "점소이_비굴한" or just "점소이".
                            // Let's assume they are keys without extension if coming from store, 
                            // BUT lines 926 and 950 add .png extension.
                            // Let's check how availableExtraImages is populated. 
                            // It is likely filenames without extension or keys.
                            // Line 950: `.../${combinedKey}.png` implies combinedKey is the filename base.
                            // If bestMatch.target is the filename base, we append .png.

                            // Re-verify: availableExtraImages comes from store.

                        }
                    }
                }

                setCharacterExpression(imagePath);
            }
        }
    }

    // Response Time Tracking
    const [avgResponseTime, setAvgResponseTime] = useState(30000); // Default 30 seconds as per request

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
                // [Agentic] 1. Add User Message to History
                addMessage({ role: 'user', text: text });
                addChoiceToHistory({ text: text, type: 'input', timestamp: Date.now() });

                // [Typing Indicator]
                setIsTyping(true);
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
            // 5. [Core] Memory Summarization Logic MOVED to Phase 2 (Background) to prevent blocking.
            // Check approx line 1200+ inside the async block.

            // 1. Generate Narrative
            console.log(`[VisualNovelUI] Sending state to server.`);

            // Sanitize state to remove functions and circular references
            // [OPTIMIZATION] Strip 'snapshot' (Client-Only) to strictly enforce <4MB Limit
            // Snapshots contain full state copies (100KB+ each), so 30 snapshots = ~3MB unnecessary data.
            const historyPayload = (currentState.chatHistory.length > 30
                ? currentState.chatHistory.slice(-30)
                : currentState.chatHistory).map(({ snapshot, ...rest }) => rest);

            const sanitizedState = JSON.parse(JSON.stringify({
                chatHistory: historyPayload,
                playerStats: currentState.playerStats,
                inventory: currentState.inventory,
                currentLocation: currentState.currentLocation,
                scenarioSummary: currentState.scenarioSummary,
                currentEvent: currentState.currentEvent,
                activeEvent: currentState.activeEvent, // [CRITICAL] Pass the full Event Object (with prompt)
                currentMood: currentState.currentMood,
                playerName: currentState.playerName,
                activeCharacters: currentState.activeCharacters,
                characterData: currentState.characterData,
                worldData: currentState.worldData,
                // [OPTIMIZATION] Static Asset Lists are Hydrated on Server
                // availableBackgrounds: currentState.availableBackgrounds,
                // availableCharacterImages: currentState.availableCharacterImages,
                // availableExtraImages: currentState.availableExtraImages,
                activeGameId: currentState.activeGameId, // [FIX] Pass GameID for Server Re-hydration
                // [OPTIMIZATION] Static data removed for payload size reduction (Hydrated on Server)
                // constants: currentState.constants, 
                // lore: currentState.lore, 
                // worldData: currentState.worldData, 
                isDirectInput: isDirectInput, // Inject Flag
                isGodMode: currentState.isGodMode, // Pass God Mode Flag to Server
                lastTurnSummary: lastTurnSummary, // [NEW] Pass Last Turn Summary
                fateUsage: fateUsage, // [Fate System] Pass requested fate points

                turnCount: nextTurnCount, // [FIX] Pass updated Turn Count for System Prompt Logic
            }));


            console.log(`[VisualNovelUI] Payload ActiveEvent:`, sanitizedState.activeEvent ? sanitizedState.activeEvent.id : "NULL");

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

            // 2. [Split Execution] Phase 1 - Story Generation (Immediate)
            const p1Start = Date.now();
            // Call Phase 1
            const p1Result: any = await Promise.race([
                serverAgentTurnPhase1(
                    currentHistory,
                    text,
                    sanitizedState, // [FIX] Use sanitizedState (with tension) instead of prunedState
                    language,
                    storyModel || MODEL_CONFIG.STORY,
                    isDirectInput
                ),
                timeoutPromise
            ]);
            const p1Duration = Date.now() - p1Start;

            // [Phase 1 Output]
            const cleanStoryText = p1Result.cleanStoryText;
            const routerOut = p1Result.routerOut; // [Fix] router -> routerOut
            const preLogicDebug = p1Result.preLogicOut; // [Fix] logic -> preLogicOut
            const usageMetadataP1 = p1Result.usageMetadata; // Note: Orchestrator returns usage object, might need shallow merge if structured differently
            const effectiveGameState = p1Result.effectiveGameState;

            // [Debug] Check PreLogic Out for Fate
            console.log("[VisualNovelUI] PreLogic Out:", preLogicDebug);
            if (preLogicDebug?.state_changes?.fate) {
                console.log("[VisualNovelUI] Fate Change detected in PreLogic:", preLogicDebug.state_changes.fate);
            }

            // [Summary Agent] Update UI (Phase 1 might not have summary, usually Phase 2)
            // Check if Phase 1 returned summary? (Likely not, Logic phase does summary)

            // [UX Improvement] Clear Character Image
            setCharacterExpression(''); // Clear before new story

            // 3. Render Story Immediately
            // [Fix] Data Flow Consistency: Use clean text for immediate display

            // [Fate System] Reset Usage after successful send
            setFateUsage(0);
            const textToParse = cleanStoryText;
            const segments = parseScript(textToParse);
            setScriptQueue(segments); // Start playing story
            setLastStoryOutput(textToParse);

            // Update History Immediately with Clean Text
            // We assume user wants to see the story log immediately.

            // [Fix] Capture Snapshot for Rewind
            // We capture the state BEFORE the new text is processed/stats applied?
            // Wait, the "Rewind" goes back to the START of this turn. 
            // So we need the state AS IT WAS before this turn's logic ran.
            // However, we are in `handleSend`. Logic runs in background (Phase 2), but Phase 1 might resolve some logic?
            // Actually, `addMessage` is called here.
            // If we restore this snapshot, we want to be in the state exactly as it is NOW (before Phase 2 logic applies).
            // But wait, Phase 1 logic (`applyGameLogic` call below) might have already run if `p1Result.logic` exists.
            // `p1Result.logic` is applied at line 1050. `addMessage` is at 1041.
            // So this is the perfect place. We capture state BEFORE Phase 1 Logic applies to the store (if any).
            // Actually line 1050 is *after* this.

            // What about `useGameStore.getState()`? It gets current state.
            const snapshotState = useGameStore.getState();
            const snapshot: Partial<typeof snapshotState> = {
                playerStats: JSON.parse(JSON.stringify(snapshotState.playerStats)),
                characterData: JSON.parse(JSON.stringify(snapshotState.characterData)),
                inventory: JSON.parse(JSON.stringify(snapshotState.inventory)),
                worldData: JSON.parse(JSON.stringify(snapshotState.worldData)),
                tensionLevel: snapshotState.tensionLevel,
                goals: JSON.parse(JSON.stringify(snapshotState.goals)),
                skills: JSON.parse(JSON.stringify(snapshotState.skills || [])), // [Fix] Capture Skills for Rewind
                activeCharacters: JSON.parse(JSON.stringify(snapshotState.activeCharacters || [])),
                deadCharacters: JSON.parse(JSON.stringify(snapshotState.deadCharacters || [])),

                // [Fix] Meta State & Descriptions
                currentMood: snapshotState.currentMood,
                triggeredEvents: JSON.parse(JSON.stringify(snapshotState.triggeredEvents || [])),
                activeEvent: snapshotState.activeEvent ? JSON.parse(JSON.stringify(snapshotState.activeEvent)) : null,
                lastTurnSummary: snapshotState.lastTurnSummary,
                userCoins: snapshotState.userCoins,
                statusDescription: snapshotState.statusDescription,
                personalityDescription: snapshotState.personalityDescription,
                currentBgm: snapshotState.currentBgm, // [Fix] Capture BGM

                day: snapshotState.day,
                time: snapshotState.time,
                turnCount: snapshotState.turnCount,
                scenarioSummary: snapshotState.scenarioSummary,
                currentLocation: snapshotState.currentLocation,
                currentBackground: snapshotState.currentBackground,
            };

            addMessage({ role: 'model', text: cleanStoryText, snapshot });

            // Apply PreLogic State Changes (Immediate)
            if (p1Result.logic) {
                // Note: We used `applyGameLogic` before for `combinedLogic`.
                // Here we only have PreLogic.
                // We should apply it to reflect "Cost" or "Instant Effects".
                // However, `applyGameLogic` expects a fuller object? 
                // It handles partials fine usually.
                applyGameLogic({ logic: p1Result.preLogicOut });
            }

            // [UX] Unlock UI (Partially)
            // setIsProcessing(false) happens in finally block.
            // We set logic pending state.
            setIsLogicPending(true);

            // [Refactor] Reset Inline Accumulator for New Turn
            inlineAccumulatorRef.current = {
                hp: 0,
                mp: 0,
                relationships: {},
                personality: {}
            };



            // 4. [Split Execution] Phase 2 - Backend Logic (Background)
            (async () => {
                try {

                    // [Summary Agent] Background Execution (Phase 2)
                    // Moved from Phase 1 to prevent blocking story generation.
                    // [Parallelization] Now runs concurrently with serverAgentTurnPhase2
                    // We define the promise here but await it later or let it run detached?
                    // The user wants it parallel.
                    // But we are inside an async IIFE that IS background.
                    // Wait, if we await Phase 2 Logic first, THEN do summary, it is sequential within the background thread.
                    // This delays the "Total Turn Completion" if we were waiting for it.
                    // But we aren't waiting for the background thread to finish to show text.
                    // However, if the user wants "Story -> (Logic + Summary)", we should start both promises at the top.

                    const currentTurnCount = useGameStore.getState().turnCount;
                    const BG_SUMMARY_THRESHOLD = 10;
                    let summaryPromise: Promise<string | null> = Promise.resolve(null);

                    if (currentTurnCount > 0 && currentTurnCount % BG_SUMMARY_THRESHOLD === 0) {
                        const latestHistory = useGameStore.getState().chatHistory;
                        const messagesToSummarize = latestHistory.slice(-BG_SUMMARY_THRESHOLD * 2);
                        console.log(`[Background] Triggering Memory Summarization (Turn ${currentTurnCount})...`);

                        addToast(`Summarizing memories (Turn ${currentTurnCount})...`, "info");
                        const prevSummary = useGameStore.getState().scenarioSummary;

                        summaryPromise = serverGenerateSummary(prevSummary, messagesToSummarize)
                            .then(newSummary => {
                                useGameStore.getState().setScenarioSummary(newSummary);
                                console.log("%c[Scenario Summary Updated]", "color: orange; font-weight: bold;", newSummary);
                                addToast("Memory updated!", "success");
                                return newSummary;
                            })
                            .catch(err => {
                                console.error("Summary Generation Failed:", err);
                                return null;
                            });
                    }

                    // Start Phase 2 Logic & Summary concurrently
                    const p2Start = Date.now();

                    // [Parallel] Run Logic (Await) + Summary (Fire/Forget)
                    // We do not wait for summaryPromise here to improve perceived latency.
                    const p2Result = await serverAgentTurnPhase2(
                        currentHistory,
                        text,
                        effectiveGameState, // Pass state with Mood Override
                        cleanStoryText,
                        language
                    );
                    // Summary Promise runs in background (started above)

                    const p2Duration = Date.now() - p2Start;

                    const postLogicOut = p2Result.postLogicOut; // [Fix] Restore definition
                    const finalStoryText = p2Result.finalStoryText; // [Fix] Restore definition

                    // Construct Combined Logic for Application & Logging
                    // (Reusing logic from original code, adapted for split sources)

                    // Deduplication Logic
                    const inlineDeltas: Record<string, number> = {};
                    if (postLogicOut && postLogicOut.inline_triggers && postLogicOut.inline_triggers.length > 0) {
                        postLogicOut.inline_triggers.forEach((trigger: any) => {
                            const statMatch = trigger.tag.match(/<Stat\s+([^=]+)=['"]?(-?\d+)['"]?.*?>/i);
                            if (statMatch) {
                                const key = statMatch[1].toLowerCase();
                                const val = parseInt(statMatch[2], 10);
                                if (!isNaN(val)) inlineDeltas[key] = (inlineDeltas[key] || 0) + val;
                            }
                        });
                    }

                    // Source HP
                    // Source HP
                    const maHp = p2Result.martialArtsOut?.stat_updates?.hp || 0;
                    const sourceHp = (preLogicDebug?.state_changes?.hpChange || 0) + maHp;
                    const inlineHp = inlineDeltas['hp'] || 0;
                    let finalHpChange = (sourceHp !== 0) ? sourceHp - inlineHp : 0;

                    const maMp = p2Result.martialArtsOut?.stat_updates?.mp || 0;
                    const sourceMp = (preLogicDebug?.state_changes?.mpChange || 0) + maMp;
                    const inlineMp = inlineDeltas['mp'] || 0;
                    let finalMpChange = (sourceMp !== 0) ? sourceMp - inlineMp : 0;

                    const plPersonality: Record<string, number> = {};
                    if (postLogicOut && postLogicOut.stat_updates) {
                        Object.entries(postLogicOut.stat_updates).forEach(([k, v]) => {
                            const key = k.toLowerCase();
                            if (key === 'hp' || key === 'mp') return;
                            plPersonality[key] = (v as number) - (inlineDeltas[key] || 0);
                        });
                    }

                    const combinedLogic = {
                        ...(preLogicDebug?.state_changes || {}),
                        hpChange: finalHpChange,

                        // [Debug] Ensure Fate is preserved
                        fate: preLogicDebug?.state_changes?.fate,

                        mpChange: finalMpChange,
                        personalityChange: plPersonality,
                        mood: postLogicOut?.mood_update,
                        location: postLogicOut?.location_update,
                        new_memories: postLogicOut?.new_memories,
                        activeCharacters: postLogicOut?.activeCharacters,

                        // [Fix] Map Injuries & Generic Stats from PostLogic
                        injuriesUpdate: {
                            add: postLogicOut?.new_injuries,
                            remove: postLogicOut?.resolved_injuries
                        },
                        stat_updates: postLogicOut?.stat_updates,

                        goal_updates: postLogicOut?.goal_updates,
                        new_goals: postLogicOut?.new_goals,
                        post_logic: {
                            ...(postLogicOut || {}),
                            stat_updates: plPersonality
                        },
                        character_memories: postLogicOut?.character_memories,
                        martial_arts: p2Result.martialArtsOut ? {
                            ...p2Result.martialArtsOut,
                            stat_updates: {
                                ...(p2Result.martialArtsOut.stat_updates || {}),
                                hp: 0, mp: 0
                            }
                        } : p2Result.martialArtsOut,
                        _debug_router: routerOut,

                        // [NEW] Event System Integration
                        triggerEventId: (p2Result.eventOut as any)?.triggerEventId,
                        currentEvent: (p2Result.eventOut as any)?.currentEvent,
                        candidates: (p2Result.eventOut as any)?.candidates,
                        event_debug_info: (p2Result.eventOut as any)?.debug // Pass debug info
                    } as any;

                    // [Fix] Defer Logic Application to End of Script
                    // Instead of applying immediately, we set it as pending.
                    // This ensures the stats update after the text has finished reading.
                    // IMPORTANT: We must NOT re-apply PreLogic changes (costs) if they ran at Phase 1.

                    const deferredLogic = { ...combinedLogic };

                    // If PreLogic successfully ran in Phase 1, remove its changes from the deferred object
                    // to prevent double-application (e.g. paying mana twice).
                    if (preLogicDebug?.state_changes && preLogicDebug.success) {
                        delete deferredLogic.hpChange; // Handled in P1 or calculated in finalHpChange?
                        delete deferredLogic.mpChange;
                        // Actually, finalHpChange = sourceHp - inlineHp.
                        // sourceHp = preLogic + postLogic.
                        // If PreLogic was applied, we only want to apply (PostLogic - Inline).
                        // So we need to subtract PreLogic from finalHpChange.

                        const preHp = preLogicDebug.state_changes.hpChange || 0;
                        const preMp = preLogicDebug.state_changes.mpChange || 0;

                        if (deferredLogic.hpChange !== undefined) deferredLogic.hpChange -= preHp;
                        if (deferredLogic.mpChange !== undefined) deferredLogic.mpChange -= preMp;

                        // Remove other explicit state changes from PreLogic if they exist
                        // (Currently PreLogic mostly does HP/MP cost).
                    }

                    // applyGameLogic(combinedLogic); // <-- OLD IMMEDIATE CALL

                    // New Deferred Call (via State)
                    // [Fix] Subtract Inline Applied values (from Client Loop)
                    // We trust the Client Loop (inlineApplied) more than server inline_triggers.
                    // Note: If 'finalHpChange' already subtracted 'inlineDeltas' (Server Tags),
                    // and 'inlineApplied' matches 'inlineDeltas', we might double-subtract.
                    // However, we assume user added the manual loop because Server Tags were unreliable.
                    // To be safe, we subtract what we ACTUALLY applied.

                    const finalDeferred = { ...deferredLogic };

                    // [Fix] Update History with Final Text (including Choices)
                    // This ensures that 'Rewind' (History Modal) can parse choices correctly.
                    if (finalStoryText) {
                        useGameStore.getState().updateLastMessage(finalStoryText);
                        console.log("[VisualNovelUI] Updated History with Final Text (Choices included)");
                    }

                    // [Refactor] Script Replacement & Tag Deduction Strategy
                    // We need to switch the active script to `finalStoryText` (which contains tags)
                    // AND ensure we don't double-count stats (Tags + PendingLogic).

                    const finalSegments = parseScript(finalStoryText);
                    const currentScriptQueue = useGameStore.getState().scriptQueue;
                    const currentSeg = useGameStore.getState().currentSegment;

                    // 1. Find Cut Point (Where are we?)
                    let matchIndex = -1;

                    // Strategy: Look for the *next* segment in our queue within the new segments.
                    const nextQueueSeg = currentScriptQueue.length > 0 ? currentScriptQueue[0] : null;

                    if (nextQueueSeg) {
                        // Scan finalSegments for a matching content
                        // We filter for content-bearing types (dialogue, narration) to match
                        matchIndex = finalSegments.findIndex(s =>
                            (s.type === nextQueueSeg.type) &&
                            // Lenient match (trim/contains) in case tags altered whitespace
                            (s.content?.trim() === nextQueueSeg.content?.trim())
                        );
                    } else if (currentSeg) {
                        // If queue is empty (user reading last line), match current segment
                        // And resume from AFTER it.
                        const currentMatch = finalSegments.findIndex(s =>
                            (s.type === currentSeg.type) &&
                            (s.content?.trim() === currentSeg.content?.trim())
                        );
                        if (currentMatch !== -1) {
                            matchIndex = currentMatch + 1; // Start from next
                        }
                    } else {
                        // Script finished? or not started?
                        matchIndex = 0; // Replace all if nothing playing?
                        // If nothing playing, queue is empty.
                    }

                    // 2. Calculate Future Tags (What will run if we replace queue)
                    const futureTagSum = {
                        hp: 0, mp: 0, relationships: {} as Record<string, number>, personality: {} as Record<string, number>
                    };

                    let newQueue: ScriptSegment[] = [];

                    if (matchIndex !== -1 && matchIndex < finalSegments.length) {
                        newQueue = finalSegments.slice(matchIndex);

                        // Sum tags in the new queue
                        newQueue.forEach(seg => {
                            if (seg.type === 'command') {
                                if (seg.commandType === 'update_stat') {
                                    try {
                                        const stats = JSON.parse(seg.content || '{}');
                                        Object.entries(stats).forEach(([k, v]) => {
                                            const key = k.toLowerCase();
                                            const val = Number(v);
                                            if (!isNaN(val)) {
                                                if (key === 'hp') futureTagSum.hp += val;
                                                else if (key === 'mp') futureTagSum.mp += val;
                                                else if (key !== 'hp' && key !== 'mp') {
                                                    futureTagSum.personality[key] = (futureTagSum.personality[key] || 0) + val;
                                                }
                                            }
                                        });
                                    } catch (e) { }
                                } else if (seg.commandType === 'update_relationship') {
                                    try {
                                        const d = JSON.parse(seg.content || '{}');
                                        if (d.charId && d.value) {
                                            const val = Number(d.value);
                                            futureTagSum.relationships[d.charId] = (futureTagSum.relationships[d.charId] || 0) + val;
                                        }
                                    } catch (e) { }
                                }
                            }
                        });

                        console.log(`[Script Replacement] Seamless Switch! resuming from index ${matchIndex}. Future Tags:`, futureTagSum);

                        // Apply Replacement
                        setScriptQueue(newQueue);

                        // [UX Check] If current segment matches exactly, do we need to refresh it?
                        // No, let user finish reading current line. ScriptQueue handles the NEXT.

                    } else {
                        console.warn("[Script Replacement] Could not match stream position. Fallback: dump all logic at end, do not replace script visual.");
                        // Fallback: We don't replace queue (user reads Clean Text).
                        // Future Tags = 0 (since we don't add tags to queue).
                        // Logic runs as pending at end.
                    }

                    // 3. Deduct Future Tags from Deferred Logic
                    // deferredLogic = Total - (InlineAppliedSoFar + FutureTags)
                    // Note: PreLogic was already subtracted from deferredLogic above if applicable.
                    // inlineAccumulatorRef tracks what user ALREADY saw/clicked (if any tags existed).

                    const acc = inlineAccumulatorRef.current; // What ran so far

                    if (finalDeferred.hpChange !== undefined) {
                        finalDeferred.hpChange -= (acc.hp + futureTagSum.hp);
                    }
                    if (finalDeferred.mpChange !== undefined) {
                        finalDeferred.mpChange -= (acc.mp + futureTagSum.mp);
                    }

                    if (finalDeferred.personalityChange) {
                        // Deduct Accumulator
                        Object.entries(acc.personality).forEach(([k, v]) => {
                            if (finalDeferred.personalityChange && finalDeferred.personalityChange[k] !== undefined) {
                                finalDeferred.personalityChange[k] -= v;
                            }
                        });
                        // Deduct Future Tags
                        Object.entries(futureTagSum.personality).forEach(([k, v]) => {
                            if (finalDeferred.personalityChange && finalDeferred.personalityChange[k] !== undefined) {
                                finalDeferred.personalityChange[k] -= (v as number);
                            }
                        });
                    }

                    // [Refactor] Apply Logic via processRealmProgression
                    // First, construct the 'next' stats candidate
                    let tempStats = { ...useGameStore.getState().playerStats };

                    // Apply HP/MP/Personality first (Standard Logic)
                    if (finalDeferred.hpChange) tempStats.hp = Math.min(tempStats.maxHp, Math.max(0, tempStats.hp + finalDeferred.hpChange));
                    if (finalDeferred.mpChange) tempStats.mp = Math.min(tempStats.maxMp, Math.max(0, tempStats.mp + finalDeferred.mpChange));
                    // Note: 'mp' in standard stats might be 'neigong' in Wuxia context?
                    // User prompt uses 'neigong' (years). Store has 'neigong'.
                    // PostLogic 'stat_updates' might imply 'mp' as 'inner power'?
                    // If PostLogic sends 'mp', does it mean 'neigong'? 
                    // Usually 'mp' is Mana/Activity. 'neigong' is Year stats.
                    // Let's check if PostLogic sends 'neigong'. The schema allows 'stat_updates' dictionary.
                    // If PostLogic sends { "neigong": 1 }, it goes into 'personalityChange' (catch-all) or separate?
                    // Lines 1387-1393 puts everything except 'hp','mp' into 'personalityChange'.
                    // So 'neigong' is in 'personalityChange'.

                    // Apply Personality/Misc including Neigong
                    if (finalDeferred.personalityChange) {
                        const pDelta = finalDeferred.personalityChange;
                        // Handle Neigong specifically if present
                        if (pDelta.neigong) {
                            tempStats.neigong = (tempStats.neigong || 0) + pDelta.neigong;
                            delete pDelta.neigong; // Remote from personality map
                        }

                        // Handle Level/Exp if present
                        if (pDelta.exp) {
                            tempStats.exp = (tempStats.exp || 0) + pDelta.exp;
                            // Simple Level Up (Base)
                            const expReq = tempStats.level * 100;
                            if (tempStats.exp >= expReq) {
                                // Potential Level Up (ProcessRealmProgression will enforce caps)
                                tempStats.level += 1;
                                tempStats.exp -= expReq;
                            }
                            delete pDelta.exp;
                        }

                        // Apply others to personality
                        Object.entries(pDelta).forEach(([k, v]) => {
                            if (typeof v === 'number') {
                                // Check if it matches a root stat (str, agi...) or personality
                                if (['str', 'agi', 'int', 'vit', 'luk', 'fame', 'gold'].includes(k)) {
                                    (tempStats as any)[k] = ((tempStats as any)[k] || 0) + v;
                                } else if (tempStats.personality && (k in tempStats.personality)) {
                                    (tempStats.personality as any)[k] += v;
                                }
                            }
                        });
                    }

                    // Now Run Realm Check on the TempStats
                    const logicProgression = processRealmProgression(tempStats, addToast);
                    if (logicProgression.narrativeEvent) {
                        const currentSummary = useGameStore.getState().lastTurnSummary || "";
                        setLastTurnSummary(currentSummary + "\n" + logicProgression.narrativeEvent);
                    }

                    // Update the final stats in store
                    const finalStatsToSet = logicProgression.stats;

                    // Also merge other deferred logic
                    // We need to actually CALL applyGameLogic-like steps or set store directly?
                    // The original code passed 'finalDeferred' to `applyGameLogic`.
                    // But `applyGameLogic` is not shown here (it's likely defined later).
                    // We must assume `applyGameLogic` exists and handles the rest (mood, memories, goals).
                    // BUT we already modified stats.
                    // So we should update stats manually here, and pass rest to applyGameLogic?
                    // OR: Pass 'stats' to applyGameLogic if it accepts it.
                    // Standard `applyGameLogic` handles `hp`, `mp`.
                    // We handled them here. So set hpChange/mpChange/personalityChange to null/empty in `finalDeferred`?

                    // Update Store with Stats
                    useGameStore.getState().setPlayerStats(finalStatsToSet);

                    // Clear applied changes from deferred logic so applyGameLogic doesn't double apply
                    finalDeferred.hpChange = 0;
                    finalDeferred.mpChange = 0;
                    finalDeferred.personalityChange = {};
                    // (We kept non-stat changes like memories, clues)

                    // [Security] Strip playerRank from deferred logic to ensure processRealmProgression is the System Authority
                    if (finalDeferred.playerRank) delete finalDeferred.playerRank;
                    if (finalDeferred.post_logic?.playerRank) delete finalDeferred.post_logic.playerRank;

                    applyGameLogic(finalDeferred);


                    if (finalDeferred.post_logic?.relationship_updates) {
                        const rels = finalDeferred.post_logic.relationship_updates;
                        // Deduct Accumulator
                        Object.entries(acc.relationships).forEach(([char, val]) => {
                            if (rels[char] !== undefined) rels[char] -= val;
                        });
                        // Deduct Future Tags
                        Object.entries(futureTagSum.relationships).forEach(([char, val]) => {
                            if (rels[char] !== undefined) rels[char] -= val;
                        });
                    }

                    setPendingLogic(finalDeferred);



                    // [Logging] Reconstruct & Log
                    const mergedResult = {
                        reply: finalStoryText,
                        raw_story: cleanStoryText,
                        router: routerOut,
                        logic: {
                            ...preLogicDebug,
                            triggerEventId: (p2Result.eventOut as any)?.triggerEventId,
                            candidates: (p2Result.eventOut as any)?.candidates,
                            event_debug_info: (p2Result.eventOut as any)?.debug,
                            currentEvent: (p2Result.eventOut as any)?.currentEvent
                        },
                        post_logic: postLogicOut,
                        martial_arts: p2Result.martialArtsOut,

                        allUsage: { ...p1Result.usage, ...p2Result.usage }, // [Fix] Merge usage objects manually
                        latencies: { ...p1Result.latencies, ...p2Result.latencies, total: p1Duration + p2Duration },
                        cost: (p1Result.costs?.total || 0) + (p2Result.costs?.total || 0),
                        usedModel: p1Result.usedModel
                    };

                    // [Telemetry & Debug Logging]
                    // Consolidated Log for Split Agent Execution (Phase 1 + Phase 2)

                    // 0. Prepare Debug Objects

                    // preLogicDebug is already defined in outer scope
                    const postLogicDebug = (p2Result as any).postLogicOut;
                    const castingDebug = (p1Result as any).suggestions; // [Fix] executeStoryPhase returns 'suggestions'
                    const maDebug = (p2Result as any).martialArtsOut;


                    // Latencies & Cost
                    const totalCost = (mergedResult.cost || 0);
                    const totalWon = Math.round(totalCost * KRW_PER_USD);

                    // Estimate latencies based on available data or reconstruction
                    // P1 has discrete latencies in result? p1Result usually has them attached if server returns them.
                    // If not, we use the client-side delta.
                    const p1Latencies = (p1Result as any).latencies || {};
                    const p2Latencies = (p2Result as any).latencies || {};

                    console.log(`%c[Telemetry] Async Phase 2 Done. Total Latency: ${mergedResult.latencies.total}ms | Cost: $${totalCost.toFixed(6)} (₩${totalWon.toLocaleString()})`, 'color: gray;');

                    // [New] Detailed Token Usage Log
                    if (mergedResult.allUsage) {
                        const usageTable = Object.entries(mergedResult.allUsage).map(([model, usage]: [string, any]) => ({
                            Model: model,
                            'In Tokens': usage.promptTokens,
                            'Out Tokens': usage.completionTokens,
                            'Total Tokens': usage.totalTokens,
                            'Cost ($)': `$${(usage.cost || 0).toFixed(6)}`
                        }));
                        console.table(usageTable);
                    }



                    // 1.5 Casting Log
                    if (castingDebug) {
                        const candidateCount = castingDebug.length;
                        console.groupCollapsed(`%c[Step 1.5] Casting Director (${candidateCount} candidates scanned)`, candidateCount > 0 ? 'color: purple; font-weight: bold;' : 'color: gray;');

                        if (candidateCount === 0) {
                            console.log("No candidates found (All filtered by Phase/Region/Active). check AgentCasting logic.");
                        } else {
                            // Display Top 15
                            console.log(`%c[Context Info]`, 'color: gray;', {
                                Location: effectiveGameState.currentLocation,
                                PlayerRank: effectiveGameState.playerStats?.playerRank,
                                PlayerLevel: effectiveGameState.playerStats?.level,
                                Phase: effectiveGameState.phase
                            });
                            console.log(`%c[Leaderboard (Top 15)]`, 'color: purple; font-weight: bold;', castingDebug.slice(0, 15).map((c: any) => ({
                                Name: c.name,
                                Score: c.score.toFixed(2),
                                Reasons: c.reasons.join(', ')
                            })));
                        }
                        console.groupEnd();
                    }

                    // 2. Pre-Logic Log
                    if (preLogicDebug) {
                        const scoreText = preLogicDebug.plausibility_score ? `Score: ${preLogicDebug.plausibility_score}/10` : (preLogicDebug.success ? 'Success' : 'Failure');
                        // [Debug] Force Expand if Fate changed (or just exist)
                        const fateChangeValue = preLogicDebug.state_changes?.fate;
                        if (fateChangeValue !== undefined) {
                            console.log(`%c[Fate System] PreLogic returned Fate Change: ${fateChangeValue} (Score: ${preLogicDebug.plausibility_score})`, 'color: gold; font-size: 14px; font-weight: bold;');
                        }

                        console.groupCollapsed(`%c[Step 2] Pre-Logic (${p1Latencies.preLogic || '?'}ms) (${scoreText})`, 'color: magenta; font-weight: bold;');
                        console.log(`%c[Input]`, 'color: gray; font-weight: bold;', preLogicDebug._debug_prompt);
                        console.log(`%c[Output]`, 'color: magenta; font-weight: bold;', {
                            Score: preLogicDebug.plausibility_score,
                            Analysis: preLogicDebug.judgment_analysis,
                            Guide: preLogicDebug.narrative_guide,
                            Mechanics: preLogicDebug.mechanics_log,
                            Changes: preLogicDebug.state_changes
                        });
                        console.groupEnd();
                    }

                    // 3. Story Log
                    console.groupCollapsed(`%c[Step 3] Story Writer (${p1Latencies.story || '?'}ms)`, 'color: green; font-weight: bold;');
                    if ((p1Result as any).systemPrompt) {
                        console.log(`%c[Input - Static (Cached)]`, 'color: gray; font-weight: bold;', (p1Result as any).systemPrompt);
                    }
                    if ((p1Result as any).finalUserMessage) {
                        console.log(`%c[Input - Dynamic (Logic + User)]`, 'color: blue; font-weight: bold;', (p1Result as any).finalUserMessage);
                    }
                    // Use clean text for log readability, or raw if preferred
                    console.log(`%c[Output]`, 'color: green; font-weight: bold;', finalStoryText);
                    console.groupEnd();

                    // 4. Post-Logic Log
                    if (postLogicDebug) {
                        console.groupCollapsed(`%c[Step 4] Post-Logic (${p2Latencies.postLogic || '?'}ms)`, 'color: orange; font-weight: bold;');
                        console.log(`%c[Input]`, 'color: gray; font-weight: bold;', postLogicDebug._debug_prompt);
                        console.log(`%c[Output]`, 'color: orange; font-weight: bold;', {
                            Mood: postLogicDebug.mood_update,
                            Relations: postLogicDebug.relationship_updates,
                            Stats: postLogicDebug.stat_updates,
                            Tension: postLogicDebug.tension_update,
                            NewGoals: postLogicDebug.new_goals,
                            GoalUpdates: postLogicDebug.goal_updates,
                            Memories: postLogicDebug.new_memories
                        });
                        console.groupEnd();
                    }

                    // 4.6. Choices Log (Post-Logic Parallel)
                    if (p2Result.choicesOut) {
                        console.groupCollapsed(`%c[Step 4.6] Choice Generation`, 'color: cyan; font-weight: bold;');
                        console.log(`%c[Input]`, 'color: gray; font-weight: bold;', p2Result.choicesOut._debug_prompt);
                        console.log(`%c[Output]`, 'color: cyan; font-weight: bold;', p2Result.choicesOut.text);
                        console.groupEnd();
                    }


                    // 4.5. Martial Arts Log
                    if (maDebug) {
                        const maResult = p2Result.martialArtsOut;
                        console.groupCollapsed(`%c[Step 4.5] Martial Arts (${p2Latencies.martial_arts || '?'}ms)`, 'color: red; font-weight: bold;');
                        console.log(`%c[Input]`, 'color: gray; font-weight: bold;', maDebug._debug_prompt);
                        console.log(`%c[Output]`, 'color: red; font-weight: bold;', {
                            LevelDelta: maResult?.level_delta,
                            NewSkills: maResult?.new_skills,
                            UpdatedSkills: maResult?.updated_skills,
                            Audit: maResult?.audit_log,
                            Stats: maResult?.stat_updates
                        });
                        console.groupEnd();
                    }


                    // 4.7. Event System Log
                    // [New] Log critical event triggering info
                    if (mergedResult.logic) {
                        const logicDebug = mergedResult.logic;
                        const triggerId = logicDebug.triggerEventId; // Legacy (Server)
                        const { mandatory, randomCandidates } = EventManager.checkEvents(useGameStore.getState()); // Client Check (Reference)
                        const serverCandidates = logicDebug.candidates; // [NEW] Server Source of Truth

                        // [Fix] Always show log for visibility
                        console.groupCollapsed(`%c[Step 4.7] Event System (Triggered: ${triggerId || 'None'})`, 'color: gold; font-weight: bold;');
                        console.log(`%c[Server Trigger]`, 'color: gold; font-weight: bold;', triggerId ? `✅ ${triggerId}` : '❌ None');

                        if (triggerId && logicDebug.currentEvent) {
                            console.log(`%c[Event Prompt]`, 'color: gray;', logicDebug.currentEvent);
                        }

                        // [NEW] Server Scan Results (Definitive)
                        if (serverCandidates) {
                            if (serverCandidates.mandatory && serverCandidates.mandatory.length > 0) {
                                console.log(`%c[Server Scan (Mandatory)]`, 'color: cyan;', serverCandidates.mandatory);
                            } else {
                                console.log(`%c[Server Scan (Mandatory)]`, 'color: cyan;', "None");
                            }

                            if (serverCandidates.random && serverCandidates.random.length > 0) {
                                console.log(`%c[Server Scan (Random)]`, 'color: orange;', `Count: ${serverCandidates.random.length}`, serverCandidates.random);
                            } else {
                                console.log(`%c[Server Scan (Random)]`, 'color: orange;', "None");
                            }
                        } else {
                            // Legacy Log
                            console.log(`%c[Candidates (Client)]`, 'color: gray;', mandatory.length > 0 ? "Blocked by Mandatory" : randomCandidates.map(e => e.id));
                        }
                        console.groupEnd();
                    }

                    // [Fix] Refresh Last Turn Summary with the FINAL story text
                    // This clears out any temporary "System Events" (like Realm Promotion) that were appended 
                    // to the previous summary, preventing them from contaminating the next turn's PreLogic.
                    // We use finalStoryText (cleaned) or cleanStoryText (raw). 
                    const nextSummary = cleanStoryText || finalStoryText;
                    if (nextSummary) {
                        let summaryToSet = nextSummary;
                        // [Fix] If a NEW Realm Event happened THIS turn, we must carry it forward to the Next Turn
                        // so PreLogic can see it. But since we are overwriting the summary, we must re-append it.
                        if (logicProgression && logicProgression.narrativeEvent) {
                            summaryToSet += "\n" + logicProgression.narrativeEvent;
                        }
                        useGameStore.getState().setLastTurnSummary(summaryToSet);
                        console.log("[VisualNovelUI] Refreshed LastTurnSummary for Next Turn (Event Carried: " + !!logicProgression?.narrativeEvent + ")");
                    }

                    // (Full logging omitted to save space, but critical data is captured in submitGameplayLog)

                    // Submit Log
                    submitGameplayLog({
                        session_id: activeSession?.user?.id || '00000000-0000-0000-0000-000000000000',
                        game_mode: useGameStore.getState().activeGameId,
                        turn_count: useGameStore.getState().turnCount,
                        choice_selected: text,
                        player_rank: useGameStore.getState().playerStats.playerRank,
                        location: useGameStore.getState().currentLocation,
                        timestamp: new Date().toISOString(),
                        player_name: useGameStore.getState().playerName,
                        cost: mergedResult.cost,
                        input_type: isDirectInput ? 'direct' : 'choice',
                        meta: {
                            hp: useGameStore.getState().playerStats.hp,
                            agent_router: routerOut?.intent,
                            pre_logic_score: preLogicDebug?.plausibility_score,
                            scenario_summary: useGameStore.getState().scenarioSummary
                        },
                        story_output: finalStoryText
                    });

                } catch (e) {
                    console.error("[VisualNovelUI] Phase 2 Error:", e);
                    addToast("Logic Sync Failed (Background)", "error");
                } finally {
                    setIsLogicPending(false);
                }
            })();

            // Update Average Response Time (Weighted: 70% history, 30% recent)
            const duration = Date.now() - startTime;
            setAvgResponseTime(prev => Math.round((prev * 0.7) + (duration * 0.3)));

            // Start playing
            if (segments.length > 0) {
                console.log(`[VisualNovelUI] Setting Script Queue (Size: ${segments.length})`);
                // Skip initial background, command, AND BGM segments
                let startIndex = 0;
                while (startIndex < segments.length && (
                    segments[startIndex].type === 'background' ||
                    segments[startIndex].type === 'command' ||
                    segments[startIndex].type === 'bgm'
                )) {
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
                        } else if (seg.commandType === 'update_stat') {
                            // [Fix] Handle Stat Update (Parsed as Command)
                            try {
                                const stats = JSON.parse(seg.content || '{}');
                                Object.entries(stats).forEach(([k, v]) => {
                                    const key = k.toLowerCase();
                                    const val = Number(v);
                                    if (isNaN(val)) return;

                                    // 1. Apply Immediate
                                    applyGameLogic({
                                        hpChange: key === 'hp' ? val : 0,
                                        mpChange: key === 'mp' ? val : 0,
                                        personalityChange: (key !== 'hp' && key !== 'mp') ? { [key]: val } : {}
                                    });

                                    // 2. Visual Feedback
                                    if (key === 'hp') addToast(`체력 ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'error');
                                    else if (key === 'mp') addToast(`내공 ${val > 0 ? '+' : ''}${val}`, 'info');
                                    else addToast(`${key} ${val > 0 ? '+' : ''}${val}`, 'info');

                                    // 3. Track for Pending Deduction (using Ref)
                                    if (key === 'hp') inlineAccumulatorRef.current.hp += val;
                                    else if (key === 'mp') inlineAccumulatorRef.current.mp += val;
                                    else if (key) {
                                        inlineAccumulatorRef.current.personality[key] = (inlineAccumulatorRef.current.personality[key] || 0) + val;
                                    }
                                });
                            } catch (e) {
                                console.warn("[VisualNovelUI] Failed to parse stat update command", e);
                            }
                        } else if (seg.commandType === 'update_relationship') {
                            // [Fix] Handle Relationship Update (Parsed as Command)
                            try {
                                const relData = JSON.parse(seg.content || '{}');
                                const charName = relData.charId || relData.character;
                                const val = Number(relData.value);

                                if (charName && !isNaN(val)) {
                                    useGameStore.getState().updateCharacterRelationship(charName, val);
                                    addToast(`${charName} 호감도 ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'info');

                                    // Track for Pending Deduction (using Ref)
                                    inlineAccumulatorRef.current.relationships[charName] = (inlineAccumulatorRef.current.relationships[charName] || 0) + val;
                                }
                            } catch (e) {
                                console.warn("[VisualNovelUI] Failed to parse relationship update command", e);
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

        // [Adaptive Agent] Track User Input Style
        addChoiceToHistory({ text: inputToLog, type: 'input', timestamp: Date.now() });

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

    const handleStartGame = async () => {
        // [Safety] Immediate Feedback
        setIsProcessing(true);
        setIsLogicPending(true); // Assume we might need AI

        try {
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

            // [Fallback] If scenario data is missing/empty, Force AI Start
            if (!processedScenario || segments.length === 0) {
                console.warn("[StartGame] Initial Scenario is empty. Triggering AI Generation fallback.");
                addToast("오프닝 생성 중...", "info");

                // Fallback: Just trigger standard turn which will see empty history and generate intro
                const result = await serverGenerateResponse(
                    [], // history (empty for start)
                    `게임 시작. 주인공 이름: ${effectiveName}. [Game Start]`, // userMessage
                    useGameStore.getState(), // gameState
                    'ko' // language
                );

                if (result && result.text) {
                    const fallbackSegments = parseScript(result.text);
                    // Add to history
                    addMessage({ role: 'model', text: result.text });

                    if (fallbackSegments.length > 0) {
                        setCurrentSegment(fallbackSegments[0]);
                        setScriptQueue(fallbackSegments.slice(1));
                        setIsLogicPending(false); // We have content now
                        setIsProcessing(false);
                        return;
                    }
                }

                // If even fallback fails
                addToast("오프닝 생성 실패. 다시 시도해주세요.", "error");
                setIsProcessing(false);
                setIsLogicPending(false);
                return;
            }

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

                // [Logic] We have content, so we are not "pending" anymore for the UI check
                setIsLogicPending(false);

                // Set character expression if the first segment is dialogue
                if (first.type === 'dialogue' && first.character) {
                    const charMap = useGameStore.getState().characterMap || {};
                    const isMainCharacter = !!charMap[first.character];

                    // [New] Override check for first segment
                    // Prevent override if it is a Main Character (AI descriptions in parens shouldn't hijack the image)
                    if (first.characterImageKey && first.character && !isMainCharacter) {
                        useGameStore.getState().setExtraOverride(first.character, first.characterImageKey);
                    }

                    const charName = first.character === playerName ? '주인공' : first.character;
                    const emotion = first.expression || 'Default';
                    const gameId = useGameStore.getState().activeGameId || 'god_bless_you';
                    const extraMap = useGameStore.getState().extraMap;

                    let imagePath = '';
                    const combinedKey = `${charName}_${emotion}`;

                    // [Fix] Explicit Key Lookup (Priority)
                    // Only use characterImageKey if NOT a Main Character (unless we add a costume system later)
                    // [Fix] Also skip if text is from Hidden Protagonist (who has a forced image override)
                    const state = useGameStore.getState();
                    const isHiddenProtagonistMatch = isHiddenProtagonist(first.character, playerName, state.protagonistImageOverride);

                    if (first.characterImageKey && !isMainCharacter && !isHiddenProtagonistMatch) {
                        if (extraMap && extraMap[first.characterImageKey]) {
                            imagePath = `/assets/${gameId}/ExtraCharacters/${extraMap[first.characterImageKey]}`;
                        } else {
                            imagePath = getCharacterImage(first.characterImageKey, emotion);
                        }
                    }
                    else if (availableExtraImages && availableExtraImages.includes(combinedKey) && !isHiddenProtagonist) {
                        imagePath = `/assets/${gameId}/ExtraCharacters/${combinedKey}.png`;
                    } else if (extraMap && extraMap[charName] && !isHiddenProtagonist) {
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
                // Even if "empty" content, we finished "processing" the start request.
                // But this will trigger the error screen. 
                // Let's rely on standard logic pending being false now.
                setIsLogicPending(false);
            }
        } catch (e) {
            console.error("[StartGame] Error:", e);
            addToast("게임 시작 중 오류 발생", "error");
            setIsLogicPending(false);
        } finally {
            setIsProcessing(false);
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
            (logicResult.expChange && logicResult.expChange > 10) || // Major EXP gain
            // [NEW] Check for new skills (unified)
            (logicResult.new_skills && logicResult.new_skills.length > 0);

        if (isGrowthEvent) {
            newStats.growthStagnation = 0;
            // console.log("[Growth] Stagnation Reset!");
        }

        // Initialize if missing (Redundant but safe)
        if (!newStats.relationships) newStats.relationships = {};

        // [New] Generic Stat Updates (PostLogic)
        if (logicResult.stat_updates) {
            console.log("[applyGameLogic] Processing Generic Stat Updates:", logicResult.stat_updates);
            Object.entries(logicResult.stat_updates).forEach(([key, val]) => {
                const numVal = Number(val);
                if (isNaN(numVal) || numVal === 0) return;

                const lowerKey = key.toLowerCase();

                // 1. Core Stats
                if (lowerKey === 'hp') {
                    newStats.hp = Math.min(Math.max(0, newStats.hp + numVal), newStats.maxHp);
                    handleVisualDamage(numVal, newStats.hp, newStats.maxHp);
                }
                else if (lowerKey === 'mp') newStats.mp = Math.min(Math.max(0, newStats.mp + numVal), newStats.maxMp);
                else if (lowerKey === 'gold') newStats.gold = Math.max(0, newStats.gold + numVal);
                else if (lowerKey === 'fame') {
                    newStats.fame = Math.max(0, (newStats.fame || 0) + numVal);
                    addToast(`${t.fame} ${numVal > 0 ? '+' : ''}${numVal}`, numVal > 0 ? 'success' : 'warning');
                }
                else if (lowerKey === 'neigong') newStats.neigong = Math.max(0, (newStats.neigong || 0) + numVal);
                else if (lowerKey === 'fate') newStats.fate = Math.max(0, (newStats.fate || 0) + numVal);

                // 2. Personality Stats
                else if (newStats.personality && Object.prototype.hasOwnProperty.call(newStats.personality, lowerKey)) {
                    // @ts-ignore
                    newStats.personality[lowerKey] = Math.min(100, Math.max(-100, (newStats.personality[lowerKey] || 0) + numVal));
                    // Optional: Toast for personality update? Maybe too spammy if handled by tag injection.
                }

                // 3. Base Stats
                else if (['str', 'agi', 'int', 'vit', 'luk'].includes(lowerKey)) {
                    // @ts-ignore
                    newStats[lowerKey] = (newStats[lowerKey] || 10) + numVal;
                }
            });
        }

        if (logicResult.hpChange) {
            newStats.hp = Math.min(Math.max(0, newStats.hp + logicResult.hpChange), newStats.maxHp);
            handleVisualDamage(logicResult.hpChange, newStats.hp, newStats.maxHp);
        }
        if (logicResult.mpChange) newStats.mp = Math.min(Math.max(0, newStats.mp + logicResult.mpChange), newStats.maxMp);
        if (logicResult.goldChange) newStats.gold = Math.max(0, newStats.gold + logicResult.goldChange);

        if (logicResult.expChange) newStats.exp += logicResult.expChange;
        if (logicResult.fameChange) newStats.fame = Math.max(0, (newStats.fame || 0) + logicResult.fameChange);
        // [Fate System] Update Fate (Generic 'fate' or legacy 'fateChange')
        if (logicResult.fate !== undefined) {
            console.log(`[applyGameLogic] Applying Fate Change: ${logicResult.fate}`);
            // [Toast] Visual Feedback
            if (logicResult.fate !== 0) addToast(`운명 포인트 ${logicResult.fate > 0 ? '+' : ''}${logicResult.fate}`, 'info');
            newStats.fate = Math.max(0, (newStats.fate || 0) + logicResult.fate);
        }
        else if (logicResult.fateChange !== undefined) {
            console.log(`[applyGameLogic] Applying Fate Change (Legacy): ${logicResult.fateChange}`);
            newStats.fate = Math.max(0, (newStats.fate || 0) + logicResult.fateChange);
        }

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

        if (logicResult.neigongChange) {
            newStats.neigong = Math.max(0, (newStats.neigong || 0) + logicResult.neigongChange);
            addToast(`내공(Internal Energy) ${logicResult.neigongChange > 0 ? '+' : ''}${logicResult.neigongChange}년`, logicResult.neigongChange > 0 ? 'success' : 'warning');
        }

        // [New] Player Rank & Faction Update
        if (logicResult.playerRank) {
            newStats.playerRank = logicResult.playerRank;
            addToast(`등급 변경: ${logicResult.playerRank}`, 'success');
        }
        if (logicResult.factionChange) {
            newStats.faction = logicResult.factionChange;
            addToast(`소속 변경: ${logicResult.factionChange}`, 'info');
        }

        // Skills
        // Skills (Unified System)
        // logicResult.new_skills is Array of Skill Objects
        if (logicResult.new_skills) {
            logicResult.new_skills.forEach((skill: Skill) => {
                // Check duplicate by ID
                if (!newStats.skills.find(s => s.id === skill.id)) {
                    newStats.skills.push(skill);
                    addToast(`신규 스킬 획득: ${skill.name}`, 'success');
                }
            });
        }

        // [Unified] Skill Proficiency Updates
        if (logicResult.updated_skills) {
            logicResult.updated_skills.forEach((update: { id: string, proficiency_delta: number }) => {
                const skillIndex = newStats.skills.findIndex(s => s.id === update.id);
                if (skillIndex > -1) {
                    const skill = newStats.skills[skillIndex];
                    const oldProf = skill.proficiency || 0;
                    const newProf = Math.min(100, Math.max(0, oldProf + update.proficiency_delta));

                    // Direct mutation of the clones array object
                    newStats.skills[skillIndex] = { ...skill, proficiency: newProf };

                    if (newProf !== oldProf) {
                        addToast(`${skill.name} 숙련도: ${oldProf}% -> ${newProf}% (${update.proficiency_delta > 0 ? '+' : ''}${update.proficiency_delta})`, 'info');
                    }
                }
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
            // Remove
            if (logicResult.injuriesUpdate.remove) {
                const initialLen = currentInjuries.length;
                const toRemove = new Set<string>();

                logicResult.injuriesUpdate.remove.forEach((targetInj: string) => {
                    // 1. Exact Match
                    if (currentInjuries.includes(targetInj)) {
                        toRemove.add(targetInj);
                        return;
                    }

                    // 2. Fuzzy Match (Fallback)
                    const best = findBestMatchDetail(targetInj, currentInjuries);
                    // Threshold 0.6 (Dice Coefficient)
                    if (best && best.rating >= 0.6) {
                        console.log(`[Injury] Fuzzy Removal: '${targetInj}' matches '${best.target}' (Score: ${best.rating.toFixed(2)})`);
                        toRemove.add(best.target);
                    }
                });

                currentInjuries = currentInjuries.filter(inj => !toRemove.has(inj));

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

        // [Universal] Level & Rank Progression
        const maResult = logicResult.martial_arts;
        if (maResult && maResult.level_delta) {
            const delta = maResult.level_delta;
            const oldLevel = newStats.level || 1;
            newStats.level = oldLevel + delta;
            addToast(`성장 (Growth): +${delta.toFixed(2)} Level`, 'success');

            // Check for Rank Up (Title Change)
            const gameId = useGameStore.getState().activeGameId || 'wuxia';
            let newTitle = '';
            let map = null;

            if (gameId === 'wuxia') map = LEVEL_TO_REALM_MAP;
            else if (gameId === 'god_bless_you') map = LEVEL_TO_RANK_MAP;

            if (map) {
                const entry = map.find(m => newStats.level >= m.min && newStats.level <= m.max);
                if (entry) {
                    if ((entry as any).id) {
                        // [Localization Fix] Unified Title Resolution
                        const lang = useGameStore.getState().language || 'ko';
                        const category = gameId === 'wuxia' ? 'realms' : 'ranks';
                        // @ts-ignore
                        const t = translations[lang]?.[gameId]?.[category];
                        newTitle = (t && t[(entry as any).id]) ? t[(entry as any).id] : (entry as any).title || "Unknown";
                    } else {
                        newTitle = (entry as any).title || "Unknown";
                    }
                }
            }

            if (newTitle && newTitle !== newStats.playerRank) {
                newStats.playerRank = newTitle;
                // useGameStore.getState().setPlayerRealm(newTitle); // [Removed] Legacy State
                addToast(`Rank Up! [${newTitle}]`, 'success');
                console.log(`[Progression] Level ${oldLevel.toFixed(2)} -> ${newStats.level.toFixed(2)} | Rank: ${newTitle}`);
            }
        }

        // [New Wuxia] New Skills Logic
        if (maResult && maResult.new_skills && maResult.new_skills.length > 0) {
            const currentSkills = useGameStore.getState().playerStats.skills || [];
            maResult.new_skills.forEach((skill: any) => {
                // Check duplicate ID
                if (!currentSkills.find((s: any) => s.id === skill.id)) {
                    // Logic to add skill is handled in setState below, but we can do a toast here
                    addToast(`New Skill: ${skill.name}`, 'success');
                }
            });
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

        // [New] Event Lifecycle Management (Fix for Event Loop Bug)
        // 1. Trigger New Event
        if (logicResult.triggerEventId) {
            const currentActive = useGameStore.getState().activeEvent;
            // Only trigger if not already active (or different)
            if (!currentActive || currentActive.id !== logicResult.triggerEventId) {
                const eventPayload = {
                    id: logicResult.triggerEventId,
                    prompt: logicResult.currentEvent || "", // Save prompt for context
                    startedTurn: useGameStore.getState().turnCount
                };
                useGameStore.getState().setActiveEvent(eventPayload);
                useGameStore.getState().addTriggeredEvent(logicResult.triggerEventId);
                addToast("새로운 이벤트가 발생했습니다!", 'info');
                console.log(`[Event System] New Event Triggered & Activated: ${logicResult.triggerEventId}`);
            }
        }

        // 2. Clear Completed/Ignored Event (From PreLogic)
        if (logicResult.event_status === 'completed' || logicResult.event_status === 'ignored') {
            const currentActive = useGameStore.getState().activeEvent;
            if (currentActive) {
                // [Fix] Failsafe: Ensure it is marked as triggered (Prevent Loops)
                if (logicResult.event_status === 'completed') {
                    const triggered = useGameStore.getState().triggeredEvents || [];
                    if (!triggered.includes(currentActive.id)) {
                        useGameStore.getState().addTriggeredEvent(currentActive.id);
                        console.log(`[Event System] Failsafe: Added ${currentActive.id} to triggeredEvents on completion.`);
                    }
                }

                useGameStore.getState().setActiveEvent(null);
                console.log(`[Event System] Event Cleared (${logicResult.event_status}): ${currentActive.id}`);
                addToast(logicResult.event_status === 'completed' ? "이벤트가 종료되었습니다." : "이벤트가 넘어갔습니다.", 'info');
            }
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
                    // [Fix] Access flattened keys directly
                    const label = (t as any)[trait] || trait.charAt(0).toUpperCase() + trait.slice(1);
                    addToast(`${label} ${value > 0 ? '+' : ''}${value}`, value > 0 ? 'success' : 'warning');
                }
            });
        }

        // [New] Player Rank Update (Sync mechanism if Logic returns direct rank)
        if (logicResult.playerRank) {
            const currentRank = useGameStore.getState().playerStats.playerRank;
            if (currentRank !== logicResult.playerRank) {
                // Update Rank AND Realm to remain consistent
                newStats.playerRank = logicResult.playerRank;
                // We don't call setPlayerStats here directly anymore, as newStats is committed at the end
                // setPlayerStats({ ...newStats, playerRank: logicResult.playerRank }); <-- Removed direct set

                // Also update top-level playerRealm State immediately for safety
                // useGameStore.getState().setPlayerRealm(logicResult.playerRank); // [Removed] Legacy

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
                    addToast(t.systemMessages?.secretsUpdated?.replace('{0}', loc.id) || `Secrets Updated: ${loc.id}`, 'info');
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

            // [NEW] Faction Update (PostLogic)
            if (postLogic.factionChange) {
                const currentFaction = useGameStore.getState().playerStats.faction;
                if (currentFaction !== postLogic.factionChange) {
                    newStats.faction = postLogic.factionChange;
                    useGameStore.getState().setPlayerStats(newStats);
                    addToast(`소속 변경: ${postLogic.factionChange}`, 'success');
                    console.log(`[PostLogic] Faction updated: ${postLogic.factionChange}`);
                }
            }

            // [NEW] Rank Update (PostLogic)
            if (postLogic.playerRank) {
                const currentRank = useGameStore.getState().playerStats.playerRank;
                if (currentRank !== postLogic.playerRank) {
                    newStats.playerRank = postLogic.playerRank;
                    useGameStore.getState().setPlayerStats(newStats);
                    addToast(`Rank Up: ${postLogic.playerRank}`, 'success');
                    console.log(`[PostLogic] Rank updated: ${postLogic.playerRank}`);
                }
            }

            // [NEW] Injury Management (Healing & Mutation)
            if (postLogic.resolved_injuries || postLogic.new_injuries) {
                useGameStore.setState(state => {
                    const currentInjuries = state.playerStats.active_injuries || [];
                    let updatedInjuries = [...currentInjuries];

                    // 1. Resolve (Remove) Injuries
                    if (postLogic.resolved_injuries && postLogic.resolved_injuries.length > 0) {
                        postLogic.resolved_injuries.forEach((resolved: string) => {
                            // [Fix] Fuzzy Match Logic (Dice Coefficient)
                            // We attempt to find the BEST match in the current injury list.
                            // If match score > 0.6, we accept it as the target.

                            let targetToRemove: string | null = null;
                            const candidates = updatedInjuries;

                            // 1. Exact or Simple Inclusion Match (Legacy)
                            const exact = candidates.find(c => c === resolved);
                            if (exact) targetToRemove = exact;
                            else {
                                // 2. Fuzzy Match
                                const bestMatch = findBestMatchDetail(resolved, candidates);
                                if (bestMatch && bestMatch.rating >= 0.5) { // 0.5 Threshold (Lenient)
                                    console.log(`[Injury] Fuzzy Resolved: "${resolved}" -> "${bestMatch.target}" (Score: ${bestMatch.rating.toFixed(2)})`);
                                    targetToRemove = bestMatch.target;
                                } else {
                                    // 3. Fallback: Check for substring inclusion (Aggressive)
                                    const subMatch = candidates.find(c => c.includes(resolved) || resolved.includes(c));
                                    if (subMatch) {
                                        console.log(`[Injury] Substring Resolved: "${resolved}" -> "${subMatch}"`);
                                        targetToRemove = subMatch;
                                    }
                                }
                            }

                            if (targetToRemove) {
                                // Remove specific instance
                                updatedInjuries = updatedInjuries.filter(i => i !== targetToRemove);
                                addToast(t.systemMessages?.statusRecovered?.replace('{0}', targetToRemove) || `상태 회복: ${targetToRemove}`, 'success');
                            } else {
                                // [Fix] Silent Failure
                                // If AI tries to heal something clearly not there, just log it. Do NOT annoy user.
                                console.warn(`[Injury] AI tried to heal '${resolved}' but no match found in:`, updatedInjuries);
                            }
                        });
                    }

                    // 2. Add New Injuries (Mutation/New)
                    if (postLogic.new_injuries && postLogic.new_injuries.length > 0) {
                        postLogic.new_injuries.forEach((newInjury: string) => {
                            if (!updatedInjuries.includes(newInjury)) {
                                updatedInjuries.push(newInjury);
                                addToast(t.systemMessages?.injuryOccurred?.replace('{0}', newInjury) || `부상 발생/악화: ${newInjury}`, 'warning');
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
                            // [Localization] Use flattened keys from translations
                            const label = (t as any)[key] || key;
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
        // This is the SINGLE SOURCE OF TRUTH for Martial Arts updates.
        if (logicResult.martial_arts) {
            const ma = logicResult.martial_arts;
            console.log("[MartialArts] Update Received:", ma);

            useGameStore.setState(state => {
                const currentStats = { ...state.playerStats };
                let hasUpdates = false;

                // 1. Realm Update
                if (ma.realm_update) {
                    // Update generic PlayerRank (Unified Skill System)
                    const normalizedRealm = ma.realm_update.split('(')[0].trim(); // Normalize "이류 (2nd Rate)" -> "이류"

                    if (currentStats.playerRank !== normalizedRealm) {
                        currentStats.playerRank = normalizedRealm;
                        // currentStats.realm = ma.realm_update; // [Removed] Legacy
                        // currentStats.realmProgress = 0; // [Removed] Legacy
                        hasUpdates = true;
                        addToast(t.systemMessages?.realmAscension?.replace('{0}', ma.realm_update) || `경지 등극: ${ma.realm_update}`, 'success');
                    }
                }

                // 2. Realm Progress Delta -> Map to EXP
                if (ma.realm_progress_delta !== undefined) {
                    // Treat progress delta as EXP gain for now
                    const currentExp = currentStats.exp || 0;
                    currentStats.exp = currentExp + ma.realm_progress_delta;
                    hasUpdates = true;
                    // Only toast for significant gain
                    if (ma.realm_progress_delta >= 5) {
                        addToast(t.systemMessages?.realmProgress?.replace('{0}', ma.realm_progress_delta) || `깨달음: 경험치 +${ma.realm_progress_delta}`, 'info');
                    }
                }

                // 3. Neigong (Internal Energy) Update
                if (ma.stat_updates?.neigong) {
                    const delta = ma.stat_updates.neigong;
                    currentStats.neigong = (currentStats.neigong || 0) + delta;
                    // Float correction (optional, but display usually handles it)
                    currentStats.neigong = Math.round(currentStats.neigong * 100) / 100;
                    hasUpdates = true;
                    const sign = delta > 0 ? '+' : '';
                    addToast(t.systemMessages?.neigongGain?.replace('{0}', `${sign}${delta}`) || `내공 ${sign}${delta}년`, 'success');
                }

                // 3.5. HP/MP Logic from Martial Arts (Penalty/Growth)
                if (ma.stat_updates?.hp) {
                    currentStats.hp = Math.max(0, (currentStats.hp || 0) + ma.stat_updates.hp);
                    hasUpdates = true;
                }
                if (ma.stat_updates?.mp) {
                    currentStats.mp = Math.max(0, (currentStats.mp || 0) + ma.stat_updates.mp);
                    hasUpdates = true;
                }

                // 3.6 Merge Injuries from Martial Arts
                if (ma.stat_updates?.active_injuries) {
                    const currentInj = currentStats.active_injuries || [];
                    ma.stat_updates.active_injuries.forEach((inj: string) => {
                        if (!currentInj.includes(inj)) {
                            currentInj.push(inj);
                            addToast(t.systemMessages?.internalInjury?.replace('{0}', inj) || `내상(Internal Injury): ${inj}`, 'warning');
                            hasUpdates = true;
                        }
                    });
                    currentStats.active_injuries = currentInj;
                }


                // 4. Skills Update
                // Add New Skills
                if (ma.new_skills && ma.new_skills.length > 0) {
                    const currentSkills = currentStats.skills || [];
                    const newSkills = ma.new_skills.filter((n: any) => !currentSkills.find((e: any) => e.name === n.name));
                    if (newSkills.length > 0) {
                        currentStats.skills = [...currentSkills, ...newSkills];
                        hasUpdates = true;
                        newSkills.forEach((skill: any) => addToast(t.systemMessages?.newArt?.replace('{0}', skill.name) || `신규 스킬 습득: ${skill.name}`, 'success'));
                    }
                }

                // Update Existing Skills (Proficiency)
                if (ma.updated_skills && ma.updated_skills.length > 0) {
                    const currentSkills = currentStats.skills || [];
                    let skillUpdated = false;
                    const updatedList = currentSkills.map((skill: any) => {
                        const update = ma.updated_skills.find((u: any) => u.id === skill.id || u.name === skill.name); // Support Name or ID
                        if (update) {
                            skillUpdated = true;
                            // Update Proficiency
                            const newProf = Math.min(100, Math.max(0, (skill.proficiency || 0) + update.proficiency_delta));
                            return { ...skill, proficiency: newProf };
                        }
                        return skill;
                    });

                    if (skillUpdated) {
                        currentStats.skills = updatedList;
                        hasUpdates = true;
                    }
                }

                // 5. Growth Stagnation - Calculated from update existence
                if (hasUpdates) {
                    currentStats.growthStagnation = 0;
                } else {
                    // Only increment if we actually ran MA logic but got no growth?
                    // Rely on external cycle for general stagnation, but here we reset it on growth.
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
                addToast(t.systemMessages?.moodChanged?.replace('{0}', logicResult.newMood.toUpperCase()) || `Mood Changed: ${logicResult.newMood.toUpperCase()}`, 'info');
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
                            addToast(t.systemMessages?.characterDefeated?.replace('{0}', id) || `Character Defeated: ${id}`, 'warning');
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

                // [Optimization] Memory Summarization Logic
                // Trigger if memories exceed threshold (12) -> Summarize down to ~10
                const updatedCharData = useGameStore.getState().characterData[targetId];
                const currentMemories = updatedCharData?.memories || [];

                if (currentMemories.length > 12) {
                    console.log(`[Memory Limit] ${targetId} has ${currentMemories.length} memories. Triggering Summary...`);
                    // activeToast is annoying if it happens too often, maybe just log? 
                    // User requested functionality so a toast is good feedback.
                    addToast(`${targetId}의 기억을 정리하는 중...`, 'info');

                    // Fire-and-forget (don't await) to not block UI
                    serverGenerateCharacterMemorySummary(targetId, currentMemories)
                        .then((summarized: string[]) => {
                            if (summarized && Array.isArray(summarized) && summarized.length > 0) {
                                console.log(`[Memory Summary] ${targetId}: ${currentMemories.length} -> ${summarized.length}`);
                                // Verify we actually reduced it or at least didn't break it
                                if (summarized.length < currentMemories.length) {
                                    useGameStore.getState().updateCharacterData(targetId, { memories: summarized });
                                    addToast(`${targetId}의 중요한 기억만 남겼습니다.`, 'success');
                                }
                            }
                        })
                        .catch(err => console.error(`[Memory Summary Failed] ${targetId}`, err));
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
        const { mandatory: triggeredEvents } = EventManager.checkEvents({
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

                addToast(t.systemMessages?.eventTriggered?.replace('{0}', matchedEvent.id) || `Event Triggered: ${matchedEvent.id}`, 'info');

                // [CRITICAL] Persist Active Event for Next Turn's Context
                useGameStore.getState().setActiveEvent(matchedEvent);

                console.log(`[Event Found] Prompt Length: ${matchedEvent.prompt.length}`);
            } else {
                console.warn(`[Logic Warning] Triggered ID '${logicResult.triggerEventId}' not found in Client Event Registry.`);

                // [Fallback] Construct Event from Server Data
                if (logicResult.currentEvent) {
                    console.log(`[Fallback] Using Server-provided Event Prompt for '${logicResult.triggerEventId}'`);
                    const syntheticEvent = {
                        id: logicResult.triggerEventId,
                        title: logicResult.triggerEventId, // Fallback title
                        prompt: logicResult.currentEvent,
                        type: logicResult.type || 'SERVER_EVENT',
                        priority: 100
                    };

                    useGameStore.getState().setActiveEvent(syntheticEvent);
                    activeEventPrompt = syntheticEvent.prompt;
                    hasActiveEvent = syntheticEvent.id;

                    addToast(t.systemMessages?.eventTriggered?.replace('{0}', syntheticEvent.id) || `Event Triggered: ${syntheticEvent.id}`, 'info');
                }
            }
        }


        // [Event System Refactor] PreLogic determines Event Lifecycle
        // Instead of auto-clearing, we listen to the AI's judgment.
        // 'active': Keep event / 'completed' or 'ignored': Clear event.
        if (logicResult.logic && (logicResult.logic.event_status === 'completed' || logicResult.logic.event_status === 'ignored')) {
            const currentActiveEvent = useGameStore.getState().activeEvent;
            if (currentActiveEvent) {
                console.log(`[Event System] PreLogic signaled '${logicResult.logic.event_status}'. Clearing Active Event: ${currentActiveEvent.id}`);
                addToast(`Event Resolved: ${currentActiveEvent.title || currentActiveEvent.id}`, 'info');
                useGameStore.getState().setActiveEvent(null);
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
                addToast(t.systemMessages?.eventsTriggered?.replace('{0}', triggeredEvents.length.toString()) || `${triggeredEvents.length} Event(s) Triggered`, 'info');
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

                {/* [무협 UI 개선] HUD 레이어 */}
                {activeGameId === 'wuxia' ? (
                    <WuxiaHUD
                        playerName={playerName}
                        playerStats={playerStats}
                        onOpenProfile={() => setShowCharacterInfo(true)}
                        onOpenWiki={() => setShowWiki(true)}
                        language={language || 'ko'}
                        day={day}
                        time={time}
                        location={currentLocation || 'Unknown'}
                    />
                ) : (
                    <ModernHUD
                        playerName={playerName}
                        playerStats={playerStats}
                        onOpenPhone={() => setIsPhoneOpen(true)}
                        onOpenProfile={() => setShowCharacterInfo(true)}
                        day={day}
                        time={time}
                        location={currentLocation || 'Unknown'}
                    />
                )}
                {/* [Common UI] Top-Right Controls (Tokens, Settings, Debug) */}
                <div className="absolute top-4 right-4 z-[60] flex items-center gap-3 pointer-events-auto">
                    {/* Token Display */}
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-500/30 flex items-center gap-2 shadow-lg">
                        <span className="text-lg">🪙</span>
                        <span className="text-yellow-400 font-bold font-mono text-sm md:text-base">
                            {userCoins?.toLocaleString() || 0}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowRechargePopup(true); }}
                            className="bg-yellow-600 hover:bg-yellow-500 text-black text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded ml-1 transition-colors"
                        >
                            +
                        </button>
                    </div>

                    {/* Settings Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowResetConfirm(true); }}
                        className="p-2 bg-black/60 hover:bg-gray-800/80 rounded-full border border-gray-600 text-gray-300 hover:text-white transition-all shadow-lg"
                        title={(t as any).settings || "Settings"}
                    >
                        <Settings className="w-5 h-5 md:w-6 md:h-6" />
                    </button>

                    {/* Debug Button (Conditional) */}
                    {(isLocalhost || isDebugOpen) && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsDebugOpen(true); }}
                            className="p-2 bg-purple-900/60 hover:bg-purple-800/80 rounded-full border border-purple-500/50 text-purple-300 hover:text-white transition-all shadow-lg"
                            title="Debug Menu"
                        >
                            <Bolt className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    )}
                </div>

                {/* [리팩토링 메모] HUD 렌더링 로직은 `ui/ModernHUD.tsx` 및 `ui/WuxiaHUD.tsx`로 분리되었습니다. */}

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
                <div className={`absolute bottom-[5vh] right-[4vw] md:bottom-10 md:right-8 flex gap-[1vw] md:gap-2 z-[100] transition-opacity pointer-events-auto ${choices.length > 0 ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}>
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
                    onClose={() => {
                        setShowWiki(false);
                        setWikiTargetCharacter(null);
                    }}
                    initialCharacter={wikiTargetCharacter || (useGameStore.getState().activeGameId === 'wuxia' ? "연화린" : "고하늘")}
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
                                                            if (confirm(t.confirmLogout)) {
                                                                if (!supabase) {
                                                                    console.warn("Supabase client not available for logout.");
                                                                    return;
                                                                }
                                                                const { error } = await supabase.auth.signOut();
                                                                if (error) {
                                                                    alert(t.logoutError?.replace('{0}', error.message));
                                                                    console.error("Logout error:", error);
                                                                } else {
                                                                    setSession(null);
                                                                    window.location.href = '/';
                                                                }
                                                            }
                                                        }}
                                                        className="flex-1 py-2.5 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 rounded-lg text-sm font-bold transition-all border border-gray-200 shadow-sm hover:shadow-md"
                                                    >
                                                        {t.logout}
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const confirmMsg = `⚠ ${t.confirmWithdrawal}`;
                                                            if (confirm(confirmMsg)) {
                                                                if (prompt(t.deleteInputPrompt) === '삭제') {
                                                                    setIsProcessing(true);
                                                                    try {
                                                                        const { deleteAccount } = await import('@/app/actions/auth');
                                                                        const result = await deleteAccount();
                                                                        if (result.success) {
                                                                            localStorage.clear(); // [CLEANUP] Clear all local data to prevent ghost state
                                                                            alert(t.withdrawalComplete);
                                                                            window.location.href = '/';
                                                                        } else {
                                                                            alert(`${t.withdrawalError}: ${result.error}`);
                                                                        }
                                                                    } catch (e) {
                                                                        console.error("Delete failed:", e);
                                                                        alert(t.errorGenerating);
                                                                    } finally {
                                                                        setIsProcessing(false);
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                                                    >
                                                        {t.withdrawal}
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
                                        <span>⚠</span> {t.dangerZone || "Danger Zone"}
                                    </h4>
                                    <div className="bg-red-50 p-5 rounded-xl border border-red-100 shadow-inner">
                                        <p className="text-gray-500 text-sm mb-4">
                                            {t.resetDescription}
                                        </p>
                                        <button
                                            onClick={() => {
                                                if (confirm(t.resetConfirm)) {
                                                    useGameStore.getState().resetGame();
                                                    router.push('/');
                                                }
                                            }}
                                            className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                                        >
                                            {t.resetGameLabel}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Top Right Menu (Removed - Merged into Top Resources Row & Profile Click) */}

                {/* Toast Notifications */}
                <div className="fixed top-24 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
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
                        <>
                            {/* [NEW] Background Dimmer (Layered BELOW UI at z-20) */}
                            <div className="absolute inset-0 bg-black/40 z-[20] pointer-events-none transition-opacity duration-500" />

                            {/* Center: Choices (Layered ABOVE UI at z-60) */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60] p-4">
                                <div className="flex flex-col gap-3 md:gap-4 w-[85vw] md:w-[min(50vw,800px)] items-center pointer-events-auto">
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


                                                // [Adaptive Agent] Track Selected Choice
                                                addChoiceToHistory({ text: choice.content, type: 'selected', timestamp: Date.now() });

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
                        </>
                    )
                }

                {/* Fallback for stuck state or Start Screen */}
                {
                    isMounted && !currentSegment && choices.length === 0 && scriptQueue.length === 0 && !isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-[100]">
                            {/* [Fix] Use turnCount === 0 to prioritize Creation Wizard even if logs exist */}
                            {turnCount === 0 ? (
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

                                                let prompt = `
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
                                                    skills: [] as Skill[],   // [Fixed] Unified Skills Type
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
                                                    newStats.skills = [...(newStats.skills || []), basicSword];
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

                                                // [New] Protagonist Image Selection
                                                const protoImage = selectProtagonistImage(pTone);
                                                if (protoImage) {
                                                    const currentOverrides = useGameStore.getState().extraOverrides || {};
                                                    // Bind to PLAYER NAME for persistence (ImageMapper resolves '주인공' -> PlayerName)
                                                    useGameStore.getState().setExtraOverride(finalName, protoImage);
                                                    console.log("[Creation] Selected Protagonist Image:", protoImage, "for", finalName);
                                                }

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

                                                // [Hidden Settings Logic]
                                                if (activeGameId === 'wuxia') {
                                                    const hidden = getHiddenSettings(finalName);
                                                    if (hidden && hidden.found) {
                                                        console.log("Applying Hidden Settings:", hidden);

                                                        // [New] Apply Overrides to Store
                                                        useGameStore.getState().setHiddenOverrides({
                                                            persona: hidden.personaOverride,
                                                            scenario: hidden.scenarioOverride,
                                                            disabledEvents: hidden.disabledEvents,
                                                            protagonistImage: hidden.imageOverride // [New]
                                                        });

                                                        // 1. Append Narrative
                                                        prompt += `\n${hidden.narrative}\n`;

                                                        // [New] Append Scenario Override if matching
                                                        if (hidden.scenarioOverride === 'WUXIA_IM_SEONG_JUN_SCENARIO') {
                                                            prompt += `\n[SCENARIO KEY OVERRIDE]\n${WUXIA_IM_SEONG_JUN_SCENARIO}\n`;
                                                        } else if (hidden.scenarioOverride === 'WUXIA_NAM_GANG_HYEOK_SCENARIO') {
                                                            prompt += `\n[SCENARIO KEY OVERRIDE]\n${WUXIA_NAM_GANG_HYEOK_SCENARIO}\n`;
                                                        }

                                                        addToast(`히든 설정 발동: ${hidden.statsModifier?.faction || 'Unknown'}`, 'success');

                                                        // 2. Apply Stats
                                                        if (hidden.statsModifier) {
                                                            const currentSkills = newStats.skills || [];
                                                            const newSkills = hidden.statsModifier.skills || [];

                                                            newStats.faction = hidden.statsModifier.faction || newStats.faction;
                                                            newStats.skills = [...currentSkills, ...newSkills];

                                                            // Apply other modifiers if needed
                                                            if (hidden.statsModifier.active_injuries) {
                                                                newStats.active_injuries = [...(newStats.active_injuries || []), ...hidden.statsModifier.active_injuries];
                                                            }

                                                            // Apply Personality Modifier if present
                                                            if (hidden.statsModifier.personality) {
                                                                // Merge or Overwrite? Let's Merge additively
                                                                Object.keys(hidden.statsModifier.personality).forEach(k => {
                                                                    const key = k as keyof typeof newStats.personality;
                                                                    // @ts-ignore
                                                                    newStats.personality[key] = (newStats.personality[key] || 0) + (hidden.statsModifier.personality[key] || 0);
                                                                });
                                                            }

                                                            // Commit merged stats
                                                            useGameStore.getState().setPlayerStats(newStats);
                                                        }
                                                    }
                                                }

                                                handleSend(prompt, false, true);
                                            }
                                        };

                                        if (!isMounted) return null; // [Fix] Prevent Hydration Mismatch for Client-Only UI

                                        // [Fix] Data Loading Guard
                                        if (!isDataLoaded) {
                                            return (
                                                <div className="flex flex-col items-center justify-center w-full h-full min-h-[50vh] text-yellow-500 animate-in fade-in duration-500">
                                                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                                                    <p className="text-xl font-bold">운명 데이터를 불러오는 중...</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="bg-[#1e1e1e]/95 p-8 rounded-xl border border-[#333] text-center shadow-2xl backdrop-blur-md flex flex-col gap-6 items-center max-w-2xl w-full relative overflow-hidden">
                                                {/* Decorative Top Line */}
                                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />

                                                {/* Progress */}
                                                <div className="w-full h-1 bg-[#333] rounded-full overflow-hidden mt-2">
                                                    <div
                                                        className="h-full bg-[#D4AF37] transition-all duration-300 shadow-[0_0_10px_#D4AF37]"
                                                        style={{ width: `${((creationStep + 1) / (creationQuestions.length + 1)) * 100}%` }}
                                                    />
                                                </div>

                                                {/* Name Input (Step 0) */}
                                                {isNameStep ? (
                                                    <div className="flex flex-col items-center gap-8 w-full max-w-md animate-in fade-in zoom-in duration-500 my-4">
                                                        <h2 className="text-3xl text-[#D4AF37] font-serif font-bold mb-2 tracking-wider">
                                                            <span className="text-[#D4AF37]/50 mr-2">◆</span>
                                                            당신의 이름은 무엇입니까?
                                                            <span className="text-[#D4AF37]/50 ml-2">◆</span>
                                                        </h2>
                                                        <div className="flex flex-col gap-2 w-full">
                                                            <label className="text-[#888] text-xs font-bold text-left uppercase tracking-wider ml-1">Name</label>
                                                            <input
                                                                type="text"
                                                                className="bg-[#252525] border border-[#333] focus:border-[#D4AF37] text-[#eee] px-6 py-4 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30 text-center text-xl font-bold placeholder-[#555] transition-all font-serif tracking-widest"
                                                                placeholder="이름을 입력하세요"
                                                                value={playerName || ''}
                                                                onChange={(e) => useGameStore.getState().setPlayerName(e.target.value)}
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        const state = useGameStore.getState();
                                                                        const result = checkNameValidity(state.playerName, state.characterData);
                                                                        if (!result.valid) {
                                                                            addToast(result.message || "Invalid Name", "error");
                                                                            return;
                                                                        }
                                                                        setCreationStep(prev => prev + 1);
                                                                    }
                                                                }}
                                                            />
                                                            <div className="flex flex-col gap-2 w-full">
                                                                <label className="text-[#888] text-xs font-bold text-left uppercase tracking-wider ml-1">Gender</label>
                                                                <div className="flex gap-2 p-1 bg-[#252525] rounded-lg border border-[#333]">
                                                                    {['male', 'female'].map((g) => {
                                                                        const currentGender = playerStats.gender || 'male';
                                                                        const isSelected = currentGender === g;
                                                                        return (
                                                                            <button
                                                                                key={g}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setPlayerStats({ gender: g as 'male' | 'female' });
                                                                                }}
                                                                                className={`flex-1 py-3 px-4 rounded-md text-2xl font-bold transition-all font-serif tracking-wide ${isSelected
                                                                                    ? (g === 'male'
                                                                                        ? 'bg-blue-600 text-white border-2 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                                                                                        : 'bg-pink-600 text-white border-2 border-pink-400 shadow-[0_0_15px_rgba(219,39,119,0.5)]')
                                                                                    : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-gray-700 hover:text-gray-300'
                                                                                    }`}
                                                                            >
                                                                                {g === 'male' ? '♂' : '♀'}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => {
                                                                const state = useGameStore.getState();
                                                                const result = checkNameValidity(state.playerName, state.characterData);
                                                                if (!result.valid) {
                                                                    addToast(result.message || "Invalid Name", "error");
                                                                    return;
                                                                }
                                                                setCreationStep(prev => prev + 1);
                                                            }}
                                                            className="mt-4 w-full px-8 py-3.5 bg-[#D4AF37] hover:bg-[#b5952f] rounded-lg font-bold text-[#1e1e1e] text-lg shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-serif"
                                                        >
                                                            <span>운명 시작하기</span>
                                                            <span className="text-base">→</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <h2 className="text-lg md:text-xl text-[#D4AF37] font-bold leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-right-4 duration-300 px-4">
                                                            <span className="text-[#D4AF37]/50 text-sm mr-2 align-middle">◆</span>
                                                            {currentQuestion?.question}
                                                        </h2>

                                                        <div className="grid grid-cols-1 w-full gap-3 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                                                            {currentQuestion?.options.map((opt: any) => {
                                                                if (opt.condition) {
                                                                    const { key, value } = opt.condition;
                                                                    if (creationData[key] !== value) return null;
                                                                }

                                                                return (
                                                                    <button
                                                                        key={opt.value}
                                                                        onClick={() => currentQuestion && handleOptionSelect(currentQuestion.id, opt.value)}
                                                                        className="group relative px-6 py-4 bg-[#252525] hover:bg-[#2a2a2a] border border-[#333] hover:border-[#D4AF37]/50 rounded-lg text-left transition-all shadow-md active:scale-[0.99] overflow-hidden"
                                                                    >
                                                                        <div className="absolute inset-y-0 left-0 w-1 bg-[#333] group-hover:bg-[#D4AF37] transition-colors" />
                                                                        <span className="font-bold text-[#666] group-hover:text-[#D4AF37] mr-3 font-serif transition-colors">◈</span>
                                                                        <span className="text-gray-300 group-hover:text-[#eee] font-medium transition-colors">
                                                                            {opt.label}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                )}

                                                {creationStep > 0 && (
                                                    <button
                                                        onClick={() => setCreationStep(prev => prev - 1)}
                                                        className="mt-2 text-[#666] hover:text-[#D4AF37] text-sm transition-colors flex items-center gap-1 font-serif"
                                                    >
                                                        <span>←</span> 이전 단계로
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }

                                    // Fallback to Standard Start Screen
                                    // Fallback to Standard Start Screen
                                    const { activeGameId, setGameId } = useGameStore.getState();

                                    // [Fix] Wuxia Data Integrity Guard
                                    if (activeGameId === 'wuxia' && (!creationQuestions || creationQuestions.length === 0)) {
                                        return (
                                            <div className="bg-black/90 p-12 rounded-xl border-2 border-red-500 text-center shadow-2xl backdrop-blur-md flex flex-col gap-6 items-center animate-pulse">
                                                <h1 className="text-3xl font-bold text-red-500 mb-2">⚠ 데이터 로드 실패</h1>
                                                <p className="text-gray-300">
                                                    캐릭터 생성 데이터를 불러오지 못했습니다.<br />
                                                    네트워크 상태를 확인하거나 다시 시도해주세요.
                                                </p>
                                                <div className="flex gap-4">
                                                    <button
                                                        onClick={() => setGameId('wuxia')}
                                                        className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded font-bold text-white shadow-lg transform hover:scale-105 transition-all"
                                                    >
                                                        ↻ 데이터 재시도
                                                    </button>
                                                    <button
                                                        onClick={() => window.location.reload()}
                                                        className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded font-bold text-gray-200"
                                                    >
                                                        새로고침
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-4">ActiveID: {activeGameId} | QLen: {creationQuestions?.length || 0}</p>
                                            </div>
                                        );
                                    }

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

                                            {/* [NEW] Gender Toggle */}
                                            <div className="flex flex-col gap-2 w-full max-w-xs">
                                                <label className="text-yellow-500 text-sm font-bold text-left">Gender</label>
                                                <div className="flex gap-2 p-1 bg-gray-900 rounded-lg border border-gray-700">
                                                    {['male', 'female'].map((g) => {
                                                        const isSelected = playerStats.gender === g;
                                                        return (
                                                            <button
                                                                key={g}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Use hook setter if available or direct update via store action if defined.
                                                                    // Since we didn't add a specialized setter, we use setPlayerStats from hook.
                                                                    setPlayerStats({ ...playerStats, gender: g as 'male' | 'female' });
                                                                }}
                                                                className={`flex-1 py-1 px-3 rounded text-sm font-bold transition-all \${isSelected
                                                                    ? (g === 'male' ? 'bg-blue-600 text-white shadow-lg' : 'bg-pink-600 text-white shadow-lg')
                                                                    : 'bg-transparent text-gray-500 hover:text-gray-300'
                                                                    }`}
                                                            >
                                                                {g === 'male' ? '남성 (Male)' : '여성 (Female)'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // [Fix] Ensure handleStartGame exists before calling (it is defined in outer scope)
                                                    handleStartGame();
                                                }}
                                                className="px-8 py-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-black text-xl shadow-[0_0_20px_rgba(234,179,8,0.5)] hover:scale-105 transition-transform animate-pulse"
                                            >
                                                Game Start
                                            </button>
                                        </div>
                                    );
                                })()
                            ) : isLogicPending ? (
                                // [Fix] Show simplified pending state instead of Error if waiting for AI
                                <div className="bg-black/80 p-6 rounded-xl border border-yellow-500 text-center shadow-2xl backdrop-blur-md animate-pulse">
                                    <h2 className="text-xl font-bold text-yellow-500 mb-2">{t.fateIsWeaving}</h2>
                                    <p className="text-gray-300 text-sm">{t.generatingChoices}</p>
                                </div>
                            ) : (
                                // Error/Paused Screen
                                // [Fix] Safe fallback to Start Screen check
                                (turnCount === 0 && !currentSegment) ? (
                                    <div className="bg-black/80 p-8 rounded-xl border border-blue-500 text-center shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-300">
                                        <h2 className="text-2xl font-bold text-blue-400 mb-4">게임 준비 완료</h2>
                                        <p className="text-gray-300 mb-6">시작하려면 아래 버튼을 클릭하세요.</p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleStartGame(); }}
                                            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white text-xl shadow-lg hover:scale-105 transition-transform animate-pulse"
                                        >
                                            게임 시작
                                        </button>
                                    </div>
                                ) : (choices.length > 0) ? (
                                    // [Fix] Choices are present, so don't show Error Screen
                                    // The choices overlay (line 3512) will handle the rendering.
                                    null
                                ) : (!isDataLoaded) ? (
                                    // [Fix] Data not loaded logic handled by top-level guard, but if here safely return null
                                    null
                                ) : (
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
                                )
                            )}
                        </div>
                    )
                }



                {/* Interactive Loading Indicator (Ad/Tip Overlay) */}
                <AnimatePresence>
                    {(isProcessing || (isLogicPending && !currentSegment && scriptQueue.length === 0)) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#000]/90 flex items-center justify-center z-50 pointer-events-auto backdrop-blur-sm"
                        >
                            <div className="flex flex-col items-center gap-6 max-w-xl w-full p-10 rounded-xl border border-[#333] bg-gradient-to-b from-[#2a2a2a] via-[#1a1a1a] to-[#0d0d0d] shadow-2xl relative overflow-hidden">
                                {/* Background Glow */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />

                                {/* Spinner & Title */}
                                <div className="flex flex-col items-center gap-3 z-10 w-full">
                                    <div className="w-16 h-16 rounded-full border-2 border-[#333] border-t-[#D4AF37] animate-spin mb-4" />

                                    <h3 className="text-3xl font-serif font-bold text-[#D4AF37] animate-pulse tracking-widest uppercase text-center flex items-center gap-3">
                                        <span className="text-[#D4AF37]/50 text-xl">◆</span>
                                        {t.fateIsWeaving}
                                        <span className="text-[#D4AF37]/50 text-xl">◆</span>
                                    </h3>

                                    <div className="text-center w-full">
                                        <ResponseTimer avgTime={avgResponseTime} />
                                        <p className="text-xs text-[#666] mt-2 font-mono tracking-widest">
                                            ESTIMATED: {Math.round(avgResponseTime / 1000)}s
                                        </p>
                                    </div>
                                </div>

                                {/* Dynamic Tips */}
                                <div className="bg-[#252525] p-5 rounded-lg border border-[#333] w-full text-center z-10 shadow-inner mt-2">
                                    <span className="text-[#D4AF37] text-xs font-serif font-bold tracking-[0.2em] block mb-2 border-b border-[#333] pb-2 mx-auto w-12">TIP</span>
                                    <p key={currentTipIndex} className="text-[#ccc] text-sm leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-2 duration-700 min-h-[3rem] flex items-center justify-center">
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

                                {/* [NEW] System Menu Bar (Available during Generation) */}
                                <div className="flex w-full justify-center gap-3 md:gap-4 mt-6 pointer-events-auto z-20">
                                    {(() => {
                                        const currentWikiTarget = (() => {
                                            if (currentSegment?.character) {
                                                const charName = currentSegment.character.split('(')[0].trim();
                                                return findBestMatch(charName, wikiKeys);
                                            }
                                            return null;
                                        })();

                                        return [
                                            { icon: <User size={20} />, label: t.profile || "Profile", onClick: () => setShowCharacterInfo(true) },
                                            { icon: <History size={20} />, label: t.chatHistory, onClick: () => setShowHistory(true) },
                                            {
                                                icon: <Book size={20} />,
                                                label: t.wiki,
                                                onClick: () => {
                                                    if (currentWikiTarget) setWikiTargetCharacter(currentWikiTarget);
                                                    setShowWiki(true);
                                                },
                                                isActive: !!currentWikiTarget,
                                                activeColor: "bg-gradient-to-r from-yellow-600 to-yellow-500 border-yellow-400 text-black shadow-yellow-500/50 animate-pulse"
                                            },
                                            { icon: <Save size={20} />, label: t.saveLoad, onClick: () => setShowSaveLoad(true) },
                                            { icon: <Settings size={20} />, label: t.settings, onClick: () => setShowResetConfirm(true) },
                                        ].map((btn, i) => (
                                            <button
                                                key={i}
                                                onClick={(e) => { e.stopPropagation(); btn.onClick(); }}
                                                className={`p-3 md:p-3 rounded-full border transition-all backdrop-blur-md shadow-lg group relative
                                                    ${(btn as any).isActive
                                                        ? (btn as any).activeColor
                                                        : 'bg-black/60 border-white/20 text-white hover:bg-white/20 hover:border-white'
                                                    } hover:scale-110`}
                                                title={btn.label}
                                            >
                                                {btn.icon}
                                                {/* Tooltip */}
                                                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 border border-white/20 px-2 py-1 rounded pointer-events-none">
                                                    {btn.label}
                                                </span>
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* [NEW] HUD Layer (Always visible in Wuxia mode) */}
                {isMounted && activeGameId === 'wuxia' && (
                    <WuxiaHUD
                        playerName={playerName}
                        playerStats={playerStats}
                        onOpenProfile={() => setShowCharacterInfo(true)}
                        onOpenWiki={() => setShowWiki(true)}
                        language={language || 'ko'}
                        day={day}
                        time={time}
                        location={currentLocation}
                        turnCount={turnCount}
                    />
                )}

                {/* History Modal */}
                <HistoryModal
                    isOpen={showHistory}
                    onClose={() => setShowHistory(false)}
                    chatHistory={chatHistory}
                    t={t}
                    setCurrentSegment={setCurrentSegment}
                    setScriptQueue={setScriptQueue}
                    setBackground={setBackground}
                />

                {/* Inventory Modal */}
                <InventoryModal
                    isOpen={showInventory}
                    onClose={() => setShowInventory(false)}
                    inventory={inventory}
                    t={t}
                />

                {/* Input Modal */}
                <AnimatePresence>
                    {isInputOpen && (
                        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-gray-900 p-6 rounded-xl w-full max-w-lg border border-green-500 shadow-2xl"
                            >
                                <h2 className="text-xl font-bold text-green-400 mb-4">{t.yourAction}</h2>

                                {/* [Fate Intervention UI] */}
                                <div className="flex items-center gap-4 mb-4 bg-black/40 p-3 rounded-lg border border-yellow-500/30">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-yellow-400 font-bold text-sm">운명 개입 (Fate)</span>
                                            <span className="text-xs bg-yellow-900/50 text-yellow-200 px-2 py-0.5 rounded-full border border-yellow-500/30">
                                                보유: {playerStats.fate || 0}
                                            </span>
                                        </div>
                                        <span className="text-gray-400 text-xs block mt-1">불가능을 가능으로 바꿉니다. (소모값 선택)</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {[0, 1, 2, 3].map(val => (
                                            <button
                                                key={val}
                                                onClick={() => setFateUsage(val)}
                                                disabled={(playerStats.fate || 0) < val}
                                                className={`w-8 h-8 rounded-lg font-bold border transition-all ${fateUsage === val
                                                    ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)] scale-110'
                                                    : 'bg-gray-800 text-gray-400 border-gray-600 hover:border-yellow-500/50 hover:text-white'
                                                    } ${(playerStats.fate || 0) < val ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            >
                                                {val}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-red-900/30 border border-red-500/50 rounded p-3 mb-4 text-sm text-red-200">
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>오직 주인공의 행동과 대사만 서술할 수 있습니다.</li>
                                        <li>상황에 맞지 않는 신적 개입은 허용되지 않습니다.</li>
                                    </ul>
                                </div>

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
                        <CharacterProfile
                            isOpen={showCharacterInfo}
                            onClose={() => setShowCharacterInfo(false)}
                            playerStats={playerStats}
                            characterData={useGameStore.getState().characterData}
                            activeCharacters={useGameStore.getState().activeCharacters}
                            turnCount={turnCount}
                            language={language || 'ko'}
                            activeTab={activeProfileTab}
                            onTabChange={setActiveProfileTab}
                        />
                        /* [리팩토링 메모] 캐릭터 정보 모달 로직은 `ui/CharacterProfile.tsx`로 이동되었습니다. */

                    )}
                </AnimatePresence>

                {/* Debug Modal */}
                <AnimatePresence>
                    {
                        isDebugOpen && (
                            <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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
                <SaveLoadModal
                    isOpen={showSaveLoad}
                    onClose={() => setShowSaveLoad(false)}
                    saveSlots={saveSlots}
                    onSave={saveGame}
                    onLoad={loadGame}
                    onDelete={deleteGame}
                    t={t}
                />

                {/* Settings / Reset Modal (Refactored) */}
                <SettingsModal
                    isOpen={showResetConfirm}
                    onClose={() => setShowResetConfirm(false)}
                    t={t}
                    session={session}
                    onResetGame={handleNewGame}
                />

                {/* System Popup Layer */}
                <SystemPopup
                    isOpen={currentSegment?.type === 'system_popup'}
                    content={currentSegment?.type === 'system_popup' ? currentSegment.content : ''}
                    onAdvance={() => advanceScript()}
                />

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
