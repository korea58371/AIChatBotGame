'use client';

import React from 'react';
import { History, Save, Book } from 'lucide-react';

interface BottomControlsProps {
    choices: any[];
    t: any;
    onOpenInput: () => void;
    onOpenHistory: () => void;
    onOpenSaveLoad: () => void;
    onOpenWiki: () => void;
}

const BottomControls = React.memo(function BottomControls({
    choices,
    t,
    onOpenInput,
    onOpenHistory,
    onOpenSaveLoad,
    onOpenWiki,
}: BottomControlsProps) {
    return (
        <div className={`absolute bottom-[5vh] right-[4vw] md:bottom-10 md:right-8 flex gap-[1vw] md:gap-2 z-[100] transition-opacity pointer-events-auto ${choices.length > 0 ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}>
            {/* Intervention / Mid-Turn Direct Input */}
            <button
                className="px-3 py-2 md:px-3 md:py-1.5 bg-green-800/60 hover:bg-green-700/80 rounded border border-green-600 text-green-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-1"
                onClick={(e) => { e.stopPropagation(); onOpenInput(); }}
                title="이야기에 개입하기"
            >
                <span className="text-lg md:text-lg">⚡</span>
                <span className="hidden md:inline">개입</span>
            </button>

            <button
                className="px-3 py-2 md:px-3 md:py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-1"
                onClick={(e) => { e.stopPropagation(); onOpenHistory(); }}
                title={t.chatHistory}
            >
                <History className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden md:inline">{t.chatHistory}</span>
            </button>
            <button
                className="px-3 py-2 md:px-3 md:py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-1"
                onClick={(e) => { e.stopPropagation(); onOpenSaveLoad(); }}
                title={t.save}
            >
                <Save className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden md:inline">{t.save}</span>
            </button>
            <button
                className="px-3 py-2 md:px-3 md:py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded border border-gray-600 text-gray-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md flex items-center gap-1"
                onClick={(e) => { e.stopPropagation(); onOpenWiki(); }}
                title={(t as any).wiki || "Wiki"}
            >
                <Book className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden md:inline">{(t as any).wiki || "Wiki"}</span>
            </button>
        </div>
    );
});

export default BottomControls;
