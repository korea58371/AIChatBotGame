import React, { useState, useEffect } from 'react';
import { useGameStore, TurnDebugLog } from '@/lib/store';
import { parseScript } from '@/lib/utils/script-parser';
import { X, Play, Database, BookOpen, Terminal, FileJson, Copy, Check } from 'lucide-react';

interface DebugPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DebugPopup({ isOpen, onClose }: DebugPopupProps) {
    const chatHistory = useGameStore(state => state.chatHistory);
    const scriptQueue = useGameStore(state => state.scriptQueue);
    const setScriptQueue = useGameStore(state => state.setScriptQueue);
    const playerStats = useGameStore(state => state.playerStats);
    const activeCharacters = useGameStore(state => state.activeCharacters);
    const currentLocation = useGameStore(state => state.currentLocation);
    const inventory = useGameStore(state => state.inventory);
    const scenarioMemory = useGameStore(state => state.scenarioMemory);
    const userCoins = useGameStore(state => state.userCoins);
    const gameId = useGameStore(state => state.activeGameId);
    const turnDebugLogs = useGameStore(state => state.turnDebugLogs);


    const [activeTab, setActiveTab] = useState<'script' | 'memory' | 'story' | 'transcript'>('script');
    const [scriptInput, setScriptInput] = useState('');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleRunScript = () => {
        if (!scriptInput.trim()) return;

        try {
            const result = parseScript(scriptInput);

            // Add to queue (append to existing or replace? Usually append is safer for debug)
            setScriptQueue([...scriptQueue, ...result]);
            alert(`Parsed ${result.length} segments and added to queue.`);
        } catch (e) {
            alert(`Error parsing script: ${e}`);
        }
    };

