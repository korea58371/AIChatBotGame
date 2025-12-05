'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store';
import { createClient } from '@/lib/supabase';
import { serverGenerateResponse, serverGenerateGameLogic, serverGenerateSummary } from '@/app/actions/game';
import { parseScript, ScriptSegment } from '@/lib/script-parser';
import { Send, Save, RotateCcw, History, SkipForward, Package, Settings, Bolt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import assets from '@/data/assets.json';

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

const getKoreanExpression = (expr: string) => {
    const map: { [key: string]: string } = {
        'normal': '기본',
        'neutral': '기본',
        'default': '기본',
        'happy': '기쁨',
        'joy': '기쁨',
        'smile': '기쁨',
        'angry': '분노',
        'rage': '분노',
        'sad': '슬픔',
        'sorrow': '슬픔',
        'crying': '슬픔',
        'surprised': '애정당황',
        'shocked': '애정당황',
        'shy': '애정당황',
        'blush': '애정당황',
        'love': '애정당황', // Most chars have 애정당황, not 애정
        'affection': '애정당황',
        'like': '애정당황'
    };
    return map[expr.toLowerCase()] || expr;
};

export default function VisualNovelUI() {
    const {
        chatHistory,
        addMessage,
        currentBackground,
        setBackground,
        characterExpression,
        setCharacterExpression,
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
        setUserCoins
    } = useGameStore();

    const supabase = createClient();

    // Auth State (Event-Based)
    const [session, setSession] = useState<any>(null);

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
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
        // Load Assets from static JSON
        console.log("Loaded Assets (Static):", assets);
        useGameStore.getState().setAvailableAssets(assets.backgrounds, assets.characters);
    }, []);

    // VN State
    const [isProcessing, setIsProcessing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showInventory, setShowInventory] = useState(false);
    const [showCharacterInfo, setShowCharacterInfo] = useState(false); // New State
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Input State
    const [isInputOpen, setIsInputOpen] = useState(false);
    const [userInput, setUserInput] = useState('');

    // Debug State
    const [isDebugOpen, setIsDebugOpen] = useState(false);
    const [debugInput, setDebugInput] = useState('');
    const [lastLogicResult, setLastLogicResult] = useState<any>(null);
    const [pendingLogic, setPendingLogic] = useState<any>(null);

    // Toast State
    const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'warning' }[]>([]);

    const addToast = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

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
        if (!bg) return '/assets/backgrounds/home.jpg';
        return bg.startsWith('http') ? bg : `/assets/backgrounds/${encodeURIComponent(bg)}.jpg`;
    };

    const getCharUrl = (char: string) => {
        if (!char) return '';
        return char.startsWith('http') ? char : `/assets/characters/${encodeURIComponent(char)}.png`;
    };

    const advanceScript = () => {
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

        // Process background segments iteratively to avoid recursion
        while (nextSegment && nextSegment.type === 'background') {
            setBackground(nextSegment.content);
            currentQueue.shift(); // Remove processed background
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
            // Combine character name and expression for filename (e.g., "Mina_happy")
            if (nextSegment.character && nextSegment.expression) {
                const expr = getKoreanExpression(nextSegment.expression);
                // Force '주인공' for player character
                const charName = nextSegment.character === playerName ? '주인공' : nextSegment.character;
                setCharacterExpression(`${charName}_${expr}`);
            }
        }
    }

    const handleSend = async (text: string) => {
        if (!text.trim()) return;

        setIsProcessing(true);
        console.log(`handleSend: "${text}", coins: ${userCoins}, session: ${!!session}`);

        try {
            let activeSession = session;
            let currentCoins = userCoins;

            // 1. Ensure Session & Coins
            if (!activeSession?.user) {
                console.log("handleSend: Session missing, attempting recovery...");
                const { data } = await supabase.auth.getSession();
                if (data.session) {
                    activeSession = data.session;
                    setSession(data.session);
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('coins')
                        .eq('id', data.session.user.id)
                        .single();
                    if (profile) {
                        currentCoins = profile.coins;
                        setUserCoins(profile.coins);
                        console.log(`handleSend: Recovered coins: ${currentCoins}`);
                    }
                } else {
                    console.warn("handleSend: No session found after fallback");
                    addToast("Authentication failed. Please refresh.", "warning");
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

            // 3. Deduct Coin
            if (activeSession?.user) {
                const { error } = await supabase.rpc('decrement_coin', { user_id: activeSession.user.id });
                if (error) {
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({ coins: currentCoins - 1 })
                        .eq('id', activeSession.user.id);

                    if (updateError) {
                        console.error("Coin update failed:", updateError);
                        addToast("Transaction failed.", "warning");
                        setIsProcessing(false);
                        return;
                    }
                }
                setUserCoins(currentCoins - 1);
            }

            addMessage({ role: 'user', text });
            setChoices([]);

            const currentState = useGameStore.getState();
            let currentHistory = currentState.chatHistory;

            if (currentHistory.length >= 15) {
                console.log("Triggering Memory Summarization (Buffer Full)...");
                addToast("Summarizing old memories...", "info");

                // Summarize everything EXCEPT the last 10 messages
                const messagesToSummarize = currentHistory.slice(0, -10);

                const newSummary = await serverGenerateSummary(
                    currentState.scenarioSummary,
                    messagesToSummarize
                );

                useGameStore.getState().setScenarioSummary(newSummary);
                useGameStore.getState().truncateHistory(10); // Keep exactly last 10 messages

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
                availableCharacterImages: currentState.availableCharacterImages
            }));

            // Race Condition for Timeout
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timed Out")), 20000));
            const responsePromise = serverGenerateResponse(
                currentHistory,
                text,
                sanitizedState,
                language
            );

            const result: any = await Promise.race([responsePromise, timeoutPromise]);

            // Handle both string (legacy) and object (new) return types
            const responseText = typeof result === 'string' ? result : result.text;
            const usageMetadata = typeof result === 'string' ? null : result.usageMetadata;

            // Log Story Model Debug Info
            if (typeof result !== 'string' && (result as any).systemPrompt) {
                console.log("%c[Story Model Input - System Prompt]", "color: cyan; font-weight: bold;");
                console.log((result as any).systemPrompt);
                console.log("%c[Story Model Input - User Message]", "color: cyan; font-weight: bold;");
                console.log(text);
            }

            if (usageMetadata) {
                const inputCost = (usageMetadata.promptTokenCount / 1000000) * 0.30;
                const outputCost = (usageMetadata.candidatesTokenCount / 1000000) * 2.50;
                const totalCost = inputCost + outputCost;
                const totalCostKRW = totalCost * 1400;

                console.log("Token Usage (Story):");
                console.log(`- Input: ${usageMetadata.promptTokenCount} tokens ($${inputCost.toFixed(6)})`);
                console.log(`- Output: ${usageMetadata.candidatesTokenCount} tokens ($${outputCost.toFixed(6)})`);
                console.log(`- Total Est. Cost: $${totalCost.toFixed(6)} (approx. ${totalCostKRW.toFixed(2)} KRW)`);

                addToast(`Tokens: In ${usageMetadata.promptTokenCount} / Out ${usageMetadata.candidatesTokenCount}`, 'info');
            }

            const segments = parseScript(responseText);

            // 2. Generate Logic (Async)
            serverGenerateGameLogic(
                text,
                responseText,
                currentState // Pass full state for context-aware spawning
            ).then(logic => {
                // Log Logic Model Debug Info
                if (logic) {
                    if (logic._debug_prompt) {
                        console.log("%c[Logic Model Input - Prompt]", "color: violet; font-weight: bold;");
                        console.log(logic._debug_prompt);
                    }
                    if (logic._debug_raw_response) {
                        console.log("%c[Logic Model Output - Raw Response]", "color: violet; font-weight: bold;");
                        console.log(logic._debug_raw_response);
                    }
                }

                if (logic && logic._usageMetadata) {
                    const usageMetadata = logic._usageMetadata;
                    const inputCost = (usageMetadata.promptTokenCount / 1000000) * 0.30;
                    const outputCost = (usageMetadata.candidatesTokenCount / 1000000) * 2.50;
                    const totalCost = inputCost + outputCost;
                    const totalCostKRW = totalCost * 1400;

                    console.log("Token Usage (Logic):");
                    console.log(`- Input: ${usageMetadata.promptTokenCount} tokens ($${inputCost.toFixed(6)})`);
                    console.log(`- Output: ${usageMetadata.candidatesTokenCount} tokens ($${outputCost.toFixed(6)})`);
                    console.log(`- Total Est. Cost: $${totalCost.toFixed(6)} (approx. ${totalCostKRW.toFixed(2)} KRW)`);
                }

                if (segments.length === 0) {
                    applyGameLogic(logic);
                } else {
                    setPendingLogic(logic);
                }
            });

            // 3. Update State
            addMessage({ role: 'model', text: responseText });

            // Start playing
            if (segments.length > 0) {
                // Skip initial background segments
                let startIndex = 0;
                while (startIndex < segments.length && segments[startIndex].type === 'background') {
                    setBackground(segments[startIndex].content);
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
                                const expr = getKoreanExpression(first.expression);
                                // Force '주인공' for player character
                                const charName = first.character === playerName ? '주인공' : first.character;
                                setCharacterExpression(`${charName}_${expr}`);
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
        handleSend(userInput);
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
        if (isProcessing || isInputOpen || isDebugOpen || showHistory || showInventory || showCharacterInfo || showSaveLoad) return;
        if (choices.length > 0) return;

        const now = Date.now();
        if (now - lastClickTime.current < 500) return; // 500ms Debounce
        lastClickTime.current = now;

        advanceScript();
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.deltaY < -30 && !showHistory && !isInputOpen && !isDebugOpen && !showInventory && !showCharacterInfo && !showSaveLoad) {
            setShowHistory(true);
        }
    };

    const handleStartGame = () => {
        handleSend("Game Start. Please introduce the world and the main character.");
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

        // Initialize if missing
        // Initialize if missing
        if (!newStats.personality) newStats.personality = {
            morality: 0, courage: 0, energy: 0, decision: 0, lifestyle: 0,
            openness: 0, warmth: 0, eloquence: 0, leadership: 0
        };
        if (!newStats.skills) newStats.skills = [];
        if (!newStats.relationships) newStats.relationships = {};

        if (logicResult.hpChange) newStats.hp = Math.min(Math.max(0, newStats.hp + logicResult.hpChange), newStats.maxHp);
        if (logicResult.mpChange) newStats.mp = Math.min(Math.max(0, newStats.mp + logicResult.mpChange), newStats.maxMp);
        if (logicResult.goldChange) newStats.gold = Math.max(0, newStats.gold + logicResult.goldChange);
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

        // Personality Toasts
        if (logicResult.personalityChange) {
            const { selfishness, heroism, morality } = logicResult.personalityChange;
            if (selfishness) addToast(`${t.selfishness} ${selfishness > 0 ? '+' : ''}${selfishness}`, 'info');
            if (heroism) addToast(`${t.heroism} ${heroism > 0 ? '+' : ''}${heroism}`, 'success');
            if (morality) addToast(`${t.morality} ${morality > 0 ? '+' : ''}${morality}`, morality > 0 ? 'success' : 'warning');
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

        // Active Characters Update
        if (logicResult.activeCharacters) {
            useGameStore.getState().setActiveCharacters(logicResult.activeCharacters);
            console.log("Active Characters Updated:", logicResult.activeCharacters);
        }
    };

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
                                /* In portrait/narrow, fill height but cap at 2:3 (150vw) */
                                aspect-ratio: unset;
                                height: 100%;
                                max-height: 150vw; /* 2:3 Ratio (Height = 1.5 * Width) */
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
                    <AnimatePresence mode="wait">
                        {characterExpression && currentSegment?.type === 'dialogue' && (
                            <motion.div
                                key={characterExpression}
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                transition={{ duration: 0.5 }}
                                className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-[90%] z-0 pointer-events-none"
                            >
                                <img
                                    src={getCharUrl(characterExpression)}
                                    alt="Character"
                                    className="h-full object-contain drop-shadow-2xl"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        console.warn(`Failed to load character image: ${getCharUrl(characterExpression)}`);
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* UI Layer */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30 pointer-events-none">
                    {/* Left: Player Info & Stats */}
                    <div className="pointer-events-auto flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                            {/* Restored Portrait Button */}
                            <div
                                className="w-12 h-12 rounded-full border-2 border-yellow-500 overflow-hidden cursor-pointer hover:scale-110 transition-transform shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                                onClick={() => setShowCharacterInfo(true)}
                            >
                                {isMounted ? (
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`} alt="Avatar" className="w-full h-full object-cover bg-gray-800" />
                                ) : (
                                    <div className="w-full h-full bg-gray-700 animate-pulse" />
                                )}
                            </div>
                            <h1 className="text-3xl font-bold text-white drop-shadow-md tracking-wider">
                                {isMounted ? playerName : "Loading..."}
                            </h1>
                        </div>

                        <div className="flex gap-4 mt-1">
                            {/* HP Bar */}
                            <div className="relative w-48 h-8 transform -skew-x-12 overflow-hidden rounded-md border border-red-900/50 bg-black/60 backdrop-blur-md opacity-80 shadow-[0_0_10px_rgba(220,38,38,0.3)]">
                                <div className="absolute inset-0 bg-red-900/20" />
                                <div
                                    className="h-full bg-gradient-to-r from-red-700 via-red-600 to-red-500 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(220,38,38,0.6)]"
                                    style={{ width: `${(playerStats.hp / playerStats.maxHp) * 100}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-between px-4 transform skew-x-12">
                                    <span className="text-xs font-bold text-red-200 drop-shadow-sm">체력</span>
                                    <span className="text-xs font-bold text-white drop-shadow-md">{Math.round((playerStats.hp / playerStats.maxHp) * 100)}%</span>
                                </div>
                            </div>

                            {/* MP Bar */}
                            <div className="relative w-48 h-8 transform -skew-x-12 overflow-hidden rounded-md border border-blue-900/50 bg-black/60 backdrop-blur-md opacity-80 shadow-[0_0_10px_rgba(37,99,235,0.3)]">
                                <div className="absolute inset-0 bg-blue-900/20" />
                                <div
                                    className="h-full bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(37,99,235,0.6)]"
                                    style={{ width: `${(playerStats.mp / playerStats.maxMp) * 100}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-between px-4 transform skew-x-12">
                                    <span className="text-xs font-bold text-blue-200 drop-shadow-sm">정신력</span>
                                    <span className="text-xs font-bold text-white drop-shadow-md">{Math.round((playerStats.mp / playerStats.maxMp) * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Resources & Settings */}
                    <div className="pointer-events-auto flex flex-col items-end gap-3">
                        {/* Resource Container */}
                        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-6 py-3 rounded-xl border border-white/10 shadow-2xl">
                            {/* Gold */}
                            <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                                <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                                    <span className="text-md">🟡</span>
                                </div>
                                <span className="text-yellow-100 font-bold font-mono text-sm">{playerStats.gold.toLocaleString()} G</span>
                            </div>

                            {/* Fame */}
                            <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                                <span className="text-lg drop-shadow-sm">👑</span>
                                <span className="text-purple-100 font-bold font-mono text-sm">{playerStats.fame}</span>
                            </div>

                            {/* Fate */}
                            <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                                <span className="text-lg drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]">🔮</span>
                                <span className="text-purple-300 font-bold font-mono text-sm">{playerStats.fate}</span>
                            </div>

                            {/* Cash (Coins) */}
                            <div className="flex items-center gap-2 pl-2">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-[10px] text-black font-extrabold shadow-sm ring-1 ring-yellow-300">
                                    C
                                </div>
                                <span className="text-yellow-400 font-bold font-mono text-sm">{userCoins.toLocaleString()}</span>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();

                                        try {
                                            // 1. Try robust auth check with timeout
                                            let currentUser = null;

                                            // Promise Race: getUser vs 2s Timeout
                                            const getUserPromise = supabase.auth.getUser();
                                            const timeoutPromise = new Promise<{ data: { user: null }, error: any }>((resolve) =>
                                                setTimeout(() => resolve({ data: { user: null }, error: 'timeout' }), 2000)
                                            );

                                            const { data: { user }, error: authError } = await Promise.race([getUserPromise, timeoutPromise]);

                                            if (user) {
                                                currentUser = user;
                                            } else {
                                                // 2. Fallback to cached session if getUser hangs/fails
                                                console.warn("getUser timed out or failed, trying getSession fallback...");
                                                const { data: { session } } = await supabase.auth.getSession();
                                                if (session?.user) {
                                                    currentUser = session.user;
                                                }
                                            }

                                            if (!currentUser) {
                                                addToast("Login check failed. Please refresh.", "warning");
                                                return;
                                            }

                                            // 3. Perform Update
                                            const newCoins = userCoins + 50;
                                            // OPTIMISTIC: Update UI first!
                                            setUserCoins(newCoins);
                                            addToast("Charged 50 Coins!", 'success');

                                            // Background Sync
                                            supabase.from('profiles').update({ coins: newCoins }).eq('id', currentUser.id)
                                                .then(({ error }: { error: any }) => {
                                                    if (error) console.error("DB Sync Failed:", error);
                                                });
                                        } catch (err) {
                                            console.error("Critical Error:", err);
                                            addToast("Error: " + JSON.stringify(err), "warning");
                                        }
                                    }}
                                    className="ml-1 w-5 h-5 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center text-xs shadow hover:scale-110 transition-transform"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Top Right Controls */}
                        <div className="flex gap-2">
                            <button
                                className="w-10 h-10 flex items-center justify-center bg-gray-800/60 backdrop-blur-md hover:bg-gray-700/80 rounded-lg text-gray-300 hover:text-white border border-gray-600 transition-all shadow-lg"
                                onClick={(e) => { e.stopPropagation(); setIsDebugOpen(true); }}
                                title="Debug"
                            >
                                <Bolt size={20} />
                            </button>
                            <button
                                className="w-10 h-10 flex items-center justify-center bg-gray-800/60 backdrop-blur-md hover:bg-gray-700/80 rounded-lg text-gray-300 hover:text-white border border-gray-600 transition-all shadow-lg"
                                onClick={(e) => { e.stopPropagation(); setShowInventory(true); }}
                                title="Inventory"
                            >
                                <Package size={20} />
                            </button>
                            <button
                                className="w-10 h-10 flex items-center justify-center bg-gray-800/60 backdrop-blur-md hover:bg-gray-700/80 rounded-lg text-gray-300 hover:text-white border border-gray-600 transition-all shadow-lg"
                                onClick={(e) => { e.stopPropagation(); /* Settings logic later */ }}
                                title="Settings"
                            >
                                <Settings size={20} />
                            </button>
                        </div>
                    </div>
                </div>

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
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-auto z-10">
                            <div className="flex flex-col gap-4 min-w-[450px]">
                                {choices.map((choice, idx) => (
                                    <motion.button
                                        key={idx}
                                        initial={{ opacity: 0, y: 20, skewX: -12 }}
                                        animate={{ opacity: 1, y: 0, skewX: -12 }}
                                        whileHover={!isProcessing ? { scale: 1.05, skewX: -12 } : {}}
                                        transition={{ delay: idx * 0.1 }}
                                        disabled={isProcessing}
                                        className={`w-full bg-gradient-to-r from-white/50 to-slate-100/70 backdrop-blur-md rounded-2xl border border-white/80 text-slate-700 font-bold py-6 px-8 text-xl shadow-[0_0_15px_rgba(71,85,105,0.5)] transition-all duration-300
                                            ${isProcessing ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-white/90 hover:text-slate-900 hover:border-white'}
                                        `}
                                        onClick={(e) => {
                                            if (isProcessing) return;
                                            console.log("Choice clicked:", choice.content);
                                            e.stopPropagation();
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
                                    className="w-full bg-gradient-to-r from-slate-100/50 to-white/50 backdrop-blur-md rounded-2xl border border-white/60 text-slate-700 font-bold py-6 px-8 text-xl shadow-[0_0_15px_rgba(71,85,105,0.5)] hover:bg-white/80 hover:border-white transition-all duration-300"
                                    onClick={(e) => {
                                        e.stopPropagation();
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
                    !currentSegment && choices.length === 0 && scriptQueue.length === 0 && !isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10">
                            {chatHistory.length === 0 ? (
                                // Start Screen
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



                {/* Loading Indicator */}
                <AnimatePresence>
                    {isProcessing && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 pointer-events-auto"
                        >
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-yellow-400 font-bold animate-pulse">{t.thinking}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* History Modal */}
                <AnimatePresence>
                    {showHistory && (
                        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="bg-gray-900 w-full max-w-3xl h-[80vh] rounded-xl flex flex-col border border-gray-700">
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
                                        return (
                                            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                <span className="text-sm text-gray-500 mb-2 font-bold">{msg.role === 'user' ? t.you : t.system}</span>
                                                <div className={`rounded-xl max-w-[95%] overflow-hidden ${msg.role === 'user' ? 'bg-blue-900/30 border border-blue-500/50' : 'bg-gray-800/50 border border-gray-700'}`}>
                                                    {msg.role === 'user' ? (
                                                        <div className="p-4 text-blue-100 text-lg">{msg.text}</div>
                                                    ) : (
                                                        <div className="flex flex-col divide-y divide-gray-700/50">
                                                            {segments.map((seg, sIdx) => (
                                                                <div key={sIdx} className="p-4">
                                                                    {seg.type === 'dialogue' && (
                                                                        <div className="mb-1">
                                                                            <span className="text-yellow-500 font-bold text-lg">{seg.character}</span>
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
                                                            ))}
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
                                    onChange={(e) => setUserInput(e.target.value)}
                                    className="w-full h-32 bg-black/50 border border-gray-700 rounded p-4 text-white text-lg mb-4 focus:outline-none focus:border-green-500"
                                    placeholder={t.placeholderAction}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleUserSubmit();
                                        }
                                    }}
                                />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setIsInputOpen(false)} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">{t.cancel}</button>
                                    <button onClick={handleUserSubmit} className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 font-bold">{t.action}</button>
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
                                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                                    <h2 className="text-2xl font-bold text-yellow-400">{t.charInfo}</h2>
                                    <button onClick={() => setShowCharacterInfo(false)} className="text-gray-400 hover:text-white text-xl">×</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                    {currentSegment.content.replace(/\*\*/g, '')}
                                </div>

                                <div className="mt-8 text-sm text-gray-500 animate-pulse">
                                    Click to continue
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Dialogue / Narration Layer */}
                {currentSegment && currentSegment.type !== 'system_popup' && (
                    <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 flex justify-center items-end z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent h-[30vh]">
                        <div className="w-full max-w-5xl pointer-events-auto relative">
                            {/* Dialogue Control Bar */}
                            <div className="absolute -top-10 right-0 flex gap-2 z-30">
                                <button
                                    className="px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-1"
                                    onClick={(e) => { e.stopPropagation(); setShowHistory(true); }}
                                >
                                    <History size={14} />
                                    {t.chatHistory}
                                </button>
                                <button
                                    className="px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-1"
                                    onClick={(e) => { e.stopPropagation(); setShowSaveLoad(true); }}
                                >
                                    <Save size={14} />
                                    {t.save}
                                </button>
                            </div>

                            <div
                                className="w-full relative flex flex-col items-center cursor-pointer"
                                onClick={handleScreenClick}
                            >
                                {/* Name Tag */}
                                {currentSegment.type === 'dialogue' && (
                                    <div className="absolute -top-12 w-full text-center px-2">
                                        <span className="text-[36px] font-bold text-yellow-500 tracking-wide drop-shadow-md">
                                            {(() => {
                                                const { characterData, playerName } = useGameStore.getState();

                                                // Handle Protagonist Name
                                                if (currentSegment.character === '주인공') {
                                                    return playerName;
                                                }

                                                const charList = Array.isArray(characterData) ? characterData : Object.values(characterData);
                                                const found = charList.find((c: any) => c.englishName === currentSegment.character || c.name === currentSegment.character);
                                                return found ? found.name : currentSegment.character;
                                            })()}
                                        </span>
                                    </div>
                                )}

                                {/* Text Content */}
                                <div className="text-[36px] leading-relaxed text-gray-100 min-h-[80px] whitespace-pre-wrap text-center w-full drop-shadow-sm">
                                    {currentSegment.type === 'narration' ? (
                                        <span className="text-gray-300 italic block px-8">
                                            {currentSegment.content}
                                        </span>
                                    ) : (
                                        <span>
                                            {currentSegment.content}
                                        </span>
                                    )}
                                </div>

                                {/* Continue Indicator */}
                                <div className="mt-2 animate-bounce text-yellow-500">
                                    ▼
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
