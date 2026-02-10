import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import { parseScript, ScriptSegment } from '@/lib/utils/script-parser';
import { resolveBackground } from '@/lib/engine/background-manager';
import { useVNAudio } from '../hooks/useVNAudio';

interface Message {
    role: string;
    text: string;
}

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatHistory: Message[];
    t: any; // Translations object
    setCurrentSegment: (seg: ScriptSegment) => void;
    setScriptQueue: (queue: ScriptSegment[]) => void;
    setBackground: (bg: string) => void;
    storyLog?: any[]; // [New] Pass storyLog
}

const HistoryModal: React.FC<HistoryModalProps> = ({
    isOpen,
    onClose,
    chatHistory,
    t,
    setCurrentSegment,
    setScriptQueue,
    setBackground,
    storyLog // [New]
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = React.useState<'chat' | 'story'>('chat'); // [New] Tab State
    // [Fix] Hook for SFX
    const { playSfx } = useVNAudio();

    // Scroll to bottom when opened
    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [isOpen, chatHistory]);

    // This helper logic mimics the logic in VisualNovelUI.tsx for visibility filtering
    // to ensure the history view matches what was shown on screen.
    const isVisibleType = (type: string) =>
        ['dialogue', 'narration', 'system_popup'].includes(type);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-[#1e1e1e]/95 w-full max-w-4xl h-[80vh] rounded-xl flex flex-col border border-[#333] shadow-2xl">
                        <div className="p-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-[#252525]">
                            <div className="flex items-center gap-4">
                                <h2 className="text-2xl font-bold font-serif text-[#D4AF37] tracking-wider">◆ {t.chatHistory}</h2>
                                <div className="flex bg-black/40 rounded-lg p-1 gap-1">
                                    <button
                                        onClick={() => setActiveTab('chat')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'chat' ? 'bg-[#D4AF37] text-black' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        대화
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('story')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'story' ? 'bg-[#D4AF37] text-black' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        일지
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => { playSfx('ui_click'); onClose(); }} onMouseEnter={() => playSfx('ui_hover')} className="text-gray-400 hover:text-white text-xl">×</button>
                        </div>
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
                            {activeTab === 'story' ? (
                                <div className="space-y-4">
                                    {(storyLog || [])
                                        .map((log: any, idx) => {
                                            const segments = parseScript(log.content || "");
                                            // [Fix] Use Turn Number from Log directly
                                            const turnNumber = log.turn;

                                            // [Refactor] Using storyLog ensuring full history access
                                            return (
                                                <div key={idx} className="bg-[#252525] border border-white/5 rounded-xl p-6">
                                                    <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                                                        <span className="text-sm text-[#D4AF37] font-bold">Turn {turnNumber}</span>
                                                        <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {segments.map((seg, sIdx) => {
                                                            if (seg.type === 'dialogue') {
                                                                const name = (seg.character || 'Unknown').split('(')[0].trim();
                                                                return (
                                                                    <div key={sIdx} className="text-gray-200 text-lg leading-relaxed font-sans">
                                                                        <span className="font-bold text-[#D4AF37] mr-2">{name}:</span>
                                                                        {seg.content}
                                                                    </div>
                                                                );
                                                            } else if (seg.type === 'narration') {
                                                                return (
                                                                    <div key={sIdx} className="text-gray-500 text-lg leading-relaxed font-sans">
                                                                        {seg.content}
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    {(!storyLog || storyLog.length === 0) && (
                                        <div className="text-center text-gray-500 py-10">기록된 일지가 없습니다.</div>
                                    )}
                                </div>
                            ) : (
                                (useGameStore.getState().displayHistory || chatHistory).map((msg, idx, arr) => {
                                    let segments = parseScript(msg.text || "");

                                    // Filter future segments logic specific to the Active (Last) Message
                                    if (idx === arr.length - 1 && msg.role === 'model') {
                                        const queue = useGameStore.getState().scriptQueue;

                                        // 1. Calculate visible text length in queue
                                        const queueTextLen = queue
                                            .filter(s => isVisibleType(s.type))
                                            .reduce((sum, s) => sum + s.content.length, 0);

                                        if (queueTextLen > 0) {
                                            const newSegments = [];

                                            // 2. Calculate visible text length in history
                                            const totalHistLen = segments
                                                .filter(s => isVisibleType(s.type))
                                                .reduce((sum, s) => sum + (s.content?.length || 0), 0);

                                            const targetVisibleLen = Math.max(0, totalHistLen - queueTextLen);
                                            let currentVisible = 0;

                                            for (const seg of segments) {
                                                if (!isVisibleType(seg.type)) {
                                                    newSegments.push(seg); // Keep filtered invisible type
                                                    continue;
                                                }

                                                const segLen = seg.content?.length || 0;
                                                if (currentVisible + segLen <= targetVisibleLen) {
                                                    newSegments.push(seg);
                                                    currentVisible += segLen;
                                                } else {
                                                    const remainingAllowed = targetVisibleLen - currentVisible;
                                                    if (remainingAllowed > 0 && seg.content) {
                                                        newSegments.push({
                                                            ...seg,
                                                            content: seg.content.slice(0, remainingAllowed)
                                                        });
                                                        currentVisible += remainingAllowed;
                                                    }
                                                    break;
                                                }
                                            }
                                            segments = newSegments;
                                        }
                                    }

                                    const canRewind = idx === arr.length - 1 && msg.role === 'model';

                                    return (
                                        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <span className="text-xs text-gray-500 mb-2 font-bold font-mono uppercase tracking-wide">{msg.role === 'user' ? t.you : t.system}</span>
                                            <div className={`rounded-xl max-w-[95%] overflow-hidden ${msg.role === 'user' ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/30' : 'bg-[#252525] border border-white/5'}`}>
                                                {msg.role === 'user' ? (
                                                    <div className="p-4 text-[#D4AF37] text-lg leading-relaxed">{msg.text}</div>
                                                ) : (
                                                    <div className="flex flex-col divide-y divide-white/5">
                                                        {segments.map((seg, sIdx) => {
                                                            // Hide non-display types from history view
                                                            if (['background', 'bgm', 'command', 'choice'].includes(seg.type)) return null;

                                                            return (
                                                                <div key={sIdx} className="p-4 relative group">
                                                                    {canRewind && (
                                                                        <button
                                                                            onClick={() => {
                                                                                playSfx('ui_confirm');
                                                                                if (confirm("이 시점으로 되돌아가시겠습니까? (이후 진행 상황은 유실됩니다)")) {
                                                                                    // [Fix] Restore Snapshot if available
                                                                                    if (msg.snapshot) {
                                                                                        console.log("Restoring snapshot...", msg.snapshot);
                                                                                        useGameStore.setState(msg.snapshot);
                                                                                    }

                                                                                    // 1. Re-parse full text
                                                                                    const allSegments = parseScript(msg.text);

                                                                                    // 2. Queue Reset
                                                                                    setCurrentSegment(allSegments[sIdx]);
                                                                                    setScriptQueue(allSegments.slice(sIdx + 1));
                                                                                    useGameStore.getState().setChoices([]);

                                                                                    // 3. Background Restore (Scan backwards in this turn)
                                                                                    for (let i = 0; i <= sIdx; i++) {
                                                                                        if (allSegments[i].type === 'background') {
                                                                                            setBackground(resolveBackground(allSegments[i].content));
                                                                                        }
                                                                                    }

                                                                                    onClose();
                                                                                }
                                                                            }}
                                                                            className="absolute top-2 right-2 p-1.5 bg-[#333] hover:bg-[#D4AF37] rounded-full text-gray-400 hover:text-black opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10 border border-white/10 hover:border-[#D4AF37]"
                                                                            title="이 대사부터 다시 보기 (Rewind)"
                                                                            onMouseEnter={() => playSfx('ui_hover')}
                                                                        >
                                                                            <RotateCcw size={14} />
                                                                        </button>
                                                                    )}

                                                                    {seg.type === 'dialogue' && (
                                                                        <div className="mb-2 flex items-center gap-2">
                                                                            <span className="text-[#D4AF37] font-serif font-bold text-lg border-b border-[#D4AF37]/30 pb-0.5">
                                                                                {(seg.character || 'Unknown').split('(')[0].trim()}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {seg.type === 'system_popup' && (
                                                                        <div className="text-[#D4AF37] font-bold text-center border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-2 rounded mb-2 font-serif text-sm">
                                                                            [SYSTEM] {seg.content}
                                                                        </div>
                                                                    )}
                                                                    <div className={`text-lg leading-relaxed ${seg.type === 'narration' ? 'text-gray-400 italic' : 'text-gray-200'}`}>
                                                                        {seg.content}
                                                                    </div>
                                                                </div>

                                                            );
                                                        })}
                                                        {segments.length === 0 && (
                                                            <div className="p-4 text-gray-400 italic">
                                                                {msg.text}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default HistoryModal;