    const handleCopyTranscript = () => {
        const text = chatHistory.map(msg => `[${msg.role.toUpperCase()}]\n${msg.text}\n`).join('\n---\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleDownloadTranscript = () => {
        const data = {
            gameId,
            timestamp: new Date().toISOString(),
            history: chatHistory,
            debugLogs: turnDebugLogs
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session_transcript_${gameId}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 selection:bg-blue-500/30"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            <div
                className="bg-slate-900 w-full max-w-5xl h-[85vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
            >
                {/* Header */}
                <div className="h-12 border-b border-gray-800 flex justify-between items-center px-4 bg-gray-950">
                    <div className="flex items-center gap-2 text-yellow-500 font-bold font-mono">
                        <Terminal size={18} />
                        <span>DEBUG CONSOLE</span>
                        <span className="text-xs text-gray-500 ml-2">[{gameId}]</span>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-800 bg-gray-900">
                    <button
                        onClick={() => setActiveTab('script')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'script' ? 'bg-yellow-500/10 text-yellow-500 border-b-2 border-yellow-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Play size={16} /> Script Tester
                    </button>
                    <button
                        onClick={() => setActiveTab('memory')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'memory' ? 'bg-blue-500/10 text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Database size={16} /> Memory Viewer
                    </button>
                    <button
                        onClick={() => setActiveTab('story')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'story' ? 'bg-green-500/10 text-green-500 border-b-2 border-green-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <BookOpen size={16} /> Storyline
                    </button>
                    <button
                        onClick={() => setActiveTab('transcript')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'transcript' ? 'bg-purple-500/10 text-purple-500 border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <FileJson size={16} /> Transcript
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden p-4 bg-black/50">
                    {activeTab === 'script' && (
                        <div className="flex flex-col h-full gap-4">
                            <div className="text-xs text-gray-400">
                                Paste game script functionality here. Supported tags: Name: text, [Background], (Expression), etc.
                            </div>
                            <textarea
                                className="flex-1 w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm font-mono text-green-400 focus:outline-none focus:border-yellow-500/50 resize-none"
                                placeholder="Narrator: Test message..."
                                value={scriptInput}
                                onChange={(e) => setScriptInput(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={handleRunScript}
                                    className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Play size={16} /> Run Script
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'memory' && (
                        <div className="h-full overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                            {/* Basic Info */}
                            <section>
                                <h3 className="text-blue-400 font-bold mb-2 border-b border-blue-500/30 pb-1">Context</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex justify-between bg-gray-900 p-2 rounded"><span className="text-gray-500">Location</span> <span className="text-white">{currentLocation}</span></div>
                                    <div className="flex justify-between bg-gray-900 p-2 rounded"><span className="text-gray-500">Coins</span> <span className="text-yellow-400">{userCoins} G</span></div>

                                    <div className="flex justify-between bg-gray-900 p-2 rounded"><span className="text-gray-500">Active Characters</span> <span className="text-white">{activeCharacters.join(', ') || 'None'}</span></div>
                                </div>
                            </section>

                            {/* Stats */}
                            <section>
                                <details className="group">
                                    <summary className="text-blue-400 font-bold mb-2 border-b border-blue-500/30 pb-1 cursor-pointer select-none">Player Stats</summary>
                                    <pre className="bg-gray-900 p-3 rounded text-xs text-blue-300 font-mono overflow-x-auto group-open:block">
                                        {JSON.stringify(playerStats, null, 2)}
                                    </pre>
                                </details>
                            </section>

                            {/* [NEW] Active Character Memories (Highlighted) */}
                            <section className="mb-6">
                                <details open className="group">
                                    <summary className="text-green-400 font-bold mb-2 border-b border-green-500/30 pb-1 flex items-center gap-2 cursor-pointer select-none">
                                        <span>🟢 Active Characters (Current Scene)</span>
                                    </summary>
                                    <div className="space-y-2 group-open:block">
                                        {activeCharacters.length > 0 ? (
                                            activeCharacters.map((charId: string) => {
                                                const allCharData = useGameStore.getState().characterData;
                                                const currentTurn = useGameStore.getState().turnCount;
                                                const charData = allCharData[charId] || {} as any;
                                                return (
                                                    <div key={charId} className="bg-green-900/20 border border-green-500/30 p-3 rounded text-xs">
                                                        <div className="flex justify-between mb-1">
                                                            <strong className="text-green-300 text-sm">{charData.name || charId}</strong>
                                                            <span className="text-green-500/70">{charData.memories?.length || 0} memories</span>
                                                        </div>
                                                        {charData.memories && charData.memories.length > 0 ? (
                                                            <ul className="space-y-2 pl-1">
                                                                {charData.memories.map((mem: any, i: number) => {
                                                                    const isString = typeof mem === 'string';
                                                                    const text = isString ? mem : mem.text;
                                                                    const tag = !isString ? mem.tag : null;
                                                                    const importance = !isString ? mem.importance : null;
                                                                    const subject = !isString ? mem.subject : null;
                                                                    const turn = !isString ? mem.turn : null;
                                                                    const keywords = !isString ? mem.keywords : null;
                                                                    const expiry = !isString ? mem.expireAfterTurn : null;
                                                                    const isNewThisTurn = turn === currentTurn;
                                                                    return (
                                                                        <li key={i} className={`border-l-2 pl-2 py-1 ${isNewThisTurn ? 'border-green-400 bg-green-500/10' : 'border-gray-700'}`}>
                                                                            <div className="flex items-start gap-1">
                                                                                {isNewThisTurn && <span className="px-1 py-0.5 bg-green-500 text-black rounded text-[9px] font-bold shrink-0">NEW</span>}
                                                                                <span className="text-gray-200">{text}</span>
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                                {tag && <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[10px]">{tag}</span>}
                                                                                {importance && <span className="px-1.5 py-0.5 bg-yellow-900/40 text-yellow-300 rounded text-[10px]">{'★'.repeat(importance)}</span>}
                                                                                {subject && <span className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded text-[10px]">→{subject}</span>}
                                                                                {turn != null && <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-[10px]">T{turn}</span>}
                                                                                {expiry != null && <span className="px-1.5 py-0.5 bg-red-900/40 text-red-300 rounded text-[10px]">⏳T{expiry}</span>}
                                                                                {expiry == null && !isString && <span className="px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded text-[10px]">∞催久</span>}
                                                                                {keywords && keywords.map((kw: string, ki: number) => (
                                                                                    <span key={ki} className="px-1.5 py-0.5 bg-cyan-900/40 text-cyan-300 rounded text-[10px]">#{kw}</span>
                                                                                ))}
                                                                            </div>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        ) : (
                                                            <div className="text-gray-500 italic">No recorded memories yet.</div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-gray-500 italic p-2">No active characters detected.</div>
                                        )}
                                    </div>
                                </details>
                            </section>

                            {/* All Character Memories */}
                            <section>
                                <details className="group">
                                    <summary className="text-blue-400 font-bold mb-2 border-b border-blue-500/30 pb-1 cursor-pointer select-none">All Character Memories</summary>
                                    <div className="space-y-2 group-open:block">
                                        {Object.keys(useGameStore.getState().characterData || {}).length === 0 ? (
                                            <div className="text-gray-600 text-sm italic">No character data available.</div>
                                        ) : (
                                            Object.entries(useGameStore.getState().characterData || {}).map(([charId, data]: [string, any]) => {
                                                const currentTurn = useGameStore.getState().turnCount;
                                                return (
                                                    <div key={charId} className="bg-gray-900 p-3 rounded text-xs">
                                                        <div className="flex justify-between mb-1">
                                                            <strong className="text-blue-300 text-sm">{data.name || charId}</strong>
                                                            <span className="text-gray-500">{data.memories?.length || 0} memories</span>
                                                        </div>
                                                        {data.memories && data.memories.length > 0 ? (
                                                            <ul className="space-y-2 pl-1">
                                                                {data.memories.map((mem: any, i: number) => {
                                                                    const isString = typeof mem === 'string';
                                                                    const text = isString ? mem : mem.text;
                                                                    const tag = !isString ? mem.tag : null;
                                                                    const importance = !isString ? mem.importance : null;
                                                                    const subject = !isString ? mem.subject : null;
                                                                    const turn = !isString ? mem.turn : null;
                                                                    const keywords = !isString ? mem.keywords : null;
                                                                    const expiry = !isString ? mem.expireAfterTurn : null;
                                                                    const isNewThisTurn = turn === currentTurn;
                                                                    return (
                                                                        <li key={i} className={`border-l-2 pl-2 py-1 ${isNewThisTurn ? 'border-blue-400 bg-blue-500/10' : 'border-gray-700'}`}>
                                                                            <div className="flex items-start gap-1">
                                                                                {isNewThisTurn && <span className="px-1 py-0.5 bg-blue-500 text-white rounded text-[9px] font-bold shrink-0">NEW</span>}
                                                                                <span className="text-gray-300">{text}</span>
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                                {tag && <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[10px]">{tag}</span>}
                                                                                {importance && <span className="px-1.5 py-0.5 bg-yellow-900/40 text-yellow-300 rounded text-[10px]">{'★'.repeat(importance)}</span>}
                                                                                {subject && <span className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded text-[10px]">→{subject}</span>}
                                                                                {turn != null && <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-[10px]">T{turn}</span>}
                                                                                {expiry != null && <span className="px-1.5 py-0.5 bg-red-900/40 text-red-300 rounded text-[10px]">⏳T{expiry}</span>}
                                                                                {expiry == null && !isString && <span className="px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded text-[10px]">∞催久</span>}
                                                                                {keywords && keywords.map((kw: string, ki: number) => (
                                                                                    <span key={ki} className="px-1.5 py-0.5 bg-cyan-900/40 text-cyan-300 rounded text-[10px]">#{kw}</span>
                                                                                ))}
                                                                            </div>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        ) : (
                                                            <div className="text-gray-600 italic">No recorded memories yet.</div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </details>
                            </section>

                            {/* Inventory */}
                            <section>
                                <details className="group">
                                    <summary className="text-blue-400 font-bold mb-2 border-b border-blue-500/30 pb-1 cursor-pointer select-none">Inventory</summary>
                                    <div className="space-y-1 group-open:block">
                                        {inventory.length === 0 ? <div className="text-gray-600 text-sm">Empty</div> : inventory.map((item, idx) => (
                                            <div key={idx} className="flex justify-between bg-gray-900 p-2 rounded text-sm">
                                                <span className="text-white">{item.name}</span>
                                                <span className="text-gray-400">x{item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </section>
                        </div>
                    )}

                    {activeTab === 'story' && (
                        <div className="h-full overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                            <section>
                                <details className="group" open>
                                    <summary className="text-green-400 font-bold mb-2 border-b border-green-500/30 pb-1 cursor-pointer select-none">AI Scenario Director</summary>
                                    <div className="bg-gray-900 p-4 rounded text-sm text-gray-300 leading-relaxed group-open:block">
                                        {useGameStore.getState().scenario ? (
                                            <div className="space-y-2">
                                                <div className="flex justify-between"><span className="text-gray-500">Title</span> <span className="text-yellow-400 font-bold">{useGameStore.getState().scenario?.title}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Goal</span> <span className="text-white">{useGameStore.getState().scenario?.goal}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Stage</span> <span className="text-blue-400">{useGameStore.getState().scenario?.stage}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-500">Turns</span> <span className="text-gray-400">{useGameStore.getState().scenario?.turnCount}</span></div>

                                                <div className="border-t border-gray-800 pt-2 mt-2">
                                                    <div className="text-gray-500 mb-1 text-xs">Variables</div>
                                                    <pre className="bg-black p-2 rounded text-xs text-green-300 overflow-x-auto">
                                                        {JSON.stringify(useGameStore.getState().scenario?.variables, null, 2)}
                                                    </pre>
                                                </div>

                                                {useGameStore.getState().scenario?.currentNote && (
                                                    <div className="border-t border-gray-800 pt-2 mt-2">
                                                        <div className="text-pink-500 mb-1 text-xs font-bold">Director's Note (Next Turn Guide)</div>
                                                        <div className="text-pink-300 italic text-xs bg-pink-900/10 p-2 rounded border border-pink-500/20">
                                                            {useGameStore.getState().scenario?.currentNote}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic">No active scenario. (Idle)</div>
                                        )}
                                    </div>
                                </details>
                            </section>

                            <section>
                                <details className="group" open>
                                    <summary className="text-green-400 font-bold mb-2 border-b border-green-500/30 pb-1 cursor-pointer select-none">Scenario Summary</summary>
                                    <div className="bg-gray-900 p-4 rounded text-sm text-gray-300 leading-relaxed whitespace-pre-wrap group-open:block">
                                        {scenarioMemory && (scenarioMemory.tier1Summaries.length > 0 || scenarioMemory.tier2Summaries.length > 0) ? (
                                            <div className="space-y-3">
                                                {scenarioMemory.tier2Summaries.length > 0 && (
                                                    <div>
                                                        <div className="text-amber-400 font-bold text-xs mb-1">[장기 기억] ({scenarioMemory.tier2Summaries.length}개)</div>
                                                        {scenarioMemory.tier2Summaries.map((s, i) => (
                                                            <div key={`t2-${i}`} className="pl-2 border-l-2 border-amber-600/50 mt-1 text-xs">{s}</div>
                                                        ))}
                                                    </div>
                                                )}
                                                {scenarioMemory.tier1Summaries.length > 0 && (
                                                    <div>
                                                        <div className="text-cyan-400 font-bold text-xs mb-1">[최근 줄거리] ({scenarioMemory.tier1Summaries.length}개)</div>
                                                        {scenarioMemory.tier1Summaries.map((s, i) => (
                                                            <div key={`t1-${i}`} className="pl-2 border-l-2 border-cyan-600/50 mt-1 text-xs">{s}</div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="text-gray-500 text-xs">Last Summarized: Turn {scenarioMemory.lastSummarizedTurn}</div>
                                            </div>
                                        ) : (
                                            "No summary available."
                                        )}
                                    </div>
                                </details>
                            </section>

                            <section>
                                <details className="group" open>
                                    <summary className="text-green-400 font-bold mb-2 border-b border-green-500/30 pb-1 cursor-pointer select-none">Recent History (Last 5)</summary>
                                    <div className="space-y-2 group-open:block">
                                        {chatHistory.slice(-5).map((msg, idx) => (
                                            <div key={idx} className={`p-3 rounded text-sm ${msg.role === 'user' ? 'bg-gray-800 border-l-2 border-blue-500' : 'bg-gray-900 border-l-2 border-purple-500'}`}>
                                                <div className="text-xs text-gray-500 mb-1 uppercase">{msg.role}</div>
                                                <div className="text-gray-300">{msg.text.substring(0, 150)}...</div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </section>
                        </div>
                    )}

                    {activeTab === 'transcript' && (
                        <div className="flex flex-col h-full gap-4">
                            <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                                <div className="text-gray-400 text-sm">
                                    Pipeline Debug ({turnDebugLogs.length} turns logged)
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCopyTranscript}
                                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs flex items-center gap-2 transition-colors"
                                    >
                                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                        {copied ? 'Copied' : 'Copy Text'}
                                    </button>
                                    <button
                                        onClick={handleDownloadTranscript}
                                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs flex items-center gap-2 transition-colors"
                                    >
                                        <FileJson size={14} />
                                        Save JSON
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                                {turnDebugLogs.length === 0 ? (
                                    <div className="text-gray-600 italic text-center mt-10">
                                        아직 디버그 로그가 없습니다. 턴을 진행하면 파이프라인 데이터가 여기에 기록됩니다.
                                    </div>
                                ) : (
                                    [...turnDebugLogs].reverse().map((log, idx) => (
                                        <details key={`turn-${log.turn}-${idx}`} className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden" open={idx === 0}>
                                            <summary className="px-4 py-3 cursor-pointer select-none hover:bg-gray-800/50 transition-colors flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-yellow-500 font-bold font-mono text-sm">T{log.turn}</span>
                                                    <span className="text-gray-300 text-sm truncate max-w-[300px]">{log.userInput}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {log.preLogic && (
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.preLogic.score >= 8 ? 'bg-green-900/50 text-green-300' :
                                                                log.preLogic.score >= 5 ? 'bg-yellow-900/50 text-yellow-300' :
                                                                    'bg-red-900/50 text-red-300'
                                                            }`}>
                                                            Score: {log.preLogic.score}
                                                        </span>
                                                    )}
                                                    {log.cost != null && (
                                                        <span className="text-gray-500 text-[10px]">${log.cost.toFixed(4)}</span>
                                                    )}
                                                    <span className="text-gray-600 text-[10px]">
                                                        {new Date(log.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </summary>
                                            <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
                                                {/* 1. User Input */}
                                                <div>
                                                    <div className="text-blue-400 text-xs font-bold mb-1">🎯 유저 입력</div>
                                                    <div className="bg-blue-950/30 border border-blue-500/20 rounded p-2 text-sm text-blue-200">{log.userInput}</div>
                                                </div>

                                                {/* 2. PreLogic */}
                                                {log.preLogic && (
                                                    <details className="group">
                                                        <summary className="text-cyan-400 text-xs font-bold cursor-pointer select-none flex items-center gap-2">
                                                            🧠 PreLogic
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${log.preLogic.score >= 8 ? 'bg-green-900/40 text-green-300' :
                                                                    log.preLogic.score >= 5 ? 'bg-yellow-900/40 text-yellow-300' :
                                                                        'bg-red-900/40 text-red-300'
                                                                }`}>
                                                                {log.preLogic.score}/10
                                                            </span>
                                                            {log.preLogic.mood && <span className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded text-[10px]">🎭 {log.preLogic.mood}</span>}
                                                            {log.preLogic.combat && <span className="px-1.5 py-0.5 bg-red-900/40 text-red-300 rounded text-[10px]">⚔️ Combat</span>}
                                                        </summary>
                                                        <div className="mt-1 space-y-1 text-xs pl-4">
                                                            {log.preLogic.analysis && (
                                                                <div><span className="text-gray-500">판정:</span> <span className="text-gray-300">{log.preLogic.analysis}</span></div>
                                                            )}
                                                            {log.preLogic.narrativeGuide && (
                                                                <div><span className="text-gray-500">가이드:</span> <span className="text-cyan-300">{log.preLogic.narrativeGuide}</span></div>
                                                            )}
                                                            {log.preLogic.locationInference && (
                                                                <div><span className="text-gray-500">장소:</span> <span className="text-gray-300">{log.preLogic.locationInference}</span></div>
                                                            )}
                                                            {log.preLogic.newCharacters.length > 0 && (
                                                                <div><span className="text-gray-500">새 캐릭터:</span> <span className="text-green-300">{log.preLogic.newCharacters.join(', ')}</span></div>
                                                            )}
                                                            {log.preLogic.characterSuggestion.length > 0 && (
                                                                <div><span className="text-gray-500">캐릭터 제안:</span> <span className="text-purple-300">{log.preLogic.characterSuggestion.join(', ')}</span></div>
                                                            )}
                                                        </div>
                                                    </details>
                                                )}

                                                {/* 3. Casting */}
                                                {log.casting && log.casting.length > 0 && (
                                                    <details className="group">
                                                        <summary className="text-green-400 text-xs font-bold cursor-pointer select-none">
                                                            🎭 캐스팅 ({log.casting.length}명)
                                                        </summary>
                                                        <div className="mt-1 overflow-x-auto">
                                                            <table className="w-full text-xs">
                                                                <thead>
                                                                    <tr className="text-gray-500 border-b border-gray-800">
                                                                        <th className="text-left py-1 px-2">이름</th>
                                                                        <th className="text-right py-1 px-2">점수</th>
                                                                        <th className="text-left py-1 px-2">사유</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {log.casting.map((c, ci) => (
                                                                        <tr key={ci} className="border-b border-gray-800/50">
                                                                            <td className="py-1 px-2 text-green-300 font-medium">{c.name || c.id}</td>
                                                                            <td className="py-1 px-2 text-right text-yellow-400">{c.score}</td>
                                                                            <td className="py-1 px-2 text-gray-400">{c.reasons.join(', ') || '-'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </details>
                                                )}

                                                {/* 4. Director */}
                                                {log.director && (
                                                    <details className="group">
                                                        <summary className="text-pink-400 text-xs font-bold cursor-pointer select-none flex items-center gap-2">
                                                            🎬 디렉터
                                                            {log.director.tone && <span className="px-1.5 py-0.5 bg-pink-900/40 text-pink-300 rounded text-[10px]">{log.director.tone}</span>}
                                                        </summary>
                                                        <div className="mt-1 space-y-1 text-xs pl-4">
                                                            {log.director.plotBeats.length > 0 && (
                                                                <div><span className="text-gray-500">Plot Beats:</span> <span className="text-pink-300">{log.director.plotBeats.join(' → ')}</span></div>
                                                            )}
                                                            {log.director.emotionalDirection && (
                                                                <div><span className="text-gray-500">감정 방향:</span> <span className="text-gray-300">{log.director.emotionalDirection}</span></div>
                                                            )}
                                                            {log.director.subtleHooks.length > 0 && (
                                                                <div>
                                                                    <span className="text-gray-500">떡밥(Hooks):</span>
                                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                                        {log.director.subtleHooks.map((hook: any, hi: number) => (
                                                                            <span key={hi} className="px-1.5 py-0.5 bg-amber-900/30 text-amber-300 rounded text-[10px]">
                                                                                {typeof hook === 'string' ? hook : JSON.stringify(hook)}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </details>
                                                )}

                                                {/* 5. Story */}
                                                {log.story && (
                                                    <details className="group">
                                                        <summary className="text-orange-400 text-xs font-bold cursor-pointer select-none flex items-center gap-2">
                                                            📝 스토리
                                                            <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-[10px]">{log.story.model}</span>
                                                            <span className="text-gray-500 text-[10px]">{log.story.rawLength.toLocaleString()} chars</span>
                                                        </summary>
                                                        {log.story.thinking && (
                                                            <div className="mt-1 pl-4">
                                                                <div className="text-gray-500 text-[10px] mb-0.5">Thinking:</div>
                                                                <div className="bg-gray-950 border border-gray-800 rounded p-2 text-[11px] text-amber-200/70 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                                                                    {log.story.thinking}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </details>
                                                )}

                                                {/* 6. PostLogic & Performance */}
                                                <details className="group">
                                                    <summary className="text-gray-400 text-xs font-bold cursor-pointer select-none">
                                                        ⚙️ PostLogic & 성능
                                                    </summary>
                                                    <div className="mt-1 text-xs pl-4 space-y-1">
                                                        {log.postLogic && (
                                                            <>
                                                                {log.postLogic.hpChange !== 0 && (
                                                                    <div>
                                                                        <span className="text-gray-500">HP 변화:</span>
                                                                        <span className={log.postLogic.hpChange > 0 ? 'text-green-400' : 'text-red-400'}> {log.postLogic.hpChange > 0 ? '+' : ''}{log.postLogic.hpChange}</span>
                                                                    </div>
                                                                )}
                                                                {log.postLogic.activeCharacters.length > 0 && (
                                                                    <div><span className="text-gray-500">활성 캐릭터:</span> <span className="text-gray-300">{log.postLogic.activeCharacters.join(', ')}</span></div>
                                                                )}
                                                                {log.postLogic.endingTrigger && (
                                                                    <div><span className="text-gray-500">엔딩:</span> <span className="text-red-400 font-bold">{log.postLogic.endingTrigger}</span></div>
                                                                )}
                                                            </>
                                                        )}
                                                        {log.latencies && (
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                                                {Object.entries(log.latencies).map(([key, val]) => (
                                                                    <span key={key} className="text-gray-500">
                                                                        {key}: <span className="text-gray-300">{typeof val === 'number' ? `${val}ms` : String(val)}</span>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {log.cost != null && (
                                                            <div><span className="text-gray-500">비용:</span> <span className="text-yellow-400">${log.cost.toFixed(4)}</span></div>
                                                        )}
                                                    </div>
                                                </details>
                                            </div>
                                        </details>
                                    ))
                                )}

                                {/* Raw Messages */}
                                <details className="bg-gray-900 rounded-lg border border-gray-800 mt-4">
                                    <summary className="px-4 py-3 cursor-pointer select-none text-gray-500 text-xs font-bold hover:text-gray-300 transition-colors">
                                        📄 Raw Messages ({chatHistory.length} entries)
                                    </summary>
                                    <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
                                        {chatHistory.map((msg, idx) => (
                                            <div key={idx} className="border-b border-gray-900 pb-3 last:border-0">
                                                <div className={`text-xs font-bold mb-1 ${msg.role === 'user' ? 'text-blue-400' : 'text-purple-400'}`}>
                                                    [{msg.role.toUpperCase()}]
                                                </div>
                                                <div className="text-gray-300 whitespace-pre-wrap leading-relaxed text-xs">
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
