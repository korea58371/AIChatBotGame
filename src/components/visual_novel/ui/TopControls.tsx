'use client';

import React from 'react';
import { Home, Settings, Bolt, Maximize, Minimize } from 'lucide-react';

interface TopControlsProps {
    userCoins: number;
    isFullscreen: boolean;
    isLocalhost: boolean;
    isDebugOpen: boolean;
    t: any;
    onOpenStore: () => void;
    onGoHome: () => void;
    onOpenSettings: () => void;
    onToggleDebug: () => void;
    onToggleFullscreen: () => void;
    playSfx: (type: string) => void;
}

const TopControls = React.memo(function TopControls({
    userCoins,
    isFullscreen,
    isLocalhost,
    isDebugOpen,
    t,
    onOpenStore,
    onGoHome,
    onOpenSettings,
    onToggleDebug,
    onToggleFullscreen,
    playSfx,
}: TopControlsProps) {
    return (
        <>
            {/* Top-Right Controls */}
            <div className="absolute top-4 right-4 z-[60] flex items-center gap-3 pointer-events-auto">
                {/* Token Display */}
                <div
                    onClick={(e) => { e.stopPropagation(); onOpenStore(); }}
                    className="bg-black/60 hover:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-500/30 flex items-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95 group"
                >
                    <span className="text-lg group-hover:scale-110 transition-transform">🪙</span>
                    <span className="text-yellow-400 font-bold font-mono text-sm md:text-base">
                        {userCoins?.toLocaleString() || 0}
                    </span>
                    <button className="bg-yellow-600 group-hover:bg-yellow-500 text-black text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded ml-1 transition-colors">
                        +
                    </button>
                </div>

                {/* Home Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        playSfx('ui_click');
                        onGoHome();
                    }}
                    className="p-2 bg-black/60 hover:bg-gray-800/80 rounded-full border border-gray-600 text-gray-300 hover:text-white transition-all shadow-lg"
                    title="홈으로"
                >
                    <Home className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                {/* Settings Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
                    className="p-2 bg-black/60 hover:bg-gray-800/80 rounded-full border border-gray-600 text-gray-300 hover:text-white transition-all shadow-lg"
                    title={(t as any).settings || "Settings"}
                >
                    <Settings className="w-5 h-5 md:w-6 md:h-6" />
                </button>
            </div>

            {/* Debug Button (Middle Left) */}
            {(isLocalhost || isDebugOpen) && (
                <div className="absolute top-1/2 left-4 -translate-y-1/2 z-[100] pointer-events-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleDebug(); }}
                        className="p-2 bg-purple-900/60 hover:bg-purple-800/80 rounded-full border border-purple-500/50 text-purple-300 hover:text-white transition-all shadow-lg backdrop-blur-sm"
                        title="Debug Menu"
                    >
                        <Bolt className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>
            )}

            {/* Fullscreen Button (Bottom Left) */}
            <div className="absolute bottom-4 left-4 z-[90] pointer-events-auto">
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }}
                    className={`p-2 rounded-lg border transition-all shadow-lg backdrop-blur-sm ${isFullscreen ? 'bg-yellow-900/40 border-yellow-500/50 text-yellow-500' : 'bg-black/60 border-white/20 text-gray-400 hover:text-white hover:border-white/50'}`}
                    title={isFullscreen ? "전체화면 종료" : "전체화면"}
                >
                    {isFullscreen ? <Minimize className="w-5 h-5 md:w-6 md:h-6" /> : <Maximize className="w-5 h-5 md:w-6 md:h-6" />}
                </button>
            </div>
        </>
    );
});

export default TopControls;
