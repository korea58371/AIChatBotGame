'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InputModalProps {
    isOpen: boolean;
    userInput: string;
    fateUsage: number;
    playerFate: number;
    costPerTurn: number;
    isProcessing: boolean;
    isLogicPending: boolean;
    t: any;
    onClose: () => void;
    onSetUserInput: (val: string) => void;
    onSetFateUsage: (val: number) => void;
    onSubmit: () => void;
    playSfx: (type: string) => void;
}

const InputModal = React.memo(function InputModal({
    isOpen,
    userInput,
    fateUsage,
    playerFate,
    costPerTurn,
    isProcessing,
    isLogicPending,
    t,
    onClose,
    onSetUserInput,
    onSetFateUsage,
    onSubmit,
    playSfx,
}: InputModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-gray-900 p-6 rounded-xl w-full max-w-lg border border-green-500 shadow-2xl"
                    >
                        <h2 className="text-xl font-bold text-green-400 mb-4">{t.yourAction}</h2>

                        {/* Fate Intervention UI */}
                        <div className="flex items-center gap-4 mb-4 bg-black/40 p-3 rounded-lg border border-yellow-500/30">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-yellow-400 font-bold text-sm">운명 개입 (Fate)</span>
                                    <span className="text-xs bg-yellow-900/50 text-yellow-200 px-2 py-0.5 rounded-full border border-yellow-500/30">
                                        보유: {playerFate || 0}
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
                                    const canAfford = (playerFate || 0) >= cost;
                                    return (
                                        <button
                                            key={val}
                                            onClick={() => {
                                                playSfx('ui_click');
                                                onSetFateUsage(val);
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
                                })}
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
                            onChange={(e) => onSetUserInput(e.target.value.slice(0, 256))}
                            className="w-full h-32 bg-black/50 border border-gray-700 rounded p-4 text-white text-lg mb-4 focus:outline-none focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder={t.placeholderAction}
                            disabled={isProcessing || isLogicPending}
                            onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) {
                                    e.preventDefault();
                                    if (!isProcessing && !isLogicPending) onSubmit();
                                }
                            }}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { if (!isProcessing && !isLogicPending) onClose(); }}
                                className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50"
                                disabled={isProcessing || isLogicPending}
                            >
                                {t.cancel}
                            </button>
                            <button
                                onClick={() => {
                                    playSfx('ui_confirm');
                                    onSubmit();
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
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
});

export default InputModal;
