'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { resolveBackground } from '@/lib/engine/background-manager';

function resolveEventCG(tag: string): string {
    const state = useGameStore.getState();
    const activeGameId = state.activeGameId;
    const cgMap = state.cgMap || {};

    // [Fix] Runtime Sanitization (Handle cached bad data)
    // If the store has "Key</CG>", strip it here too.
    const cleanTag = tag.replace(/<\/[^>]+>/g, '').trim();

    console.log(`[EventCG] Resolving Tag: "${cleanTag}" (Raw: "${tag}")`, { cgMapParams: Object.keys(cgMap).length });

    // 1. Check CG Map (Specific EventCG folder)
    if (cgMap[cleanTag]) {
        const filename = cgMap[cleanTag];
        // Use encodeURI to handle Korean/Spaces safely
        const path = encodeURI(`/assets/${activeGameId}/EventCG/${filename}`);
        console.log(`[EventCG] Mapped to: ${path}`);
        return path;
    }

    // 2. Fallback to Background Manager (Legacy/Shared Folder)
    const fallback = resolveBackground(cleanTag);
    console.log(`[EventCG] Fallback to: ${fallback}`);
    return fallback;
}

export default function EventCGLayer() {
    const currentCG = useGameStore(state => state.currentCG);
    // Resolve path immediately to check validity
    const resolvedPath = currentCG ? resolveEventCG(currentCG) : '';

    return (
        <AnimatePresence>
            {currentCG && (
                <motion.div
                    key={currentCG} // Key change triggers re-animation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.0 }} // Slow dramatic fade
                    className="absolute inset-0 z-[50] pointer-events-none"
                // z-[50] to Debug Visibility
                >
                    {/* Dark Backdrop to hide layers below (optional, but safer) */}
                    <div className="absolute inset-0 bg-black" />

                    {/* The CG Image - Only render if path exists */}
                    {resolvedPath && (
                        <img
                            src={resolvedPath}
                            alt="Event CG"
                            className="absolute inset-0 w-full h-full object-cover z-10"
                            onLoad={() => console.log(`[EventCG] Image Loaded Successfully: ${resolvedPath}`)}
                            onError={(e) => {
                                console.error(`[EventCG] Failed to load image: ${resolvedPath}`);
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
