import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import { parseScript, ScriptSegment } from '@/lib/script-parser';
import { resolveBackground } from '@/lib/background-manager';

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
}

const HistoryModal: React.FC<HistoryModalProps> = ({
    isOpen,
    onClose,
    chatHistory,
    t,
    setCurrentSegment,
    setScriptQueue,
    setBackground
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

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
                    <div className="bg-gray-900 w-full max-w-4xl h-[80vh] rounded-xl flex flex-col border border-gray-600">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">{t.chatHistory}</h2>
                            <button onClick={onClose} className="text-gray-400 hover:text-white">{t.close}</button>
                        </div>
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {(useGameStore.getState().displayHistory || chatHistory).map((msg, idx, arr) => {
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
                                        <span className="text-sm text-gray-500 mb-2 font-bold">{msg.role === 'user' ? t.you : t.system}</span>
                                        <div className={`rounded-xl max-w-[95%] overflow-hidden ${msg.role === 'user' ? 'bg-blue-900/30 border border-blue-500/50' : 'bg-gray-800/50 border border-gray-700'}`}>
                                            {msg.role === 'user' ? (
                                                <div className="p-4 text-blue-100 text-lg">{msg.text}</div>
                                            ) : (
                                                <div className="flex flex-col divide-y divide-gray-700/50">
                                                    {segments.map((seg, sIdx) => {
                                                        // Hide non-display types from history view
                                                        if (['background', 'bgm', 'command', 'choice'].includes(seg.type)) return null;

                                                        return (
                                                            <div key={sIdx} className="p-4 relative group">
                                                                {canRewind && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (confirm("이 시점으로 되돌아가시겠습니까? (이후 진행 상황은 유실됩니다)")) {
                                                                                // [Fix] Restore Snapshot if available
                                                                                if (msg.snapshot) {
                                                                                    console.log("Restoring snapshot...", msg.snapshot);
                                                                                    useGameStore.setState(msg.snapshot);
                                                                                    // Force a re-render of local UI states if needed? 
                                                                                    // Store updates should trigger re-renders.
                                                                                    // One exception: local `currentBgm` state in VisualNovelUI might need sync if we want perfection,
                                                                                    // but store doesn't track BGM path directly (it tracks mood).
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

                                                                                // 4. Truncate History (Optional but recommended for consistency)
                                                                                // If we rewind, we usually want to "forget" the future.
                                                                                // But the existing logic didn't truncate. 
                                                                                // The prompt implies "replay then...".
                                                                                // If we don't truncate, the user has "future" messages in history that are now invalid vs state.
                                                                                // Standardization: Let's truncate history to this point.
                                                                                const currentHistory = useGameStore.getState().chatHistory;
                                                                                // idx is the index in the *displayed* array.
                                                                                // If displayHistory might differ, we need to be careful.
                                                                                // Assuming displayHistory === chatHistory for now or strict mapping.
                                                                                // We will truncate to idx + 1 (keep this message).
                                                                                // Actually, let's keep it safe and just restore state. 
                                                                                // Truncating might be aggressive if user just wants to re-read.
                                                                                // But "Rewind" implies going back.

                                                                                // For now, only state restoration was requested to fix validation.

                                                                                onClose();
                                                                            }
                                                                        }}
                                                                        className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-yellow-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
                                                                        title="이 대사부터 다시 보기 (Rewind)"
                                                                    >
                                                                        <RotateCcw size={14} />
                                                                    </button>
                                                                )}

                                                                {seg.type === 'dialogue' && (
                                                                    <div className="mb-1 flex items-center gap-2">
                                                                        <span className="text-yellow-500 font-bold text-lg">
                                                                            {(seg.character || 'Unknown').split('(')[0].trim()}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {seg.type === 'system_popup' && (
                                                                    <div className="text-purple-400 font-bold text-center border border-purple-500/30 bg-purple-900/20 p-2 rounded">
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
                            })}
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default HistoryModal;
