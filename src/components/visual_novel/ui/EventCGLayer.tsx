'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { resolveBackground } from '@/lib/engine/background-manager';

export default function EventCGLayer() {
    const currentCG = useGameStore(state => state.currentCG);

    // If no CG is active, render nothing (AnimatePresence handles exit)
    // Actually, we put AnimatePresence inside the return for the motion div
    return (
        <AnimatePresence>
            {currentCG && (
                <motion.div
                    key={currentCG} // Key change triggers re-animation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.0 }} // Slow dramatic fade
                    className="absolute inset-0 z-[10] pointer-events-none"
                // z-[10] is above Background (0) and Character (usually low z), but below HUD/UI
                >
                    {/* Dark Backdrop to hide layers below (optional, but safer) */}
                    <div className="absolute inset-0 bg-black" />

                    {/* The CG Image */}
                    <img
                        src={resolveBackground(currentCG)} // Reuse background resolver logic
                        alt="Event CG"
                        className="w-full h-full object-cover"
                    // Optional: Add Ken Burns effect or panning here later
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
