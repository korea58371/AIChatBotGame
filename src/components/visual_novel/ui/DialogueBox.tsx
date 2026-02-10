'use client';

import React, { useMemo } from 'react';
import { useGameStore } from '@/lib/store';
import { formatText } from '@/lib/utils/text-formatter';
import { useShallow } from 'zustand/react/shallow';

interface DialogueBoxProps {
    onClick: (e: React.MouseEvent) => void;
}

export default function DialogueBox({ onClick }: DialogueBoxProps) {
    // Granular Selectors to prevent unnecessary re-renders
    const currentSegmentType = useGameStore(state => state.currentSegment?.type);
    const currentSegmentContent = useGameStore(state => state.currentSegment?.content);
    const currentSegmentCharacter = useGameStore(state => state.currentSegment?.character);

    // Character Data Selectors
    const playerName = useGameStore(state => state.playerName);
    const characterData = useGameStore(state => state.characterData);

    // Derived Name Logic (MUST be before early return to satisfy React Hook rules)
    const displayName = useMemo(() => {
        if (!currentSegmentCharacter) return '';

        // Handle Protagonist Name
        if (currentSegmentCharacter === '주인공') {
            return playerName;
        }

        const charList = Array.isArray(characterData) ? characterData : Object.values(characterData || {});
        const found = charList.find((c: any) => c.englishName === currentSegmentCharacter || c.name === currentSegmentCharacter || c.id === currentSegmentCharacter);
        if (found) return found.name;
        return currentSegmentCharacter.split('_')[0];
    }, [currentSegmentCharacter, playerName, characterData]);

    // Only render if valid type
    const isValidType = currentSegmentType && !['system_popup', 'text_message', 'phone_call', 'tv_news', 'article', 'time_skip'].includes(currentSegmentType);

    if (!isValidType) return null;

    return (
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 pb-32 md:pb-12 flex justify-center items-end z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent min-h-[40vh] md:h-[min(30vh,600px)]">
            <div className="w-full max-w-screen-2xl pointer-events-auto relative">
                {/* Dialogue Control Bar */}
                <div
                    className="w-full relative flex flex-col items-center cursor-pointer"
                    onClick={onClick}
                >
                    {/* Name Tag */}
                    {currentSegmentType === 'dialogue' && (
                        <div className="absolute -top-[3vh] md:-top-[6vh] w-full text-center px-2">
                            <span className="text-[max(16px,4.5vw)] md:text-[clamp(20px,1.4vw,47px)] font-bold text-yellow-500 tracking-wide drop-shadow-md">
                                {displayName}
                            </span>
                        </div>
                    )}

                    {/* Text Content */}
                    <div className="text-[max(16px,3.7vw)] md:text-[clamp(18px,1.3vw,39px)] leading-relaxed text-gray-100 min-h-[10vh] whitespace-pre-wrap text-center w-full drop-shadow-sm px-[4vw] md:px-0">
                        {currentSegmentType === 'narration' ? (
                            <span className="text-gray-300 italic block">
                                {formatText(currentSegmentContent || '')}
                            </span>
                        ) : (
                            <span>
                                {formatText(currentSegmentContent || '')}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
