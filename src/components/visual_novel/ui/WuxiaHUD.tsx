import React from 'react';
import { motion } from 'framer-motion';
import { User, Scroll, Maximize, Minimize } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import { useVNAudio } from '@/components/visual_novel/hooks/useVNAudio';
import martialArtsLevels from '@/data/games/wuxia/jsons/levels.json';
import { FAME_TITLES, FATIGUE_LEVELS, REALM_ORDER, LEVEL_TO_REALM_MAP } from '@/data/games/wuxia/constants';

import { translations } from '@/data/translations';

interface WuxiaHUDProps {
    playerName: string;
    playerStats: any;
    onOpenProfile: () => void;
    onOpenWiki: () => void; // Wuxia uses Wiki often
    language?: 'ko' | 'en'; // [Localization]
    day?: number;
    time?: string;
    location?: string;
    turnCount?: number; // [NEW] For Onboarding Logic
}

export default function WuxiaHUD({ playerName, playerStats, onOpenProfile, onOpenWiki, language = 'ko', day, time, location, turnCount = 0 }: WuxiaHUDProps) {
    const { playSfx } = useVNAudio();

    if (!playerStats) return null;



    const t = translations[language].wuxia;

    // Resolve Rank Name
    const rankKey = playerStats.playerRank || '삼류';
    const hierarchy = martialArtsLevels as any;
    const rankData = hierarchy[rankKey] || hierarchy[rankKey.toLowerCase()];
    const displayRankCore = (rankData?.name || rankKey).split('(')[0];

    // [Bottleneck Logic]
    const currentRankIdx = REALM_ORDER.indexOf(rankKey);
    let bottleneckSuffix = "";
    let bottleneckColor = "text-amber-500"; // Default

    if (currentRankIdx !== -1 && currentRankIdx < REALM_ORDER.length - 1) {
        const currentLevelMap = LEVEL_TO_REALM_MAP[currentRankIdx];
        const maxLevel = currentLevelMap?.max || 999;

        const nextRankName = REALM_ORDER[currentRankIdx + 1];
        const nextRankConfig = (hierarchy as any)[nextRankName];
        const nextReq = nextRankConfig?.조건?.최소_내공 ?? 999;

        const currentLevel = playerStats.level || 1;
        const currentNeigong = playerStats.neigong || 0;

        // 1. Neigong Bottleneck: Level Maxed, Neigong Low
        if (currentLevel >= maxLevel && currentNeigong < nextReq) {
            bottleneckSuffix = " (내공 부족)";
            bottleneckColor = "text-red-400";
        }
        // 2. Experience Bottleneck: Neigong Capped (Ready), Level Low
        else if (currentNeigong >= nextReq && currentLevel < maxLevel) {
            bottleneckSuffix = " (경험 부족)";
            bottleneckColor = "text-blue-400";
        }
    }

    // Fame Title Logic
    const fame = playerStats.fame || 0;
    let titleObj = FAME_TITLES[0];
    for (let i = FAME_TITLES.length - 1; i >= 0; i--) {
        if (fame >= FAME_TITLES[i].threshold) {
            titleObj = FAME_TITLES[i];
            break;
        }
    }

    // Localize Fame Title
    const localizedTitle = (titleObj.id && t.fame && (t.fame as any)[titleObj.id]) ? (t.fame as any)[titleObj.id] : 'Unknown';

    // Colors based on Realm (Optional polish)
    const isHighRank = ['절정', '초절정', '화경', '현경'].includes(rankKey);
    const auraColor = isHighRank ? "shadow-[0_0_15px_rgba(234,179,8,0.6)] border-yellow-500/50" : "border-stone-600/50";

    // Check if time string already includes the day info (e.g. "3일차 ...")
    const timeStr = time || '';
    const hasDayInTime = timeStr.includes('일차');

    return (
        <div className="absolute inset-0 z-50 flex justify-between items-start p-4 pointer-events-none font-serif">
            {/* Profile Background Brush */}
            <div className="absolute -top-20 -left-10 w-[min(600px,90vw)] h-[min(300px,45vw)] pointer-events-none select-none z-0 opacity-90">
                <img
                    src="/assets/wuxia/interface/UI_ProfileBG.png"
                    className="w-full h-full object-contain"
                    alt=""
                />
            </div>



            {/* LEFT SIDE: Player Stats */}
            <div className="relative flex items-start gap-4 pointer-events-auto z-10">
                {/* Wuxia Frame (Stone/Gold Texture) */}
                <div
                    className="relative group cursor-pointer mt-3"
                    onClick={(e) => {
                        e.stopPropagation();
                        playSfx('ui_click');
                        onOpenProfile();
                    }}
                    onMouseEnter={() => playSfx('ui_hover')}
                >
                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-lg transform rotate-45 overflow-hidden border-2 bg-stone-900/80 backdrop-blur-md shadow-2xl transition-all group-hover:scale-105 ${auraColor} flex items-center justify-center`}>
                        {/* Counter-rotate content to be straight */}
                        <div className="transform -rotate-45 w-full h-full flex items-center justify-center">
                            <span className="text-3xl filter grayscale opacity-50">🥋</span>
                        </div>
                    </div>
                    {/* Realm Badge */}
                    <div className="absolute bottom-0 right-0 translate-y-2 translate-x-2 bg-stone-800 px-3 py-1 border border-amber-700 shadow-lg flex items-center gap-1 min-w-max" style={{ clipPath: 'polygon(5% 0, 100% 0, 100% 100%, 0% 100%)' }}>
                        <span className="text-amber-500 text-xs md:text-sm font-bold">{displayRankCore}</span>
                        {bottleneckSuffix && (
                            <span className={`text-[10px] md:text-xs font-bold ${bottleneckColor} animate-pulse`}>
                                {bottleneckSuffix}
                            </span>
                        )}
                    </div>
                </div>

                {/* Info Block */}
                <div className="flex flex-col justify-start pt-2 ml-4">
                    {/* Name & Title */}
                    <div className="flex items-baseline gap-3">
                        <span className="text-[clamp(18px,5vw,30px)] font-bold text-transparent bg-clip-text bg-gradient-to-b from-stone-200 via-amber-100 to-yellow-700 drop-shadow-md tracking-widest leading-none">
                            {playerName || '무명협객'}
                        </span>
                        <span className="text-sm md:text-base text-zinc-500 font-bold tracking-wide">
                            {localizedTitle}
                        </span>
                    </div>

                    {/* Faction & Neigong */}
                    {/* Faction & Neigong */}
                    <div className="flex items-center gap-2 text-xs md:text-sm text-zinc-400 font-medium tracking-wide mt-1">
                        <span>{(playerStats.faction || '무소속').split(' ')[0]}</span>
                        <span className="text-zinc-700">|</span>
                        <span className="text-amber-200/80 flex items-center gap-1">
                            <span className="hidden md:inline">내공</span>
                            <span className="md:hidden">⚡</span>
                            {(playerStats.neigong || 0).toLocaleString()}
                            <span className="hidden md:inline">년</span>
                        </span>
                        <span className="text-zinc-700">|</span>
                        <span className="text-yellow-500 flex items-center gap-1">
                            <span className="hidden md:inline">💰</span>
                            <span className="md:hidden">🪙</span>
                            {(playerStats.gold || 0).toLocaleString()}
                            <span className="hidden md:inline">냥</span>
                        </span>
                    </div>

                    {/* HP & MP (Qi) */}
                    <div className="flex flex-col gap-1 mt-2">
                        {/* HP (Red/Dark) */}
                        <div className="w-[min(12rem,40vw)] md:w-64 h-2.5 bg-black/60 border border-stone-800 relative">
                            <div className="absolute inset-0 bg-red-900/20" />
                            <motion.div
                                className="h-full bg-gradient-to-r from-red-900 via-red-700 to-red-600"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (playerStats.hp / playerStats.maxHp) * 100)}%` }}
                            />
                        </div>

                        {/* MP/Qi */}
                        <div className="flex items-center gap-1 mt-1">
                            {Array.from({ length: 10 }).map((_, i) => {
                                const currentMpPerc = (playerStats.mp / playerStats.maxMp) * 100;
                                const isActive = currentMpPerc >= (i + 1) * 10 - 5;
                                return (
                                    <div
                                        key={i}
                                        className={`w-2 h-2 rounded-full transition-all ${isActive ? 'bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]' : 'bg-stone-800'}`}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Active Injuries (Wuxia Style) */}
                    {playerStats.active_injuries && playerStats.active_injuries.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {playerStats.active_injuries.map((injury: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-red-900/30 border border-red-800/50 rounded-sm">
                                    <span className="text-red-400 text-xs font-bold font-serif tracking-tight">🩸 {injury}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT SIDE: Time & Location & Controls Placeholder */}
            {/* Note: Standard Controls (Wiki, etc) are in VisualNovelUI independently. 
                We just place the Time/Location here. 
                We add 'mt-14' or similar to avoid overlapping the top-right buttons if they are absolute.
                VisualNovelUI has buttons at 'top-4 right-4'. 
                We should probably stack BELOW them or to the LEFT of them.
                Actually, simpler to just put them in the top-right flow.
            */}
            <div className="relative z-10 flex flex-col items-end gap-2 pointer-events-auto mt-12 mr-2">
                {/* [NEW] System Controls Row (Fullscreen) REMOVED - Moved to Left Side */}
                <div className="flex items-center gap-2 mb-1">
                    {/* Placeholder or Empty if needed, or remove entire block */}
                </div>
                {/* Time & Location (Wuxia Style - Right Aligned) */}
                <div className="flex flex-col items-end gap-1">
                    <div className="px-3 py-1 bg-stone-900/90 border-y-2 border-stone-700 text-stone-200 text-xs md:text-sm md:text-base font-serif tracking-widest shadow-2xl flex items-center gap-2 md:gap-3">
                        {!hasDayInTime && (
                            <>
                                <span>{day || 1}일차</span>
                                <span className="text-stone-600">|</span>
                            </>
                        )}
                        <span>{timeStr || '오전'}</span>
                    </div>
                    {location && (
                        <div className="px-2 py-0.5 md:px-3 md:py-1 bg-stone-800/80 border border-stone-600 rounded-sm text-stone-300 text-[10px] md:text-sm font-serif tracking-widest shadow-lg flex items-center gap-2">
                            <span>{(location || '').replace('공용_', '').replace('강호_', '').replace(/_/g, ' ')}</span>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
