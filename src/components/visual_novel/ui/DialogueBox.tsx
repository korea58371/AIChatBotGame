'use client';

import React, { useMemo } from 'react';
import { useGameStore } from '@/lib/store';
import { formatText } from '@/lib/utils/text-formatter';
import { useShallow } from 'zustand/react/shallow';

interface DialogueBoxProps {
    onClick: (e: React.MouseEvent) => void;
}

const DialogueBox = React.memo(function DialogueBox({ onClick }: DialogueBoxProps) {
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
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent h-[38vh] md:h-[min(30vh,600px)] flex flex-col justify-end pointer-events-none">
            <div
                className="w-full max-w-screen-2xl mx-auto pointer-events-auto cursor-pointer flex flex-col items-center px-4 md:px-8 pb-28 md:pb-30"
                onClick={onClick}
            >
                {/* Name Tag - Fixed position within flex layout, does not shift with text length */}
                {currentSegmentType === 'dialogue' && (
                    <div className="w-full text-center mb-2 md:mb-3 shrink-0">
                        <span className="text-[clamp(16px,2.5vw+8px,36px)] font-bold text-yellow-500 tracking-wide drop-shadow-md">
                            {displayName}
                        </span>
                    </div>
                )}

                {/* Text Content */}
                <div className="text-[clamp(14px,2vw+6px,30px)] leading-relaxed text-gray-100 whitespace-pre-wrap text-center w-full drop-shadow-sm px-[2vw] md:px-0">
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
    );
});

export default DialogueBox;
