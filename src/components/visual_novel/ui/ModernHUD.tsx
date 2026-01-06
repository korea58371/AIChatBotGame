import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Battery, User } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import { LEVEL_TO_RANK_MAP } from '@/data/games/god_bless_you/constants';

// [Localization]
interface ModernHUDProps {
    playerName: string;
    playerStats: any;
    onOpenPhone: () => void;
    onOpenProfile: () => void;
    day?: number;
    time?: string;
    location?: string;
}

export default function ModernHUD({ playerName, playerStats, onOpenPhone, onOpenProfile, day, time, location }: ModernHUDProps) {
    if (!playerStats) return null;

    // Calculate Rank based on Level (Modern)
    // Calculate Rank based on Level (Modern)
    const currentLevel = playerStats.level || 1;
    let rankTitle = '일반인';
    // Find rank title from map (Array-based)
    const foundRank = LEVEL_TO_RANK_MAP.find(r => currentLevel >= r.min && currentLevel <= r.max);
    if (foundRank) {
        rankTitle = foundRank.title;
    } else if (currentLevel >= 100) {
        rankTitle = 'SS-Rank'; // Fallback for high levels
    }


    // Clean Time String
    const timeStr = time || '';
    const dayPrefix = `${day}일차`; // Modern mode might use English "Day X", but store seems to be uniform? 
    // Wait, Modern mode might check language. 
    // Assuming uniform logic for now:
    const displayTime = timeStr.replace(new RegExp(`${day}일차\\s*`), '').trim() || timeStr;

    return (
        <div className="absolute inset-0 z-50 flex justify-between items-start p-4 pointer-events-none">
            {/* LEFT SIDE: Player Stats */}
            <div className="flex items-start gap-4 pointer-events-auto mt-3">
                {/* Avatar Frame (Modern Style - Circular/Glass) */}
                <div
                    className="relative group cursor-pointer"
                    onClick={onOpenProfile}
                >
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-white/30 bg-black/40 backdrop-blur-md overflow-hidden shadow-xl transition-transform transform group-hover:scale-105">
                        {/* Placeholder Avatar or Character Image */}
                        <div className="w-full h-full flex items-center justify-center text-white/50">
                            <User size={32} />
                        </div>
                    </div>
                    {/* Level Badge */}
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-blue-400 shadow-md">
                        Lv.{currentLevel}
                    </div>
                </div>

                {/* Info Block */}
                <div className="flex flex-col gap-1 pt-1">
                    {/* Name & Title */}
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl md:text-2xl font-bold text-white drop-shadow-md tracking-wide">
                            {playerName || '플레이어'}
                        </span>
                        <span className="text-xs md:text-sm text-blue-300 font-medium bg-blue-900/40 px-2 py-0.5 rounded backdrop-blur-sm border border-blue-500/30">
                            {rankTitle}
                        </span>
                    </div>

                    {/* Bars - Modern Slim Style */}
                    <div className="flex flex-col gap-1.5 w-40 md:w-56">
                        {/* HP Bar */}
                        <div className="h-2 bg-gray-900/60 rounded-full overflow-hidden border border-gray-700/50">
                            <motion.div
                                className="h-full bg-gradient-to-r from-red-500 to-rose-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (playerStats.hp / playerStats.maxHp) * 100)}%` }}
                            />
                        </div>
                        {/* MP Bar (Mental) */}
                        <div className="h-2 bg-gray-900/60 rounded-full overflow-hidden border border-gray-700/50">
                            <motion.div
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (playerStats.mp / playerStats.maxMp) * 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 mt-1">
                        <button
                            onClick={onOpenPhone}
                            className="p-1.5 bg-black/40 hover:bg-black/60 rounded-lg text-white/80 hover:text-white border border-white/10 transition-colors"
                            title="스마트폰"
                        >
                            <Smartphone size={16} />
                        </button>
                        {/* Battery/Stamina Icon */}
                        <div className="flex items-center gap-1 text-xs text-gray-300 bg-black/30 px-2 rounded-lg border border-white/10">
                            <Battery size={14} className="text-green-400" />
                            <span>{100 - (playerStats.fatigue || 0)}%</span>
                        </div>
                        {/* Money */}
                        <div className="flex items-center gap-1 text-xs text-yellow-300 bg-black/30 px-2 rounded-lg border border-white/10">
                            <span>₩</span>
                            <span>{(playerStats.gold || 0).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Active Injuries (Modern Style) */}
                    {playerStats.active_injuries && playerStats.active_injuries.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {playerStats.active_injuries.map((injury: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded-full animate-pulse">
                                    <span className="text-red-300 text-[10px] font-bold tracking-wide">⚠ {injury}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT SIDE: Time & Location */}
            <div className="flex flex-col items-end gap-2 pointer-events-auto mt-12 mr-2">
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-black/80 rounded-full backdrop-blur-md border border-white/20 text-xs md:text-sm text-blue-100 shadow-xl">
                        <span>Day {day || 1}</span>
                        <span className="text-white/30">|</span>
                        <span>{displayTime || '12:00'}</span>
                    </div>
                    {location && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-black/60 rounded-full backdrop-blur-sm border border-white/10 text-[10px] md:text-xs text-blue-200">
                            <span>{location}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
