'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Goal {
    id: string;
    description: string;
    status: string;
    createdTurn: number;
}

interface Choice {
    type: string;
    content: string;
}

interface ChoiceOverlayProps {
    choices: Choice[];
    goals: Goal[];
    turnSummary: string | null;
    costPerTurn: number;
    isProcessing: boolean;
    isLogicPending: boolean;
    endingType: string;
    onChoiceSelect: (choice: Choice) => void;
    onDirectInput: () => void;
    playSfx: (type: string) => void;
    t: any;
}

const ChoiceOverlay = React.memo(function ChoiceOverlay({
    choices,
    goals,
    turnSummary,
    costPerTurn,
    isProcessing,
    isLogicPending,
    endingType,
    onChoiceSelect,
    onDirectInput,
    playSfx,
    t,
}: ChoiceOverlayProps) {
    // [Perf/UX] Click guard — prevent accidental choice selection from rapid text-advance clicking
    const [isClickGuarded, setIsClickGuarded] = useState(true);
    const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (choices.length > 0) {
            setIsClickGuarded(true);
            if (guardTimerRef.current) clearTimeout(guardTimerRef.current);
            guardTimerRef.current = setTimeout(() => setIsClickGuarded(false), 400); // 400ms cooldown
        }
        return () => { if (guardTimerRef.current) clearTimeout(guardTimerRef.current); };
    }, [choices]);

    if (choices.length === 0 || endingType !== 'none') return null;

    const activeGoals = (goals || [])
        .filter(g => g.status === 'ACTIVE')
        .sort((a, b) => b.createdTurn - a.createdTurn)
        .slice(0, 3);

    return (
        <>
            {/* Background Dimmer */}
            <div className="absolute inset-0 bg-black/40 z-[20] pointer-events-none transition-opacity duration-500" />

            {/* Center: Choices */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60] p-4">
                <div className="flex flex-col gap-3 md:gap-4 w-[85vw] md:w-[min(50vw,800px)] items-center pointer-events-auto">
                    {/* Active Goals Display */}
                    {activeGoals.length > 0 && (
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
                    )}

                    {/* Turn Summary */}
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

                    {/* Choice Buttons */}
                    {choices.map((choice, idx) => (
                        <motion.button
                            key={idx}
                            initial={{ opacity: 0, y: 20, skewX: -12 }}
                            animate={{ opacity: 1, y: 0, skewX: -12 }}
                            whileHover={!isProcessing ? { scale: 1.05, skewX: -12 } : {}}
                            transition={{ delay: idx * 0.1 }}
                            disabled={isProcessing || isLogicPending || isClickGuarded}
                            className={`w-full bg-gradient-to-r from-white/50 to-slate-100/70 backdrop-blur-md rounded-2xl border border-white/80 text-slate-700 font-bold 
                            w-[85vw] md:w-[min(50vw,1200px)] 
                            py-4 px-[5vw] md:py-5 md:px-[min(2vw,48px)] h-auto min-h-[60px]
                            text-[max(18px,3.5vw)] md:text-[clamp(20px,1.1vw,32px)] leading-relaxed
                            shadow-[0_0_15px_rgba(71,85,105,0.5)] transition-all duration-300
                            ${(isProcessing || isLogicPending || isClickGuarded) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-white/90 hover:text-slate-900 hover:border-white'}
                        `}
                            onClick={(e) => {
                                if (isProcessing || isLogicPending || isClickGuarded) return;
                                playSfx('ui_confirm');
                                e.stopPropagation();
                                onChoiceSelect(choice);
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
                        ${(isProcessing || isLogicPending || isClickGuarded) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-white/80 hover:border-white'}
                    `}
                        onMouseEnter={() => playSfx('ui_hover')}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isProcessing || isLogicPending || isClickGuarded) return;
                            playSfx('ui_confirm');
                            onDirectInput();
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
    );
});

export default ChoiceOverlay;
