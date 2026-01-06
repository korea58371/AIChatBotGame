import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function AdButton({ onReward }: { onReward: () => void }) {
    const [status, setStatus] = useState<'idle' | 'playing' | 'rewarded'>('idle');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let interval: any;
        if (status === 'playing') {
            interval = setInterval(() => {
                setProgress(prev => {
                    const next = prev + 10;
                    return next > 100 ? 100 : next;
                });
            }, 500);
        }
        return () => clearInterval(interval);
    }, [status]);

    useEffect(() => {
        if (status === 'playing' && progress >= 100) {
            setStatus('rewarded');
            onReward();
        }
    }, [progress, status, onReward]);

    if (status === 'rewarded') {
        return (
            <button disabled className="w-full py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-gray-400 font-bold cursor-not-allowed flex items-center justify-center gap-2">
                <span className="text-green-500">✓</span> 보상 지급 완료
            </button>
        );
    }

    if (status === 'playing') {
        return (
            <div className="w-full bg-gray-800 rounded-xl border border-yellow-500/50 p-4 relative overflow-hidden">
                <div className="flex justify-between items-center mb-2 z-10 relative">
                    <span className="text-yellow-500 font-bold text-sm animate-pulse">광고 시청 중...</span>
                    <span className="text-white text-xs">{Math.floor(progress)}%</span>
                </div>
                {/* Progress Bar Background */}
                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden z-10 relative">
                    <motion.div
                        className="h-full bg-yellow-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                    />
                </div>
                {/* Fake Ad Content (Overlay) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <span className="text-4xl">📺</span>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={() => setStatus('playing')}
            className="w-full py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-xl border border-yellow-400 text-white font-bold shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-2"
        >
            <span>📺</span> 광고 보고 50 골드 받기
        </button>
    );
}
