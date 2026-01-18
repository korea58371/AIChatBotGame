import React, { useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Shield, Zap, BookOpen, Heart, Skull, Activity, Star } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import { RelationshipManager } from '@/lib/relationship-manager';
import { LEVEL_TO_RANK_MAP } from '@/data/games/god_bless_you/constants';
import { useVNAudio } from '../hooks/useVNAudio';

import { translations } from '@/data/translations';

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
    lust: '변태'
};

const PERSONALITY_TRAITS = [
    { key: 'morality', label: '도덕성', color: 'text-green-400', bar: 'bg-green-600' },
    { key: 'courage', label: '용기', color: 'text-red-400', bar: 'bg-red-600' },
    { key: 'energy', label: '에너지', color: 'text-yellow-400', bar: 'bg-yellow-600' },
    { key: 'decision', label: '의사결정', color: 'text-blue-400', bar: 'bg-blue-600' },
    { key: 'lifestyle', label: '생활양식', color: 'text-purple-400', bar: 'bg-purple-600' },
    { key: 'openness', label: '수용성', color: 'text-indigo-400', bar: 'bg-indigo-600' },
    { key: 'warmth', label: '대인온도', color: 'text-pink-400', bar: 'bg-pink-600' },
    { key: 'eloquence', label: '화술', color: 'text-teal-400', bar: 'bg-teal-600' },
    { key: 'leadership', label: '통솔력', color: 'text-orange-400', bar: 'bg-orange-600' },
];

interface CharacterProfileProps {
    isOpen: boolean;
    onClose: () => void;
    playerStats: any;
    characterData: any;
    activeCharacters: string[];
    turnCount: number;
    language: 'ko' | 'en';
    activeTab: 'basic' | 'martial_arts' | 'relationships';
    onTabChange: (tab: 'basic' | 'martial_arts' | 'relationships') => void;
}

