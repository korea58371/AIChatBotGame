'use client';

import { useRouter } from 'next/navigation';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGameStore, GameState, Skill } from '@/lib/store';
import { createClient } from '@/lib/supabase';
import { useAuthSession } from '@/hooks/useAuthSession';
import { serverGenerateResponse, serverGenerateGameLogic, serverGenerateSummary, getExtraCharacterImages, serverPreloadCache, serverAgentTurn, serverAgentTurnPhase1, serverAgentTurnPhase2, serverGenerateCharacterMemorySummary } from '@/app/actions/game';
import { getCharacterImage } from '@/lib/utils/image-mapper';
import { isHiddenProtagonist } from '@/lib/utils/character-utils';
import { resolveBackground } from '@/lib/engine/background-manager';
import { RelationshipManager } from '@/lib/engine/relationship-manager'; // Added import // Added import
import { MODEL_CONFIG, PRICING_RATES, KRW_PER_USD } from '@/lib/ai/model-config';
import { normalizeCharacterId } from '@/lib/utils/character-id'; // [NEW] ID Normalization
import { fetchAgentTurnStream } from '@/lib/network/stream-client'; // [Stream] Client
import { normalizeWuxiaInjury } from '@/lib/utils/injury-cleaner'; // [New] Injury Sanitization
import { parseScript, ScriptSegment } from '@/lib/utils/script-parser';
import { findBestMatch, findBestMatchDetail, normalizeName } from '@/lib/utils/name-utils'; // [NEW] Fuzzy Match Helper
import martialArtsLevels from '@/data/games/wuxia/jsons/martial_arts_levels.json'; // Import Wuxia Ranks
import { FAME_TITLES, FATIGUE_LEVELS, LEVEL_TO_REALM_MAP, REALM_ORDER, WUXIA_IM_SEONG_JUN_SCENARIO, WUXIA_NAM_GANG_HYEOK_SCENARIO } from '@/data/games/wuxia/constants'; // [New] UI Constants
import { LEVEL_TO_RANK_MAP } from '@/data/games/god_bless_you/constants'; // [New] UI Constants
import wikiData from '@/data/games/wuxia/wiki_data.json'; // [NEW] Wiki Data Import

import { GameRegistry } from '@/lib/registry/GameRegistry';
import { GameUIRegistry } from '@/lib/registry/GameUIRegistry';

// Import Configs to register them (Side-effect)
import '@/data/games/wuxia/config';
import '@/data/games/god_bless_you/config';

// Import UI Configs (Client-Side Only)
import '@/data/games/god_bless_you/ui';
import '@/data/games/wuxia/ui'; // [Refactor] Wuxia UI Registered


import { submitGameplayLog } from '@/app/actions/log';
import { deleteAccount } from '@/app/actions/auth';
import { translations } from '@/data/translations';
import { checkNameValidity, getHiddenSettings, selectProtagonistImage } from '@/data/games/wuxia/character_creation';

// [Refactoring] New Components & Hooks
import SaveLoadModal from './visual_novel/ui/SaveLoadModal';
import InventoryModal from './visual_novel/ui/InventoryModal';
import HistoryModal from './visual_novel/ui/HistoryModal';
import SystemPopup from './visual_novel/ui/SystemPopup';
import { useGameInitialization } from './visual_novel/hooks/useGameInitialization';
import { useSaveLoad } from './visual_novel/hooks/useSaveLoad';




