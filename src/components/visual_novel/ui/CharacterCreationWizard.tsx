'use client';

import React, { useState, memo } from 'react';
import { useGameStore, Skill } from '@/lib/store';
import { checkNameValidity, getHiddenSettings, selectProtagonistImage } from '@/data/games/wuxia/character_creation';
import { WUXIA_IM_SEONG_JUN_SCENARIO, WUXIA_NAM_GANG_HYEOK_SCENARIO } from '@/data/games/wuxia/constants';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import EventCGLayer from '@/components/visual_novel/ui/EventCGLayer';
import CharacterLayer from '@/components/visual_novel/ui/CharacterLayer';

interface CharacterCreationWizardProps {
    handleSend: (text: string, isDirectInput?: boolean, isHidden?: boolean) => void;
    handleStartGame: () => void;
    addToast: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
    playSfx: (name: string) => void;
    onNavigateHome: () => void;
    playerStats: any;
    setPlayerStats: (stats: any) => void;
}

/**
 * [Perf] Extracted as a separate component to prevent full VisualNovelUI re-renders
 * when creationStep/creationData changes during character creation.
 * Previously, every click in the creation wizard caused ~350ms re-renders
 * because the entire 7000-line parent component would re-render.
 */
function CharacterCreationWizardInner({
    handleSend,
    handleStartGame,
    addToast,
    playSfx,
    onNavigateHome,
    playerStats,
    setPlayerStats,
}: CharacterCreationWizardProps) {
    // [Perf] Local state — changes here only re-render THIS component, not the parent
    const [creationStep, setCreationStep] = useState(0);
    const [creationData, setCreationData] = useState<Record<string, string>>({});

    const creationQuestions = useGameStore(state => state.characterCreationQuestions);
    const isDataLoaded = !!creationQuestions && creationQuestions.length > 0;
    // [Fix] 개별 셀렉터 사용 — 인라인 객체 셀렉터는 매 렌더마다 새 참조를 생성하여 getSnapshot 무한 루프 유발
    const playerName = useGameStore(state => state.playerName);
    const activeGameId = useGameStore(state => state.activeGameId);

    // [Fix] Data Loading Guard
    if (!isDataLoaded) {
        // [Fix] Wuxia Data Integrity Guard
        if (activeGameId === 'wuxia') {
            const { setGameId } = useGameStore.getState();
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

        // Fallback to Standard Start Screen
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
                        onBlur={(e) => useGameStore.getState().setPlayerName(e.target.value)}
                        defaultValue={useGameStore.getState().playerName}
                    />
                </div>

                {/* Gender Toggle */}
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
                                        setPlayerStats({ gender: g as 'male' | 'female' });
                                    }}
                                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${isSelected
                                        ? (g === 'male' ? 'bg-blue-600 text-white' : 'bg-pink-600 text-white')
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    {g === 'male' ? '♂ Male' : '♀ Female'}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleStartGame();
                    }}
                    className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 rounded font-bold text-black shadow-lg transform hover:scale-105 transition-all"
                >
                    Start Game
                </button>
            </div>
        );
    }

    // Creation wizard with questions
    const isNameStep = creationStep === 0;
    const questionIndex = creationStep - 1;
    const currentQuestion = isNameStep ? null : creationQuestions[questionIndex];

    const handleOptionSelect = (qId: string, value: string) => {
        const updatedData = { ...creationData, [qId]: value };
        setCreationData(updatedData);

        if (questionIndex < creationQuestions.length - 1) {
            setCreationStep(prev => prev + 1);
        } else {
            // Finished — Construct Prompt
            let profileText = "사용자 캐릭터 프로필:\n";
            Object.entries(updatedData).forEach(([key, val]) => {
                const q = creationQuestions.find(q => q.id === key);
                const opt = q?.options.find((o: any) => o.value === val);
                profileText += `- ${q?.id}: ${opt?.label || val}\n`;
            });

            // [Default Name Logic]
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

            // [Protagonist Image Selection]
            const gender = useGameStore.getState().playerStats.gender || 'male';
            const finalImage = selectProtagonistImage(finalName, gender, updatedData);
            if (finalImage) {
                console.log(`[CharacterCreation] Setting Protagonist Image: ${finalImage}`);
                useGameStore.getState().setHiddenOverrides({ protagonistImage: finalImage });
            }

            const newStats = {
                ...useGameStore.getState().playerStats,
                skills: [] as Skill[],
                neigong: 0,
                gold: 0,
            };

            // [Cost Deduction Logic]
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

            // [보너스 적용] 핵심 설정
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
                newStats.level = 100;
                if (!newStats.personality) {
                    newStats.personality = {
                        morality: 0, courage: 0, energy: 0, decision: 0, lifestyle: 0,
                        openness: 0, warmth: 0, eloquence: 0, leadership: 0,
                        humor: 0, lust: 0
                    };
                }
                newStats.personality.morality = -50;
                const demonArt = {
                    id: 'heavenly_demon_art',
                    name: '천마신공(天魔神功)',
                    rank: '절대지경',
                    type: '신공',
                    description: '천마의 절대무공. 파괴적인 위력을 자랑한다.',
                    proficiency: 10,
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

            // [GBY Bonuses]
            if (activeGameId === 'god_bless_you') {
                if (coreSetting === 'incompetent') {
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
                    newStats.gold = (newStats.gold || 0) + 500000;
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
                    (newStats as any).potential = ((newStats as any).potential || 10) + 30;
                    newStats.level = 20;
                    addToast("특전: S급 유망주 (마력 +500, 잠재력 +30, 레벨 20)", "success");
                }
            }

            // [Personality Bonuses]
            const pLink = newStats.personality || {};
            const pTone = updatedData['personality_tone'];
            if (pTone === 'humorous') {
                pLink.warmth = (pLink.warmth || 0) + 10;
                pLink.energy = (pLink.energy || 0) + 10;
                pLink.humor = (pLink.humor || 0) + 20;
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

            // [Final Goal]
            if (updatedData['final_goal']) {
                newStats.final_goal = updatedData['final_goal'];
            }

            if (updatedData['narrative_perspective']) {
                newStats.narrative_perspective = updatedData['narrative_perspective'];
            }

            // Commit to Store
            useGameStore.getState().setPlayerStats(newStats);
            console.log("[Start] Applied Initial Stats:", newStats);

            // [Hidden Settings Logic]
            if (activeGameId === 'wuxia') {
                const hidden = getHiddenSettings(finalName);
                if (hidden && hidden.found) {
                    console.log("Applying Hidden Settings:", hidden);

                    useGameStore.getState().setHiddenOverrides({
                        persona: hidden.personaOverride,
                        scenario: hidden.scenarioOverride,
                        disabledEvents: hidden.disabledEvents,
                        protagonistImage: hidden.imageOverride
                    });

                    prompt += `\n${hidden.narrative}\n`;

                    if (hidden.scenarioOverride === 'WUXIA_IM_SEONG_JUN_SCENARIO') {
                        prompt += `\n[SCENARIO KEY OVERRIDE]\n${WUXIA_IM_SEONG_JUN_SCENARIO}\n`;
                    } else if (hidden.scenarioOverride === 'WUXIA_NAM_GANG_HYEOK_SCENARIO') {
                        prompt += `\n[SCENARIO KEY OVERRIDE]\n${WUXIA_NAM_GANG_HYEOK_SCENARIO}\n`;
                    }

                    addToast(`히든 설정 발동: ${hidden.statsModifier?.faction || 'Unknown'}`, 'success');

                    if (hidden.statsModifier) {
                        const currentSkills = newStats.skills || [];
                        const newSkills = hidden.statsModifier.skills || [];

                        newStats.faction = hidden.statsModifier.faction || newStats.faction;
                        newStats.skills = [...currentSkills, ...newSkills];

                        if (hidden.statsModifier.active_injuries) {
                            newStats.active_injuries = [...(newStats.active_injuries || []), ...hidden.statsModifier.active_injuries];
                        }

                        if (hidden.statsModifier.personality) {
                            Object.keys(hidden.statsModifier.personality).forEach(k => {
                                const key = k as keyof typeof newStats.personality;
                                // @ts-ignore
                                newStats.personality[key] = (newStats.personality[key] || 0) + (hidden.statsModifier.personality[key] || 0);
                            });
                        }

                        useGameStore.getState().setPlayerStats(newStats);
                    }
                }
            }

            handleSend(prompt, false, true);
        }
    };

    const bgGradient = activeGameId === 'god_bless_you'
        ? 'bg-gradient-to-br from-slate-900 via-[#0f172a] to-black'
        : 'bg-gradient-to-br from-[#1c1917] via-[#292524] to-black';

    return (
        <>
            {/* Creation Phase Background */}
            <div className={`fixed inset-0 -z-10 ${bgGradient} flex items-center justify-center`}>
                <div className="absolute inset-0 bg-black/40" />
                {/* Starfield Warp Effect */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none perspective-[1000px]">
                    {/* Center Glow */}
                    <motion.div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)' }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                </div>

                {/* Event CG Layer (z-50) */}
                <EventCGLayer />

                {/* Character Layer (z-10) */}
                <CharacterLayer />

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
                                    defaultValue={playerName || ''}
                                    onBlur={(e) => {
                                        useGameStore.getState().setPlayerName(e.target.value);
                                    }}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            useGameStore.getState().setPlayerName((e.target as HTMLInputElement).value);
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
                                        onNavigateHome();
                                    }}
                                    className="px-6 py-3.5 bg-[#444] hover:bg-[#555] rounded-lg font-bold text-[#aaa] hover:text-[#eee] text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all font-serif"
                                >
                                    타이틀로
                                </button>
                                <button
                                    onClick={() => {
                                        // Sync name from DOM since input is uncontrolled
                                        const nameInput = document.querySelector<HTMLInputElement>('input[placeholder="이름을 입력하세요"]');
                                        if (nameInput) {
                                            useGameStore.getState().setPlayerName(nameInput.value);
                                        }
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
            </div>
        </>
    );
}

// [Perf] React.memo prevents re-renders from parent state changes
const CharacterCreationWizard = memo(CharacterCreationWizardInner);
export default CharacterCreationWizard;
