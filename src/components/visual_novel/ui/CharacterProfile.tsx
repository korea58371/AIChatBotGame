import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Shield, Zap, BookOpen, Heart, Skull, Activity, Star } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import { RelationshipManager } from '@/lib/relationship-manager';
import { LEVEL_TO_RANK_MAP } from '@/data/games/god_bless_you/constants';

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
    lust: '색욕'
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
    const t = translations[language];

    // [Refactor] Dynamic Trait Mapping using translations.ts (Jan 2026)
    const PERSONALITY_TRAITS = [
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
        { key: 'lust', label: t.lust || '색욕', color: 'text-rose-400', bar: 'bg-rose-600' }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-gray-900 w-full max-w-4xl h-[80vh] rounded-xl flex flex-col border border-yellow-600 shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-yellow-400">{t.charInfo}</h2>
                        <div className="px-3 py-1 bg-gray-700 rounded-full border border-gray-600">
                            <span className="text-gray-300 text-sm font-mono">Turn: {turnCount}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-700 bg-black/40">
                    <button
                        onClick={() => onTabChange('basic')}
                        className={`flex-1 py-3 text-center font-bold transition-colors ${activeTab === 'basic' ? 'bg-yellow-600/20 text-yellow-400 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        {t.tabBasic}
                    </button>
                    <button
                        onClick={() => onTabChange('martial_arts')}
                        className={`flex-1 py-3 text-center font-bold transition-colors ${activeTab === 'martial_arts' ? 'bg-yellow-600/20 text-yellow-400 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        {t.tabMartialArts}
                    </button>
                    <button
                        onClick={() => onTabChange('relationships')}
                        className={`flex-1 py-3 text-center font-bold transition-colors ${activeTab === 'relationships' ? 'bg-yellow-600/20 text-yellow-400 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        {t.tabAffinity}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {/* Tab Content: Basic Info */}
                    {activeTab === 'basic' && (
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
                                            <span className="text-yellow-400 font-bold">{t.neigong}</span>
                                            <span className="text-yellow-200 font-mono bg-yellow-900/30 px-2 py-1 rounded border border-yellow-700/50">
                                                {playerStats.neigong || 0}{t.years}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Personality Section */}
                                <div className="space-y-2">
                                    {PERSONALITY_TRAITS.map((trait) => (
                                        <div key={trait.key}>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-gray-300 text-xs">{trait.label}</span>
                                                <span className={`text-xs ${trait.color}`}>
                                                    {/* @ts-ignore */}
                                                    {playerStats.personality?.[trait.key] || 0}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-1.5 relative">
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
                                        {t.activeCharactersTitle}
                                    </h3>
                                    {activeCharacters.length === 0 ? (
                                        <p className="text-gray-500 italic">{t.noActiveCharacters}</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {activeCharacters.map((charId: string) => {
                                                const charInfo = characterData[charId];
                                                return (
                                                    <div key={charId} className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-green-900/50">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden border border-gray-600">
                                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                                                                    {charInfo?.name?.[0] || charId[0]}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-green-300">{charInfo?.name || charId}</div>
                                                                <div className="text-xs text-green-500/70">
                                                                    {charInfo?.memories?.length || 0} {t.memoriesRecorded}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="px-2 py-1 bg-green-900/30 rounded text-xs text-green-400">
                                                            {t.presentStatus}
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
                                            {playerStats.skills.map((skill: any, idx: number) => (
                                                <span key={idx} className="px-3 py-1 bg-blue-900/50 border border-blue-500 rounded-full text-blue-200 text-sm">
                                                    {skill.name || skill}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content: Martial Arts */}
                    {activeTab === 'martial_arts' && (
                        <div className="space-y-8">
                            <div className="bg-gray-800 p-6 rounded-lg border border-yellow-600/50">
                                <div className="flex justify-between items-center mb-4 border-b border-yellow-600/30 pb-2">
                                    <div className="flex flex-col">
                                        <h3 className="text-xl font-bold text-yellow-400">
                                            {t.martialArts}
                                        </h3>
                                        <span className="text-xs text-yellow-500/80 mt-1">
                                            {t.cumulativeNeigong}: <strong className="text-yellow-300 text-sm">{playerStats.neigong || 0}{t.years}</strong>
                                        </span>
                                    </div>
                                    <div className="px-3 py-1 bg-yellow-900/40 rounded border border-yellow-600/50 flex flex-col items-end">
                                        <span className="text-yellow-200 font-bold font-mono text-sm md:text-base">
                                            Lv.{Math.floor(playerStats.level || 1)} {playerStats.playerRank || 'Unknown'}
                                        </span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-yellow-500"
                                                    style={{ width: `${((playerStats.level || 1) % 1 * 100).toFixed(0)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-yellow-500">
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
                            <div className="bg-black/40 p-6 rounded-lg border border-gray-700">
                                <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-600 pb-2">{t.relationships}</h3>
                                {Object.keys(playerStats.relationships || {}).length === 0 ? (
                                    <p className="text-gray-500 italic text-center py-8">{t.noRelationships}</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(playerStats.relationships || {}).map(([charId, affinity]) => {
                                            const charMemories = characterData?.[charId]?.memories || [];
                                            const tierInfo = RelationshipManager.getTier(affinity as number);

                                            return (
                                                <div key={charId} className="flex flex-col bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 hover:bg-gray-800 transition-colors">
                                                    <div className="flex flex-col gap-2 mb-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-gray-200 text-lg">{charId}</span>
                                                            <span className={`text-xl font-bold ${(affinity as number) > 0 ? 'text-pink-400' : 'text-gray-400'}`}>{affinity as number}</span>
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
                                                        <div className="mt-auto pl-2 border-l-2 border-yellow-700/50 pt-2">
                                                            <p className="text-xs text-yellow-500 font-bold mb-1">{t.memoriesLabel}</p>
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
