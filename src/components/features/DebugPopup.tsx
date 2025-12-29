import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store';
import { parseScript } from '@/lib/script-parser';
import { X, Play, Database, BookOpen, Terminal } from 'lucide-react';

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
    const scenarioSummary = useGameStore(state => state.scenarioSummary);
    const userCoins = useGameStore(state => state.userCoins);
    const gameId = useGameStore(state => state.activeGameId);

    const [activeTab, setActiveTab] = useState<'script' | 'memory' | 'story'>('script');
    const [scriptInput, setScriptInput] = useState('');

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-[800px] h-[600px] bg-gray-900 border border-yellow-500/30 rounded-xl shadow-2xl flex flex-col overflow-hidden">
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
                                <h3 className="text-blue-400 font-bold mb-2 border-b border-blue-500/30 pb-1">Player Stats</h3>
                                <pre className="bg-gray-900 p-3 rounded text-xs text-blue-300 font-mono overflow-x-auto">
                                    {JSON.stringify(playerStats, null, 2)}
                                </pre>
                            </section>

                            {/* Inventory */}
                            <section>
                                <h3 className="text-blue-400 font-bold mb-2 border-b border-blue-500/30 pb-1">Inventory</h3>
                                <div className="space-y-1">
                                    {inventory.length === 0 ? <div className="text-gray-600 text-sm">Empty</div> : inventory.map((item, idx) => (
                                        <div key={idx} className="flex justify-between bg-gray-900 p-2 rounded text-sm">
                                            <span className="text-white">{item.name}</span>
                                            <span className="text-gray-400">x{item.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'story' && (
                        <div className="h-full overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                            <section>
                                <h3 className="text-green-400 font-bold mb-2 border-b border-green-500/30 pb-1">Scenario Summary</h3>
                                <div className="bg-gray-900 p-4 rounded text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                                    {scenarioSummary || "No summary available."}
                                </div>
                            </section>

                            <section>
                                <h3 className="text-green-400 font-bold mb-2 border-b border-green-500/30 pb-1">Recent History (Last 5)</h3>
                                <div className="space-y-2">
                                    {chatHistory.slice(-5).map((msg, idx) => (
                                        <div key={idx} className={`p-3 rounded text-sm ${msg.role === 'user' ? 'bg-gray-800 border-l-2 border-blue-500' : 'bg-gray-900 border-l-2 border-purple-500'}`}>
                                            <div className="text-xs text-gray-500 mb-1 uppercase">{msg.role}</div>
                                            <div className="text-gray-300">{msg.text.substring(0, 150)}...</div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
