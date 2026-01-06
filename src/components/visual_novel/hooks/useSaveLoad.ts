import { useState, useEffect } from 'react';
import { useGameStore, GameState } from '@/lib/store';
import { DataManager } from '@/lib/data-manager';

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
    delete (compressed as any).characterMap;
    delete (compressed as any).extraMap;

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

    return compressed;
};

export function useSaveLoad({ showSaveLoad, setShowSaveLoad, t, resetGame, addToast }: UseSaveLoadProps) {
    const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);

    // Load slots on mount or when modal opens
    useEffect(() => {
        const slots: SaveSlot[] = [];
        for (let i = 1; i <= 3; i++) {
            const data = localStorage.getItem(`vn_save_${i}`);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    slots.push({
                        id: i,
                        date: new Date(parsed.timestamp).toLocaleString(),
                        summary: parsed.summary || 'No summary'
                    });
                } catch (e) {
                    console.error("Failed to parse save slot", i, e);
                    slots.push({ id: i, date: 'Error', summary: 'Corrupted Data' });
                }
            } else {
                slots.push({ id: i, date: 'Empty', summary: '-' });
            }
        }
        setSaveSlots(slots);
    }, [showSaveLoad]);

    const saveGame = (slotId: number) => {
        try {
            const state = useGameStore.getState();
            const summary = `${state.playerName || 'Unknown'} / Turn: ${state.turnCount || 0} / ${state.playerStats?.playerRank || 'Unknown'}`;

            // Compress state by removing static data
            const compressedState = compressState(state);

            const saveData = {
                timestamp: Date.now(),
                summary: summary,
                state: compressedState
            };

            localStorage.setItem(`vn_save_${slotId}`, JSON.stringify(saveData));
            addToast(t.gameSaved.replace('{0}', slotId.toString()), 'success');
            setShowSaveLoad(false);

            // Refresh slots to show new save immediately
            setSaveSlots(prev => prev.map(s =>
                s.id === slotId
                    ? { id: slotId, date: new Date().toLocaleString(), summary }
                    : s
            ));

        } catch (e) {
            console.error("Save failed", e);
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                addToast("Save failed: Storage limit exceeded. Delete old saves.", 'error');
            } else {
                addToast("Save failed", 'error');
            }
        }
    };

    const loadGame = async (slotId: number) => {
        const data = localStorage.getItem(`vn_save_${slotId}`);
        if (!data) return;

        if (confirm(t.confirmLoad.replace('{0}', slotId.toString()))) {
            try {
                const parsed = JSON.parse(data);
                const savedState = parsed.state as Partial<GameState>;

                // Hydrate static data if we have an activeGameId
                // Default to 'wuxia' if missing (legacy saves)
                const gameId = savedState.activeGameId || 'wuxia';

                // Show loading toast? Or assume fast enough?
                // DataManager.loadGameData is async
                const staticData = await DataManager.loadGameData(gameId);

                // Reconstruct full state
                const hydratedState = {
                    ...savedState,
                    // Re-attach static data
                    lore: staticData.lore,
                    wikiData: staticData.wikiData,
                    constants: staticData.constants,
                    events: staticData.events,
                    availableBackgrounds: staticData.backgroundList,
                    availableCharacterImages: staticData.characterImageList || [],
                    availableExtraImages: staticData.extraCharacterList || [],
                    characterCreationQuestions: staticData.characterCreationQuestions,
                    backgroundMappings: staticData.backgroundMappings,
                    characterMap: staticData.characterMap,
                    extraMap: staticData.extraMap,

                    // Re-attach functions
                    getSystemPromptTemplate: staticData.getSystemPromptTemplate,
                    getRankInfo: staticData.getRankInfo,

                    // Ensure core flags
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

    const deleteGame = (slotId: number) => {
        if (confirm(t.confirmDelete.replace('{0}', slotId.toString()))) {
            localStorage.removeItem(`vn_save_${slotId}`);
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