import { Send, Save, RotateCcw, History, SkipForward, Package, Settings, Bolt, Maximize, Minimize, Loader2, X, Book, User, Info, ShoppingBag, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { EventManager } from '@/lib/engine/event-manager';
import WikiSystem from './WikiSystem';
import TextMessage from './features/TextMessage';
import PhoneCall from './features/PhoneCall';
import TVNews from './features/TVNews';
import SmartphoneApp from './features/SmartphoneApp';
import { checkRankProgression } from '@/data/games/wuxia/progression';
import Article from './features/Article';
import DebugPopup from './features/DebugPopup';
import Link from 'next/link';
import LanguageSelector from '@/components/LanguageSelector';

// [Refactoring] New Components & Hooks
import { useVNState } from './visual_novel/hooks/useVNState';
import { useVNAudio } from './visual_novel/hooks/useVNAudio';
// HUDs are now loaded via Registry
import CharacterProfile from './visual_novel/ui/CharacterProfile';
import SettingsModal from './visual_novel/ui/SettingsModal';
import ResponseTimer from './visual_novel/ui/common/ResponseTimer';
import { AdBanner } from './AdBanner'; // [New] Import AdBanner
import StoreModal from './visual_novel/ui/StoreModal'; // [New] Import StoreModal
import { CloudConflictModal } from './visual_novel/ui/CloudConflictModal'; // [New] Cloud Conflict Modal
import EndingModal from './visual_novel/ui/EndingModal'; // [New] Ending UI
import TheEndScreen from './visual_novel/ui/TheEndScreen'; // [New] Final Ending Screen



// getKoreanExpression removed in favor of getCharacterImage utility



// Game Tips Library
import { LOADING_TIPS } from '@/data/loading_tips';

// ResponseTimer moved to common/ResponseTimer.tsx

// Internal Component for Ad Simulation
// AdButton moved to common/AdButton.tsx

// Helper to format text (Bold support)
const formatText = (text: string) => {
    if (!text) return null;
    // [Fix] Filter out Ending Tags (e.g. <GOOD ENDING>, <BAD ENDING>) to prevent leakage
    const cleanText = text.replace(/<[A-Z_]+ ENDING>/g, '').trim();

    const parts = cleanText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-yellow-400 font-extrabold">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

import EventCGLayer from '@/components/visual_novel/ui/EventCGLayer';







export default function VisualNovelUI() {
    // [Fix] Initialize Router for Navigation
    const router = useRouter();

    // [Fix] Initialize Supabase Client
    const supabase = createClient();

    // [AuthDebug] Verify Client-Side Cookie Visibility
    useEffect(() => {
        if (typeof document !== 'undefined') {
            const cookieNames = document.cookie.split(';').map(c => c.trim().split('=')[0]);
            console.log("[AuthDebug] VisualNovelUI: Visible Cookies:", cookieNames);
            const hasAuthToken = cookieNames.some(name => name.startsWith('sb-') && name.includes('-auth-token'));
            console.log("[AuthDebug] VisualNovelUI: Has Auth Token?", hasAuthToken);
            console.log("[AuthDebug] VisualNovelUI: Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
        }

        // [Fix] Reset Epilogue Guard on Mount
        isEpilogueRef.current = false;
    }, []);

    // [Stream] Track active segment index (consumed count) for syncing stream with UI
    // [Payment Callback Handling]
    useEffect(() => {
        const handlePaymentResult = async () => {
            if (typeof window === 'undefined') return;
            const params = new URLSearchParams(window.location.search);
            const impSuccess = params.get('imp_success');
            const errorMsg = params.get('error_msg');

            // Check if returning from payment
            if (impSuccess !== null || errorMsg) {
                const pendingPayment = localStorage.getItem('pending_payment');
                if (pendingPayment) {
                    try {
                        const product = JSON.parse(pendingPayment);

                        if (impSuccess === 'true') {
                            // Success Logic
                            // 1. Optimistic Update
                            const totalAmount = product.amount + product.bonusAmount;

                            if (product.type === 'token') {
                                // [Fix] Fetch fresh coins from DB first (Store might be 0 on reload)
                                // const processPayment = async () => { 
                                {
                                    const supabase = createClient();
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (session?.user) {
                                        // 1. Fetch Current
                                        const { data: profile } = await supabase
                                            .from('profiles')
                                            .select('coins')
                                            .eq('id', session.user.id)
                                            .single();

                                        const currentCoins = profile?.coins || 0;
                                        const newCoins = currentCoins + totalAmount;

                                        // 2. Update DB
                                        await supabase.from('profiles').update({ coins: newCoins }).eq('id', session.user.id);

                                        // 3. Update Store
                                        useGameStore.getState().setUserCoins(newCoins);
                                    }
                                    // };
                                    // processPayment();
                                }
                            } else {
                                const currentFate = useGameStore.getState().playerStats.fate || 0;
                                const newFate = currentFate + totalAmount;
                                useGameStore.getState().setPlayerStats({ ...useGameStore.getState().playerStats, fate: newFate });
                            }

                            alert(`구매 성공! ${product.name}이(가) 지급되었습니다.`);
                        } else {
                            // Failure Logic
                            const msg = decodeURIComponent(errorMsg || '결제가 취소되었습니다.');
                            alert(`결제 실패: ${msg}`);
                        }
                    } catch (e) {
                        console.error('Payment callback handling failed', e);
                        alert(`결제 처리 중 오류 발생: ${e}`);
                    } finally {
                        // Cleanup
                        localStorage.removeItem('pending_payment');
                        // Clean URL
                        window.history.replaceState({}, '', window.location.pathname);
                    }
                } else {
                    // Context Lost Case (Mobile specific debug)
                    alert("결제 결과가 반환되었으나 구매 정보를 찾을 수 없습니다. (Context Lost)\n(LocalStorage가 비어있음)");
                }
            }
        };
        handlePaymentResult();
    }, []);
    const activeSegmentIndexRef = useRef(0);

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

    // [New] Cost Calculation Logic
    const storyModel = useGameStore(state => state.storyModel);
    const currentCG = useGameStore(state => state.currentCG); // [New] Subscribe to CG state
    const costPerTurn = storyModel === 'gemini-3-pro-preview' ? 20 : 10;
    // [리팩토링 메모] UI 상태 관리 로직(모달, 입력, 디버그 등)은 `hooks/useVNState.ts`로 이동되었습니다.

    const [fateUsage, setFateUsage] = useState<number>(0);

    // const router = useRouter(); // Removed duplicate
    const wikiKeys = useMemo(() => Object.keys(wikiData), []); // [Performance] Memoize keys



    // Core Game Store
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);



        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error(err));
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => console.error(err));
        }
    };

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

        // [Rule 0: Integrity Check - Realism Enforcement]
        // If Player has High Rank (e.g. Peak) but Low Neigong (e.g. 12y), it is a "False Realm".
        // Instead of giving free Neigong, we DOWNGRADE the Rank to match reality.
        const minEnergyForCurrentRank = currentRealmConfig?.조건?.최소_내공 ?? 0;

        if (stats.neigong < minEnergyForCurrentRank) {
            console.warn(`[Realm] False Realm Detected: ${currentRankName} requires ${minEnergyForCurrentRank}y, but had ${stats.neigong}y. Downgrading.`);

            // Find the correct rank for this neigong amount
            let correctRank = "삼류";
            // Iterate reverse to find highest qualifying rank
            for (let i = REALM_ORDER.length - 1; i >= 0; i--) {
                const rName = REALM_ORDER[i];
                const rConfig = (martialArtsLevels as any)[rName];
                const rMin = rConfig?.조건?.최소_내공 ?? 0;
                if (stats.neigong >= rMin) {
                    correctRank = rName;
                    break;
                }
            }

            // Apply Downgrade
            if (stats.playerRank !== correctRank) {
                stats.playerRank = correctRank;
                addToastCallback(`경지 불안정: 내공이 부족하여 [${currentRankName}] 유지가 불가능합니다. -> [${correctRank}] 하락.`, 'error');
                return { stats, narrativeEvent: null }; // Stop processing promotion for this turn
            }
        }

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

    // [New] Status Effects (Natural Healing Only + Sanitization)
    const processStatusEffects = useCallback((currentStats: any, addToastCallback: (msg: string, type: any) => void) => {
        let stats = { ...currentStats };
        const maxHp = stats.maxHp || 100;
        const maxMp = stats.maxMp || 100;

        // [User Fix] Sanitize Existing Injuries (Collapse Duplicates)
        // This fixes the "Minor/Stable" duplicate issue by forcing normalization every turn.
        if (stats.active_injuries && stats.active_injuries.length > 0) {
            const cleanInjuries = Array.from(new Set(stats.active_injuries.map(normalizeWuxiaInjury))) as string[];
            if (cleanInjuries.length !== stats.active_injuries.length) {
                console.log(`[Status] Auto-consolidated injuries: ${stats.active_injuries.length} -> ${cleanInjuries.length}`);
                stats.active_injuries = cleanInjuries;
            }
        }

        // [User Request] Removed Injury Drain (Double Dip Prevention)
        // AI Narrative already handles damage. We only handle Natural Recovery here.
        const drain = 0;

        // 2. Natural Healing (if not critical)
        // Recover if HP < 90%
        if (stats.hp < maxHp * 0.9) {
            const recoveryRate = 0.02; // 2% per turn
            const amount = Math.floor(maxHp * recoveryRate);
            stats.hp = Math.min(maxHp, stats.hp + amount);
        }

        // MP Recovery (Always slight recovery unless combat)
        if (stats.mp < maxMp) {
            const mpRec = Math.floor(maxMp * 0.03); // 3%
            stats.mp = Math.min(maxMp, stats.mp + mpRec);
        }

        return stats;
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
        isHydrated, // [Fix] Hydration Status
        goals, // [New] Goals for Choice Panel
        endingType, // [Fix] Reactively Subscribe to Ending Type
    } = useGameStore();

    // [Fix] Auto-Start Game Logic (Scenario Injection)
    // When game switches or resets, scriptQueue is empty. We must parse initialScenario.
    useEffect(() => {
        const store = useGameStore.getState();
        // Condition: Empty Queue, No Segment, Data Loaded, Initial Scenario Exists
        if (scriptQueue.length === 0 && !currentSegment && store.isDataLoaded && store.initialScenario) {

            // Defensively check if we already have history (don't re-run start scenario if we are just paused)
            if (chatHistory.length > 0) {
                console.log("[VisualNovelUI] History exists, skipping bootstrap (Assumed paused/idle).");
                return;
            }

            // [Fix] Character Creation Guard
            // If it's a NEW GAME (turnCount === 0) and we have creation questions,
            // we MUST yield to the Creation Wizard (lines 3943+). 
            // Do NOT force-feed the scenario yet.
            if (turnCount === 0 && store.characterCreationQuestions && store.characterCreationQuestions.length > 0) {
                console.log("[VisualNovelUI] Detected Character Creation phase. Deferring bootstrap.");
                return;
            }

            console.log("[VisualNovelUI] Bootstrapping Initial Scenario...");
            const initialSegments = parseScript(store.initialScenario);
            setScriptQueue(initialSegments);
            console.log(`[VisualNovelUI] Bootstrapped ${initialSegments.length} segments.`);
        }
    }, [isDataLoaded, scriptQueue.length, currentSegment, chatHistory.length, turnCount]);

    useEffect(() => {
        // [Fix] Race Condition Guard
        // If a force reset is pending, strictly SKIP all default initialization.
        // The Force Reset Effect (lines 586+) will handle everything.
        if (sessionStorage.getItem('vn_force_reset') === 'true') return;

        // [Fix] Wait for IDB Hydration
        // If we proceed before hydration, we might use the default 'god_bless_you' ID
        // and overwrite the user's actual game (e.g. 'wuxia').
        if (!isHydrated) {
            // console.log("[Initialization] Waiting for IDB Hydration...");
            return;
        }

        // [Heuristic Recovery] Detect Wuxia State in GBY Mode (Fix for corrupted IDB)
        // [DISABLE] This heuristic prevents starting GBY if Wuxia stats persist.
        // If the user was affected by the "Reset to GBY" bug, their ActiveGameId is GBY, 
        // but their stats/rank are still Wuxia. We auto-correct this.
        /*
        if (activeGameId === 'god_bless_you') {
            const state = useGameStore.getState();
            // Check for Wuxia Ranks or Neigong
            const wuxiaRanks = ['삼류', '이류', '일류', '절정', '초절정', '화경', '현경', '생사경', '자연경'];
            const currentRank = state.playerStats?.playerRank;

            // Heuristic: If Rank is Wuxia-style OR Neigong exists (>0), it's Wuxia.
            if (wuxiaRanks.includes(currentRank) || (state.playerStats.neigong && state.playerStats.neigong > 0)) {
                console.warn("[Recovery] Detected Wuxia data in GBY mode. Auto-restoring 'wuxia' ID...");
                useGameStore.getState().setGameId('wuxia');
                return; // Trigger re-render with new ID
            }
        }
        */

        // [Fix] Ensure Game Data is Loaded on Mount (especially after New Game reset)
        if (!isDataLoaded) {
            console.log("[Initialization] Data not loaded, triggering setGameId for:", activeGameId);
            useGameStore.getState().setGameId(activeGameId);
        }

        // [Failsafe] Enforce GBY Initial Settings if Turn 0 and Gold != 100k
        const currentState = useGameStore.getState();
        if (activeGameId === 'god_bless_you' && currentState.turnCount === 0) {
            // Logic: If Gold is not 100k (e.g. 0 or default 1000), force it.
            if (currentState.playerStats.gold !== 100000) {
                console.log("[Failsafe] GBY Initial Settings incorrect. Force applying 100k Gold & Level 0.");
                useGameStore.getState().setPlayerStats({ gold: 100000, level: 0 });
            }
        }
    }, [turnCount, characterCreationQuestions, activeGameId, isDataLoaded, isHydrated, scriptQueue, choices]);



    // [Localization]
    const t = translations[language as keyof typeof translations] || translations.en;


    const creationQuestions = characterCreationQuestions; // Alias for UI Usage

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

    // [Fix] Keep Ref in sync with State
    // Crucial for Sync Logic which relies on Ref to know what user is currently reading.
    useEffect(() => {
        currentSegmentRef.current = currentSegment;
    }, [currentSegment]);

    useEffect(() => {
        if (characterExpression) {
            lastCharNameRef.current = getCurrentCharName(characterExpression);
        } else {
            // Reset when character disappears so next appearance animates fully
            lastCharNameRef.current = '';
        }
    }, [characterExpression]);

    // [New] Warp Starfield Logic (Defines stars at top level to enforce hook rules)
    // Generate stable random stars
    // [New] Warp Starfield Logic (Defines stars at top level to enforce hook rules)
    // Generate stable random stars
    const stars = useMemo(() => Array.from({ length: isLogicPending ? 200 : 100 }).map((_, i) => ({
        id: i,
        angle: Math.random() * 360,
        dist: Math.random() * 50 + 50, // Start distance %
        size: Math.random() * 3 + 1,
        duration: Math.random() * 3 + 2, // 2-5s normal
        delay: Math.random() * 2
    })), [isLogicPending]); // Re-generate on mode switch for more stars

    const starColors = activeGameId === 'god_bless_you'
        ? ['bg-cyan-300', 'bg-blue-400', 'bg-white']
        : ['bg-amber-300', 'bg-yellow-400', 'bg-orange-200'];

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
    const [showTheEnd, setShowTheEnd] = useState(false); // [New] Epilogue Completion Logic
    const wasForcedResetRef = useRef(false); // [Fix] Track Force Reset for Cloud Sync
    const [lastLogicResult, setLastLogicResult] = useState<any>(null);
    const [pendingLogic, setPendingLogic] = useState<any>(null);
    const [lastStoryOutput, setLastStoryOutput] = useState<string>(''); // [Logging] Store last story output



    // [New] Effect State (Damage / Feedback)
    const [damageEffect, setDamageEffect] = useState<{ intensity: number; duration: number } | null>(null);
    const damageAudioRef = useRef<HTMLAudioElement | null>(null); // [New] Audio Ref
    const pendingEndingRef = useRef<string | null>(null); // [New] Defer Ending Trigger until text finishes

    // [Refactor] Inline Stat Accumulator (Shared across Turn)
    // Tracks stats applied via <Stat> tags during playback to prevent double-counting in Post-Logic
    const currentSegmentRef = useRef<ScriptSegment | null>(null); // [Fix] Live Ref for Sync
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
            audio.volume = useGameStore.getState().sfxVolume; // [Fix] Use global SFX volume
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



    const [isStoreOpen, setIsStoreOpen] = useState(false); // [New] Store Modal State
    const [creationStep, setCreationStep] = useState(0);
    // [리팩토링 메모] 세션 관리 로직 중 일부는 Store로 통합되었으나, 호환성을 위해 로컬 session 상태도 유지됩니다.
    // [리팩토링 메모] 모달/팝업 관련 상태(`showSaveLoad` 등)는 `useVNState`로 통합되어 제거되었습니다.
    const [creationData, setCreationData] = useState<Record<string, string>>({});

    // [New] Recharge Popup State
    const [showRechargePopup, setShowRechargePopup] = useState(false);

    // [Refactor] Recharge Popup Logic
    // handleRecharge removed in favor of Store redirection

    // [Refactor] Sync Auth State from Hook
    const { session, coins: authCoins, fatePoints: authFate, refreshSession, loading: authLoading } = useAuthSession();

    // Sync Coins & Fate to Global Store when they change
    useEffect(() => {
        // [Fix] Only sync if loaded and 'user' exists (Don't wipe local data for guests)
        if (!authLoading && session?.user) {
            if (typeof authCoins === 'number') {
                setUserCoins(authCoins);
            }
            // [Fix] Sync Fate Points from DB (Authoritative)
            if (typeof authFate === 'number') {
                const currentFate = useGameStore.getState().playerStats.fate;
                // Only update if different (and non-zero/valid check if needed, but 0 is valid for DB)
                if (currentFate !== authFate) {
                    console.log(`[Sync] Updating Fate Points: ${currentFate} -> ${authFate}`);
                    const currentStats = useGameStore.getState().playerStats;
                    useGameStore.getState().setPlayerStats({ ...currentStats, fate: authFate });
                }
            }
        }
    }, [authCoins, authFate, authLoading, setUserCoins, session]);

    // [Refactor] Cloud Conflict Logic Removal
    // The legacy auto-save conflict check is removed in favor of the manual slot system.
    // Ideally, we will implement "Sync Status" in the SaveLoadModal later.

    // ------------------------------------------------------------------
    // Hydration Fix & Asset Loading
    const [sessionId, setSessionId] = useState<string>('');
    // const [isMounted, setIsMounted] = useState(false); // Moved to useVNState
    const [turnSummary, setTurnSummary] = useState<string | null>(null); // [NEW] Summary State

    // [Fix] Force Reset Check (Persistence Fix)
    // [Fix] Force Reset Check (Persistence Fix)
    useEffect(() => {
        const performForceReset = async () => {
            if (sessionStorage.getItem('vn_force_reset') === 'true') {
                wasForcedResetRef.current = true; // [Fix] Flag as fresh reset
                console.log("[VisualNovelUI] Detected Force Reset Flag. Resetting Game State...");

                // [Critical Fix] Restore correct Game ID from session, solving the "Return to GBY" bug
                const targetGameId = sessionStorage.getItem('vn_reset_game_id');
                const state = useGameStore.getState();

                // [Critical Fix] Order swapped: Reset FIRST, then Load Data.
                // Otherwise resetGame() wipes the characterData we just loaded.
                state.resetGame(targetGameId || undefined);

                if (targetGameId) {
                    console.log(`[VisualNovelUI] Restoring Active Game ID: ${targetGameId}`);
                    await state.setGameId(targetGameId); // [Fix] Await Async Load
                }

                sessionStorage.removeItem('vn_force_reset');
                sessionStorage.removeItem('vn_reset_game_id');

                // [Safety] Force reload page one last time if we suspect data is still stale? 
                // No, setGameId should handle it.
            }
        };
        performForceReset();
    }, []);

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
            if (sessionStorage.getItem('vn_force_reset') === 'true') return; // [Fix] Skip if reset pending

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





    const [isResetting, setIsResetting] = useState(false); // [Fix] Reset State

    const handleNewGame = () => {
        if (confirm(t.confirmNewGame)) {
            setIsResetting(true); // Show overlay

            // 1. Reset Internal State
            resetGame();

            // 2. Clear Session Storage (Optional but recommended)
            sessionStorage.removeItem('vn_session_id');
            sessionStorage.setItem('vn_force_reset', 'true');
            // [Fix] Store activeGameId to prevent race condition defaulting to GBY
            sessionStorage.setItem('vn_reset_game_id', useGameStore.getState().activeGameId || 'wuxia');

            // 3. Wait for IDB Persistence (Critical Fix)
            // Give Zustand persist middleware enough time to write the empty state to IndexedDB
            setTimeout(() => {
                window.location.reload();
            }, 2500);
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
        // [Fix] Do not recover if we are waiting for a deferred ending trigger OR generating Epilogue
        if (pendingEndingRef.current || showTheEnd || isEpilogueRef.current) return;

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

    // [Fix] Failsafe: Auto-Trigger Deferred Ending
    // If the queue is empty and we have a pending ending, ensure it triggers even if the user didn't click.
    useEffect(() => {
        if (!currentSegment && scriptQueue.length === 0 && pendingEndingRef.current) {
            console.log(`[Ending] Failsafe Trigger: ${pendingEndingRef.current}`);
            const type = pendingEndingRef.current.toLowerCase() as any;
            pendingEndingRef.current = null;
            useGameStore.getState().setEndingType(type);
        }
    }, [currentSegment, scriptQueue]);

    // Helper Functions
    const getBgUrl = (bg: string) => {
        const state = useGameStore.getState();
        const gameId = state.activeGameId || 'god_bless_you';

        // [Debug] Log Background Resolution
        // console.log(`[UI] getBgUrl: Input="${bg}", GameId="${gameId}"`);

        if (!bg) return `/assets/${gameId}/backgrounds/Home_Entrance.jpg`; // Default fallback
        if (bg.startsWith('http') || bg.startsWith('/')) return bg; // Return absolute paths directly

        // [New] Resolve Mapping first
        let filename = bg;
        if (state.backgroundMappings && state.backgroundMappings[bg]) {
            filename = state.backgroundMappings[bg];
            // console.log(`[UI] Mapped "${bg}" -> "${filename}"`);
        }

        // [Fix] Avoid Double Extension
        if (filename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            return `/assets/${gameId}/backgrounds/${filename}`;
        }
        return `/assets/${gameId}/backgrounds/${encodeURIComponent(filename)}.jpg`; // Fallback for legacy simple names
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

        // [Logic] Select BGM Map based on Game ID via Registry
        const state = useGameStore.getState();
        const gameId = state.activeGameId || 'god_bless_you';

        // [Registry Lookup]
        const config = GameRegistry.get(gameId);

        if (!config) {
            console.warn(`[VisualNovelUI] Config not found for game: ${gameId}`);
            return;
        }

        const map = config.assets.bgmMap;
        const aliases = config.assets.bgmAliases;

        // Asset Path strategy is currently implicit in the folder structure logic or can be added to config.
        // For now, we derive it from ID, but ideally it should be in config.
        // Let's assume standard structure: `/assets/${gameId}/BGM/`
        const assetPath = `/assets/${gameId}/BGM/`;

        // 별칭 확인 (부분 키가 사용된 경우)
        if (aliases[validKey]) validKey = aliases[validKey];

        const candidates = map[validKey];
        if (!candidates || candidates.length === 0) {
            console.warn(`[BGM] 해당 분위기 키에 대한 BGM을 찾을 수 없음: ${moodKey} (Game: ${gameId})`);
            return;
        }

        const filename = candidates[Math.floor(Math.random() * candidates.length)];
        // 참고: useVNAudio는 경로가 '/'로 시작하면 그대로 사용하고, 그렇지 않으면 /bgm/을 접두어로 붙임
        const bgmPath = `${assetPath}${filename}.mp3`;

        console.log(`[BGM] 재생 전환: ${filename} (무드: ${moodKey}, Game: ${gameId})`);

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

            // [Fix] Check ExtraImages for correct path construction (Support Generated Protagonists)
            const availableExtras = state.availableExtraImages || [];
            const isExtra = availableExtras.includes(pOverride) || availableExtras.includes(pOverride + '.png');

            const expectedPath = isExtra
                ? `/assets/${gameId}/ExtraCharacters/${pOverride}.png`
                : `/assets/${gameId}/characters/${pOverride}.png`;

            // If current display is wrong (different path or empty), force update
            if (characterExpression !== expectedPath) {
                console.log("[Auto-Fix] Correcting Stale Protagonist Image:", expectedPath);
                setCharacterExpression(expectedPath);
            }
        }
    }, [currentSegment, characterExpression, useGameStore.getState().protagonistImageOverride]);

    // [Debug] Monitor Background Changes
    useEffect(() => {
        console.log(`[VisualNovelUI] currentBackground changed to: "${currentBackground}"`);
    }, [currentBackground]);

    // [fix] Auto-Advance Script: Moved below advanceScript definition
    const advanceScript = useCallback(() => {
        // [Stream] Increment consumed count
        activeSegmentIndexRef.current += 1;

        // Handle Character Exit (Exit Tag Logic)
        if (currentSegment?.characterLeave) {
            console.log("Character leaving based on <떠남> tag.");
            setCharacterExpression(''); // Clear character (use empty string as per type definition)
        }

        // Use a local copy of the queue to process immediately
        let currentQueue = [...scriptQueue];

        if (currentQueue.length === 0) {
            setCurrentSegment(null);

            // [Fix] Epilogue Completion
            // If we are in Epilogue Mode and the queue is empty, we are DONE.
            // Do NOT trigger pending logic (which might be a new turn loop).
            // [Fix] Add !isProcessing check to prevent premature trigger while generating epilogue
            if (isEpilogueRef.current) {
                console.log(`[Epilogue] Completion Check: isProcessing=${isProcessing}, Queue=${currentQueue.length}`);
                if (!isProcessing) {
                    console.log("[Epilogue] Script finished. Triggering THE END.");
                    setShowTheEnd(true);
                    setPendingLogic(null); // Clear any pending logic
                    return;
                } else {
                    console.log("[Epilogue] Queue empty but Processing... Waiting.");
                }
            }

            // Check for pending logic
            if (pendingLogic) {
                applyGameLogic(pendingLogic);
                setPendingLogic(null);
            }
            return;
        }

        let nextSegment = currentQueue[0];

        // Process background, command, and BGM segments iteratively to avoid recursion
        while (nextSegment && (nextSegment.type === 'background' || nextSegment.type === 'command' || nextSegment.type === 'bgm' || nextSegment.type === 'event_cg')) {
            console.log(`[ScriptLoop] Processing Segment: Type=${nextSegment.type}, Content=${nextSegment.content}`);

            if (nextSegment.type === 'background') {
                // Resolve fuzzy tag to actual file path
                console.log(`[Background Debug] AI Tag: "${nextSegment.content}"`);
                const resolvedBg = resolveBackground(nextSegment.content);
                console.log(`[Background Debug] Resolved to: "${resolvedBg}"`);
                setBackground(resolvedBg);

                // [Fix] Sync Current Location with Narrative Tag
                console.log(`[Location] Updating Current Location: ${nextSegment.content}`);
                useGameStore.getState().setCurrentLocation(nextSegment.content);

                useGameStore.getState().setEventCG(null); // [Fix] Clear Event CG on background change
                setCharacterExpression(''); // Clear character on scene change

                // [Fix] Force React Render Cycle for Background
                // Sometimes state update doesn't reflect in time for the next frame if logic is heavy.
                // We rely on 'setBackground' (Zustand) which should trigger re-render.
                // But to be safe for "Streaming", we ensure this runs before next text segment.
                setTimeout(() => { }, 0);
            } else if (nextSegment.type === 'command') {
                // [New] Handle Commands
                if (nextSegment.commandType === 'set_time') {
                    const rawContent = nextSegment.content;
                    console.log(`[Command] Updating Time/Day: ${rawContent}`);

                    // [Fix] Parse Day explicitly to update State
                    // Format: "2일차 07:00 (아침)"
                    const dayMatch = rawContent.match(/(\d+)(일차|Day)/i);
                    if (dayMatch) {
                        const newDay = parseInt(dayMatch[1], 10);
                        if (!isNaN(newDay)) {
                            console.log(`[Command] Day Update: ${newDay}`);
                            useGameStore.getState().setDay(newDay);
                        }
                    }

                    // [Fix] Clean Time String (Remove Day part to avoid duplication in HUD)
                    // "2일차 07:00 (아침)" -> "07:00 (아침)"
                    const cleanTime = rawContent.replace(/(\d+)(일차|Day)\s*/gi, '').trim();
                    if (cleanTime) {
                        useGameStore.getState().setTime(cleanTime);
                    }
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
                            // [Fix] Normalize ID
                            const canonicalId = normalizeCharacterId(data.charId, useGameStore.getState().language || 'ko');
                            const val = Number(data.value);
                            console.log(`[Command] Update Rel: ${canonicalId} (User: ${data.charId}) += ${val}`);

                            // [Fix] Update PlayerStats (Primary Data Source for UI)
                            const currentStats = useGameStore.getState().playerStats;
                            const currentRel = currentStats.relationships[canonicalId] || 0;
                            const newRel = currentRel + val;

                            useGameStore.getState().setPlayerStats({
                                relationships: {
                                    ...currentStats.relationships,
                                    [canonicalId]: newRel
                                }
                            });

                            // [Fix] Sync CharacterData (Secondary)
                            useGameStore.getState().updateCharacterRelationship(canonicalId, newRel);

                            // Try to resolve name for toast
                            const charData = useGameStore.getState().characterData[canonicalId];
                            const name = charData ? charData.name : canonicalId;
                            addToast(`${name} 호감도 ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');
                        }
                    } catch (e) {
                        console.error("Failed to parse update_relationship command:", e);
                    }
                } else if (nextSegment.commandType === 'update_time') {
                    // [New] Inline Time Update
                    // [New] Inline Time Update
                    const rawContent = nextSegment.content;
                    console.log(`[Command] Inline Time Update: ${rawContent}`);

                    // Parse Day (reused logic from set_time)
                    const dayMatch = rawContent.match(/(\d+)(일차|Day)/i);
                    if (dayMatch) {
                        const newDay = parseInt(dayMatch[1], 10);
                        if (!isNaN(newDay)) {
                            useGameStore.getState().setDay(newDay);
                        }
                    }

                    // Clean Time String
                    const cleanTime = rawContent.replace(/(\d+)(일차|Day)\s*/gi, '').trim();
                    if (cleanTime) {
                        useGameStore.getState().setTime(cleanTime);
                        addToast(`시간 업데이트: ${cleanTime}`, 'info');
                    }

                } else if (nextSegment.commandType === 'add_injury') {
                    // [New] Inline Injury
                    try {
                        const data = JSON.parse(nextSegment.content);
                        if (data.name) {
                            console.log(`[Command] Inline Injury: ${data.name}`);
                            const state = useGameStore.getState();
                            const currentInjuries = state.playerStats.active_injuries || [];

                            if (!currentInjuries.includes(data.name)) {
                                state.setPlayerStats({
                                    active_injuries: [...currentInjuries, data.name]
                                });
                                addToast(`부상 발생: ${data.name}`, 'warning');
                                handleVisualDamage(-10, state.playerStats.hp, state.playerStats.maxHp);
                            }
                        }
                    } catch (e) {
                        console.error("Failed to parse add_injury command:", e);
                    }
                }
            } else if (nextSegment.type === 'bgm') {
                // [New] Handle BGM
                playBgm(nextSegment.content);
            } else if (nextSegment.type === 'event_cg') {
                // [New] Handle Event CG
                const content = nextSegment.content;
                if (content.toLowerCase() === 'off') {
                    useGameStore.getState().setEventCG(null);
                } else {
                    useGameStore.getState().setEventCG(content);
                }
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

            // [Fix] Trigger Deferred Ending (After text finishes)
            if (pendingEndingRef.current) {
                console.log(`[Ending] Triggering Deferred Ending: ${pendingEndingRef.current}`);
                useGameStore.getState().setEndingType(pendingEndingRef.current.toLowerCase() as any);
                pendingEndingRef.current = null;
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

            // [Epilogue Guard] Do NOT show choices during Epilogue (Streaming Fix)
            if (isEpilogueRef.current) {
                console.log("[Epilogue] Choices detected in queue. Suppressing and auto-advancing.");
                // We consumed them, so we just clear choices to be safe and continue
                setChoices([]);
            } else {
                setChoices(newChoices);
            }

            setScriptQueue(currentQueue.slice(i));
            setCurrentSegment(null);

            // [Fix] Apply Pending Logic when Reaching Choices (End of Turn)
            if (pendingLogic) {
                console.log("[VisualNovelUI] Applying Pending Logic at Choice Boundary", pendingLogic);
                applyGameLogic(pendingLogic);
                setPendingLogic(null);
            }
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


        // Response Time Tracking
    }, [currentSegment, scriptQueue]);

    // [fix] Auto-Advance Script when Queue fills (Streaming Support)
    // [fix] Auto-Advance Script when Queue fills OR when Epilogue finishes (Transition to The End)
    useEffect(() => {
        // Condition 1: Queue has items (Streaming)
        if (!currentSegment && scriptQueue.length > 0) {
            console.log("[Auto-Advance] Queue has items. currentSegment is null. Advancing...");
            advanceScript();
        }
        // Condition 2: Queue is empty, but we are in Epilogue Mode (and not yet showing The End)
        // This forces the "Final Call" to advanceScript which triggers setShowTheEnd(true)
        else if (!currentSegment && scriptQueue.length === 0 && isEpilogueRef.current && !showTheEnd) {
            console.log("[Auto-Advance] Epilogue finished. Triggering Final Advance for The End.");
            advanceScript();
        }
    }, [currentSegment, scriptQueue, showTheEnd]);


    const [avgResponseTime, setAvgResponseTime] = useState(30000); // Default 30 seconds as per request

    const handleSend = async (text: string, isDirectInput: boolean = false, isHidden: boolean = false) => {
        if (!text.trim()) return;

        setIsProcessing(true);
        const startTime = Date.now();
        console.log(`handleSend: "${text}", coins: ${userCoins}, session: ${!!session}, isDirectInput: ${isDirectInput}`);

        try {
            let activeSession = session;
            let currentCoins = userCoins;

            // [New] Determine Cost based on Model
            const currentModel = useGameStore.getState().storyModel;
            const COST_PER_TURN = currentModel === 'gemini-3-pro-preview' ? 20 : 10;

            console.log(`[Cost] Model: ${currentModel}, Cost: ${COST_PER_TURN}`);

            // 1. Ensure Session (Use local state)
            if (!activeSession?.user) {
                console.warn("handleSend: No session found, but allowing guest/optimistic play if coins > 0");
                if (currentCoins < COST_PER_TURN) {
                    // addToast("Login required or not enough coins.", "warning");
                    setShowRechargePopup(true); // Trigger Popup for Guests too
                    setIsProcessing(false);
                    return;
                }
            }

            // 2. Coin Check
            if (currentCoins < COST_PER_TURN) {
                console.warn("handleSend: Not enough coins");
                // addToast("Not enough coins! Please recharge.", "warning");
                setShowRechargePopup(true); // Trigger Popup
                setIsProcessing(false);
                return;
            }

            // 3. OPTIMISTIC Deduct Coin
            const newCoinCount = currentCoins - COST_PER_TURN;
            setUserCoins(newCoinCount); // Optimistic UI Update

            // Background DB Sync (Server Action)
            if (activeSession?.user) {
                // Ensure to import: import { deductCoins } from '@/app/actions/economy';
                // We use dynamic import or top-level import? Top-level is better but this is a large file update.
                // For now, let's just assume top-level import will be added by me in a separate step or I can add it here if I am careful?
                // No, replace_file_content chunk cannot add import at top easily if it's far away.
                // I will add the call here and then add the import at the top in a separate call or rely on user to add it? NO. I must do it.
                // Wait, dynamic import for server action? 
                // `import('@/app/actions/economy').then(mod => mod.deductCoins(COST_PER_TURN))`

                import('@/app/actions/economy').then(({ deductCoins }) => {
                    deductCoins(COST_PER_TURN).then((result) => {
                        if (result.success) {
                            console.log("Coin deduction confirmed by server:", result.newBalance);
                        } else {
                            console.error("Coin deduction failed:", result.error);
                            // [Critical Fix] Revert optimistic update on failure
                            setUserCoins(currentCoins);
                            alert(`코인 차감 처리 중 오류가 발생했습니다: ${result.error || "알 수 없는 오류"}`);
                        }
                    }).catch(err => {
                        console.error("Coin deduction mechanism failed:", err);
                        setUserCoins(currentCoins);
                        alert("코인 차감 시스템 오류");
                    });
                });
            }

            if (!isHidden) {
                // [Agentic] 1. Add User Message to History
                addMessage({ role: 'user', text: text });
                addChoiceToHistory({ text: text, type: 'input', timestamp: Date.now() });

                // [Typing Indicator]
                setIsTyping(true);

                // [Fix] Reset Epilogue Guard on Direct Input
                // If user is typing/playing, they are definitely NOT in an epilogue generation loop.
                console.log("[handleSend] User Input detected. Resetting Epilogue Guard.");
                isEpilogueRef.current = false;
            }
            setChoices([]);

            // [Fix] Reset active segment index for new turn to prevent skipping lines (Jump Bug)
            activeSegmentIndexRef.current = 0;
            console.log("[VisualNovelUI] Reset activeSegmentIndexRef to 0 for new turn.");

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
            // [OPTIMIZATION] Reduced history slice to 10 (User Request & Summary Cycle Align)
            const historyPayload = (currentState.chatHistory.length > 10
                ? currentState.chatHistory.slice(-10)
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
                // [OPTIMIZATION] Smart Character Pruning activeCharacters: currentState.activeCharacters,
                characterData: Object.entries(currentState.characterData).reduce((acc, [key, val]) => {
                    const isRelevant = currentState.activeCharacters.includes(key) || (val.memories && val.memories.length > 0) || val.relationship !== 0;
                    if (isRelevant) {
                        acc[key] = {
                            id: val.id,
                            name: val.name,
                            relationship: val.relationship,
                            relationshipInfo: val.relationshipInfo,
                            memories: val.memories, // Critical for context
                            description: val.description // Include only if dynamic
                        };
                    }
                    return acc;
                }, {} as any),
                goals: currentState.goals, // [FIX] Pass Goals to Server for Logic Model Analysis
                // [OPTIMIZATION] Sanitize World Data
                worldData: {
                    locations: currentState.worldData?.locations || {},
                    items: currentState.worldData?.items || {}
                },
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

                day: currentState.day, // [FIX] Pass Day to Server
                time: currentState.time, // [FIX] Pass Time to Server
                turnCount: nextTurnCount, // [FIX] Pass updated Turn Count for System Prompt Logic
            }));


            console.log(`[VisualNovelUI] Payload ActiveEvent:`, sanitizedState.activeEvent ? sanitizedState.activeEvent.id : "NULL");

            // [DEBUG] Dynamic Payload Reduction (Self-Healing)
            let finalPayload = {
                history: historyPayload,
                userInput: text,
                gameState: sanitizedState,
                language: language,
                modelName: useGameStore.getState().storyModel || MODEL_CONFIG.STORY
            };

            try {
                const getPayloadSizeMB = (obj: any) => JSON.stringify(obj).length / 1024 / 1024;
                let currentSize = getPayloadSizeMB(finalPayload);
                console.log(`%c[Payload Check] Initial: ${currentSize.toFixed(2)} MB`, "color: cyan");

                // Level 1: Reduce History to 5
                if (currentSize > 4.0) {
                    console.warn("[Payload] Level 1 Reduction: History 10 -> 5");
                    const reducedHistory = currentState.chatHistory.slice(-5).map(({ snapshot, ...rest }) => rest);
                    finalPayload.gameState.chatHistory = reducedHistory;
                    finalPayload.history = reducedHistory;
                    currentSize = getPayloadSizeMB(finalPayload);
                }

                // Level 2: Strip Active Event Prompt & Reduce History to 2
                if (currentSize > 4.0) {
                    console.warn("[Payload] Level 2 Reduction: History 5 -> 2, Strip Event Prompt");
                    const reducedHistory = currentState.chatHistory.slice(-2).map(({ snapshot, ...rest }) => rest);
                    finalPayload.gameState.chatHistory = reducedHistory;
                    finalPayload.history = reducedHistory;

                    // Strip huge prompt from event
                    if (finalPayload.gameState.activeEvent) {
                        finalPayload.gameState.activeEvent = {
                            id: finalPayload.gameState.activeEvent.id,
                            type: finalPayload.gameState.activeEvent.type, // keep type
                            // Remove prompt
                        };
                    }
                    currentSize = getPayloadSizeMB(finalPayload);
                }

                // Level 3: Emergency (No History, No Event, Minimal Char Data)
                if (currentSize > 4.0) {
                    console.warn("[Payload] Level 3 Reduction: EMERGENCY MODE");
                    finalPayload.gameState.chatHistory = [];
                    finalPayload.history = [];
                    finalPayload.gameState.activeEvent = null;
                    // Aggressive Char Pruning (Only ID/Name)
                    finalPayload.gameState.characterData = Object.entries(currentState.characterData).reduce((acc, [key, val]) => {
                        if (currentState.activeCharacters.includes(key)) {
                            acc[key] = { id: val.id, name: val.name };
                        }
                        return acc;
                    }, {} as any);
                    currentSize = getPayloadSizeMB(finalPayload);
                }

                console.log(`%c[Payload Check] Final: ${currentSize.toFixed(2)} MB`, "color: lime");

                if (currentSize > 4.4) {
                    alert("데이터 용량이 너무 커서 서버 전송에 실패할 수 있습니다. (4.5MB 초과)");
                }

            } catch (e) {
                console.error("Payload optimization failed:", e);
            }

            // Race Condition for Timeout


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

            // [Phase 1 Removed] Stream handles generation.

            const snapshotState = useGameStore.getState();
            const snapshot: Partial<typeof snapshotState> = {
                playerStats: JSON.parse(JSON.stringify(snapshotState.playerStats)),
                characterData: JSON.parse(JSON.stringify(snapshotState.characterData)),
                inventory: JSON.parse(JSON.stringify(snapshotState.inventory)),
                worldData: JSON.parse(JSON.stringify(snapshotState.worldData)),

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

            // [Stream Init]
            // activeSegmentIndexRef.current = 0; // [Fix] Removed to prevent Replay of Old Turn
            setCurrentSegment(null);
            let accumulatedText = "";
            let streamStarted = false;
            setCharacterExpression('');
            setFateUsage(0);
            const p1Start = Date.now();

            // [Safety] Race with Timeout
            let timeoutId: NodeJS.Timeout;
            const timeoutRace = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("Request Timed Out")), 300000);
            });

            try {
                await Promise.race([
                    fetchAgentTurnStream(
                        finalPayload, // [Fix] Use optimized payload
                        {
                            onToken: (token) => {
                                if (!streamStarted) {
                                    streamStarted = true;
                                    // [UX] First token received: Transition from "Thinking" to "Playing"

                                    // [Fix] Add Placeholder Output Message to prevent Overwriting User Input
                                    useGameStore.getState().addMessage({ role: 'model', text: '' });

                                    setIsProcessing(false); // Stop "Processing" spinner
                                    setIsTyping(false); // Stop typing dots
                                    setIsLogicPending(true); // Lock heavy interactions until Logic finishes

                                    // [Metrics] Update Average Response Time (TTFT)
                                    // User Request: Progress bar should track "Time to Start", not "Time to Finish".
                                    const ttft = Date.now() - startTime;
                                    console.log(`[Metrics] TTFT: ${ttft}ms`);
                                    setAvgResponseTime(prev => Math.round((prev * 0.7) + (ttft * 0.3)));
                                }

                                accumulatedText += token;

                                // [Filter] Client-side visibility filter for Thinking/Output tags
                                // We keep accumulatedText as the RAW buffer.
                                // We derive 'visText' for the parser and UI.
                                // [Fix] History Leaking / Text Flashing Bug
                                // We must strictly isolate the LAST <Output> block if multiple exist.
                                let visText = accumulatedText;

                                // 1. Remove closed Thinking blocks first (High Priority)
                                visText = visText.replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, '');

                                // 2. Hide partial Thinking blocks (prevent flash)
                                const openThink = visText.indexOf('<Thinking');
                                if (openThink !== -1) {
                                    visText = visText.substring(0, openThink);
                                }

                                // 3. [Fix] Relaxed Output Handling
                                // Instead of discarding everything before <Output>, we just extract the content inside it IF it exists.
                                // BUT, if <배경> exists *before* <Output>, we want to keep it.
                                // So we simply remove the <Output> tags themselves, relying on the fact that we already removed Thinking.
                                // Exception: If there are multiple Output blocks (leaking history), we SHOULD take the last one.
                                const outputMatches = [...visText.matchAll(/<Output>([\s\S]*?)<\/Output>/gi)];
                                if (outputMatches.length > 0) {
                                    // Take the content of the LAST complete block
                                    // AND also prepend any tags that appeared *before* the first Output? 
                                    // No, simple models might output "<Tags> <Output>Content</Output>".
                                    // Let's iterate and concat all non-thinking content?
                                    // Risk: Repeating history.

                                    // Safer Strategy:
                                    // If <Output> exists, use the LAST block's content.
                                    // BUT checking if the Background tag is missing in it?

                                    // Let's try the simple approach first that the User suggested implicitly (Timing/Parsing).
                                    // Be permissive: Just remove the tags.
                                    visText = visText.replace(/<Output[^>]*>/gi, '').replace(/<\/Output>/gi, '');

                                    // If we have "History <Output> New", replacing tags leaves "History New".
                                    // This is bad.
                                    // We MUST use substring if we suspect history leak.
                                    // Let's trust the LAST <Output> start index.
                                    const lastOpenIdx = accumulatedText.lastIndexOf('<Output>');
                                    if (lastOpenIdx !== -1) {
                                        // Check if <배경> is explicitly *before* this index in the scratch buffer?
                                        // This is getting complex.

                                        // Logic: If we found <Output>, valid content starts there.
                                        // IF the AI puts <배경> before it, the AI is malformed.
                                        // But I will allow a "Grace Zone" of 50 chars before Output?
                                        visText = accumulatedText.substring(lastOpenIdx);
                                        visText = visText.replace(/<Output[^>]*>/gi, '').replace(/<\/Output>/gi, '');
                                    } else {
                                        // No Output tag yet? Show everything (cleaned).
                                    }
                                } else {
                                    // No complete Output block logic or streaming incomplete.
                                    // If we have an OPEN tag but no close?
                                    const lastOpenIdx = visText.lastIndexOf('<Output>');
                                    if (lastOpenIdx !== -1) {
                                        visText = visText.substring(lastOpenIdx).replace(/<Output[^>]*>/gi, '');
                                    }
                                }

                                // [Fix] Scrub Logic Tags (Sync with Orchestrator)
                                // If we don't scrub these, the Client Parser might create 'Command' segments that the Server Parser (on clean text) doesn't.
                                // This causes 'activeSegmentIndexRef' to Desync (Client has more segments than Server).
                                // When onComplete swaps the text, the index points to the wrong place (or past end), causing "Reversion" or "Jump".
                                visText = visText
                                    .replace(/\[Stat[^\]]*\]/gi, '')
                                    .replace(/<Stat[^>]*>/gi, '')
                                    .replace(/\[Rel[^\]]*\]/gi, '')
                                    .replace(/<Rel[^>]*>/gi, '')
                                    .replace(/\[Relationship[^\]]*\]/gi, '')
                                    .replace(/<Relationship[^>]*>/gi, '')
                                    .replace(/\[Tension[^\]]*\]/gi, '')
                                    .replace(/<Tension[^>]*>/gi, '')
                                    .replace(/<NewInjury[^>]*>/gi, '')
                                    .replace(/<Injury[^>]*>/gi, '')
                                    .replace(/<Dead[^>]*>/gi, '')
                                    .replace(/\[Dead[^\]]*\]/gi, '')
                                    .replace(/<Location[^>]*>/gi, '')
                                    .replace(/<Faction[^>]*>/gi, '')
                                    .replace(/<Rank[^>]*>/gi, '')
                                    .replace(/<PlayerRank[^>]*>/gi, '')
                                    .replace(/\[PlayerRank[^\]]*\]/gi, '')
                                    .replace(/<EventProgress[^>]*>/gi, '')
                                    .replace(/\[EventProgress[^\]]*\]/gi, '')
                                    .replace(/<ResolvedInjury[^>]*>/gi, '')
                                    .replace(/\[ResolvedInjury[^\]]*\]/gi, '')
                                    // [Fix] Robustly remove Narration/Dialogue CLOSING tags (Parser only uses Open tags)
                                    .replace(/<\/\s*(나레이션|대사|이름|지문)[^>]*>/gi, '')
                                    // [Fix] Remove Ending Key Block entirely (System Data)
                                    .replace(/<ENDING KEY>[\s\S]*?<\/ENDING KEY>/gi, '')
                                    .replace(/<ENDING KEY>[^>]*>/gi, '')
                                    .replace(/<\/ENDING KEY>/gi, '')
                                    // [Fix] Do NOT remove Open Narration tag, as it acts as a delimiter for the parser.
                                    // Removing it causes the previous <대사> tag to greedily consume the narration text.
                                    // .replace(/<나레이션[^>]*>/gi, '') 
                                    .replace(/\[나레이션[^\]]*\]/gi, '');

                                // [Fix] Partial Tag Hiding (Prevent Flashing)
                                // If the text ends with a partial tag (e.g. "</나레"), hide it until it's complete and scrubbed.
                                // Logic: If there is a '<' that is NOT followed by a '>' anywhere after it.
                                // If the text ends with a partial tag (e.g. "</나레"), hide it until it's complete and scrubbed.
                                // Logic: If there is a '<' that is NOT followed by a '>' anywhere after it.
                                const lastLessThan = visText.lastIndexOf('<');
                                const lastGreaterThan = visText.lastIndexOf('>');
                                if (lastLessThan > lastGreaterThan) {
                                    // [Fix] Robustness: Only hide if it actually looks like a tag (starts with letter, /, !, ?)
                                    // This prevents hiding text like "Health < 50" or "Love <3"
                                    const nextChar = visText[lastLessThan + 1];
                                    if (nextChar && /[a-zA-Z가-힣!/?]/.test(nextChar)) {
                                        visText = visText.substring(0, lastLessThan);
                                    }
                                }

                                // [Removed] Aggressive Thinking Leak Scrubbing
                                // This logic was causing valid narrative text (appearing before the first tag) to be deleted.
                                // We now rely on the 'Thinking' tag removal above (lines 1849-1855).

                                const allSegments = parseScript(visText);

                                // [Fix] Aggressive Index Reset for Empty/Garbage Phase
                                // If we parsed 0 segments, we're in a "garbage" or "waiting for content" phase.
                                // The index should ALWAYS be 0 in this state to prevent stale index values
                                // from causing segment skips when real content arrives.
                                if (allSegments.length === 0) {
                                    activeSegmentIndexRef.current = 0;
                                }

                                // [DEBUG] Log segment count for each stream update

                                if (allSegments.length > 0) {

                                }

                                // [Stream] Auto-Advance Logic
                                // We track 'activeSegmentIndexRef' as the index of the segment currently being shown (or just finished).
                                // Logic: Scan from current index. If command/bg/bgm, execute & increment. If content, set & break.

                                let currentIndex = activeSegmentIndexRef.current;

                                // Safety check
                                if (currentIndex == null) currentIndex = 0;

                                // [Fix] Background Hoisting (Stream Start)
                                // If the stream starts with some garbage text followed by a Background tag,
                                // the standard loop stops at the text, preventing the BG from updating.
                                // We scan ahead in the first few segments to apply the BG immediately.
                                if (currentIndex === 0 && allSegments.length > 0) {
                                    for (let i = 0; i < Math.min(5, allSegments.length); i++) {
                                        const s = allSegments[i];
                                        if (s.type === 'background') {
                                            try {
                                                const resolvedBg = resolveBackground(s.content);
                                                // Direct store access to avoid closure staleness, though setBackground is likely stable
                                                const currentBg = useGameStore.getState().currentBackground;
                                                if (currentBg !== resolvedBg) {
                                                    console.log(`[Stream] Hoisted Background Update: ${resolvedBg}`);
                                                    setBackground(resolvedBg);
                                                }
                                            } catch (e) { }
                                        }
                                    }
                                }

                                while (currentIndex < allSegments.length) {
                                    const seg = allSegments[currentIndex];

                                    const isIdempotent = ['background', 'bgm', 'event_cg'].includes(seg.type);

                                    // [Fix] Stream Sync Hazard - "The Partial Tag Trap" & 404 Prevention
                                    // If a metadata segment (BG/BGM) is the LAST segment, it might be incomplete (growing).
                                    // We must NOT execute it yet to avoid 404s (partial paths) or flickering.
                                    // We wait until it is no longer the last segment (or stream ends, effectively).
                                    // Commands are non-idempotent (stat adds), but we assume they are atomic or parsed safely.

                                    const isLastSegment = currentIndex === allSegments.length - 1;

                                    if (isIdempotent && isLastSegment) {
                                        // Do NOT execute. Do NOT increment. Let loop break.
                                        // Next onToken will re-process this index with fuller content.
                                        break;
                                    }

                                    if (seg.type === 'background' || seg.type === 'bgm' || seg.type === 'event_cg' || seg.type === 'command') {
                                        // Execute Command
                                        if (seg.type === 'background') {
                                            try {

                                                const resolvedBg = resolveBackground(seg.content);

                                                // [Fix] Force Update on Start
                                                // If this is the very first segment (index 0), we force setBackground
                                                // to ensure the UI is in sync, even if the store thinks it's already set (e.g. from hydration).
                                                // This fixes "Missing Background on First Stream".
                                                const currentBg = useGameStore.getState().currentBackground;
                                                const shouldUpdate = currentBg !== resolvedBg || currentIndex === 0;

                                                if (shouldUpdate) {

                                                    setBackground(resolvedBg);
                                                    setCharacterExpression('');
                                                }
                                            } catch (e) { console.error("[Stream] BG Update Error:", e); }
                                        } else if (seg.type === 'bgm') {
                                            playBgm(seg.content);
                                        } else if (seg.type === 'event_cg') {
                                            // [New] Stream Event CG
                                            try {
                                                const clean = seg.content.replace(/<\/[^>]+>/g, '').trim();
                                                if (clean) {
                                                    useGameStore.getState().setEventCG(clean); // Assume store handles resolution or component does
                                                }
                                            } catch (e) { }
                                        } else if (seg.type === 'command') {
                                            // Minimal Stat Parsing (Sync with onComplete logic accumulator)
                                            if (seg.commandType === 'update_stat') {
                                                try {
                                                    const stats = JSON.parse(seg.content || '{}');
                                                    Object.entries(stats).forEach(([k, v]) => {
                                                        const val = Number(v);
                                                        if (isNaN(val)) return;
                                                        const key = k.toLowerCase();

                                                        // Accumulate
                                                        if (key === 'hp') inlineAccumulatorRef.current.hp += val;
                                                        else if (key === 'mp') inlineAccumulatorRef.current.mp += val;
                                                        else inlineAccumulatorRef.current.personality[key] = (inlineAccumulatorRef.current.personality[key] || 0) + val;

                                                        // Visual Update
                                                        applyGameLogic({
                                                            hpChange: key === 'hp' ? val : 0,
                                                            mpChange: key === 'mp' ? val : 0,
                                                            personalityChange: (key !== 'hp' && key !== 'mp') ? { [key]: val } : {}
                                                        });
                                                    });
                                                } catch (e) { }
                                            } else if (seg.commandType === 'update_relationship') {
                                                try {
                                                    const d = JSON.parse(seg.content || '{}');
                                                    if (d.charId && d.value) {
                                                        const val = Number(d.value);
                                                        const normalizedId = normalizeCharacterId(d.charId);
                                                        inlineAccumulatorRef.current.relationships[normalizedId] = (inlineAccumulatorRef.current.relationships[normalizedId] || 0) + val;
                                                        // Visual
                                                        useGameStore.getState().updateCharacterRelationship(normalizedId, val);
                                                        addToast(`${normalizedId} 호감도 ${val > 0 ? '+' : ''}${val}`, 'info');
                                                    }
                                                } catch (e) { }
                                            } else if (seg.commandType === 'set_time') {
                                                // Handle Time
                                                useGameStore.getState().setTime(seg.content);
                                            }
                                        }

                                        // Advance
                                        currentIndex++;
                                        activeSegmentIndexRef.current = currentIndex;
                                    } else {
                                        // Content (Dialogue/Narration/Choice)
                                        if (allSegments[currentIndex]) {
                                            const seg = allSegments[currentIndex];
                                            setCurrentSegment(seg);
                                            // [Fix] Ensure Typewriter receives the update
                                            if (currentSegmentRef.current?.content !== seg.content) {
                                                currentSegmentRef.current = seg;
                                            }
                                        }

                                        // Handle Choices Lookahead
                                        if (seg.type === 'choice') {
                                            const newChoices = [];
                                            let tempIdx = currentIndex;
                                            while (tempIdx < allSegments.length && allSegments[tempIdx].type === 'choice') {
                                                newChoices.push(allSegments[tempIdx]);
                                                tempIdx++;
                                            }
                                            setChoices(newChoices);
                                            setCurrentSegment(null); // Clear text box for choices
                                            setCharacterExpression(''); // Clear character for choices (optional)
                                        }

                                        // Update Queue for Next Click
                                        // If choice, we don't queue choices again? 
                                        // Standard logic: choices are handled by clicks.
                                        // But if "next" is clicked, we need queue?
                                        // Actually, if choice is displayed, script stops.
                                        // We should setQueue to remainder AFTER choices.

                                        let queueStart = currentIndex + 1;
                                        if (seg.type === 'choice' && allSegments.length > 0) {
                                            // Skip all choice segments in queue
                                            while (queueStart < allSegments.length && allSegments[queueStart].type === 'choice') {
                                                queueStart++;
                                            }
                                        }

                                        setScriptQueue(allSegments.slice(queueStart));
                                        break; // Stop auto-advance
                                    }
                                }
                            },
                            onComplete: (data) => {

                                const p2Duration = Date.now() - p1Start;

                                // [Fix] Destructure Correctly based on Orchestrator Payload
                                const {
                                    raw_story: cleanStoryText,
                                    logic: preLogicOut,
                                    post_logic: postLogicOut,
                                    martial_arts: martialArtsOut,
                                    event_debug, // Wrapper
                                    usage,
                                    latencies,
                                    costs,
                                    reply: finalStoryText // Mapped from 'reply'
                                } = data;

                                // Extract Event Data specifically
                                const eventOut = event_debug?.output;

                                // [Debug] Structured Console Logs (Enhanced Readability)
                                const logStyle = "font-weight: bold; color: #4ade80; background: #064e3b; padding: 2px 5px; border-radius: 3px;";
                                const subLogStyle = "font-weight: bold; color: #60a5fa;";

                                console.groupCollapsed(`%c[Turn ${currentState.turnCount}] AI Processing Report`, "font-size: 14px; background: #111; color: #fff; padding: 4px; border-radius: 4px;");

                                // 1. Pre-Logic
                                console.groupCollapsed(`%c1. Pre-Logic [${latencies?.preLogic || 0}ms]`, logStyle);
                                console.log("%c[Input Prompt]", subLogStyle, preLogicOut?._debug_prompt || "N/A");
                                console.log("%c[Analysis]", subLogStyle, preLogicOut?.judgment_analysis);
                                console.log("%c[Narrative Guide]", subLogStyle, preLogicOut?.narrative_guide);

                                // [Auxiliary Fields Log]
                                if (preLogicOut?.combat_analysis) console.log("%c[Combat Analysis]", subLogStyle, preLogicOut.combat_analysis);
                                if (preLogicOut?.emotional_context) console.log("%c[Emotional Context]", subLogStyle, preLogicOut.emotional_context);
                                if (preLogicOut?.character_suggestion) console.log("%c[Char Suggestion]", subLogStyle, preLogicOut.character_suggestion);
                                if (preLogicOut?.goal_guide) console.log("%c[Goal Guide]", subLogStyle, preLogicOut.goal_guide);
                                if (preLogicOut?.location_inference) console.log("%c[Loc Inference]", subLogStyle, preLogicOut.location_inference);

                                console.groupEnd();

                                // [New] Casting Debug
                                console.groupCollapsed(`%c1.5 Character Casting (${data.casting?.length || 0} candidates)`, logStyle);
                                if (data.casting && data.casting.length > 0) {
                                    // Format for Table (Reasons as String)
                                    const formattedCasting = data.casting.map((c: any) => ({
                                        id: c.id,
                                        name: c.name,
                                        score: c.score,
                                        scenario: c.aiScenario || "N/A", // [New] Show AI Scenario
                                        reasons: (Array.isArray(c.reasons) ? c.reasons : []).join(", "),
                                        data: c.data
                                    }));
                                    console.table(formattedCasting);
                                } else {
                                    console.log("No characters selected for casting.");
                                }
                                console.groupEnd();

                                // 2. Story Generation
                                console.groupCollapsed(`%c2. Story Generation (${cleanStoryText?.length || 0} chars) [${latencies?.story || 0}ms]`, logStyle);

                                // [New] Detailed Input Breakdown
                                const components = data.story_debug?.components;
                                if (components) {
                                    console.log("%c[Narrative Guide]", subLogStyle, components.narrative_guide);
                                    console.log("%c[Player Context]", subLogStyle, components.context_player);
                                    console.log("%c[Active Characters]", subLogStyle, components.context_characters);
                                    console.log("%c[Retrieved Context]", subLogStyle, components.context_retrieved);
                                    console.log("%c[Structure Instruction]", subLogStyle, components.instruction_thinking);
                                }

                                console.log("%c[Static Prompt]", subLogStyle, data.story_static_prompt || data.systemPrompt || "N/A");
                                console.log("%c[Dynamic Output (Full)]", subLogStyle, data.story_dynamic_prompt || components?.full_composite || "N/A");
                                console.log("%c[Generated Text]", subLogStyle, cleanStoryText);
                                console.groupEnd();

                                // 3. Game Logic (Post-Logic)
                                console.groupCollapsed(`%c3. Game Logic & Stats [${latencies?.postLogic || 0}ms]`, logStyle);
                                console.groupCollapsed("Post-Logic Input (Prompt)");
                                console.log(postLogicOut?._debug_prompt);
                                console.groupEnd();

                                console.groupCollapsed("Post-Logic System Prompt (Static Rules)");
                                console.log(postLogicOut?._debug_system_prompt || "Cached/Not Available");
                                console.groupEnd();

                                console.groupCollapsed("Post-Logic Output (Result)");
                                console.dir(postLogicOut);
                                console.groupEnd();

                                console.groupCollapsed("Martial Arts Logic");
                                console.log("System Prompt:", martialArtsOut?._debug_prompt);
                                console.dir(martialArtsOut);
                                console.groupEnd();
                                console.groupEnd();

                                // 4. Events
                                console.groupCollapsed(`%c4. Event System [${latencies?.eventSystem || 0}ms]`, logStyle); // Events run in parallel with PostLogic usually, or part of logic time

                                console.log("Event Data:", eventOut);
                                console.groupEnd();

                                // 5. Telemetry
                                console.groupCollapsed(`%c5. Performance & Cost ($${costs?.total?.toFixed(4) || '0.0000'})`, logStyle);
                                console.log(`%c[Timing Breakdown]`, "font-weight:bold; color: yellow;");
                                console.log(`- Retriever:  ${latencies?.retriever}ms`);
                                console.log(`- Pre-Logic:  ${latencies?.preLogic}ms %c(Blocking)`, "color:red");
                                console.log(`- Story Gen:  ${latencies?.story}ms`);
                                console.log(`- Post-Logic: ${latencies?.postLogic}ms`);
                                console.log(`- Total Turn: ${latencies?.total}ms`);
                                console.table(latencies);
                                console.log("Usage:", usage);
                                console.log("Detailed Costs:", costs);
                                console.groupEnd();

                                console.groupEnd(); // End Main Report

                                // [Fix] Field Name Mismatch Support (Orchestrator uses 'reply', UI expects 'finalStoryText')
                                const serverFinalText = finalStoryText || data.reply;

                                // [Fix] Update History with FINAL text (server authoritative)
                                let finalText = serverFinalText || cleanStoryText || accumulatedText;

                                // [Safety] If falling back to accumulatedText, we must scrub tags again (as it is raw)
                                if (finalText === accumulatedText) {
                                    finalText = finalText.replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, '')
                                        .replace(/<Output>/gi, '').replace(/<\/Output>/gi, '');
                                }

                                // [Fix] Robust History De-Duplication
                                // Sometimes the AI regurgitates the user's prompt or the previous turn's text.
                                // We check the last few messages in history and strip them if they appear at the START of finalText.
                                const lastUserMsg = currentState.chatHistory.slice().reverse().find(m => m.role === 'user');
                                const lastModelMsg = currentState.chatHistory.slice().reverse().find(m => m.role === 'model' && m.text !== '...' && m.text !== '');

                                if (lastUserMsg && finalText.trim().startsWith(lastUserMsg.text.trim())) {
                                    console.warn("[Post-Process] Deduplicated User Prompt from response.");
                                    finalText = finalText.replace(lastUserMsg.text.trim(), '').trim();
                                }

                                // Also check for "User: [Text]" format just in case
                                if (lastUserMsg && finalText.includes(`${lastUserMsg.text}`)) {
                                    // More aggressive leak check? 
                                    // Let's stick to prefix removal for safety.
                                }

                                // [Fallback] Text-based Ending Detection (Belt & Suspenders)
                                // [Fix] DISABLED due to false positives (e.g. text saying "배드 엔딩" in dialogue)
                                let detectedEndingType: 'bad' | 'good' | 'true' | null = null;
                                /*
                                if (finalText) {
                                    if (/(<BAD ENDING>|\[BAD ENDING\]|배드 엔딩|주인공 사망|\[사망\])/i.test(finalText)) detectedEndingType = 'bad';
                                    else if (/(<GOOD ENDING>|\[GOOD ENDING\]|굿 엔딩|굿엔딩|해피 엔딩|\[완벽한 굿엔딩\])/i.test(finalText)) detectedEndingType = 'good';
                                    else if (/(<TRUE ENDING>|\[TRUE ENDING\]|트루 엔딩|진 엔딩|진엔딩)/i.test(finalText)) detectedEndingType = 'true';

                                    if (detectedEndingType) {
                                        console.log(`[Ending] Text-based detection: ${detectedEndingType}`);
                                    } else {
                                        console.log(`[Ending] No text-based ending detected in: ${finalText.slice(-50)}`);
                                    }
                                }
                                */

                                if (finalText) {
                                    setLastStoryOutput(finalText);

                                    // [Fix] Capture Snapshot for Rewind (Atomic w/o recursing history)
                                    // This must be done BEFORE logic update if we want "Pre-Logic" state?
                                    // Actually, we usually want "Post-Logic" state of the PREVIOUS TURN.
                                    // But here we are saving the snapshot associated with THIS message.
                                    // If we rewind to THIS message, we want the state associated with it.
                                    // Since this is the AI response, the state should be the RESULT of the turn.
                                    // However, 'applyGameLogic' is pending (deferred).
                                    // So this snapshot captures "Pre-Logic" state.
                                    // This means if we rewind to this message, we get state BEFORE damage.
                                    // This is actually safer for "Retry".
                                    const currentState = useGameStore.getState();
                                    const snapshot = {
                                        ...currentState,
                                        chatHistory: [], // Exclude history to prevent bloat/recursion
                                        displayHistory: []
                                    };

                                    // [Fix] Atomic Replacement of Placeholder with Final + Snapshot
                                    // Prevents "Duplicate Bubble" issue where Placeholder and Final both appeared.
                                    useGameStore.getState().replaceLastMessage({ role: 'model', text: finalText, snapshot });

                                    // [Fix] Re-Sync Script Queue to include Choices
                                    // The 'finalText' contains the choices appended by the server.
                                    // We re-parse it and update the queue, respecting the user's current reading position.
                                    const rawSegments = parseScript(finalText);

                                    // [Fix] If Ending is triggered, STRIP CHOICES from queue to prevent UI overlap
                                    // We check both the explicit JSON trigger and the fallback text detection.
                                    let hasEnding = (postLogicOut?.ending_trigger && ['BAD', 'GOOD', 'TRUE'].includes(postLogicOut.ending_trigger)) || detectedEndingType;

                                    // [Epilogue Guard] If we are in Epilogue Mode, suppress ANY ending triggers.
                                    // The AI often repeats "<BAD ENDING>" in the epilogue text, which causes a loop.
                                    if (isEpilogueRef.current) {
                                        if (hasEnding) {
                                            console.log(`[Epilogue] Suppressing ending trigger '${hasEnding}'. (Epilogue Mode is ACTIVE)`);
                                            hasEnding = false;

                                            // [New] Trigger Final "The End" State
                                            // [Fix] Do NOT trigger 'The End' immediately here.
                                            // Use 'advanceScript' to trigger it ONLY after the user reads all the text.
                                            console.log("[Epilogue] Epilogue Generated. Waiting for user to read...");
                                            // setShowTheEnd(true); // <--- REMOVED PREMATURE TRIGGER
                                        }
                                    } else {
                                        console.log(`[Epilogue] Epilogue Mode is FALSE. Allowing ending: ${hasEnding}`);
                                    }

                                    const finalSegments = (hasEnding || isEpilogueRef.current)
                                        ? rawSegments.filter(s => s.type !== 'choice')
                                        : rawSegments;

                                    if (hasEnding) {
                                        // [Fix] Defer Ending Trigger until after text detection
                                        // We removed choices from the queue, so the user will click through the text.
                                        // when queue ends, applyGameLogic will fire and trigger the ending.

                                        console.log(`[Ending] Detected (${postLogicOut?.ending_trigger || detectedEndingType}). Choices stripped.`);
                                        setChoices([]); // Ensure clear so no buttons appear
                                    }

                                    // [Fix] Content-Based Queue Synchronization
                                    // Instead of blindly slicing by index (which fails if parser yields different segment counts for stream vs final),
                                    // we find WHERE in the finalSegments the user currently is, based on Content Matching.

                                    let newQueueIndex = 0;
                                    const currentIndex = activeSegmentIndexRef.current;

                                    // 1. Get the content the user is currently looking at (or just finished)
                                    // We need to access the 'allSegments' from the LAST render.
                                    // Since we don't have direct access to the stream's 'allSegments' here (it's local to onToken),
                                    // we rely on 'currentSegment' state if it exists, or we infer from index if we could trust it.
                                    // Actually, 'currentSegment' is the SOURCE of truth for what's on screen.

                                    // [Fix] Use Ref instead of Stale State
                                    const liveCurrentSegment = currentSegmentRef.current;

                                    // [Fix] Drift Recovery: Variable to collect skipped segments
                                    // Must be declared outside the if block so it's accessible when building the queue
                                    let skippedContentSegments: typeof finalSegments = [];

                                    if (liveCurrentSegment && currentIndex !== null) {
                                        // Normalize content for comparison (remove spaces/newlines)
                                        const normalize = (s: string) => s.replace(/\s+/g, '').trim();
                                        const targetContent = normalize(liveCurrentSegment.content);

                                        // 2. Scan finalSegments to find BEST match (Closest to currentIndex)
                                        let bestMatchIndex = -1;
                                        let minDistance = Infinity;

                                        for (let i = 0; i < finalSegments.length; i++) {
                                            const seg = finalSegments[i];
                                            const segContent = normalize(seg.content);

                                            // [Debug] Deep Search - Log only candidates near window
                                            if (Math.abs(i - currentIndex) < 10) {
                                                const isPrefix = segContent.startsWith(targetContent);
                                                const isExact = segContent === targetContent;
                                                // console.log(`[SyncCandidate] [${i}] Pfx:${isPrefix} Exact:${isExact} (${segContent.substring(0,10)}...)`);
                                            }

                                            // Check Exact or Prefix Match
                                            if (segContent && (segContent === targetContent || segContent.startsWith(targetContent))) {
                                                const distance = Math.abs(i - currentIndex);

                                                if (distance < minDistance) {
                                                    minDistance = distance;
                                                    bestMatchIndex = i;

                                                    // [Fix] Auto-Repair Partial Segment
                                                    // If Target (Stream) is shorter than Match (Final) and is a prefix, it means user has incomplete text.
                                                    // We MUST upgrade the screen content to the full final text, otherwise queueing 'bestMatchIndex + 1' will skip the suffix.
                                                    if (segContent.length > targetContent.length) {

                                                        setCurrentSegment(seg);
                                                        currentSegmentRef.current = seg;
                                                    }
                                                }
                                            }
                                        }



                                        // [Debug] Sync Trace


                                        // [Fix] Drift Recovery: Capture Skipped Content Segments
                                        // [Correction] If bestMatchIndex > currentIndex, it usually means the USER manually advanced (clicked)
                                        // faster than the stream parser loop. The 'skipped' segments are actually SEEN segments.
                                        // We should NOT rewind the user. We trust the User's Position (bestMatchIndex).

                                        if (bestMatchIndex !== -1) {
                                            // The user is currently looking at 'bestMatchIndex'.
                                            // The next content to show is simply the one after it.

                                            // [Debug] Log Advance
                                            if (bestMatchIndex > (currentIndex || 0)) {
                                                console.log(`[Sync] User is Ahead of Stream. Stream:${currentIndex} -> User:${bestMatchIndex}. Accepting User Position.`);
                                            }

                                            newQueueIndex = bestMatchIndex + 1;
                                        } else {
                                            // [Fix] Race Condition Vulnerability
                                            // If currentSegment is null (state lag) but currentIndex is set (ref), 
                                            // falling back to 'currentIndex + 1' SKIPS the current segment.
                                            // We should fallback to 'currentIndex' to ensure it gets queued.

                                            newQueueIndex = currentIndex || 0;
                                        }
                                    } else {
                                        // No active segment? Maybe starting fresh or error.
                                        // [Fix] Same as above. Do not skip if we haven't rendered yet.
                                        newQueueIndex = (currentIndex || 0);
                                    }

                                    // Apply the calculated start index
                                    let adjustedIndex = newQueueIndex;

                                    // [Fix] Enhanced Repetition Guard (Window 3) with Verify Logs
                                    if (liveCurrentSegment) {
                                        const normalize = (s: string) => s.replace(/\s+/g, '').trim();
                                        const currentContent = normalize(liveCurrentSegment.content);

                                        // [Debug] Log Before Guard
                                        // console.log(`[SyncCheck] Current Screen: "${liveCurrentSegment.content.substring(0, 15)}..."`);

                                        // Check 0, 1, 2
                                        for (let offset = 0; offset < 3; offset++) {
                                            if (adjustedIndex + offset < finalSegments.length) {
                                                const checkSeg = finalSegments[adjustedIndex + offset];
                                                if (checkSeg.type === liveCurrentSegment.type &&
                                                    normalize(checkSeg.content) === currentContent) {


                                                    adjustedIndex = adjustedIndex + offset + 1;
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    // [Fix] Flush Pending Metadata at End of Stream
                                    // If the stream ended on a Background/BGM tag, 'onToken' would have skipped it (waiting for more data).
                                    // Now that we are Complete, we MUST execute any pending non-content segments immediately.
                                    // Also, if the screen is EMPTY (Cold Start), we should auto-display the first content to avoid "first line skipped" feel.

                                    while (adjustedIndex < finalSegments.length) {
                                        const seg = finalSegments[adjustedIndex];
                                        const isMetadata = ['background', 'bgm', 'command', 'event_cg'].includes(seg.type);

                                        if (isMetadata) {

                                            // Execute Metadata
                                            if (seg.type === 'background') {
                                                const resolvedBg = resolveBackground(seg.content);
                                                if (useGameStore.getState().currentBackground !== resolvedBg) {
                                                    setBackground(resolvedBg);
                                                    setCharacterExpression('');
                                                }
                                            } else if (seg.type === 'bgm') {
                                                playBgm(seg.content);
                                            } else if (seg.type === 'event_cg') {
                                                useGameStore.getState().setEventCG(seg.content);
                                            } else if (seg.type === 'command') {
                                                // Identify command type and execute if necessary (Time, etc)
                                                if (seg.commandType === 'set_time') {
                                                    useGameStore.getState().setTime(seg.content);
                                                }
                                            }
                                            // Advance past this segment since we just executed it
                                            adjustedIndex++;
                                        } else {
                                            // It is Content (Dialogue/Narration/Choice)

                                            // [Fix] Cold Start Protection
                                            // If NOTHING is currently on screen (currentSegmentRef.current is null),
                                            // and we are sitting at the start of new content, AUTO-DISPLAY it.
                                            // Otherwise the user sees a blank screen and has to click to see the first line.
                                            if (!currentSegmentRef.current && seg.type !== 'choice') {

                                                setCurrentSegment(seg);
                                                currentSegmentRef.current = seg;
                                                // We CONSUMED this segment by displaying it, so advance index.
                                                adjustedIndex++;
                                            }

                                            // Stop flushing. We are now at the "Next" content to be queued.
                                            break;
                                        }
                                    }


                                    // [Fix] Flush Pending Metadata at End of Stream
                                    // If the stream ended on a Background/BGM tag, 'onToken' would have skipped it (waiting for more data).
                                    // Now that we are Complete, we MUST execute any pending non-content segments immediately.
                                    // Also, if the screen is EMPTY (Cold Start), we should auto-display the first content to avoid "first line skipped" feel.

                                    while (adjustedIndex < finalSegments.length) {
                                        const seg = finalSegments[adjustedIndex];
                                        const isMetadata = ['background', 'bgm', 'command', 'event_cg'].includes(seg.type);

                                        if (isMetadata) {

                                            // Execute Metadata
                                            if (seg.type === 'background') {
                                                const resolvedBg = resolveBackground(seg.content);
                                                if (useGameStore.getState().currentBackground !== resolvedBg) {
                                                    setBackground(resolvedBg);
                                                    setCharacterExpression('');
                                                }
                                            } else if (seg.type === 'bgm') {
                                                playBgm(seg.content);
                                            } else if (seg.type === 'event_cg') {
                                                useGameStore.getState().setEventCG(seg.content);
                                            } else if (seg.type === 'command') {
                                                // Identify command type and execute if necessary (Time, etc)
                                                if (seg.commandType === 'set_time') {
                                                    useGameStore.getState().setTime(seg.content);
                                                }
                                            }
                                            // Advance past this segment since we just executed it
                                            adjustedIndex++;
                                        } else {
                                            // It is Content (Dialogue/Narration/Choice)

                                            // [Fix] Cold Start Protection
                                            // If NOTHING is currently on screen (currentSegmentRef.current is null),
                                            // and we are sitting at the start of new content, AUTO-DISPLAY it.
                                            // Otherwise the user sees a blank screen and has to click to see the first line.
                                            if (!currentSegmentRef.current && seg.type !== 'choice') {

                                                setCurrentSegment(seg);
                                                currentSegmentRef.current = seg;
                                                // We CONSUMED this segment by displaying it, so advance index.
                                                adjustedIndex++;
                                            }

                                            // Stop flushing. We are now at the "Next" content to be queued.
                                            break;
                                        }
                                    }

                                    const remaining = finalSegments.slice(adjustedIndex);

                                    // [Fix] Drift Recovery: Logic Removed
                                    // We now assume skipped segments were seen by user manual advance.
                                    let finalQueue = remaining;
                                    if (skippedContentSegments.length > 0) {
                                        console.warn("[Sync] Unexpected skipped segments detected (Is Backfilling Enabled?):", skippedContentSegments);
                                        // Redundant safety - normally empty now
                                    }

                                    setScriptQueue(finalQueue);


                                    // [Debug] Final Verify
                                    if (finalQueue.length > 0) {

                                    }
                                }

                                // Calculate Logic
                                // Deduplication Logic
                                const inlineDeltas: Record<string, number> = {};
                                if (postLogicOut && postLogicOut.inline_triggers) {
                                    postLogicOut.inline_triggers.forEach((trigger: any) => {
                                        const statMatch = trigger.tag.match(/<Stat\s+([^=]+)=['"]?(-?\d+)['"]?.*?>/i);
                                        if (statMatch) {
                                            const key = statMatch[1].toLowerCase();
                                            const val = parseInt(statMatch[2], 10);
                                            if (!isNaN(val)) inlineDeltas[key] = (inlineDeltas[key] || 0) + val;
                                        }
                                    });
                                }

                                const maHp = martialArtsOut?.stat_updates?.hp || 0;
                                const sourceHp = maHp;
                                const inlineHp = inlineDeltas['hp'] || 0;
                                let finalHpChange = (sourceHp !== 0) ? sourceHp - inlineHp : 0;

                                const maMp = martialArtsOut?.stat_updates?.mp || 0;
                                const sourceMp = maMp;
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

                                // [Fate System] Update logic - DEPRECATED (Handled Client-Side)
                                // const fateDelta = preLogicOut?.fate_change || 0;


                                const combinedLogic = {
                                    hpChange: finalHpChange,
                                    fate: 0, // [Fate] Handled deterministically before request
                                    mpChange: finalMpChange,
                                    personalityChange: plPersonality,
                                    // [MOOD PERSISTENCE] Apply PreLogic Override if PostLogic is silent
                                    // Priority: PostLogic (Result) > PreLogic (Intent)
                                    mood: postLogicOut?.mood_update || preLogicOut?.mood_override,
                                    location: postLogicOut?.location_update,
                                    new_memories: postLogicOut?.new_memories,
                                    activeCharacters: postLogicOut?.activeCharacters,
                                    injuriesUpdate: {
                                        add: postLogicOut?.new_injuries,
                                        remove: postLogicOut?.resolved_injuries
                                    },
                                    stat_updates: postLogicOut?.stat_updates,
                                    goal_updates: postLogicOut?.goal_updates,
                                    new_goals: postLogicOut?.new_goals,
                                    // [Fix] Inject Text-Detected Ending if JSON missed it, BUT suppress if in Epilogue
                                    ending_trigger: isEpilogueRef.current ? null : (postLogicOut?.ending_trigger ?? (detectedEndingType ? detectedEndingType.toUpperCase() : null)),
                                    post_logic: {
                                        ...(postLogicOut || {}),
                                        stat_updates: plPersonality
                                    },
                                    martial_arts: martialArtsOut ? {
                                        ...martialArtsOut,
                                        stat_updates: { ...(martialArtsOut.stat_updates || {}), hp: 0, mp: 0 }
                                    } : martialArtsOut,
                                    _debug_router: data.routerOut,
                                    triggerEventId: eventOut?.triggerEventId,
                                    currentEvent: eventOut?.currentEvent,
                                    candidates: eventOut?.candidates,
                                    event_debug_info: eventOut?.debug
                                };


                                // Defer Logic
                                const deferredLogic = { ...combinedLogic };
                                // Subtract already applied (Client side accumulator)
                                const acc = inlineAccumulatorRef.current;
                                if (deferredLogic.hpChange !== undefined) deferredLogic.hpChange -= acc.hp;
                                if (deferredLogic.mpChange !== undefined) deferredLogic.mpChange -= acc.mp;
                                if (deferredLogic.personalityChange) {
                                    Object.entries(acc.personality).forEach(([k, v]) => {
                                        if (deferredLogic.personalityChange[k] !== undefined) {
                                            deferredLogic.personalityChange[k] -= v;
                                        }
                                    });
                                }
                                // Reset Inline Accumulator
                                inlineAccumulatorRef.current = { hp: 0, mp: 0, relationships: {}, personality: {} };

                                // [Fix] Apply Logic IMMEDIATELY to prevent "Choice Gap"
                                // If we defer logic, the UI might show choices (enabling interaction)
                                // BEFORE the logic determines the user is dead or an ending occurred.
                                // This causes "Ghost Cost" (User clicks -> Token Used -> Then dies).
                                // By applying immediately, we ensure the UI reflects the TRUE state (e.g. Bad Ending)
                                // before unlocking controls.
                                applyGameLogic(deferredLogic);

                                setPendingLogic(null);
                                setIsLogicPending(false);

                                // [Fix] Trigger Critical Autosave
                                // Ensure we save the game state *after* all logic and text are finalized.
                                // This prevents "Loss of Context" if the user reloads right after a turn.
                                console.log("[AutoSave] Triggering Post-Turn Autosave...");
                                useGameStore.getState().saveToSlot('auto');

                                // Logging
                                submitGameplayLog({
                                    session_id: activeSession?.user?.id || '00000000-0000-0000-0000-000000000000',
                                    game_mode: useGameStore.getState().activeGameId,
                                    turn_count: useGameStore.getState().turnCount,
                                    choice_selected: text,
                                    player_rank: useGameStore.getState().playerStats.playerRank,
                                    location: useGameStore.getState().currentLocation,
                                    timestamp: new Date().toISOString(),
                                    player_name: useGameStore.getState().playerName,
                                    cost: costs?.total || 0,
                                    input_type: isDirectInput ? 'direct' : 'choice',
                                    meta: {
                                        hp: useGameStore.getState().playerStats.hp,
                                        pre_logic_score: preLogicOut?.plausibility_score,
                                        scenario_summary: useGameStore.getState().scenarioSummary
                                    },
                                    story_output: finalStoryText || cleanStoryText
                                });

                                // [NEW] Accumulate Log for "Replay" / "Story Log" Feature
                                if (finalStoryText || cleanStoryText) {
                                    useGameStore.getState().addStoryLogEntry({
                                        turn: useGameStore.getState().turnCount,
                                        content: finalStoryText || cleanStoryText,
                                        type: 'narrative',
                                        timestamp: Date.now()
                                    });
                                }

                                console.log(`%c[Telemetry] Stream Finished. Latency: ${p2Duration}ms`, 'color: green;');
                            },
                            onError: (err) => {
                                console.error("[Stream] Error:", err);
                                addToast("Error: " + err.message, "error");
                                setIsProcessing(false);
                                setIsLogicPending(false);
                            }
                        }
                    ), timeoutRace]);
            } finally {
                // @ts-ignore
                if (timeoutId) clearTimeout(timeoutId);
            }

            // [Streaming] Script playback is handled incrementally in onToken.

            // [Streaming] Script playback is handled incrementally in onToken.


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

        // [Intervention Fix] Truncate 'Future' Text from History
        // When intervening mid-turn, we must remove unread text from the history log
        // to prevent spoilers and ensure the log matches the user's experience.
        const state = useGameStore.getState();
        const history = state.chatHistory;
        const queue = scriptQueue; // Use local state which is in-sync with UI

        // [Fate System] Deterministic Deduction
        // Must happen BEFORE handleSend to prevent "Free Usage" if network fails, 
        // but primarily to ensure prompt reflects "Paid" status.
        if (fateUsage > 0) {
            const currentFate = state.playerStats.fate || 0;
            const fateCost = fateUsage * fateUsage;

            if (currentFate < fateCost) {
                addToast("운명이 부족합니다! (Not enough Fate)", "warning");
                return;
            }

            // Deduct immediately
            const newFate = currentFate - fateCost;
            useGameStore.getState().setPlayerStats({ ...state.playerStats, fate: newFate });
            addToast(`운명 ${fateCost} 포인트 사용`, "info");
            console.log(`[Fate] Client-side deduction: -${fateCost} (New Balance: ${newFate})`);
        }

        if (history.length > 0 && queue.length > 0) {
            const lastMsg = history[history.length - 1];
            if (lastMsg.role === 'model') {
                const segments = parseScript(lastMsg.text);

                // Assuming scriptQueue is a suffix of the original segments (Safe Assumption for linear reads)
                const seenCount = Math.max(0, segments.length - queue.length);

                if (seenCount < segments.length) {
                    const seenSegments = segments.slice(0, seenCount);

                    // Reconstruct Text from Seen Segments
                    // This creates a "Clean" version of the history for display and persistence
                    const reconstructed = seenSegments.map(s => {
                        if (s.type === 'background') return `<배경>${s.content}`;
                        if (s.type === 'bgm') return `<BGM>${s.content}`;
                        if (s.type === 'dialogue') {
                            if (s.character) return `<대사> ${s.character}: ${s.content}`;
                            return `<대사> ${s.content}`;
                        }
                        if (s.type === 'narration') return s.content;
                        if (s.type === 'system_popup') return `<시스템> ${s.content}`;
                        return '';
                    }).filter(Boolean).join('\n');

                    console.log(`[Intervention] Truncating history. Segments: ${segments.length} -> ${seenSegments.length}`);
                    state.updateLastMessage(reconstructed);
                }
            }
        }

        // [New] Clear Script Queue on Intervene to "Interrupt" current flow
        setScriptQueue([]);


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
    const isEpilogueRef = useRef(false); // [Fix] Track Epilogue State to suppress recurring triggers

    const handleScreenClick = (e: React.MouseEvent) => {
        // [Fix] Allow clicking if we have buffered segments, even if still processing (Streaming Mode)
        // Block only if processing AND queue is empty (Waiting for tokens)
        if ((isProcessing && scriptQueue.length === 0) || isInputOpen || isDebugOpen || showHistory || showInventory || showCharacterInfo || showSaveLoad || showWiki) return;
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
            // [Fix] Reset Epilogue Guard on New Game Start
            isEpilogueRef.current = false;

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
                        // [Fix] Protagonist Override Handling
                        // If this IS the protagonist, and we have an override, use the override key for lookup
                        if (isHiddenProtagonistMatch && state.protagonistImageOverride) {
                            console.log(`[ImageDebug] Protagonist Override Match! Name: ${first.character}, OverrideKey: ${state.protagonistImageOverride}`);
                            // If override is a direct path (rare), use it. otherwise treat as key.
                            // Usually override is like 'protagonist_wuxia_male_default'
                            imagePath = getCharacterImage(state.protagonistImageOverride, emotion);
                            console.log(`[ImageDebug] Resolved Path via Override: ${imagePath}`);
                        } else {
                            imagePath = getCharacterImage(charName, emotion);
                            console.log(`[ImageDebug] Standard Resolution. Name: ${charName} -> Path: ${imagePath}`);
                        }
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

    // [New] Ending System Handlers
    // [New] Ending System Handlers
    // const endingType = useGameStore((state) => state.endingType); // [Fix] Removed duplicate (now at top level)

    const handleRewind = () => {
        const history = useGameStore.getState().chatHistory;

        let safeIndex = -1;
        // Search backwards, skipping the very last message (which is likely the death message)
        // We look for a valid Model snapshot where the player was alive.
        console.log("[Rewind] Searching for safe point...");
        for (let i = history.length - 2; i >= 0; i--) {
            const msg = history[i];
            if (msg.role === 'model') {
                if (msg.snapshot) {
                    const snap = msg.snapshot as any;
                    const hp = snap.playerStats?.hp ?? 0;
                    const endType = snap.endingType || 'none';

                    console.log(`[Rewind] Checking msg[${i}]: HP=${hp}, End=${endType}`);

                    if (hp > 0 && endType === 'none') {
                        safeIndex = i;
                        console.log(`[Rewind] Safe point found at index ${i}`);
                        break;
                    }
                } else {
                    console.log(`[Rewind] Msg[${i}] has NO snapshot.`);
                }
            }
        }

        if (safeIndex !== -1) {
            const safeMsg = history[safeIndex];
            const snapshot = safeMsg.snapshot;

            if (snapshot) {
                // [Fix] Atomic State Restoration
                // We truncated the history to the point of the safe snapshot.
                const truncatedHistory = history.slice(0, safeIndex + 1);

                // Restore Global State
                useGameStore.setState({
                    ...snapshot,
                    chatHistory: truncatedHistory,
                    displayHistory: truncatedHistory, // Keep display synced
                    endingType: 'none', // Ensure ending lock is lifted
                });

                // [Fix] Reset Epilogue Guard on Rewind
                isEpilogueRef.current = false;

                // [Fix] Reset Epilogue Guard on Rewind
                isEpilogueRef.current = false;

                // Reset Local UI State
                setChoices([]);
                setScriptQueue(snapshot.scriptQueue || []); // Restore queue if captured
                setCurrentSegment(snapshot.currentSegment || null); // Restore segment

                addToast("운명의 수레바퀴를 되돌렸습니다. (Time Rewind)", "success");
            }
        } else {
            // No safe point found (e.g. died at very beginning or no snapshots)
            addToast("되돌릴 수 있는 안전한 시점이 없습니다. (No Safe Point)", "warning");
        }
    };

    const handleTitle = () => {
        console.log("[Epilogue] handleTitle called. Resetting Epilogue Guard.");
        isEpilogueRef.current = false;
        router.push('/');
    };

    const handleEpilogue = () => {
        setIsProcessing(true); // [Fix] Force Processing State IMMEDIATELY to block premature 'The End' trigger
        isEpilogueRef.current = true; // [Fix] Enable Epilogue Mode
        // Trigger AI to write epilogue
        // [Fix] Reset HP to 1 to prevent immediate "Dead" trigger loop if Epilogue is for a Bad Ending
        const currentStats = useGameStore.getState().playerStats;
        if (currentStats.hp <= 0) {
            console.log("[Epilogue] Resurrecting player (HP 1) to allow epilogue playback.");
            useGameStore.getState().setPlayerStats({ ...currentStats, hp: 1 });
        }

        setChoices([]); // [Fix] Clear choices immediately
        handleSend("에필로그를 들려줘. [System: Write an Epilogue for the Good Ending]", true, true);
        useGameStore.getState().setEndingType('none');
        console.log("[Epilogue] Mode Activated. isEpilogueRef = true");
    };

    const handleContinue = () => {
        console.log("[Epilogue] handleContinue called. Resetting Epilogue Guard.");
        isEpilogueRef.current = false;
        useGameStore.getState().setEndingType('none');
        setChoices([]); // [Fix] Clear choices
    };

    function applyGameLogic(logicResult: any) {
        // [Refactor] Collapsible Console Group for Cleaner Logs
        console.groupCollapsed("▶ [applyGameLogic] Received Payload");
        console.dir(logicResult);
        console.groupEnd();

        if (!logicResult) {
            console.warn('applyGameLogic: logicResult is null or undefined');
            return;
        }
        setLastLogicResult(logicResult);

        // [New] Ending Trigger
        // [Fix] Epilogue Guard: Do not re-trigger ending if already in Epilogue mode
        if (logicResult.ending_trigger && ['BAD', 'GOOD', 'TRUE'].includes(logicResult.ending_trigger) && !isEpilogueRef.current) {
            console.log(`[Ending] Detected: ${logicResult.ending_trigger}. Deferring trigger until text completion.`);
            // [Fix] Defer ending trigger until script queue is empty
            pendingEndingRef.current = logicResult.ending_trigger;
            setChoices([]); // [Fix] Force-clear any floating choices to prevent UI overlap
        }

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

                    // [Fix] HARD Auto-Death Trigger (Backup if AI misses it)
                    if (newStats.hp <= 0 && useGameStore.getState().endingType === 'none') {
                        console.log("HP <= 0 detected. Queuing DEFERRED BAD ENDING.");
                        // Do NOT set immediately, as user might still be reading the "You died" description.
                        pendingEndingRef.current = 'bad';
                    }
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

        // [New] Deterministic Rank Progression (Wuxia Only)
        // If we are in Wuxia mode, check for rank up based on updated stats (Level + Neigong).
        if (activeGameId === 'wuxia') {
            const progression = checkRankProgression(newStats, useGameStore.getState().playerStats.playerRank);
            if (progression) {
                console.log(`[Progression] Rank Up Detected: ${progression.newRankId}`);
                useGameStore.getState().setPlayerStats({ playerRank: progression.newRankId });
                // [Suppressed] Rank Up Toast
                // addToast(`[승급] ${progression.title}의 경지에 올랐습니다!`, 'success');
                // addToast(progression.message, 'info');
            }
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

        if (logicResult.goldChange) {
            newStats.gold = Math.max(0, (newStats.gold || 0) + logicResult.goldChange);
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
            // [Fix] Defensive check for AI hallucination (returning object instead of array)
            const changes = Array.isArray(logicResult.relationshipChange)
                ? logicResult.relationshipChange
                : [logicResult.relationshipChange];

            changes.forEach((rel: any) => {
                if (!rel || !rel.characterId) return;
                // [Fix] Normalize ID
                const normalizedId = normalizeCharacterId(rel.characterId);
                newStats.relationships[normalizedId] = (newStats.relationships[normalizedId] || 0) + (rel.change || 0);
            });
        }

        console.log('New Stats after update:', newStats);

        // [New] Injuries Update
        if (logicResult.injuriesUpdate) {
            let currentInjuries = [...(newStats.active_injuries || [])];
            let changed = false;

            // Add
            if (logicResult.injuriesUpdate.add) {
                const addList = Array.isArray(logicResult.injuriesUpdate.add)
                    ? logicResult.injuriesUpdate.add
                    : [logicResult.injuriesUpdate.add];

                addList.forEach((injury: string) => {
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

                const removeList = Array.isArray(logicResult.injuriesUpdate.remove)
                    ? logicResult.injuriesUpdate.remove
                    : [logicResult.injuriesUpdate.remove];

                removeList.forEach((targetInj: string) => {
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
                // [Sanitization] Auto-clean invalid injuries (Psychological, duplicates)
                const INVALID_KEYWORDS = ['심리적', '정신적', '공포', '두려움', '위축', '긴장', '불안', '경직', '뻐근함'];
                currentInjuries = currentInjuries.filter(inj => {
                    // 1. Check Blacklist
                    if (INVALID_KEYWORDS.some(kw => inj.includes(kw))) return false;
                    // 2. Check Empty/Short
                    if (!inj || inj.trim().length < 2) return false;
                    return true;
                });
                // Deduplicate
                currentInjuries = Array.from(new Set(currentInjuries));

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
            // [Suppressed] Generic Level Growth Toast
            // queueToast(`성장 (Growth): +${delta.toFixed(2)} Level`, 'success');

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
                console.log(`[VisualNovelUI] Marking Event as Triggered: ${logicResult.triggerEventId}`);
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
        if (Object.keys(logicResult).some(k => k === 'hpChange' || k === 'mpChange' || k === 'goldChange' || k === 'statChange' || k === 'personalityChange' || k === 'relationshipChange') || hasInjuryChanges) {
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
                    // [Suppressed] Personality Toast
                    // queueToast(`${label} ${value > 0 ? '+' : ''}${value}`, value > 0 ? 'success' : 'warning');
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

                // [Suppressed] Rank Up Toast
                // queueToast(`Rank Up: ${logicResult.playerRank}`, 'success');
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

        // [Fix] Update Active Characters FIRST to ensure they exist in store
        if (logicResult.activeCharacters) {
            useGameStore.getState().setActiveCharacters(logicResult.activeCharacters);
        }

        // Character Updates (Bio & Memories)
        if (logicResult.characterUpdates && logicResult.characterUpdates.length > 0) {
            logicResult.characterUpdates.forEach((char: any) => {
                // [Fix] Normalize ID
                const normalizedId = normalizeCharacterId(char.id, useGameStore.getState().language || 'ko');

                // [Fix] Fetch existing data to safely merge
                const existingData = useGameStore.getState().characterData[normalizedId] || {
                    id: normalizedId,
                    name: char.name || normalizedId,
                    relationship: 0,
                    memories: []
                };

                const updateData = { ...char, id: normalizedId };

                // [Critical Fix] Merge Memories instead of Replacing
                // The Logic Model returns NEW memories or relevant ones. We must not wipe old ones.
                if (updateData.memories && Array.isArray(updateData.memories)) {
                    const oldMemories = existingData.memories || [];
                    const newMemories = updateData.memories;

                    // Deduplicate and Append
                    const mergedMemories = [...oldMemories];
                    newMemories.forEach((m: string) => {
                        if (!mergedMemories.includes(m)) {
                            mergedMemories.push(m);
                        }
                    });

                    updateData.memories = mergedMemories;
                    addToast(`Memories Updated: ${normalizedId} (+${newMemories.length})`, 'info');
                } else {
                    // If no memories provided in update, DO NOT touch existing memories
                    delete updateData.memories;
                }

                // [Safe Update] Use updateCharacterData (which now works because we initialized above, or we can use dedicated setter if needed)
                // Since updateCharacterData might fail if ID missing (though setActiveCharacters handles it), 
                // we can rely on it now.
                useGameStore.getState().updateCharacterData(normalizedId, updateData);

                if (!char.memories) addToast(`Character Updated: ${normalizedId}`, 'info');
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
                            // If match score > 0.5, we accept it as the target.

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
                            // [Suppressed] Personality Toast
                            // queueToast(`${label} ${(val as number) > 0 ? '+' : ''}${val}`, 'info');
                        }
                    } else if (['hp', 'mp', 'gold', 'fame', 'neigong'].includes(key)) {
                        // [Fix] Handle Core Stats in stat_updates
                        const currentVal = (currentStats as any)[key] || 0;
                        const newVal = Math.max(0, currentVal + (val as number));

                        // Apply update immediately
                        const updatePayload: any = {};
                        updatePayload[key] = newVal;

                        // Ensure we use the latest state structure
                        const freshStats = useGameStore.getState().playerStats;
                        useGameStore.getState().setPlayerStats({ ...freshStats, ...updatePayload });
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
                        // [Suppressed] Realm Ascension Toast
                        // queueToast(t.systemMessages?.realmAscension?.replace('{0}', ma.realm_update) || `경지 등극: ${ma.realm_update}`, 'success');
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
                        // [Suppressed] Realm Progress Toast
                        // queueToast(t.systemMessages?.realmProgress?.replace('{0}', ma.realm_progress_delta) || `깨달음: 경험치 +${ma.realm_progress_delta}`, 'info');
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
                    // [Suppressed] Neigong Gain Toast (often frequent)
                    // queueToast(t.systemMessages?.neigongGain?.replace('{0}', `${sign}${delta}`) || `내공 ${sign}${delta}년`, 'success');
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
                                backgroundImage: `url(${resolveBackground(currentBackground)})`,
                                filter: 'brightness(0.6)'
                            }}
                        />

                        {/* Event CG Layer (Full Screen Override) */}
                        {/* Renders ABOVE background, BELOW characters/UI (but characters are hidden by logic below) */}
                        <EventCGLayer />

                        {/* Character Layer */}
                        <AnimatePresence>
                            {!currentCG && characterExpression && characterExpression.startsWith('/') && (
                                <motion.div
                                    key={characterExpression}
                                    initial={isSameCharacter ? { opacity: 0, scale: 1, y: 0, x: "-50%" } : { opacity: 0, scale: 0.95, y: 20, x: "-50%" }}
                                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                                    exit={{ opacity: 0, scale: 1, y: 0, x: "-50%" }}
                                    transition={{ duration: 0.5 }}
                                    className="absolute bottom-0 left-1/2 h-[90%] z-0 pointer-events-none"
                                >
                                    <img
                                        src={characterExpression}
                                        alt="Character"
                                        className="h-full w-auto max-w-none object-contain drop-shadow-2xl"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            console.warn(`Failed to load character image: ${characterExpression}`);
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
                {/* [Legacy HUD Removed] Replaced by Modular HUD Layer via GameRegistry */}
                {/* [Common UI] Top-Right Controls (Tokens, Settings, Debug) */}
                <div className="absolute top-4 right-4 z-[60] flex items-center gap-3 pointer-events-auto">
                    {/* Token Display */}
                    {/* Token Display */}
                    <div
                        onClick={(e) => { e.stopPropagation(); setIsStoreOpen(true); }}
                        className="bg-black/60 hover:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-500/30 flex items-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95 group"
                    >
                        <span className="text-lg group-hover:scale-110 transition-transform">🪙</span>
                        <span className="text-yellow-400 font-bold font-mono text-sm md:text-base">
                            {userCoins?.toLocaleString() || 0}
                        </span>
                        <button
                            className="bg-yellow-600 group-hover:bg-yellow-500 text-black text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded ml-1 transition-colors"
                        >
                            +
                        </button>
                    </div>

                    {/* Shop Button */}


                    {/* Home Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            playSfx('ui_click');
                            if (confirm('타이틀 화면으로 돌아가시겠습니까? 저장되지 않은 진행 상황은 손실될 수 있습니다.')) {
                                router.push('/');
                            }
                        }}
                        className="p-2 bg-black/60 hover:bg-gray-800/80 rounded-full border border-gray-600 text-gray-300 hover:text-white transition-all shadow-lg"
                        title="홈으로"
                    >
                        <Home className="w-5 h-5 md:w-6 md:h-6" />
                    </button>

                    {/* Settings Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowResetConfirm(true); }}
                        className="p-2 bg-black/60 hover:bg-gray-800/80 rounded-full border border-gray-600 text-gray-300 hover:text-white transition-all shadow-lg"
                        title={(t as any).settings || "Settings"}
                    >
                        <Settings className="w-5 h-5 md:w-6 md:h-6" />
                    </button>


                    {/* Debug Button (Conditional) */}


                </div>

                {/* [New] Debug Button (Bottom Left) */}
                {/* [New] Debug Button (Middle Left) */}
                {(isLocalhost || isDebugOpen) && (
                    <div className="absolute top-1/2 left-4 -translate-y-1/2 z-[100] pointer-events-auto">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsDebugOpen(true); }}
                            className="p-2 bg-purple-900/60 hover:bg-purple-800/80 rounded-full border border-purple-500/50 text-purple-300 hover:text-white transition-all shadow-lg backdrop-blur-sm"
                            title="Debug Menu"
                        >
                            <Bolt className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                )}

                {/* [New] Fullscreen Button (Bottom Left) */}
                <div className="absolute bottom-4 left-4 z-[90] pointer-events-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                        className={`p-2 rounded-lg border transition-all shadow-lg backdrop-blur-sm ${isFullscreen ? 'bg-yellow-900/40 border-yellow-500/50 text-yellow-500' : 'bg-black/60 border-white/20 text-gray-400 hover:text-white hover:border-white/50'}`}
                        title={isFullscreen ? "전체화면 종료" : "전체화면"}
                    >
                        {isFullscreen ? <Minimize className="w-5 h-5 md:w-6 md:h-6" /> : <Maximize className="w-5 h-5 md:w-6 md:h-6" />}
                    </button>
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
                    {/* [NEW] Intervention / Mid-Turn Direct Input */}
                    <button
                        className="px-3 py-2 md:px-3 md:py-1.5 bg-green-800/60 hover:bg-green-700/80 rounded border border-green-600 text-green-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-1"
                        onClick={(e) => { e.stopPropagation(); setIsInputOpen(true); }}
                        title="이야기에 개입하기"
                    >
                        <span className="text-lg md:text-lg">⚡</span>
                        <span className="hidden md:inline">개입</span>
                    </button>

                    <button
                        className="px-3 py-2 md:px-3 md:py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-1"
                        onClick={(e) => { e.stopPropagation(); setShowHistory(true); }}
                        title={t.chatHistory}
                    >
                        <History className="w-5 h-5 md:w-[14px] md:h-[14px]" />
                        <span className="hidden md:inline">{t.chatHistory}</span>
                    </button>
                    <button
                        className="px-3 py-2 md:px-3 md:py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-1"
                        onClick={(e) => { e.stopPropagation(); setShowSaveLoad(true); }}
                        title={t.save}
                    >
                        <Save className="w-5 h-5 md:w-[14px] md:h-[14px]" />
                        <span className="hidden md:inline">{t.save}</span>
                    </button>
                    <button
                        className="px-3 py-2 md:px-3 md:py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-1"
                        onClick={(e) => { e.stopPropagation(); setShowWiki(true); }}
                        title={(t as any).wiki || "Wiki"}
                    >
                        <Book className="w-5 h-5 md:w-[14px] md:h-[14px]" />
                        <span className="hidden md:inline">{(t as any).wiki || "Wiki"}</span>
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

                {/* [Refactor] Dynamic HUD Injection via UI Registry */}
                {(() => {
                    const HUD = GameUIRegistry.getHUD(activeGameId);
                    if (HUD) {
                        return (
                            <div className="absolute inset-0 z-[40] pointer-events-none">
                                <HUD
                                    playerName={playerName}
                                    playerStats={playerStats}
                                    onOpenPhone={() => setIsPhoneOpen(true)}
                                    onOpenProfile={() => setShowCharacterInfo(true)}
                                    day={day}
                                    time={time}
                                    location={currentLocation}
                                />
                            </div>
                        );
                    }
                    return null;
                })()}

                {/* Center: Choices */}
                {
                    choices.length > 0 && endingType === 'none' && (
                        <>
                            {/* [NEW] Background Dimmer (Layered BELOW UI at z-20) */}
                            <div className="absolute inset-0 bg-black/40 z-[20] pointer-events-none transition-opacity duration-500" />

                            {/* Center: Choices (Layered ABOVE UI at z-60) */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60] p-4">
                                <div className="flex flex-col gap-3 md:gap-4 w-[85vw] md:w-[min(50vw,800px)] items-center pointer-events-auto">
                                    {/* [NEW] Turn Summary Display */}
                                    {/* [Modified] Active Goals Display (Top Priority) */}
                                    {(() => {
                                        const activeGoals = (goals || [])
                                            .filter(g => g.status === 'ACTIVE')
                                            .sort((a, b) => b.createdTurn - a.createdTurn) // Newest first
                                            .slice(0, 3);

                                        if (activeGoals.length === 0) return null;

                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="bg-black/80 border border-yellow-500/50 rounded-2xl p-5 mb-4 backdrop-blur-md shadow-[0_0_15px_rgba(234,179,8,0.2)] 
                                                w-[85vw] md:w-[min(50vw,1200px)]
                                                flex flex-col gap-3"
                                            >
                                                <h4 className="text-yellow-500 text-sm md:text-base font-bold uppercase tracking-widest flex items-center gap-2 border-b border-yellow-500/30 pb-2">
                                                    <span>🎯</span> 현재 목표 (Current Objectives)
                                                </h4>
                                                <div className="space-y-2">
                                                    {activeGoals.map(goal => (
                                                        <div key={goal.id} className="flex items-start gap-3 text-gray-100 text-base md:text-lg font-medium leading-snug">
                                                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_5px_#fbbf24] shrink-0" />
                                                            <span>{goal.description}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        );
                                    })()}

                                    {/* [NEW] Turn Summary Display - Displayed below Goals if present */}
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
                                            py-4 px-[5vw] md:py-5 md:px-[min(2vw,48px)] h-auto min-h-[60px]
                                            text-[max(18px,3.5vw)] md:text-[clamp(20px,1.1vw,32px)] leading-relaxed
                                            shadow-[0_0_15px_rgba(71,85,105,0.5)] transition-all duration-300
                                            ${(isProcessing || isLogicPending) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-white/90 hover:text-slate-900 hover:border-white'}
                                        `}
                                            onClick={(e) => {
                                                if (isProcessing || isLogicPending) return;
                                                playSfx('ui_confirm');
                                                console.log("Choice clicked:", choice.content);
                                                e.stopPropagation();

                                                // [LOGGING] Handled in handleSend


                                                // [Adaptive Agent] Track Selected Choice
                                                addChoiceToHistory({ text: choice.content, type: 'input', timestamp: Date.now() });

                                                handleSend(choice.content);
                                            }}
                                            onMouseEnter={() => playSfx('ui_hover')}
                                        >
                                            <div className="flex w-full justify-between items-center transform skew-x-12 px-1">
                                                <span className="text-left whitespace-pre-wrap break-keep mr-4 leading-normal">{choice.content}</span>
                                                <span className="shrink-0 bg-slate-200/60 text-slate-700 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full border border-slate-300/50">
                                                    {costPerTurn}🪙
                                                </span>
                                            </div>
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
                                        py-4 px-[5vw] md:py-5 md:px-[min(2vw,48px)] h-auto min-h-[60px]
                                        text-[max(18px,3.5vw)] md:text-[clamp(20px,1.1vw,32px)] leading-relaxed 
                                        shadow-[0_0_15px_rgba(71,85,105,0.5)] transition-all duration-300
                                        ${(isProcessing || isLogicPending) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-white/80 hover:border-white'}
                                    `}
                                        onMouseEnter={() => playSfx('ui_hover')}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isProcessing || isLogicPending) return;
                                            playSfx('ui_confirm');
                                            setIsInputOpen(true);
                                        }}
                                    >
                                        <div className="flex w-full justify-between items-center transform skew-x-12 px-1">
                                            <span>{t.directInput}</span>
                                            <span className="shrink-0 bg-slate-200/60 text-slate-700 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full border border-slate-300/50">
                                                {costPerTurn}🪙
                                            </span>
                                        </div>
                                    </motion.button>


                                </div>
                            </div>
                        </>
                    )
                }

                {/* Fallback for stuck state or Start Screen */}
                {
                    isMounted && !currentSegment && choices.length === 0 && scriptQueue.length === 0 && !isProcessing && endingType === 'none' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]">
                            {/* [Fix] Use turnCount === 0 to prioritize Creation Wizard even if logs exist */}
                            <AnimatePresence mode="popLayout">
                                {turnCount === 0 ? (
                                    // Creation or Start Screen
                                    <motion.div
                                        key="creation-wizard"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, transition: { duration: 1.5 } }}
                                        className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto"
                                    >
                                        {(() => {
                                            const creationQuestions = useGameStore.getState().characterCreationQuestions;
                                            const { playerName, activeGameId } = useGameStore.getState();

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
                                                        // const activeGameId = useGameStore.getState().activeGameId; // [Moved Up]
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
                                                        // [Protagonist Image Selection]
                                                        const gender = useGameStore.getState().playerStats.gender || 'male';
                                                        const finalImage = selectProtagonistImage(finalName, gender, updatedData);
                                                        if (finalImage) {
                                                            console.log(`[CharacterCreation] Setting Protagonist Image: ${finalImage}`);
                                                            useGameStore.getState().setHiddenOverrides({ protagonistImage: finalImage });
                                                        }

                                                        const newStats = {
                                                            ...useGameStore.getState().playerStats,
                                                            skills: [] as Skill[],   // [Fixed] Unified Skills Type
                                                            neigong: 0,        // Reset Neigong
                                                            gold: 0,           // Reset Gold
                                                        };

                                                        // [NEW] Cost Deduction Logic
                                                        let totalFateCost = 0;
                                                        creationQuestions.forEach(q => {
                                                            const selectedVal = updatedData[q.id];
                                                            if (selectedVal) {
                                                                const opt = q.options.find((o: any) => o.value === selectedVal);
                                                                if (opt && opt.cost && opt.costType === 'fate') {
                                                                    totalFateCost += opt.cost;
                                                                }
                                                            }
                                                        });

                                                        if (totalFateCost > 0) {
                                                            newStats.fate = (newStats.fate || 0) - totalFateCost;
                                                            console.log(`[Creation] Deducted ${totalFateCost} Fate Points. Remaining: ${newStats.fate}`);
                                                            addToast(`${totalFateCost} 운명 포인트가 소모되었습니다. (잔여: ${newStats.fate})`, 'info');
                                                        }

                                                        // [보너스 적용] 욕망 (4번째 질문)
                                                        // [보너스 적용] 핵심 설정 (4번째 질문)
                                                        const coreSetting = updatedData['core_setting'];
                                                        if (coreSetting) {
                                                            newStats.core_setting = coreSetting;
                                                        }

                                                        if (coreSetting === 'possessed_noble') {
                                                            newStats.int = (newStats.int || 10) + 20;

                                                            if (!newStats.personality) {
                                                                newStats.personality = {
                                                                    morality: 0, courage: 0, energy: 0, decision: 0, lifestyle: 0,
                                                                    openness: 0, warmth: 0, eloquence: 0, leadership: 0,
                                                                    humor: 0, lust: 0
                                                                };
                                                            }
                                                            newStats.personality.eloquence = (newStats.personality.eloquence || 0) + 20;

                                                            newStats.gold = (newStats.gold || 0) + 1000;
                                                            addToast("특전: 지략가 보너스 적용 (지력/화술 +20, 금화 +1000)", "success");
                                                        }
                                                        else if (coreSetting === 'rejuvenated_master') {
                                                            newStats.neigong = (newStats.neigong || 0) + 60;
                                                            ['str', 'agi', 'int', 'vit', 'luk'].forEach(s => {
                                                                // @ts-ignore
                                                                newStats[s] = (newStats[s] || 10) + 10;
                                                            });
                                                            addToast("특전: 환골탈태 보너스 적용 (내공 60년, 전 스탯 +10)", "success");
                                                        }
                                                        else if (coreSetting === 'returnee_demon') {
                                                            newStats.level = 100; // Returnee retains enlightenment
                                                            // Neigong is 0 (reset body)

                                                            if (!newStats.personality) {
                                                                newStats.personality = {
                                                                    morality: 0, courage: 0, energy: 0, decision: 0, lifestyle: 0,
                                                                    openness: 0, warmth: 0, eloquence: 0, leadership: 0,
                                                                    humor: 0, lust: 0
                                                                };
                                                            }
                                                            newStats.personality.morality = -50; // Evil alignment

                                                            const demonArt = {
                                                                id: 'heavenly_demon_art',
                                                                name: '천마신공(天魔神功)',
                                                                rank: '절대지경',
                                                                type: '신공',
                                                                description: '천마의 절대무공. 파괴적인 위력을 자랑한다.',
                                                                proficiency: 10, // Reincarnated but needs practice? Or maybe 100? Let's say 10 (reset).
                                                                effects: ['절대적인 파괴력', '마기 운용'],
                                                                createdTurn: 0
                                                            };
                                                            newStats.skills = [...(newStats.skills || []), demonArt];
                                                            addToast("특전: 천마 재림 적용 (천마신공, 레벨 100)", "success");
                                                        }
                                                        else if (coreSetting === 'dimensional_merchant') {
                                                            newStats.gold = (newStats.gold || 0) + 500000;
                                                            addToast("특전: 거상 보너스 적용 (초기 자금 50만냥)", "success");
                                                        }

                                                        // [GBY: God Bless You Start Bonuses]
                                                        if (activeGameId === 'god_bless_you') {
                                                            if (coreSetting === 'incompetent') {
                                                                // Hard Mode
                                                                addToast("특성: 무능력자 (특별한 보너스 없음, 하드코어 시작)", "info");
                                                            }
                                                            else if (coreSetting === 'superhuman') {
                                                                ['str', 'agi', 'vit'].forEach(s => {
                                                                    // @ts-ignore
                                                                    newStats[s] = (newStats[s] || 10) + 10;
                                                                });
                                                                newStats.level = 5;
                                                                addToast("특전: 초인 (신체 능력 +10, 레벨 5)", "success");
                                                            }
                                                            else if (coreSetting === 'd_rank_hunter') {
                                                                ['str', 'agi', 'vit', 'int', 'luk'].forEach(s => {
                                                                    // @ts-ignore
                                                                    newStats[s] = (newStats[s] || 10) + 5;
                                                                });
                                                                newStats.gold = (newStats.gold || 0) + 500000; // 50만원
                                                                // @ts-ignore
                                                                if (!(newStats as any).inventory) (newStats as any).inventory = [];
                                                                // @ts-ignore
                                                                (newStats as any).inventory.push({ id: 'hunter_license_d', name: 'D급 헌터 자격증', quantity: 1, type: 'item' });
                                                                addToast("특전: D급 헌터 (전 스탯 +5, 자격증, 50만원)", "success");
                                                            }
                                                            else if (coreSetting === 'academy_student') {
                                                                newStats.int = (newStats.int || 10) + 15;
                                                                // @ts-ignore
                                                                (newStats as any).potential = ((newStats as any).potential || 10) + 10;
                                                                // @ts-ignore
                                                                if (!(newStats as any).inventory) (newStats as any).inventory = [];
                                                                // @ts-ignore
                                                                (newStats as any).inventory.push({ id: 'blesser_academy_uniform', name: '아카데미 교복', quantity: 1, type: 'item' });
                                                                addToast("특전: 아카데미 생도 (지능+15, 잠재력+10, 교복)", "success");
                                                            }
                                                            else if (coreSetting === 's_rank_candidate') {
                                                                newStats.mp = (newStats.mp || 100) + 500;
                                                                // @ts-ignore
                                                                (newStats as any).potential = ((newStats as any).potential || 10) + 30; // S-Rank Potential
                                                                newStats.level = 20;
                                                                addToast("특전: S급 유망주 (마력 +500, 잠재력 +30, 레벨 20)", "success");
                                                            }
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

                                                const bgGradient = activeGameId === 'god_bless_you'
                                                    ? 'bg-gradient-to-br from-slate-900 via-[#0f172a] to-black'
                                                    : 'bg-gradient-to-br from-[#1c1917] via-[#292524] to-black';

                                                const accentColor = activeGameId === 'god_bless_you' ? 'text-cyan-400' : 'text-[#D4AF37]';

                                                return (
                                                    <>
                                                        {/* [New] Creation Phase Background */}
                                                        <div className={`fixed inset-0 -z-10 ${bgGradient} flex items-center justify-center`}>
                                                            <div className="absolute inset-0 bg-black/40" />
                                                            {/* [NEW] Starfield Warp Effect */}
                                                            <div className="absolute inset-0 overflow-hidden pointer-events-none perspective-[1000px]">
                                                                {/* Center Glow */}
                                                                <motion.div
                                                                    initial={{ opacity: 0, scale: 0.8 }} // [Fix] Prevent initial pop
                                                                    animate={{
                                                                        scale: isLogicPending ? [1, 1.3, 1] : [0.9, 1, 0.9], // Both use arrays
                                                                        opacity: isLogicPending ? [0.5, 0.8, 0.5] : [0.2, 0.3, 0.2] // Both use arrays
                                                                    }}
                                                                    transition={{
                                                                        duration: isLogicPending ? 2 : 5, // Slower normal breath
                                                                        repeat: Infinity,
                                                                        ease: "easeInOut"
                                                                    }}
                                                                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20vw] h-[20vw] rounded-full blur-[100px] ${activeGameId === 'god_bless_you' ? 'bg-cyan-500' : 'bg-amber-500'}`}
                                                                />

                                                                {/* Stars */}
                                                                {stars.map((star) => (
                                                                    <motion.div
                                                                        key={star.id}
                                                                        className={`absolute rounded-full top-1/2 left-1/2 ${starColors[star.id % starColors.length]}`}
                                                                        style={{
                                                                            width: star.size,
                                                                            height: isLogicPending ? star.size * 20 : star.size, // Stretch in warp
                                                                            originX: 0.5,
                                                                            originY: 0.5,
                                                                            boxShadow: isLogicPending ? `0 0 ${star.size * 2}px ${activeGameId === 'god_bless_you' ? '#06b6d4' : '#f59e0b'}` : 'none'
                                                                        }}
                                                                        initial={{
                                                                            x: 0,
                                                                            y: 0,
                                                                            opacity: 0,
                                                                            scale: 0,
                                                                            rotate: star.angle + 90 // Face outward
                                                                        }}
                                                                        animate={isLogicPending ? {
                                                                            // Warp Mode: Fast, Stretched, Far
                                                                            x: [0, Math.cos(star.angle * Math.PI / 180) * 1200], // Increased distance
                                                                            y: [0, Math.sin(star.angle * Math.PI / 180) * 1200],
                                                                            opacity: [0, 1, 1, 0], // Stay visible longer
                                                                            scale: [0.5, 3, 3, 0.5], // Stretch effect handled by height style
                                                                        } : {
                                                                            // Normal Mode: Gentle Float
                                                                            x: [0, Math.cos(star.angle * Math.PI / 180) * 400],
                                                                            y: [0, Math.sin(star.angle * Math.PI / 180) * 400],
                                                                            opacity: [0, 1, 1, 0], // Longer visibility
                                                                            scale: [0, 1.5, 1.5, 0],
                                                                        }}
                                                                        transition={{
                                                                            duration: isLogicPending ? 0.5 : star.duration, // Slightly slower warp for better visibility
                                                                            repeat: Infinity,
                                                                            delay: isLogicPending ? Math.random() * 0.2 : star.delay,
                                                                            ease: isLogicPending ? "linear" : "easeOut"
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="bg-[#1e1e1e]/95 p-8 rounded-xl border border-[#333] text-center shadow-2xl backdrop-blur-md flex flex-col gap-6 items-center max-w-2xl w-full relative overflow-hidden pointer-events-auto">
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

                                                                    <div className="flex gap-4 w-full mt-4">
                                                                        <button
                                                                            onClick={() => {
                                                                                playSfx('ui_click');
                                                                                router.push('/');
                                                                            }}
                                                                            className="px-6 py-3.5 bg-[#444] hover:bg-[#555] rounded-lg font-bold text-[#aaa] hover:text-[#eee] text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all font-serif"
                                                                        >
                                                                            타이틀로
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const state = useGameStore.getState();
                                                                                const result = checkNameValidity(state.playerName, state.characterData);
                                                                                if (!result.valid) {
                                                                                    addToast(result.message || "Invalid Name", "error");
                                                                                    return;
                                                                                }
                                                                                playSfx('ui_confirm');
                                                                                setCreationStep(prev => prev + 1);
                                                                            }}
                                                                            className="flex-1 px-8 py-3.5 bg-[#D4AF37] hover:bg-[#b5952f] rounded-lg font-bold text-[#1e1e1e] text-lg shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-serif"
                                                                        >
                                                                            <span>운명 시작하기</span>
                                                                            <span className="text-base">→</span>
                                                                        </button>
                                                                    </div>
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

                                                                            const isAffordable = !opt.cost || (opt.costType === 'fate' ? (playerStats.fate || 0) >= opt.cost : true);

                                                                            return (
                                                                                <button
                                                                                    key={opt.value}
                                                                                    disabled={!isAffordable}
                                                                                    onClick={() => {
                                                                                        if (!isAffordable) return;
                                                                                        playSfx('ui_click');
                                                                                        currentQuestion && handleOptionSelect(currentQuestion.id, opt.value);
                                                                                    }}
                                                                                    className={`group relative px-6 py-4 border rounded-lg text-left transition-all shadow-md overflow-hidden flex justify-between items-center
                                                                                        ${isAffordable
                                                                                            ? 'bg-[#252525] hover:bg-[#2a2a2a] border-[#333] hover:border-[#D4AF37]/50 active:scale-[0.99] cursor-pointer'
                                                                                            : 'bg-[#1a1a1a] border-[#333] opacity-60 cursor-not-allowed grayscale'
                                                                                        }
                                                                                    `}
                                                                                >
                                                                                    <div className="flex items-center">
                                                                                        <div className={`absolute inset-y-0 left-0 w-1 transition-colors ${isAffordable ? 'bg-[#333] group-hover:bg-[#D4AF37]' : 'bg-red-900'}`} />
                                                                                        <span className={`font-bold mr-3 font-serif transition-colors ${isAffordable ? 'text-[#666] group-hover:text-[#D4AF37]' : 'text-stone-600'}`}>◈</span>
                                                                                        <span className={`font-medium transition-colors ${isAffordable ? 'text-gray-300 group-hover:text-[#eee]' : 'text-gray-500'}`}>
                                                                                            {opt.label}
                                                                                        </span>
                                                                                    </div>

                                                                                    {opt.cost && (
                                                                                        <div className={`text-xs font-bold px-2 py-1 rounded border ${isAffordable
                                                                                            ? 'bg-purple-900/40 text-purple-300 border-purple-700/50'
                                                                                            : 'bg-red-900/20 text-red-500 border-red-800/30'
                                                                                            }`}>
                                                                                            🔮 {opt.cost} Fate
                                                                                        </div>
                                                                                    )}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </>
                                                            )}

                                                            {creationStep > 0 && (
                                                                <button
                                                                    onClick={() => {
                                                                        playSfx('ui_click');
                                                                        setCreationStep(prev => prev - 1);
                                                                    }}
                                                                    className="mt-2 text-[#666] hover:text-[#D4AF37] text-sm transition-colors flex items-center gap-1 font-serif"
                                                                >
                                                                    <span>←</span> 이전 단계로
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                );
                                            }

                                            // Fallback to Standard Start Screen
                                            // Fallback to Standard Start Screen
                                            const { setGameId } = useGameStore.getState();

                                            // [Fix] Wuxia Data Integrity Guard
                                            if (activeGameId === 'wuxia' && (!creationQuestions || creationQuestions.length === 0)) {
                                                return (
                                                    <div className="bg-black/90 p-12 rounded-xl border-2 border-red-500 text-center shadow-2xl backdrop-blur-md flex flex-col gap-6 items-center animate-pulse pointer-events-auto">
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
                                                <div className="bg-black/80 p-12 rounded-xl border-2 border-yellow-500 text-center shadow-2xl backdrop-blur-md flex flex-col gap-6 items-center pointer-events-auto">
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
                                                                            playSfx('ui_click');
                                                                            // Use hook setter if available or direct update via store action if defined.
                                                                            // Since we didn't add a specialized setter, we use setPlayerStats from hook.
                                                                            setPlayerStats({ ...playerStats, gender: g as 'male' | 'female' });
                                                                        }}
                                                                        className={`flex-1 py-1 px-3 rounded text-sm font-bold transition-all ${isSelected
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
                                        })()}
                                    </motion.div>
                                ) : (
                                    <motion.div key="game-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="contents">
                                        {isLogicPending && endingType === 'none' ? (
                                            <div className="bg-black/80 p-6 rounded-xl border border-yellow-500 text-center shadow-2xl backdrop-blur-md animate-pulse pointer-events-auto z-10 transition-all duration-300 scale-110">
                                                <h2 className="text-2xl font-bold text-yellow-500 mb-2 tracking-widest uppercase">{t.fateIsWeaving}</h2>
                                                <p className="text-yellow-200/80 text-sm font-bold animate-pulse">
                                                    LINK START...
                                                </p>
                                            </div>
                                        ) : (
                                            // Error/Paused Screen
                                            // [Fix] Safe fallback to Start Screen check
                                            (choices.length > 0) ? (
                                                // [Fix] Choices are present, so don't show Error Screen
                                                // The choices overlay (line 3512) will handle the rendering.
                                                null
                                            ) : (!isDataLoaded || pendingEndingRef.current || isEpilogueRef.current) ? (
                                                // [Fix] Data not loaded OR Waiting for Deferred Ending OR Epilogue -> Show nothing
                                                null
                                            ) : (
                                                <div className="bg-black/90 p-8 rounded-xl border border-yellow-600/50 text-center shadow-[0_0_30px_rgba(202,138,4,0.2)] backdrop-blur-md relative overflow-hidden pointer-events-auto">
                                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />
                                                    <h2 className="text-2xl font-bold text-yellow-500 mb-4 font-serif tracking-wide flex items-center justify-center gap-2">
                                                        <span className="text-yellow-500/50 text-lg">❖</span>
                                                        {t.scenePaused}
                                                        <span className="text-yellow-500/50 text-lg">❖</span>
                                                    </h2>
                                                    <p className="text-gray-300 mb-6 font-medium">{t.noActiveDialogue}</p>
                                                    <div className="flex gap-4 justify-center">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                console.log("[VisualNovelUI] Lost Way Continue Clicked. Opening Input.");
                                                                setIsInputOpen(true);
                                                            }}
                                                            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded font-bold text-white shadow-lg hover:scale-105 transition-transform"
                                                        >
                                                            {t.continueInput}
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </motion.div>
                                )
                                }
                            </AnimatePresence>
                        </div>
                    )}



                {/* Interactive Loading Indicator (Ad/Tip Overlay) */}
                <AnimatePresence>
                    {(isProcessing || (isLogicPending && !currentSegment && scriptQueue.length === 0 && choices.length === 0 && endingType === 'none')) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#000]/90 flex items-center justify-center z-[70] pointer-events-auto backdrop-blur-sm"
                        >
                            <div className="flex flex-col items-center gap-6 max-w-xl w-full p-10 rounded-xl border border-[#333] bg-gradient-to-b from-[#2a2a2a] via-[#1a1a1a] to-[#0d0d0d] shadow-2xl relative overflow-hidden">
                                {/* Background Glow */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />

                                {isProcessing ? (
                                    <>
                                        {/* [Standard] Story Generation Mode - Full UI */}
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
                                            <div className="flex flex-col items-center gap-2 w-full px-4">
                                                <AdBanner
                                                    dataAdSlot="9593102689"
                                                    format="auto"
                                                    responsive={true}
                                                    className="w-full min-h-[100px] overflow-hidden rounded-lg shadow-lg bg-black/20"
                                                    style={{ display: 'block' }}
                                                />
                                                <p className="text-[10px] text-[#444] font-mono">ADVERTISEMENT</p>
                                            </div>
                                        </div>

                                        {/* System Menu Bar */}
                                        <div className="flex w-full justify-center gap-3 md:gap-4 mt-6 pointer-events-auto z-20">
                                            {(() => {
                                                const currentWikiTarget = (() => {
                                                    if (currentSegment?.character) {
                                                        const charName = currentSegment.character.split('(')[0].trim();
                                                        return findBestMatch(charName, wikiKeys);
                                                    }
                                                    return null;
                                                })();

                                                const systemMenuItems = [
                                                    { icon: <Home size={20} />, label: "홈으로", onClick: () => { playSfx('ui_click'); if (confirm('타이틀 화면으로 돌아가시겠습니까? 저장되지 않은 진행 상황은 손실될 수 있습니다.')) router.push('/'); } },
                                                    { icon: <User size={20} />, label: t.profile || "Profile", onClick: () => { playSfx('ui_click'); setShowCharacterInfo(true); } },
                                                    { icon: <ShoppingBag size={20} />, label: "상점", onClick: () => { playSfx('ui_click'); setIsStoreOpen(true); }, isActive: false },
                                                    { icon: <History size={20} />, label: t.chatHistory, onClick: () => { playSfx('ui_click'); setShowHistory(true); } },
                                                    {
                                                        icon: <Book size={20} />,
                                                        label: t.wiki,
                                                        onClick: () => {
                                                            playSfx('ui_click');
                                                            if (currentWikiTarget) setWikiTargetCharacter(currentWikiTarget);
                                                            setShowWiki(true);
                                                        },
                                                        isActive: !!currentWikiTarget,
                                                        activeColor: "bg-gradient-to-r from-yellow-600 to-yellow-500 border-yellow-400 text-black shadow-yellow-500/50 animate-pulse"
                                                    },
                                                    { icon: <Save size={20} />, label: t.saveLoad, onClick: () => { playSfx('ui_click'); setShowSaveLoad(true); } },
                                                    {
                                                        isCustom: true,
                                                        component: <LanguageSelector direction="up" className="shadow-lg" />
                                                    },
                                                    { icon: <Settings size={20} />, label: t.settings, onClick: () => { playSfx('ui_click'); setShowResetConfirm(true); } },
                                                ];

                                                return systemMenuItems.map((item, i) => {
                                                    if ((item as any).isCustom) return <div key={i}>{(item as any).component}</div>;

                                                    const btn = item as any;
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={(e) => { e.stopPropagation(); btn.onClick(); }}
                                                            onMouseEnter={() => playSfx('ui_hover')}
                                                            className={`p-3 md:p-3 rounded-full border transition-all backdrop-blur-md shadow-lg group relative
                                                        ${btn.isActive
                                                                    ? btn.activeColor
                                                                    : 'bg-black/60 border-white/20 text-white hover:bg-white/20 hover:border-white'
                                                                } hover:scale-110`}
                                                            title={btn.label}
                                                        >
                                                            {btn.icon}
                                                            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 border border-white/20 px-2 py-1 rounded pointer-events-none">
                                                                {btn.label}
                                                            </span>
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* [New] Choice Logic Processing Mode - Minimal UI */}
                                        <div className="flex flex-col items-center justify-center gap-6 z-10 animate-in fade-in zoom-in duration-500">
                                            {/* Minimal Spinner */}
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-yellow-500 animate-spin" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_10px_#fbbf24]" />
                                                </div>
                                            </div>

                                            {/* Text Only */}
                                            <div className="text-center space-y-2">
                                                <h3 className="text-xl md:text-2xl font-serif font-bold text-yellow-500/90 tracking-widest uppercase animate-pulse">
                                                    AI가 선택지를 생성중입니다...
                                                </h3>
                                                <p className="text-[10px] md:text-xs text-yellow-500/40 font-mono tracking-[0.3em]">
                                                    GENERATING CHOICES...
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* [Legacy] Modular HUD block removed in favor of GameUIRegistry injection above */}

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
                        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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
                                            {fateUsage > 0 && (
                                                <span className="text-xs bg-red-900/50 text-red-200 px-2 py-0.5 rounded-full border border-red-500/30 font-bold animate-pulse">
                                                    -{fateUsage * fateUsage} 차감
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-gray-400 text-xs block mt-1">불가능을 가능으로 바꿉니다. (소모값 선택)</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {[0, 1, 2, 3, 4, 5].map(val => {
                                            const cost = val * val;
                                            const canAfford = (playerStats.fate || 0) >= cost;
                                            return (
                                                <button
                                                    key={val}
                                                    onClick={() => {
                                                        playSfx('ui_click');
                                                        setFateUsage(val);
                                                    }}
                                                    onMouseEnter={() => playSfx('ui_hover')}
                                                    disabled={!canAfford && val !== 0}
                                                    className={`px-3 h-8 rounded-lg font-bold border transition-all text-xs ${fateUsage === val
                                                        ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)] scale-110'
                                                        : 'bg-gray-800 text-gray-400 border-gray-600 hover:border-yellow-500/50 hover:text-white'
                                                        } ${!canAfford && val !== 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                    title={val > 0 ? `레벨 ${val} (비용: ${cost} Fate)` : '사용 안 함'}
                                                >
                                                    {val === 0 ? '0' : `${val}`}
                                                </button>
                                            );
                                        })}                                            </div>
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
                                        onClick={() => {
                                            playSfx('ui_confirm');
                                            handleUserSubmit();
                                        }}
                                        className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 font-bold disabled:opacity-50 flex items-center gap-2"
                                        disabled={isProcessing || isLogicPending}
                                    >
                                        <span>{t.action}</span>
                                        <span className="bg-black/20 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1 md:ml-2 border border-white/20">
                                            {costPerTurn}🪙
                                        </span>
                                    </button>
                                </div>
                                {/* End of Input Form */}
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
                                        상점에서 토큰을 구매하시겠습니까?
                                    </p>

                                    <div className="w-full h-px bg-gray-700 my-2" />

                                    <div className="flex gap-3 w-full">
                                        <button
                                            onClick={() => {
                                                playSfx('ui_click');
                                                setShowRechargePopup(false);
                                            }}
                                            className="flex-1 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold transition-colors"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={() => {
                                                playSfx('ui_confirm');
                                                setShowRechargePopup(false);
                                                setIsStoreOpen(true);
                                            }}
                                            className="flex-1 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 rounded-lg font-bold text-black shadow-lg transition-all transform hover:scale-105"
                                        >
                                            상점 이동
                                        </button>
                                    </div>
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
                            language={(language as any) || 'ko'}
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
                    mode="save" // Default to save mode in-game (we can add tabs or logic later)
                    t={t}
                />

                {/* [New] Store Modal */}
                <StoreModal
                    isOpen={isStoreOpen}
                    onClose={() => setIsStoreOpen(false)}
                />

                {/* Settings / Reset Modal (Refactored) */}
                <SettingsModal
                    isOpen={showResetConfirm}
                    onClose={() => setShowResetConfirm(false)}
                    t={t}
                    session={session}
                    coins={userCoins} // [Fix] Pass coins for display
                    fatePoints={playerStats.fate} // [Fix] Pass Fate Points for display
                    onRefresh={refreshSession} // [Fix] Pass refresh handler
                    onResetGame={handleNewGame}
                />

                {/* Cloud Conflict Modal (Removed) */}

                {/* [New] Ending Modal (Z-100 to cover everything) */}
                <div className="relative z-[100]">
                    <EndingModal
                        type={endingType}
                        onRewind={handleRewind}
                        onTitle={handleTitle}
                        onEpilogue={handleEpilogue}
                        onContinue={handleContinue}
                    />
                </div>

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
                        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 pb-32 md:pb-12 flex justify-center items-end z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent min-h-[40vh] md:h-[min(30vh,600px)]">
                            <div className="w-full max-w-screen-2xl pointer-events-auto relative">
                                {/* Dialogue Control Bar */}

                                <div
                                    className="w-full relative flex flex-col items-center cursor-pointer"
                                    onClick={handleScreenClick}
                                >
                                    {/* Name Tag */}
                                    {currentSegment.type === 'dialogue' && (
                                        <div className="absolute -top-[3vh] md:-top-[6vh] w-full text-center px-2">

                                            <span className="text-[max(16px,4.5vw)] md:text-[clamp(20px,1.4vw,47px)] font-bold text-yellow-500 tracking-wide drop-shadow-md">
                                                {(() => {
                                                    if (!currentSegment) return '';
                                                    const { characterData, playerName } = useGameStore.getState();

                                                    // Handle Protagonist Name
                                                    if (currentSegment.character === '주인공') {
                                                        return playerName;
                                                    }

                                                    const charList = Array.isArray(characterData) ? characterData : Object.values(characterData);
                                                    const charName = currentSegment.character || '';
                                                    const found = charList.find((c: any) => c.englishName === charName || c.name === charName || c.id === charName);
                                                    if (found) return found.name;
                                                    return charName.split('_')[0];
                                                })()}
                                            </span>
                                        </div>
                                    )}

                                    {/* Text Content */}
                                    <div className="text-[max(16px,3.7vw)] md:text-[clamp(18px,1.3vw,39px)] leading-relaxed text-gray-100 min-h-[10vh] whitespace-pre-wrap text-center w-full drop-shadow-sm px-[4vw] md:px-0">
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
                {/* [Fix] Resetting Overlay */}
                {
                    isResetting && (
                        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center pointer-events-auto">
                            <Loader2 className="w-16 h-16 text-red-500 animate-spin mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-2">게임 초기화 중...</h2>
                            <p className="text-gray-400">데이터를 정리하고 있습니다. 잠시만 기다려주세요.</p>
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

            {/* [New] The End Screen Overlay */}
            {/* [New] The End Screen Overlay (Component) */}
            {
                showTheEnd && (
                    <TheEndScreen
                        onTitle={() => {
                            setShowTheEnd(false);
                            handleTitle();
                        }}
                        playerRank={playerStats.playerRank}
                    />
                )
            }

        </div >
    );
}