export default function CharacterProfile({
    isOpen,
    onClose,
    playerStats,
    characterData,
    activeCharacters,
    turnCount,
    language,
    activeTab,
    onTabChange
}: CharacterProfileProps) {
    const { playSfx } = useVNAudio();

    // Play Popup Sound on Open
    useEffect(() => {
        if (isOpen) {
            playSfx('ui_popup');
        }
    }, [isOpen]);

    if (!isOpen) return null;
    if (!playerStats) return null;

    const t = translations[language];
    // Access goals from store
    const { goals } = useGameStore();

    // [Refactor] Dynamic Trait Mapping using translations.ts (Jan 2026)
    const PERSONALITY_TRAITS_DYNAMIC = [
        { key: 'morality', label: t.morality || '도덕성', color: 'text-green-400', bar: 'bg-green-600' },
        { key: 'courage', label: t.courage || '용기', color: 'text-red-400', bar: 'bg-red-600' },
        { key: 'energy', label: t.energy || '에너지', color: 'text-yellow-400', bar: 'bg-yellow-600' },
        { key: 'decision', label: t.decision || '의사결정', color: 'text-blue-400', bar: 'bg-blue-600' },
        { key: 'lifestyle', label: t.lifestyle || '생활양식', color: 'text-purple-400', bar: 'bg-purple-600' },
        { key: 'openness', label: t.openness || '수용성', color: 'text-indigo-400', bar: 'bg-indigo-600' },
        { key: 'warmth', label: t.warmth || '대인온도', color: 'text-pink-400', bar: 'bg-pink-600' },
        { key: 'eloquence', label: t.eloquence || '화술', color: 'text-cyan-400', bar: 'bg-cyan-600' },
        { key: 'leadership', label: t.leadership || '통솔력', color: 'text-orange-400', bar: 'bg-orange-600' },
        { key: 'humor', label: t.humor || '유머', color: 'text-lime-400', bar: 'bg-lime-600' },
        { key: 'lust', label: t.lust || '변태', color: 'text-rose-400', bar: 'bg-rose-600' }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                // [Theme Refinement] Gradient Background for Profile
                className="bg-gradient-to-b from-[#2a2a2a] via-[#1a1a1a] to-[#0d0d0d] w-full max-w-5xl h-[85vh] rounded-xl border border-[#333] shadow-2xl overflow-hidden flex flex-col relative"
            >
                {/* Decorative Top Line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />{/* Header */}
                <div className="p-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-[#252525]">
                    <div className="flex items-center gap-4">
                        <h2 className="text-3xl font-bold font-serif text-[#D4AF37] tracking-wider">◆ {t.charInfo}</h2>
                        <div className="px-3 py-1 bg-[#1a1a1a] rounded-full border border-white/10">
                            <span className="text-[#D4AF37] text-sm font-mono">Turn: {turnCount}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            playSfx('ui_cancel');
                            onClose();
                        }}
                        onMouseEnter={() => playSfx('ui_hover')}
                        className="text-gray-400 hover:text-white text-xl"
                    >×</button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-white/5 bg-[#1e1e1e]">
                    <button
                        onClick={() => {
                            playSfx('ui_click');
                            onTabChange('basic');
                        }}
                        onMouseEnter={() => playSfx('ui_hover')}
                        className={`flex-1 py-3 text-center font-bold transition-all duration-300 ${activeTab === 'basic' ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-b-2 border-[#D4AF37] font-serif text-lg' : 'text-gray-500 hover:text-[#D4AF37] hover:bg-[#D4AF37]/5'}`}
                    >
                        {t.tabBasic}
                    </button>
                    <button
                        onClick={() => {
                            playSfx('ui_click');
                            onTabChange('martial_arts');
                        }}
                        onMouseEnter={() => playSfx('ui_hover')}
                        className={`flex-1 py-3 text-center font-bold transition-all duration-300 ${activeTab === 'martial_arts' ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-b-2 border-[#D4AF37] font-serif text-lg' : 'text-gray-500 hover:text-[#D4AF37] hover:bg-[#D4AF37]/5'}`}
                    >
                        {t.tabMartialArts}
                    </button>
                    <button
                        onClick={() => {
                            playSfx('ui_click');
                            onTabChange('relationships');
                        }}
                        onMouseEnter={() => playSfx('ui_hover')}
                        className={`flex-1 py-3 text-center font-bold transition-all duration-300 ${activeTab === 'relationships' ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-b-2 border-[#D4AF37] font-serif text-lg' : 'text-gray-500 hover:text-[#D4AF37] hover:bg-[#D4AF37]/5'}`}
                    >
                        {t.tabAffinity}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    {/* Tab Content: Basic Info */}
                    {activeTab === 'basic' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                            {/* Left Column: Stats & Personality */}
                            <div className="space-y-8">
                                <div className="space-y-8">
                                    {/* Base Stats Section */}
                                    <div className="bg-[#252525] p-4 rounded-lg border border-white/5 shadow-lg">
                                        <h3 className="text-[#D4AF37] font-serif font-bold text-xl mb-4 border-b border-white/10 pb-2">◆ {t.baseStats}</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400">{t.str}</span>
                                                <span className="text-[#eee] font-mono bg-black/30 px-2 py-1 rounded border border-white/5">{playerStats.str || 10}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400">{t.agi}</span>
                                                <span className="text-[#eee] font-mono bg-black/30 px-2 py-1 rounded border border-white/5">{playerStats.agi || 10}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400">{t.int}</span>
                                                <span className="text-[#eee] font-mono bg-black/30 px-2 py-1 rounded border border-white/5">{playerStats.int || 10}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400">{t.vit}</span>
                                                <span className="text-[#eee] font-mono bg-black/30 px-2 py-1 rounded border border-white/5">{playerStats.vit || 10}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400">{t.luk}</span>
                                                <span className="text-[#eee] font-mono bg-black/30 px-2 py-1 rounded border border-white/5">{playerStats.luk || 10}</span>
                                            </div>
                                            {/* [Wuxia] Neigong Display */}
                                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/10">
                                                <span className="text-[#D4AF37] font-bold">{t.neigong}</span>
                                                <span className="text-[#D4AF37] font-mono bg-[#D4AF37]/10 px-2 py-1 rounded border border-[#D4AF37]/20">
                                                    {playerStats.neigong || 0}{t.years}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Personality Section */}
                                    <div className="space-y-2">
                                        {/* @ts-ignore */}
                                        {PERSONALITY_TRAITS.map((trait) => (
                                            <div key={trait.key}>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-gray-400 text-xs font-serif tracking-wide">{trait.label}</span>
                                                    <span className={`text-xs ${trait.color} font-mono`}>
                                                        {/* @ts-ignore */}
                                                        {playerStats.personality?.[trait.key] || 0}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-[#111] rounded-full h-1.5 relative border border-[#333]">
                                                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#444]"></div>
                                                    <div
                                                        className={`${trait.bar} h-1.5 rounded-full absolute top-0 bottom-0 transition-all duration-500 opacity-90`}
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
                            </div>

                            {/* Right Column (Basic): Active Chars & Goals */}
                            <div className="space-y-8">
                                {/* Active Characters Section */}
                                <div className="bg-[#252525] p-6 rounded-lg border border-white/5 shadow-lg">
                                    <h3 className="text-xl font-bold font-serif text-[#D4AF37] mb-4 border-b border-white/10 pb-2">
                                        ◆ {t.activeCharactersTitle}
                                    </h3>
                                    {activeCharacters.length === 0 ? (
                                        <p className="text-gray-500 italic">{t.noActiveCharacters}</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {activeCharacters.map((charId: string) => {
                                                const charInfo = characterData[charId];
                                                return (
                                                    <div key={charId} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden border border-white/10">
                                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#D4AF37]">
                                                                    {charInfo?.name?.[0] || charId[0]}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-gray-200">{charInfo?.name || charId}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    {charInfo?.memories?.length || 0} {t.memoriesRecorded}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="px-2 py-1 bg-white/5 rounded text-xs text-[#D4AF37] border border-white/5">
                                                            {t.presentStatus}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Current Goals Section (Replaces Skills) */}
                                <div className="bg-[#252525] p-6 rounded-lg border border-white/5 shadow-lg">
                                    <h3 className="text-xl font-bold font-serif text-[#D4AF37] mb-4 border-b border-white/10 pb-2">◆ {t.currentGoal}</h3>

                                    {/* Final Goal / Main Objective */}
                                    {playerStats.final_goal && (
                                        <div className="mb-4 pb-4 border-b border-white/5">
                                            <h4 className="text-sm text-[#888] mb-2 font-serif">최종 목표</h4>
                                            <p className="text-lg text-white font-serif leading-relaxed">
                                                <span className="text-[#D4AF37] mr-2">◈</span>
                                                {{
                                                    'go_home': "다 필요 없어! 와이파이 터지는 내 방으로 돌아갈래!",
                                                    'harem_king': "이왕 온 거, 무림의 미녀란 미녀는 다 내 걸로 만들겠다.",
                                                    'tycoon': "현대의 지식(다단계, 주식)으로 무림 경제를 지배해주마.",
                                                    'survival': "가늘고 길게 사는 게 최고다. 산속에 숨어서 만수무강하리라.",
                                                    'murim_lord': "무력으로 천하를 제패하는 천하제일인이 되겠다."
                                                }[playerStats.final_goal as string] || playerStats.final_goal}
                                            </p>
                                        </div>
                                    )}

                                    {/* Active Quest Goals */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm text-[#888] mb-2 font-serif">진행 중인 목표</h4>
                                        {/* @ts-ignore */}
                                        {(goals || []).filter((g: any) => g.status === 'ACTIVE').length === 0 ? (
                                            <p className="text-gray-500 italic">특별한 목표가 없습니다.</p>
                                        ) : (
                                            /* @ts-ignore */
                                            (goals || []).filter((g: any) => g.status === 'ACTIVE').map((goal: any) => (
                                                <div key={goal.id} className="flex items-start gap-2">
                                                    <span className={`mt-1.5 text-[10px] ${goal.type === 'MAIN' ? 'text-[#D4AF37]' : 'text-gray-500'}`}>◆</span>
                                                    <div className={`${goal.type === 'MAIN' ? 'text-gray-200 font-bold' : 'text-gray-400'}`}>
                                                        {goal.description}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content: Martial Arts */}
                    {activeTab === 'martial_arts' && (
                        <div className="space-y-8">
                            <div className="bg-[#252525] p-6 rounded-lg border border-white/5 shadow-lg">
                                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                                    <div className="flex flex-col">
                                        <h3 className="text-xl font-bold font-serif text-[#D4AF37]">
                                            ◆ {t.martialArts}
                                        </h3>
                                        <span className="text-xs text-[#D4AF37]/80 mt-1">
                                            {t.cumulativeNeigong}: <strong className="text-[#D4AF37] text-sm">{playerStats.neigong || 0}{t.years}</strong>
                                        </span>
                                    </div>
                                    <div className="px-3 py-1 bg-[#D4AF37]/10 rounded border border-[#D4AF37]/30 flex flex-col items-end">
                                        <span className="text-[#D4AF37] font-bold font-mono text-sm md:text-base">
                                            Lv.{Math.floor(playerStats.level || 1)} {playerStats.playerRank || 'Unknown'}
                                        </span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#D4AF37]"
                                                    style={{ width: `${((playerStats.level || 1) % 1 * 100).toFixed(0)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-[#D4AF37]">
                                                {((playerStats.level || 1) % 1 * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {(!playerStats.skills || playerStats.skills.length === 0) ? (
                                    <div className="text-center py-6 border border-dashed border-gray-700 rounded-lg">
                                        <p className="text-gray-500 italic mb-2">{t.noMartialArts}</p>
                                        <p className="text-xs text-gray-600">{t.learnMartialArts}</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {playerStats.skills.map((art: any, idx: number) => (
                                            <div key={idx} className="bg-[#1e1e1e] p-4 rounded border border-white/5 hover:border-[#D4AF37]/50 transition-all duration-300 shadow-md">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="font-bold font-serif text-[#D4AF37] text-lg">◆ {art.name}</span>
                                                        <span className="text-xs text-gray-500 ml-2">[{art.rank || 'Unknown'}]</span>
                                                    </div>
                                                    <span className="text-xs font-mono text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-0.5 rounded bg-[#D4AF37]/5">
                                                        {art.type}
                                                    </span>
                                                </div>

                                                {/* Proficiency Bar */}
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-[#b38f2d] to-[#D4AF37]"
                                                            style={{ width: `${art.proficiency || 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-[#D4AF37] font-mono w-10 text-right">
                                                        {art.proficiency || 0}%
                                                    </span>
                                                </div>

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
                    {activeTab === 'relationships' && (
                        <div className="space-y-8">
                            <div className="bg-[#252525] p-6 rounded-lg border border-white/5 shadow-lg">
                                <h3 className="text-xl font-bold font-serif text-[#D4AF37] mb-4 border-b border-white/10 pb-2">◆ {t.relationships}</h3>
                                {Object.keys(playerStats.relationships || {}).length === 0 ? (
                                    <p className="text-gray-500 italic text-center py-8">{t.noRelationships}</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(playerStats.relationships || {}).map(([charId, affinity]) => {
                                            const charMemories = characterData?.[charId]?.memories || [];
                                            const tierInfo = RelationshipManager.getTier(affinity as number);

                                            return (
                                                <div key={charId} className="flex flex-col bg-[#1e1e1e] p-4 rounded-lg border border-white/5 hover:border-[#D4AF37]/20 transition-all duration-300">
                                                    <div className="flex flex-col gap-2 mb-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold font-serif text-[#D4AF37] text-lg">◆ {charId}</span>
                                                            <span className={`text-xl font-bold ${(affinity as number) > 0 ? 'text-pink-400' : 'text-gray-400'}`}>{affinity as number}</span>
                                                        </div>

                                                        {/* Tier Badge & Progress */}
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex justify-between items-end">
                                                                <span className="text-xs text-[#D4AF37] font-mono font-bold uppercase tracking-wider">
                                                                    {tierInfo.tier}
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${(affinity as number) > 0 ? 'bg-gradient-to-r from-pink-600 to-pink-400' : 'bg-gray-500'}`}
                                                                    style={{ width: `${Math.min(100, Math.abs(affinity as number))}%` }}
                                                                />
                                                            </div>
                                                            <p className="text-xs text-gray-400 mt-1 italic leading-relaxed">
                                                                "{tierInfo.description}"
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Memories Display */}
                                                    {charMemories.length > 0 && (
                                                        <div className="mt-auto pl-2 border-l-2 border-[#D4AF37]/30 pt-2">
                                                            <p className="text-xs text-[#D4AF37] font-bold mb-1">{t.memoriesLabel}</p>
                                                            <ul className="list-disc list-inside space-y-0.5">
                                                                {charMemories.slice(-3).map((mem: string, i: number) => (
                                                                    <li key={i} className="text-xs text-gray-400 line-clamp-1" title={mem}>
                                                                        {mem}
                                                                    </li>
                                                                ))}
                                                                {charMemories.length > 3 && (
                                                                    <li className="text-xs text-gray-500 italic">... {charMemories.length - 3} {t.andXMore}</li>
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
    );
}
