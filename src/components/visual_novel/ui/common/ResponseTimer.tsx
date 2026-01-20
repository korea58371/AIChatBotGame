import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function ResponseTimer({ avgTime, label }: { avgTime: number, label?: string }) {
    const [progress, setProgress] = useState(0);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        // Reset whenever avgTime changes or mount
        setProgress(0);
        setElapsed(0);

        const interval = setInterval(() => {
            setElapsed(prev => {
                const newElapsed = prev + 100;
                // Calculate percentage: (elapsed / avgTime) * 100
                // Cap at 95% to allow for "finishing" jump
                // If elapsed > avgTime, we slow down the increment drastically or just cap at 98%
                let newProgress = (newElapsed / avgTime) * 100;
                if (newProgress > 95) newProgress = 95 + ((newElapsed - avgTime) / 10000); // Very slow creep after 95%
                if (newProgress > 99) newProgress = 99;

                setProgress(newProgress);
                return newElapsed;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [avgTime]);

    // Format time MM:SS
    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full mt-4 flex flex-col gap-2 min-w-[300px]">
            <div className="flex justify-between text-xs text-yellow-500 font-mono">
                <span className="animate-pulse">{label || "WARPING REALITY..."}</span>
                <span>{formatTime(elapsed)} / {formatTime(avgTime)} EST</span>
            </div>
            <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-yellow-900/50 shadow-inner relative">
                {/* Grid Background Effect */}
                <div className="absolute inset-0 bg-black opacity-20 pointer-events-none"></div>

                <motion.div
                    className="h-full bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "tween", ease: "linear", duration: 0.1 }}
                />
            </div>

        </div>
    );
}
