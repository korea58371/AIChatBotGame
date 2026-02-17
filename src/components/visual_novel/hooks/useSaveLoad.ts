import { useState, useEffect } from 'react';
import { useGameStore, GameState } from '@/lib/store';
import { DataManager } from '@/lib/engine/data-manager';
import { useVNAudio } from './useVNAudio';
import { normalizeCharacterId } from '@/lib/utils/character-id';
import { getCharacterImage } from '@/lib/utils/image-mapper';
import { get, set, del } from 'idb-keyval';

interface SaveSlot {
    id: number;
    date: string;
    summary: string;
}

interface UseSaveLoadProps {
    showSaveLoad: boolean;
    setShowSaveLoad: (show: boolean) => void;
    t: any; // Translations object
    resetGame: () => void;
    addToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

// Helper to strip static/heavy data that can be rehydrated
const compressState = (state: GameState): Partial<GameState> => {
    const compressed = { ...state };

    // Remove static large datasets that are reloaded from DataManager
    delete (compressed as any).lore;
    delete (compressed as any).wikiData;
    delete (compressed as any).constants;
    delete (compressed as any).events;
    delete (compressed as any).availableBackgrounds;
    delete (compressed as any).availableCharacterImages;
    delete (compressed as any).availableExtraImages;
    delete (compressed as any).characterCreationQuestions;

    // Remove functions and mappings
    delete (compressed as any).getSystemPromptTemplate;
    delete (compressed as any).getRankInfo;
    delete (compressed as any).backgroundMappings;
    // characterMap removed
    // extraMap removed

    // Strip snapshots from history to prevent recursive state explosion
    // Snapshots contain full state copies, causing exponential size growth
    if (compressed.chatHistory) {
        compressed.chatHistory = compressed.chatHistory.map(msg => {
            const { snapshot, ...rest } = msg;
            return rest;
        });
    }

    if (compressed.displayHistory) {
        compressed.displayHistory = compressed.displayHistory.map(msg => {
            const { snapshot, ...rest } = msg;
            return rest;
        });
    }

    // [Fix] DataCloneError: Strip all functions and non-serializable data
    return JSON.parse(JSON.stringify(compressed));
};

export function useSaveLoad({ showSaveLoad, setShowSaveLoad, t, resetGame, addToast }: UseSaveLoadProps) {
    const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);

    // [Async] Load slots on mount or when modal opens
    useEffect(() => {
        const loadSlots = async () => {
            const slots: SaveSlot[] = [];
            for (let i = 1; i <= 3; i++) {
                const key = `vn_save_${i}`;
                let data: any = null;

                // 1. Try IndexedDB
                try {
                    data = await get(key);
                } catch (e) { console.warn("IDB Read Error", e); }

                // 2. Fallback to LocalStorage (Migration Check)
                if (!data) {
                    const localExec = localStorage.getItem(key);
                    if (localExec) {
                        try {
                            data = JSON.parse(localExec);
                            // Auto Migrate
                            console.log(`[SaveLoad] Migrating Slot ${i} to IDB...`);
                            await set(key, data);
                            localStorage.removeItem(key);
                        } catch (e) {
                            console.error(`[SaveLoad] Corrupted LS Slot ${i}`, e);
                        }
                    }
                }

                if (data) {
                    slots.push({
                        id: i,
                        date: new Date(data.timestamp).toLocaleString(),
                        summary: data.summary || 'No summary'
                    });
                } else {
                    slots.push({ id: i, date: 'Empty', summary: '-' });
                }
            }
            setSaveSlots(slots);
        };

        if (showSaveLoad) {
            loadSlots();
        }
    }, [showSaveLoad]);

    const saveGame = async (slotId: number) => {
        try {
            const state = useGameStore.getState();
            const summary = `${state.playerName || 'Unknown'} / Turn: ${state.turnCount || 0} / ${state.playerStats?.playerRank || 'Unknown'}`;

            // Compress state
            const compressedState = compressState(state);

            const saveData = {
                timestamp: Date.now(),
                summary: summary,
                state: compressedState
            };

            // Save to IDB
            await set(`vn_save_${slotId}`, saveData);

            addToast(t.gameSaved.replace('{0}', slotId.toString()), 'success');
            setShowSaveLoad(false);

            // Refresh UI
            setSaveSlots(prev => prev.map(s =>
                s.id === slotId
                    ? { id: slotId, date: new Date().toLocaleString(), summary }
                    : s
            ));

        } catch (e) {
            console.error("Save failed", e);
            addToast("Save failed", 'error');
        }
    };

    const loadGame = async (slotId: number) => {
        if (confirm(t.confirmLoad.replace('{0}', slotId.toString()))) {
            try {
                // Load from IDB
                const data = await get(`vn_save_${slotId}`);
                if (!data) {
                    addToast("Save file not found.", 'warning');
                    return;
                }

                const savedState = data.state as Partial<GameState>;

                // Hydrate static data
                const gameId = savedState.activeGameId || 'wuxia';
                const staticData = await DataManager.loadGameData(gameId);

                // Reconstruct full state
                const hydratedState = {
                    ...savedState,
                    lore: staticData.lore,
                    wikiData: staticData.wikiData,
                    constants: staticData.constants,
                    events: staticData.events,
                    availableBackgrounds: staticData.backgroundList,
                    availableCharacterImages: staticData.characterImageList || [],
                    availableExtraImages: staticData.extraCharacterList || [],
                    characterCreationQuestions: staticData.characterCreationQuestions,
                    backgroundMappings: staticData.backgroundMappings,
                    // characterMap removed
                    // extraMap removed
                    getSystemPromptTemplate: staticData.getSystemPromptTemplate,
                    getRankInfo: staticData.getRankInfo,
                    isDataLoaded: true,
                };

                useGameStore.setState(hydratedState as GameState);
                addToast(t.gameLoaded.replace('{0}', slotId.toString()), 'success');
                setShowSaveLoad(false);
            } catch (e) {
                console.error("Failed to load game", e);
                addToast("Failed to load save file.", 'error');
            }
        }
    };

    const deleteGame = async (slotId: number) => {
        if (confirm(t.confirmDelete.replace('{0}', slotId.toString()))) {
            await del(`vn_save_${slotId}`);
            setSaveSlots(prev => prev.map(s => s.id === slotId ? { ...s, date: 'Empty', summary: '-' } : s));
            addToast(t.gameDeleted.replace('{0}', slotId.toString()), 'info');
        }
    };

    return {
        saveSlots,
        saveGame,
        loadGame,
        deleteGame
    };
}
