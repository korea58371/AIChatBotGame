'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { getCharacterImage } from '@/lib/utils/image-mapper';

interface CharacterLayerProps {
    // We can pass props if needed, but subscribing to store is better for performance if we want granular updates.
    // However, for a layer, subscribing to the list of active characters is standard.
}

export default function CharacterLayer({ }: CharacterLayerProps) {
    const activeCharacters = useGameStore(state => state.activeCharacters);
    const characterData = useGameStore(state => state.characterData);
    const playerStats = useGameStore(state => state.playerStats);

    // If no characters, render nothing
    if (!activeCharacters || activeCharacters.length === 0) return null;

    return (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-end justify-center px-4 pb-0">
            <AnimatePresence>
                {activeCharacters.map((charId, index) => {
                    const char = characterData?.[charId];
                    if (!char) return null;

                    // Resolve Image
                    // Use helper we assumed exists or implement simple resolution
                    // We'll simplisticly assume character has 'image' or use a placeholder/helper
                    // In VisualNovelUI, it used 'getCharacterImage'. We can't import that if it's inside the component.
                    // We'll import 'getCharacterImage' from utils if available, or assume char.image

                    // Logic to distribute characters:
                    // 1 char: Center
                    // 2 chars: Left-Center, Right-Center
                    // 3 chars: Left, Center, Right

                    const total = activeCharacters.length;
                    let positionClass = "translate-x-0"; // Center

                    if (total === 2) {
                        positionClass = index === 0 ? "-translate-x-1/2" : "translate-x-1/2";
                    } else if (total >= 3) {
                        if (index === 0) positionClass = "-translate-x-full";
                        if (index === 1) positionClass = "translate-x-0";
                        if (index === 2) positionClass = "translate-x-full";
                    }

                    // For now, simpler flex distribution using logic often found in VNs
                    // Or just use flex-gap.

                    return (
                        <motion.div
                            key={charId}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.5 }}
                            className={`relative h-[80vh] w-auto max-w-[30vw] flex-shrink-0 transition-transform duration-500`}
                            style={{
                                // Basic positioning logic override if needed
                            }}
                        >
                            {/* 
                                We don't have getCharacterImage imported yet. 
                                We should check if it exists in a util file. 
                            */}
                            <img
                                src={char.image || `/assets/characters/${charId}.png`}
                                alt={char.name}
                                className="h-full w-auto object-contain drop-shadow-2xl"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
