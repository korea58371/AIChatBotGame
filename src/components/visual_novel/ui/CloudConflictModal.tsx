import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVNAudio } from '../hooks/useVNAudio';

interface CloudConflictModalProps {
    isOpen: boolean;
    cloudTurn: number;
    localTurn: number;
    cloudTime: string;
    onResolve: (useCloud: boolean) => void;
}

export const CloudConflictModal: React.FC<CloudConflictModalProps> = ({
    isOpen,
    cloudTurn,
    localTurn,
    cloudTime,
    onResolve
}) => {
    // [Fix] Hook for SFX
    const { playSfx } = useVNAudio();

    if (!isOpen) return null;

    const dateStr = new Date(cloudTime).toLocaleString();

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-[90%] max-w-md bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-2xl"
                >
                    <h2 className="text-xl font-bold text-red-400 mb-4 whitespace-pre-wrap">
                        ⚠️ 데이터 충돌 (Data Conflict)
                    </h2>

                    <p className="text-gray-300 mb-6 text-sm leading-relaxed">
                        클라우드에 더 최신 기록이 발견되었습니다.<br />
                        어느 데이터를 사용하시겠습니까?
                    </p>

                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between items-center p-3 bg-zinc-800 rounded border border-zinc-600">
                            <span className="text-gray-400 text-sm">현재 기기 (Local)</span>
                            <span className="text-white font-mono">Turn {localTurn}</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-blue-900/30 rounded border border-blue-500/50">
                            <div className="flex flex-col">
                                <span className="text-blue-300 text-sm font-bold">클라우드 (Cloud)</span>
                                <span className="text-blue-400/70 text-xs">{dateStr}</span>
                            </div>
                            <span className="text-white font-mono text-lg font-bold">Turn {cloudTurn}</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => { playSfx('ui_click'); onResolve(false); }}
                            onMouseEnter={() => playSfx('ui_hover')}
                            className="flex-1 py-3 px-4 bg-zinc-700 hover:bg-zinc-600 text-gray-200 rounded-lg text-sm transition-colors"
                        >
                            기기 데이터 유지<br />
                            <span className="text-xs opacity-50">(클라우드 덮어쓰기)</span>
                        </button>
                        <button
                            onClick={() => { playSfx('ui_confirm'); onResolve(true); }}
                            onMouseEnter={() => playSfx('ui_hover')}
                            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/50"
                        >
                            클라우드 불러오기<br />
                            <span className="text-xs opacity-70">(최신 기록 복구)</span>
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
