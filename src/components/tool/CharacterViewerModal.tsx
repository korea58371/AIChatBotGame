'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Edit2, Database, Search, User, Users, Tag, BookOpen, Heart, MessageCircle, Map, Share2, Play, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LocationExplorerView from './LocationExplorerView';
import assets from '../../data/assets.json';

interface CharacterViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameId: string;
}

type CharacterData = Record<string, any>;
type ViewMode = 'database' | 'relations' | 'simulation' | 'locations';

export default function CharacterViewerModal({ isOpen, onClose, gameId }: CharacterViewerModalProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('database');
    const [activeTab, setActiveTab] = useState<'main' | 'supporting'>('main');

    // Data States
    const [mainData, setMainData] = useState<CharacterData>({});
    const [supportingData, setSupportingData] = useState<CharacterData>({});
    const [locations, setLocations] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch Data
    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, gameId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [charRes, locRes] = await Promise.all([
                fetch(`/api/dev/characters?gameId=${gameId}`),
                fetch(`/api/dev/locations?gameId=${gameId}`)
            ]);

            if (charRes.ok) {
                const json = await charRes.json();
                setMainData(json.main || {});
                setSupportingData(json.supporting || {});
            }
            if (locRes.ok) {
                const locJson = await locRes.json();
                setLocations(locJson);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const allData = useMemo(() => ({ ...mainData, ...supportingData }), [mainData, supportingData]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-[95vw] h-[95vh] bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <Database className="w-6 h-6 text-cyan-400" />
                            <h2 className="text-xl font-bold text-white tracking-wide">
                                Character Database <span className="text-xs px-2 py-0.5 bg-cyan-900/50 text-cyan-300 rounded ml-2">DEV: {gameId}</span>
                            </h2>
                        </div>

                        {/* Mode Switcher */}
                        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                            <ModeButton
                                active={viewMode === 'database'}
                                onClick={() => setViewMode('database')}
                                icon={<Database className="w-4 h-4" />}
                                label="Database"
                            />
                            <ModeButton
                                active={viewMode === 'relations'}
                                onClick={() => setViewMode('relations')}
                                icon={<Share2 className="w-4 h-4" />}
                                label="Relations Graph"
                            />
                            <ModeButton
                                active={viewMode === 'simulation'}
                                onClick={() => setViewMode('simulation')}
                                icon={<Play className="w-4 h-4" />}
                                label="Casting Sim"
                            />
                            <ModeButton
                                active={viewMode === 'locations'}
                                onClick={() => setViewMode('locations')}
                                icon={<Map className="w-4 h-4" />}
                                label="Locations"
                            />
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-white/50 hover:text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden relative">
                    {viewMode === 'database' && (
                        <DatabaseView
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            mainData={mainData}
                            supportingData={supportingData}
                            setMainData={setMainData}
                            setSupportingData={setSupportingData}
                            gameId={gameId}
                            isLoading={isLoading}
                        />
                    )}
                    {viewMode === 'relations' && (
                        <RelationsGraphView data={allData} />
                    )}
                    {viewMode === 'simulation' && (
                        <CastingSimulatorView data={allData} locations={locations} />
                    )}
                    {viewMode === 'locations' && (
                        <LocationExplorerView
                            gameId={gameId}
                            allCharacters={allData}
                            locations={locations}
                            // @ts-ignore
                            backgrounds={assets[gameId]?.backgrounds || []}
                        />
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// ============================================================================
// 1. Database View Component (Original Functionality Enhanced)
// ============================================================================
function DatabaseView({ activeTab, setActiveTab, mainData, supportingData, setMainData, setSupportingData, gameId, isLoading }: any) {
    const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editJson, setEditJson] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Affinity Simulation State
    const [simulatedAffinity, setSimulatedAffinity] = useState(0);

    const activeData = activeTab === 'main' ? mainData : supportingData;
    const characterList = Object.keys(activeData).filter(name =>
        name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const selectedChar = selectedCharId ? activeData[selectedCharId] : null;

    useEffect(() => {
        if (selectedChar) {
            setEditJson(JSON.stringify(selectedChar, null, 4));
            setSimulatedAffinity(0); // Reset simulation on char switch
        }
    }, [selectedChar]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const parsed = JSON.parse(editJson);
            const newData = { ...activeData, [selectedCharId!]: parsed };

            if (activeTab === 'main') setMainData(newData);
            else setSupportingData(newData);

            const res = await fetch('/api/dev/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: activeTab,
                    data: newData,
                    gameId: gameId
                })
            });

            if (!res.ok) throw new Error('Save failed');
            setIsEditing(false);
        } catch (err) {
            alert('Failed to save: ' + err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-80 border-r border-white/10 flex flex-col bg-black/20 shrink-0">
                <div className="flex p-2 gap-1 border-b border-white/5">
                    <TabButton active={activeTab === 'main'} onClick={() => setActiveTab('main')} label="Main" icon={<User className="w-4 h-4" />} color="cyan" />
                    <TabButton active={activeTab === 'supporting'} onClick={() => setActiveTab('supporting')} label="Supporting" icon={<Users className="w-4 h-4" />} color="purple" />
                </div>
                <div className="p-4 border-b border-white/5">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {isLoading ? <div className="p-8 text-center text-white/30 text-sm">Loading...</div> : characterList.map(name => (
                        <button
                            key={name}
                            onClick={() => { setSelectedCharId(name); setIsEditing(false); }}
                            className={`w-full flex flex-col items-start px-4 py-3 rounded-lg transition-all border ${selectedCharId === name ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-white/60 hover:bg-white/5'}`}
                        >
                            <span className="font-bold text-sm">{name}</span>
                            <span className="text-xs text-white/30 truncate max-w-full">{activeData[name]?.title || 'Unknown'}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 bg-[#1a1a1a] flex flex-col overflow-hidden relative">
                {selectedChar ? (
                    <>
                        <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-black/20 shrink-0">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-bold text-white">{selectedCharId}</h3>
                                {/* Affinity Simulator Slider */}
                                <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                    <Heart className={`w-4 h-4 ${simulatedAffinity > 0 ? 'text-pink-500 fill-pink-500' : 'text-white/30'}`} />
                                    <span className="text-xs text-white/50 uppercase font-bold">Simulate Interest:</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={simulatedAffinity}
                                        onChange={(e) => setSimulatedAffinity(parseInt(e.target.value))}
                                        className="w-32 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500"
                                    />
                                    <span className="text-xs font-mono w-8 text-right text-pink-400">{simulatedAffinity}%</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsEditing(!isEditing)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm flex items-center gap-2 transition-all">
                                    <Edit2 className="w-4 h-4" /> {isEditing ? 'Visual Mode' : 'Edit JSON'}
                                </button>
                                {isEditing && (
                                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shadow-lg flex items-center gap-2 transition-all">
                                        <Save className="w-4 h-4" /> Save
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                            {isEditing ? (
                                <textarea
                                    value={editJson}
                                    onChange={(e) => setEditJson(e.target.value)}
                                    className="w-full h-full bg-[#121212] text-green-400 font-mono text-sm p-6 rounded-lg border border-white/10 focus:outline-none focus:border-cyan-500/50 resize-none leading-relaxed"
                                    spellCheck={false}
                                />
                            ) : (
                                <div className="max-w-5xl mx-auto space-y-8 pb-20">
                                    {/* Header Info */}
                                    <div className="flex items-start gap-8">
                                        <div className="w-32 h-32 bg-black rounded-full border-4 border-white/5 flex items-center justify-center shrink-0 overflow-hidden relative group shadow-xl">
                                            <User className="w-12 h-12 text-white/20" />
                                            {/* Simulate Affinity Glow */}
                                            {simulatedAffinity >= 50 && <div className="absolute inset-0 border-4 border-pink-500/30 rounded-full animate-pulse pointer-events-none" />}
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <h1 className="text-4xl font-black text-white">{selectedChar.title}</h1>
                                            {selectedChar.system_logic?.tags && (
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedChar.system_logic.tags.map((tag: string) => (
                                                        <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/70 flex items-center gap-1">
                                                            <Tag className="w-3 h-3 text-cyan-500" /> {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 
                                     *  DYNAMIC UNLOCK SECTION 
                                     *  Demonstrating "Secret" unlocking logic based on affinity
                                     */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <SectionCard title="Profile" icon={<User className="w-5 h-5 text-blue-400" />} data={selectedChar.profile} />

                                        {/* Personality - often has hidden traits */}
                                        <SectionCard
                                            title="Personality"
                                            icon={<Heart className="w-5 h-5 text-rose-400" />}
                                            data={selectedChar.personality}
                                            affinity={simulatedAffinity}
                                            unlockThreshold={30} // Example threshold
                                            secretData={{ "Hidden Side": "Unhappy when hungry (Unlocked at 30%)", "Trauma": "Fear of abandonment (Unlocked at 50%)" }}
                                        />

                                        <SectionCard title="Social" icon={<Users className="w-5 h-5 text-purple-400" />} data={selectedChar.social || selectedChar.인간관계} />
                                        <SectionCard title="Appearance" icon={<Eye className="w-5 h-5 text-amber-400" />} data={selectedChar.외형 || selectedChar.appearance} />

                                        {/* Secrets Section - Fully Locked until high affinity */}
                                        <SecretSection
                                            title="Deep Secrets"
                                            data={selectedChar.secret}
                                            currentAffinity={simulatedAffinity}
                                            requiredAffinity={50}
                                        />
                                    </div>

                                    {/* Event Triggers Visualization */}
                                    <div className="mt-8 p-6 bg-cyan-900/10 border border-cyan-500/20 rounded-xl">
                                        <h4 className="text-cyan-400 font-bold mb-4 flex items-center gap-2"><Play className="w-4 h-4" /> Potential Events</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Mock Event Data - In real app, read from char events */}
                                            <EventCard trigger="Affinity 30 + Cafe" reward="Sweet Tooth Event (CG)" active={simulatedAffinity >= 30} />
                                            <EventCard trigger="Affinity 50 + Night" reward="Trauma Event (CG)" active={simulatedAffinity >= 50} />
                                            <EventCard trigger="Affinity 100 + Park" reward="Confession Event (CG)" active={simulatedAffinity >= 100} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-white/20 gap-4">
                        <Database className="w-24 h-24 opacity-10" />
                        <p>Select a character to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// 2. Relations Graph View (SVG Implementation)
// ============================================================================
function RelationsGraphView({ data }: { data: CharacterData }) {
    // Basic Force-Directed-ish Layout via purely circular calculation for v1
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

    const nodes = useMemo(() => {
        const charNames = Object.keys(data);
        const count = charNames.length;
        const radius = Math.max(300, count * 30);
        return charNames.map((name, i) => {
            const angle = (i / count) * 2 * Math.PI;
            return {
                id: name,
                x: 400 + radius * Math.cos(angle), // Center 400,400
                y: 400 + radius * Math.sin(angle),
                data: data[name]
            };
        });
    }, [data]);

    const links = useMemo(() => {
        const linkList: any[] = [];
        nodes.forEach(source => {
            const relations = source.data.인간관계 || source.data.social; // Fallback
            if (!relations) return;

            Object.keys(relations).forEach(targetName => {
                const target = nodes.find(n => n.id === targetName);
                if (target) {
                    // Start naive parsing of relation to guess affinity
                    const relText = relations[targetName];
                    let type = 'neutral';
                    if (relText.includes('친구') || relText.includes('동료')) type = 'friend';
                    if (relText.includes('적') || relText.includes('라이벌')) type = 'enemy';

                    linkList.push({ source, target, type, label: relText });
                }
            });
        });
        return linkList;
    }, [nodes]);

    const handleWheel = (e: React.WheelEvent) => {
        setZoom(z => Math.max(0.1, z - e.deltaY * 0.001));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setDragging(true);
        setLastPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastPos.x;
        const dy = e.clientY - lastPos.y;
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
        setLastPos({ x: e.clientX, y: e.clientY });
    };

    return (
        <div
            className="w-full h-full bg-[#0a0a0a] overflow-hidden cursor-move relative"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            ref={containerRef}
        >
            <div className="absolute top-4 left-4 z-10 bg-black/60 p-4 rounded-xl border border-white/10 backdrop-blur pointer-events-none">
                <h3 className="text-white font-bold mb-2">Relationship Map</h3>
                <div className="flex flex-col gap-1 text-xs text-white/50">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500/50"></span> Friend / Ally</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500/50"></span> Hostile</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-500/50"></span> Neutral / Other</div>
                    <p className="mt-2 text-cyan-400">Scroll to Zoom • Drag to Pan</p>
                </div>
            </div>

            <svg
                className="w-full h-full touch-none"
                viewBox="0 0 800 800"
            >
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Links */}
                    {links.map((link, i) => {
                        let stroke = '#475569'; // Slate-600 neutral
                        if (link.type === 'friend') stroke = '#22c55e'; // Green
                        if (link.type === 'enemy') stroke = '#ef4444'; // Red
                        return (
                            <line
                                key={i}
                                x1={link.source.x} y1={link.source.y}
                                x2={link.target.x} y2={link.target.y}
                                stroke={stroke}
                                strokeWidth="2"
                                opacity="0.4"
                            />
                        );
                    })}

                    {/* Nodes */}
                    {nodes.map(node => (
                        <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                            <circle r="30" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                            <foreignObject x="-20" y="-20" width="40" height="40" className="pointer-events-none">
                                <div className="w-full h-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-white/50" />
                                </div>
                            </foreignObject>
                            <text y="50" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" style={{ textShadow: '0 2px 4px black' }}>{node.id}</text>
                            <text y="65" textAnchor="middle" fill="#94a3b8" fontSize="10">{node.data.title || ''}</text>
                        </g>
                    ))}
                </g>
            </svg>
        </div>
    );
}


// ============================================================================
// 3. Casting Simulator View (Logic Debugger)
// ============================================================================
// ============================================================================
// 3. Casting Simulator View (Logic Debugger)
// ============================================================================
function CastingSimulatorView({ data, locations }: { data: CharacterData, locations?: any }) {
    const [location, setLocation] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [playerRank, setPlayerRank] = useState('');
    const [activeChar, setActiveChar] = useState('');
    const [simulatedResults, setSimulatedResults] = useState<any[]>([]);

    // Helper: Resolve Location to Hierarchy [Region, Zone, Spot]
    // Uses the passed 'locations' JSON map
    const resolveLocationHierarchy = (locName: string): string[] => {
        if (!locName || !locations) return [locName || ""];

        // 1. Check Regions
        for (const [rKey, rVal] of Object.entries(locations.regions || {})) {
            if (locName === rKey) return [rKey];

            // 2. Check Zones
            const regionData = rVal as any;
            if (regionData.zones) {
                for (const [zKey, zVal] of Object.entries(regionData.zones)) {
                    if (locName === zKey) return [rKey, zKey];

                    // 3. Check Spots
                    const zoneData = zVal as any;
                    if (zoneData.spots && Array.isArray(zoneData.spots)) {
                        if (zoneData.spots.includes(locName)) {
                            return [rKey, zKey, locName];
                        }
                    }
                }
            }
        }
        return [locName];
    };

    // Extract unique options from data
    const { allRegions, allTags, allRanks, allNames } = useMemo(() => {
        const regions = new Set<string>();
        const tags = new Set<string>();
        const ranks = new Set<string>();
        const names = Object.keys(data).sort();

        // Add Regions from locations.json explicitly to ensure dropdown has them even if no char is there
        if (locations?.regions) {
            Object.keys(locations.regions).forEach(r => regions.add(r));
            Object.values(locations.regions).forEach((r: any) => {
                if (r.zones) {
                    Object.keys(r.zones).forEach(z => regions.add(z));
                    Object.values(r.zones).forEach((z: any) => {
                        if (z.spots) z.spots.forEach((s: string) => regions.add(s));
                    });
                }
            });
        }

        Object.values(data).forEach(char => {
            // Collect Regions
            const r = char['활동지역'] || char.activity_region;
            if (r) regions.add(r);

            // Collect Tags
            const tList = char.system_logic?.tags;
            if (Array.isArray(tList)) {
                tList.forEach((t: string) => tags.add(t));
            }

            // Collect Ranks
            const rk = char['강함']?.['등급'] || char.strength?.rank;
            if (rk) ranks.add(rk);
        });

        return {
            allRegions: Array.from(regions).sort(),
            allTags: Array.from(tags).sort(),
            allRanks: Array.from(ranks).sort(),
            allNames: names
        };
    }, [data, locations]);

    // Set defaults
    useEffect(() => {
        if (!location && allRegions.length > 0) setLocation(allRegions[0]);
        if (!playerRank && allRanks.length > 0) setPlayerRank(allRanks[0]);
    }, [allRegions, allRanks, location, playerRank]);

    const runSimulation = () => {
        // Helper: Get numeric rank (Aligned with AgentCasting.ts)
        const getRankLevel = (rankStr: string): number => {
            if (!rankStr) return 1;
            // Tier 10: Godly / Transcendental
            if (rankStr.includes('자연경') || rankStr.includes('공령') || rankStr.includes('SSS')) return 10;
            // Tier 9: Life and Death / Demigod
            if (rankStr.includes('생사경') || rankStr.includes('반신')) return 9;
            // Tier 8: Supreme / Shinwha / Hyunkyung
            if (rankStr.includes('현경') || rankStr.includes('신화') || rankStr.includes('SS')) return 8;
            if (rankStr.includes('화경') || rankStr.includes('탈각') || rankStr.includes('S')) return 7;
            if (rankStr.includes('초절정') || rankStr.includes('A')) return 6;
            if (rankStr.includes('절정') || rankStr.includes('B')) return 5;
            if (rankStr.includes('일류') || rankStr.includes('C')) return 4;
            if (rankStr.includes('이류') || rankStr.includes('D')) return 3;
            if (rankStr.includes('삼류') || rankStr.includes('E')) return 2;
            if (rankStr.includes('일반') || rankStr.includes('F')) return 1;
            return 1;
        };

        const targetRankLevel = getRankLevel(playerRank);

        // Resolve Player Hierarchy (User input 'location' is Player Location)
        const playerHierarchy = resolveLocationHierarchy(location);

        const results = Object.entries(data).map(([name, char]) => {
            let score = 5; // Base Score (0.5 * 10)
            const log = ['Base (+5)'];

            // 1. Region Check (Hierarchical)
            const regionStr = char['활동지역'] || char.activity_region || 'Unknown';
            const charHierarchy = resolveLocationHierarchy(regionStr);

            let locScore = 0;

            if (charHierarchy.length > 0 && playerHierarchy.length > 0) {
                // Level 1: Region
                if (charHierarchy[0] === playerHierarchy[0]) {
                    locScore += 20;

                    // Level 2: Zone
                    if (charHierarchy[1] && playerHierarchy[1] && charHierarchy[1] === playerHierarchy[1]) {
                        locScore += 20;

                        // Level 3: Spot
                        if (charHierarchy[2] && playerHierarchy[2] && charHierarchy[2] === playerHierarchy[2]) {
                            locScore += 20;
                            log.push(`🎯 Spot Match (${charHierarchy[2]}) (+60)`);
                        } else {
                            log.push(`🏙️ Zone Match (${charHierarchy[1]}) (+40)`);
                        }
                    } else {
                        log.push(`🌍 Region Match (${charHierarchy[0]}) (+20)`);
                    }
                }
            }

            // Fallback for simple matches
            if (locScore === 0) {
                if (regionStr === location) { // String match fallback
                    locScore += 20;
                    log.push('✅ Location Match [String] (+20)');
                } else if (regionStr === 'Everywhere' || regionStr === 'Korea') {
                    score += 2;
                    log.push('🌍 Wildcard Region (+2)');
                } else {
                    log.push(`📍 Distinct Region (${regionStr}) (0)`);
                }
            }

            score += locScore;

            // 2. Main Character Bonus (Heroine / Plot Armor)
            // [Fix] Uses injected 'is_main' flag to match AgentCasting.ts logic
            // User requested reduction to 15 points (1.5 engine score) to allow extras to appear early.
            if (char.is_main) {
                score += 15; // Base (1.5 * 10)
                log.push('🌟 Main Character Bonus (+15)');
            }

            // 3. Tag Matching (Weighted: +15 per tag)
            const charTags = (char.system_logic?.tags || []).map((t: string) => t.toLowerCase());
            const activeTags = selectedTags.map(t => t.toLowerCase());

            const matchedTags = charTags.filter((t: string) => activeTags.includes(t));
            if (matchedTags.length > 0) {
                const bonus = matchedTags.length * 15;
                score += bonus;
                log.push(`🏷️ Tags Matched: ${matchedTags.join(', ')} (+${bonus})`);
            }

            // 3. Relationship Resonance (Weighted: +40 for direct, +10 for others)
            // AgentCasting.ts gives +4.0 (highest single factor) for existing relationships.
            if (activeChar && name !== activeChar) {
                const rels = char['인간관계'] || char.relationships || {};
                const forwardRel = rels[activeChar];

                const activeCharData = data[activeChar];
                const reverseRels = activeCharData?.['인간관계'] || activeCharData?.relationships || {};
                const reverseRel = reverseRels[name];

                if (forwardRel || reverseRel) {
                    const relStr = (forwardRel || '') + (reverseRel || '');
                    const isPositive = /친구|동료|가족|파 트너|협력|호감|부하|상사/.test(relStr);
                    const isHostile = /적|라이벌|혐오/.test(relStr);

                    if (isPositive) {
                        score += 40; // High priority for associates
                        log.push(`🤝 Relationship Bonus (+40)`);
                    } else if (isHostile) {
                        score += 5; // Slight boost for drama (Engine doesn't explicitly do this but good for Sim)
                        log.push(`⚔️ Conflict Potential (+5)`);
                    } else {
                        score += 40; // Treat ANY relation as high priority (matches casting.ts +4.0 logic)
                        log.push(`🔗 Connection Found (+40)`);
                    }
                }
            }

            // 4. Rank Penalty (Multiplicative)
            // AgentCasting.ts applies multiplier if Gap >= 2 (Too Strong) or Gap <= -3 (Too Weak)
            if (playerRank) {
                const charLevel = getRankLevel(char['강함']?.['등급'] || char.strength?.rank);
                const rankGap = charLevel - targetRankLevel;

                // Too Strong (Gap >= 2) -> Penalty
                if (rankGap >= 2) {
                    const penaltyMp = 1.0 / (rankGap * 2.0);
                    score *= penaltyMp;
                    log.push(`🔻 Rank Gap High (+${rankGap}) (x${penaltyMp.toFixed(2)})`);
                }
                // Too Weak (Gap <= -3) -> Penalty
                else if (rankGap <= -3) {
                    const absGap = Math.abs(rankGap);
                    const penaltyMp = 1.0 / (absGap * 1.5);
                    score *= penaltyMp;
                    log.push(`🔻 Rank Gap Low (${rankGap}) (x${penaltyMp.toFixed(2)})`);
                } else {
                    // Within range - no penalty
                    score += 5; // Slight bonus for being "Within Range"
                    log.push(`⚖️ Rank Range OK (+5)`);
                }
            }

            return { name, score: Math.round(score), log, title: char.title };
        });

        // Sort by score
        results.sort((a, b) => b.score - a.score);
        setSimulatedResults(results);
    };

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(prev => prev.filter(t => t !== tag));
        } else {
            setSelectedTags(prev => [...prev, tag]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#161616]">
            {/* Control Panel */}
            <div className="p-6 bg-black/30 border-b border-white/10 flex flex-col gap-6">

                {/* Top Row: Region & Rank & Active Char */}
                <div className="flex flex-wrap gap-6">
                    {/* Region */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase block">Current Region</label>
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10 min-w-[200px]">
                            <Map className="w-4 h-4 text-cyan-400 shrink-0" />
                            <select
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="bg-transparent border-none text-white focus:outline-none w-full text-sm [&>option]:bg-black"
                            >
                                <option value="" disabled>Select Region</option>
                                {allRegions.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Player Rank */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase block">Player Rank</label>
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10 min-w-[150px]">
                            <Tag className="w-4 h-4 text-yellow-400 shrink-0" />
                            <select
                                value={playerRank}
                                onChange={(e) => setPlayerRank(e.target.value)}
                                className="bg-transparent border-none text-white focus:outline-none w-full text-sm [&>option]:bg-black"
                            >
                                <option value="" disabled>Rank</option>
                                {allRanks.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Active Character */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase block">Active Companion</label>
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10 min-w-[200px]">
                            <User className="w-4 h-4 text-pink-400 shrink-0" />
                            <select
                                value={activeChar}
                                onChange={(e) => setActiveChar(e.target.value)}
                                className="bg-transparent border-none text-white focus:outline-none w-full text-sm [&>option]:bg-black"
                            >
                                <option value="">(None)</option>
                                {allNames.map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={runSimulation}
                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-900/20 active:scale-95 transition-all flex items-center gap-2 ml-auto h-[42px] self-end"
                    >
                        <Play className="w-5 h-5 fill-current" /> Run Simulation
                    </button>
                </div>

                {/* Bottom Row: Tags */}
                <div className="space-y-2 w-full">
                    <label className="text-xs font-bold text-white/50 uppercase block">Situation Tags</label>
                    <div className="flex flex-col gap-2">
                        {/* Tag Selector */}
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10 w-full">
                            <Tag className="w-4 h-4 text-purple-400 shrink-0" />
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        toggleTag(e.target.value);
                                        e.target.value = ""; // Reset
                                    }
                                }}
                                className="bg-transparent border-none text-white focus:outline-none w-full text-sm [&>option]:bg-black"
                            >
                                <option value="">+ Add Tag Condition...</option>
                                {allTags.map(t => (
                                    <option key={t} value={t} disabled={selectedTags.includes(t)}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Selected Tags Display */}
                        <div className="flex flex-wrap gap-2 min-h-[28px]">
                            {selectedTags.length === 0 && <span className="text-xs text-white/20 italic p-1">No tags selected</span>}
                            {selectedTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    className="px-2 py-1 rounded bg-purple-900/30 border border-purple-500/30 text-purple-200 text-xs flex items-center gap-1 hover:bg-purple-900/50 transition-colors group"
                                >
                                    {tag} <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#0f0f0f]">
                <h3 className="text-white font-bold mb-4 opacity-50">Simulation Results (Who would appear?)</h3>
                <div className="flex flex-col gap-3">
                    {simulatedResults.map((res: any, idx: number) => (
                        <div key={res.name} className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${res.score > 0 ? 'bg-white/5 border-white/10' : 'opacity-40 border-transparent bg-black/20 hover:opacity-100'}`}>
                            <div className={`text-2xl font-black w-12 text-center ${res.score > 0 ? (idx === 0 ? 'text-yellow-400' : 'text-white/30') : 'text-red-900'}`}>
                                #{idx + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-lg font-bold text-white">{res.name} <span className="text-sm font-normal text-white/40 ml-2">{res.title}</span></h4>
                                    <span className={`font-mono font-bold ${res.score > 0 ? 'text-cyan-400' : 'text-red-500'}`}>{res.score} pts</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {res.log.map((l: string, i: number) => (
                                        <span key={i} className={`text-xs px-2 py-1 rounded border ${l.includes('✅') || l.includes('Base') || l.includes('Matched') || l.includes('Bonus') || l.includes('Connection') || l.includes('Range OK') ? 'bg-cyan-900/20 border-cyan-500/20 text-cyan-200' : (l.includes('Conflict') ? 'bg-orange-900/20 border-orange-500/20 text-orange-200' : 'bg-red-900/10 border-red-500/10 text-red-400')}`}>
                                            {l}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                    {simulatedResults.length === 0 && (
                        <div className="text-center py-20 text-white/20 italic">Run simulation to see results</div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helpers
function ModeButton({ active, onClick, icon, label }: any) {
    return (
        <button onClick={onClick} className={`px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold transition-all ${active ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}>
            {icon} {label}
        </button>
    );
}

function TabButton({ active, onClick, label, icon, color }: any) {
    const activeClass = color === 'cyan' ? 'bg-cyan-900/30 text-cyan-400 border-cyan-800/50' : 'bg-purple-900/30 text-purple-400 border-purple-800/50';
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 rounded transition-all border ${active ? activeClass : 'border-transparent text-white/40 hover:bg-white/5'}`}
        >
            {icon} {label}
        </button>
    );
}

function SectionCard({ title, icon, data, affinity, unlockThreshold, secretData }: any) {
    if (!data) return null;
    const isSecretUnlocked = unlockThreshold !== undefined && affinity !== undefined && affinity >= unlockThreshold;

    return (
        <div className="bg-black/30 border border-white/5 rounded-xl p-6 hover:border-white/10 transition-colors relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    {icon}
                    <h4 className="text-white font-bold tracking-wide">{title}</h4>
                </div>
                {/* Visual Lock Indicator for secrets in this section */}
                {secretData && (
                    <div className="flex items-center gap-1 text-xs font-mono">
                        {isSecretUnlocked ? <Unlock className="w-3 h-3 text-green-500" /> : <Lock className="w-3 h-3 text-red-500" />}
                        <span className={isSecretUnlocked ? 'text-green-500' : 'text-red-500'}>
                            {isSecretUnlocked ? 'EXTENDED INFO' : 'LOCKED INFO'}
                        </span>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                {Object.entries(data).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1">
                        <span className="text-xs text-white/40 uppercase tracking-wider">{key}</span>
                        <p className="text-sm text-white/80 leading-relaxed font-light">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </p>
                    </div>
                ))}

                {/* Dynamically show secret data if unlocked */}
                {secretData && isSecretUnlocked && (
                    <div className="mt-4 pt-4 border-t border-dashed border-white/10">
                        {Object.entries(secretData).map(([key, value]) => (
                            <div key={key} className="flex flex-col gap-1 mb-2">
                                <span className="text-xs text-pink-400/70 uppercase tracking-wider flex items-center gap-1"><Heart className="w-3 h-3" /> {key}</span>
                                <p className="text-sm text-pink-100/90 leading-relaxed font-light">{String(value)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function SecretSection({ title, data, currentAffinity, requiredAffinity }: any) {
    if (!data || Object.keys(data).length === 0) return null;
    const isUnlocked = currentAffinity >= requiredAffinity;

    return (
        <div className={`col-span-1 lg:col-span-2 border rounded-xl p-6 transition-all relative overflow-hidden ${isUnlocked ? 'bg-purple-900/10 border-purple-500/30' : 'bg-black/40 border-white/5 opacity-70'}`}>
            <div className="flex items-center gap-3 mb-4">
                {isUnlocked ? <Unlock className="w-5 h-5 text-purple-400" /> : <Lock className="w-5 h-5 text-white/30" />}
                <h4 className={`font-bold tracking-wide ${isUnlocked ? 'text-purple-400' : 'text-white/50'}`}>{title}</h4>
            </div>

            {isUnlocked ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="bg-black/40 p-3 rounded">
                            <span className="text-xs text-purple-300 uppercase block mb-1">{key}</span>
                            <p className="text-sm text-white/90">{String(value)}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                    <p className="text-white/30 text-sm mb-2">Unlock deeper secrets by increasing affinity to {requiredAffinity}%</p>
                    <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${Math.min(100, (currentAffinity / requiredAffinity) * 100)}%` }} />
                    </div>
                </div>
            )}
        </div>
    );
}

function EventCard({ trigger, reward, active }: any) {
    return (
        <div className={`p-3 rounded-lg border ${active ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-black/20 border-white/5 opacity-50'}`}>
            <div className="flex justify-between items-start mb-1">
                <span className={`text-xs font-bold uppercase ${active ? 'text-cyan-400' : 'text-white/40'}`}>Condition</span>
                {active && <span className="text-[10px] bg-cyan-900 text-cyan-200 px-1.5 rounded">ACTIVE</span>}
            </div>
            <p className="text-sm font-medium text-white mb-2">{trigger}</p>
            <div className={`text-xs p-2 rounded ${active ? 'bg-cyan-500/20 text-white' : 'bg-black/40 text-white/30'}`}>
                Reward: {reward}
            </div>
        </div>
    );
}
