import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, SaveSlotMetadata } from '@/lib/store';
import { Database, Trash2, Save, FileText, MapPin, Clock, Target } from 'lucide-react';
import { get as idbGet } from 'idb-keyval';
import { useVNAudio } from '../hooks/useVNAudio';

const getRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
};

interface SaveLoadModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'save' | 'load';
    t: any; // Translations object
    gameId?: string; // [NEW] Optional override for TitleScreen
    onLoadSuccess?: () => void; // [NEW] Callback for navigation after load
}

const SaveLoadModal: React.FC<SaveLoadModalProps> = ({ isOpen, onClose, mode, t, gameId: propGameId, onLoadSuccess }) => {
    // 99 Slots + Auto
    // We show Unified List
    const [slots, setSlots] = useState<SaveSlotMetadata[]>([]);
    const [loading, setLoading] = useState(false);

    // Store Actions
    const saveToSlot = useGameStore(state => state.saveToSlot);
    const loadFromSlot = useGameStore(state => state.loadFromSlot);
    const deleteSlot = useGameStore(state => state.deleteSlot);
    const listSaveSlots = useGameStore(state => state.listSaveSlots);
    const activeGameIdStore = useGameStore(state => state.activeGameId);

    // [Fix] Hook for SFX
    const { playSfx } = useVNAudio();

    // [Fix] Use prop if available, else store
    const activeGameId = propGameId || activeGameIdStore;


    const [autoSaves, setAutoSaves] = useState<any[]>([]);

    // Refresh Slots
    const refreshSlots = async () => {
        setLoading(true);
        try {
            // 1. Fetch Manual Slots
            const manualList = await listSaveSlots(activeGameId);
            setSlots(manualList);

            // 2. Fetch Auto Saves (Cloud & Local)
            const autoList = [];

            // A. Check Local Active State (In Memory / Persisted)
            // A. Check Local Auto Save (IndexedDB Isolation)
            // We fetch the isolated auto-save slot for this game mode
            const autoKey = `vn_autosave_${activeGameId}`;
            try {
                // Dynamic import or assumed global from store context? 
                // We should import it properly. 
                // Since we can't easily add import via replace (unless we touch top), 
                // we'll rely on the existing imports or add one.
                // Wait, SaveLoadModal doesn't import idb-keyval yet. 
                // But `store.ts` does.
                // I'll add the import in a separate block.

                // Assuming `idbGet` is available (I will add import)
                const localAutoData = await idbGet(autoKey);

                if (localAutoData) {
                    autoList.push({
                        id: 'local_auto',
                        type: 'local',
                        date: localAutoData.metadata?.date || new Date().toISOString(),
                        summary: localAutoData.metadata?.summary || "자동 저장",
                        turn: localAutoData.turnCount,
                        location: localAutoData.currentLocation || "Unknown",
                        label: "현재 기기 (자동 저장)"
                    });
                }
            } catch (e) {
                console.warn("Failed to fetch local auto save", e);
            }

            // B. Check Cloud Save (Supabase)
            // Note: We need the user ID from auth to check this.
            // Ideally we could pass 'user' prop, but let's try to get it from Supabase client directly or store.
            // Simplified: Just try to fetch from 'game_saves' table for this user & game.
            // We'll use the client-side supabase instance if available, or just skip if not logged in.
            // actually we can use the `checkForCloudConflict` logic or just a raw select.

            // To be safe and clean, we'll try to just read the store's hasCloudSave logic if exposed,
            // OR just do a quick fetch here since we are client side.
            const { createClient } = await import('@/lib/supabase'); // Dynamic import to avoid SSR issues if any
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: cloudData } = await supabase
                    .from('game_saves')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('game_id', activeGameId)
                    .order('updated_at', { ascending: false })
                    .limit(1);

                const row = cloudData && cloudData.length > 0 ? cloudData[0] : null;

                if (row) {
                    autoList.push({
                        id: 'cloud_auto',
                        type: 'cloud',
                        date: row.updated_at,
                        summary: cloudData.summary || "클라우드 저장",
                        turn: cloudData.turn_count,
                        location: "Cloud",
                        label: "클라우드 (자동 저장)"
                    });
                }
            }

            setAutoSaves(autoList);

        } catch (e) {
            console.error("Failed to list slots", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            refreshSlots();
            // Default to 'auto' tab if no manual slots but auto slots exist?
            // Actually, if we are in "Load" mode from Title Screen, we might want to default to Auto if appropriate.
            // For now let's just default to 'auto' if prop says so, or stick to manual.
            // Let's force 'auto' tab active if we are in Title Screen context (no active manual saves usually)?
            // Better: If local storage has no manual slots, switch to auto.
        }
    }, [isOpen, activeGameId]);



    const handleSave = async (slotId: number) => {
        if (window.confirm(`Slot ${slotId}에 저장하시겠습니까?`)) {
            await saveToSlot(slotId, activeGameId);
            await refreshSlots();
            if (mode === 'save') alert("저장되었습니다.");
        }
    };

    const handleLoad = async (slotId: number | string) => {
        // Handle Auto Saves (Strings)
        if (typeof slotId === 'string') {
            if (slotId === 'local_auto') {
                const success = await loadFromSlot('auto', activeGameId);
                if (success) {
                    onClose();
                    if (onLoadSuccess) onLoadSuccess();
                } else {
                    alert("자동 저장 불러오기 실패");
                }
                return;
            }

            if (slotId === 'cloud_auto') {
                const success = await useGameStore.getState().loadFromCloud(activeGameId);
                if (success) {
                    onClose();
                    if (onLoadSuccess) onLoadSuccess();
                } else {
                    alert("클라우드 로드 실패");
                }
                return;
            }

            // Fallback for generic strings
            onClose();
            if (onLoadSuccess) onLoadSuccess();
            return;
        }

        // Handle Manual Slots (Number)
        // [UX Improvement] Remove confirmation for faster loading
        const success = await loadFromSlot(slotId, activeGameId);
        if (success) {
            onClose();
            if (onLoadSuccess) onLoadSuccess();
        } else {
            alert("불러오기에 실패했습니다.");
        }
    };

    const handleDelete = async (slotId: number) => {
        if (window.confirm(`Slot ${slotId} 데이터를 삭제하시겠습니까?`)) {
            await deleteSlot(slotId, activeGameId);
            await refreshSlots();
        }
    };

    // Generate Grid for 99 slots (Manual)
    const renderManualSlots = () => {
        const grid = [];
        for (let i = 1; i <= 99; i++) {
            const slotData = slots.find(s => s.id === i);
            grid.push(
                <SaveSlotItem
                    key={i}
                    slotId={i}
                    data={slotData}
                    mode={mode}
                    onSave={handleSave}
                    onLoad={handleLoad}
                    onDelete={handleDelete}
                    gameId={activeGameId}
                    playSfx={playSfx}
                />
            );
        }
        return grid;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#252525]">
                            <div className="flex items-center gap-4">
                                <h2 className="text-2xl font-bold text-amber-500 tracking-wider flex items-center gap-2">
                                    <Database className="w-6 h-6" />
                                    {mode === 'save' ? 'SAVE GAME' : 'LOAD GAME'}
                                </h2>
                                <span className="px-3 py-1 bg-white/5 rounded text-xs text-white/50 uppercase tracking-widest">
                                    {activeGameId.replace(/_/g, ' ')}
                                </span>
                            </div>

                            <button onClick={() => { playSfx('ui_click'); onClose(); }} onMouseEnter={() => playSfx('ui_hover')} className="text-white/30 hover:text-white p-2 text-xl hover:bg-white/5 rounded-full transition-colors">
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-[#111] custom-scrollbar">
                            <div className="max-w-5xl mx-auto flex flex-col gap-3">
                                {/* 1. Auto Saves */}
                                {autoSaves.map((save) => (
                                    <div key={save.id}
                                        onMouseEnter={() => playSfx('ui_hover')}
                                        className="p-4 bg-[#1e1e1e] border border-cyan-500/20 hover:border-cyan-500/50 rounded-lg flex justify-between items-center group transition-all shadow-md">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className={`w-16 h-10 flex items-center justify-center rounded font-black text-xs tracking-wider border ${save.type === 'cloud' ? 'bg-blue-900/20 border-blue-500/30 text-blue-400' : 'bg-green-900/20 border-green-500/30 text-green-400'}`}>
                                                {save.type === 'local' ? 'AUTO' : 'CLOUD'}
                                            </div>

                                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                                <div className="flex items-center gap-2 text-xs text-white/40 font-mono">
                                                    <span className="text-amber-500 font-bold">{save.playerName || "플레이어"}</span>
                                                    <span className="w-1 h-1 bg-white/20 rounded-full" />
                                                    <span>{getRelativeTime(save.date)}</span>
                                                </div>
                                                <div className="text-white/90 text-xl font-black tracking-widest text-amber-500 uppercase my-1 font-serif">
                                                    {save.playerRank || save.summary || "No Rank"}
                                                </div>
                                                <div className="text-xs text-white/50 truncate flex items-center gap-3 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-cyan-500" /> Turn {save.turn}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 text-emerald-500" /> {save.location}
                                                    </span>
                                                    {save.mainGoal && (
                                                        <span className="flex items-center gap-1 text-amber-500/80 border-l border-white/10 pl-3">
                                                            <Target className="w-3 h-3" /> {save.mainGoal}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {mode === 'load' && (
                                            <button
                                                onClick={async () => {
                                                    playSfx('ui_confirm');
                                                    // Simplified Logic reuse
                                                    if (save.type === 'cloud') {
                                                        const success = await useGameStore.getState().loadFromCloud(activeGameId);
                                                        if (success) { onClose(); if (onLoadSuccess) onLoadSuccess(); }
                                                    } else {
                                                        const success = await loadFromSlot('auto', activeGameId);
                                                        if (success) { onClose(); if (onLoadSuccess) onLoadSuccess(); }
                                                    }
                                                }}
                                                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded shadow-lg shadow-cyan-900/20 hover:scale-105 transition-all"
                                                onMouseEnter={() => playSfx('ui_hover')}
                                            >
                                                LOAD
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {/* Divider */}
                                {autoSaves.length > 0 && <div className="h-px bg-white/5 my-4 mx-4" />}

                                {/* 2. Manual Slots */}
                                <div className="flex flex-col gap-4">
                                    {renderManualSlots()}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div >
            )}
        </AnimatePresence >
    );
};

// Unified Slot Item Component (Horizontal Layout)
const SaveSlotItem = ({ slotId, data, mode, onSave, onLoad, onDelete, gameId, playSfx }: any) => {
    const isEmpty = !data;

    return (
        <div
            onMouseEnter={() => playSfx && playSfx('ui_hover')}
            className={`
            relative group p-4 rounded-lg border transition-all duration-200 flex items-center justify-between gap-4
            ${isEmpty
                    ? 'bg-white/5 border-white/5 hover:border-white/10'
                    : 'bg-[#1e1e1e] border-amber-500/20 hover:border-amber-500/50 shadow-md hover:shadow-amber-500/10'
                }
`}>
            {/* Left: ID & Content */}
            < div className="flex items-center gap-4 flex-1 min-w-0" >
                {/* ID */}
                < span className={`text-2xl font-black font-mono w-12 text-center ${isEmpty ? 'text-white/10' : 'text-amber-500'} `}>
                    {String(slotId).padStart(2, '0')}
                </span >

                {/* Vertical Divider */}
                < div className="w-px h-10 bg-white/5" />

                {/* Info */}
                {
                    isEmpty ? (
                        <div className="text-white/20 text-sm font-medium tracking-widest uppercase">
                            Empty Slot
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5 text-xs">
                                <span className="font-bold text-amber-500 uppercase tracking-wider">{data.playerName || "플레이어"}</span>
                                <span className="text-white/30 truncate">•</span>
                                <span className="text-white/50">{getRelativeTime(data.date)}</span>
                            </div>

                            <div className="text-white/90 text-xl font-black tracking-widest text-amber-500 uppercase my-1 font-serif">
                                {data.playerRank || data.summary || "No Rank"}
                            </div>

                            <div className="flex gap-4 text-xs text-white/50 font-mono items-center truncate mt-1">
                                <span className="flex items-center gap-1 shrink-0">
                                    <Clock className="w-3 h-3 text-cyan-500" /> Turn {data.turn}
                                </span>
                                <span className="flex items-center gap-1 truncate">
                                    <MapPin className="w-3 h-3 text-emerald-500" /> {data.location}
                                </span>
                                {data.mainGoal && (
                                    <span className="flex items-center gap-1 truncate text-amber-500/70 border-l border-white/10 pl-3">
                                        <Target className="w-3 h-3" /> {data.mainGoal}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Right: Actions */}
            < div className="flex items-center gap-2 shrink-0" >
                {/* SAVE Mode: Always show Save button */}
                {
                    mode === 'save' && (
                        <button
                            onClick={() => { playSfx('ui_confirm'); onSave(slotId); }}
                            onMouseEnter={() => playSfx && playSfx('ui_hover')}
                            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-black text-sm font-bold rounded shadow-lg shadow-amber-900/20 hover:scale-105 transition-all"
                        >
                            SAVE
                        </button>
                    )
                }

                {/* LOAD Mode: Show Load button if NOT empty */}
                {
                    mode === 'load' && !isEmpty && (
                        <button
                            onClick={() => { playSfx('ui_confirm'); onLoad(slotId); }}
                            onMouseEnter={() => playSfx && playSfx('ui_hover')}
                            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded shadow-lg shadow-cyan-900/20 hover:scale-105 transition-all"
                        >
                            LOAD
                        </button>
                    )
                }

                {/* Delete Button (Always visible if not empty) */}
                {
                    !isEmpty && (
                        <button
                            onClick={() => { playSfx('ui_click'); onDelete(slotId); }}
                            onMouseEnter={() => playSfx && playSfx('ui_hover')}
                            className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors border border-transparent hover:border-red-400/20"
                            title="Delete Save"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )
                }
            </div >
        </div >
    );
};

export default SaveLoadModal;
