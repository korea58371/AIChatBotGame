import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'; // [IndexedDB]
import { createClient } from './supabase'; // [Cloud]
import LZString from 'lz-string'; // [Compression]
import { ScriptSegment } from '@/lib/script-parser';
import { MoodType } from '@/data/prompts/moods';
import { GameRegistry } from '@/lib/registry/GameRegistry'; // [Refactor]
// Import Configs to register them (Side-effect)
// This ensures they are registered before store is used.
import '@/data/games/wuxia/config';
import '@/data/games/god_bless_you/config';
import { DataManager, GameData } from './data-manager';
import { PromptManager } from './prompt-manager';
import { MODEL_CONFIG } from './model-config';
import { normalizeCharacterId } from './utils/character-id'; // [NEW] ID Normalization

export interface Message {
  role: 'user' | 'model';
  text: string;
  snapshot?: Partial<GameState>; // [New] State snapshot for rewind
}

export interface GameState {
  // Game Configuration
  activeGameId: string;
  setGameId: (id: string, reset?: boolean) => Promise<void>;
  isDataLoaded: boolean;
  isHydrated: boolean; // [NEW] Track IDB Rehydration status
  setHydrated: (hydrated: boolean) => void;

  // Save/Load System
  saveToSlot: (slotId: number | string, gameId?: string) => Promise<void>;
  loadFromSlot: (slotId: number | string, gameId?: string) => Promise<boolean>;
  deleteSlot: (slotId: number | string, gameId?: string) => Promise<void>;
  listSaveSlots: (gameId: string) => Promise<SaveSlotMetadata[]>;

  // Event System State
  triggeredEvents: string[];
  activeEvent: any | null;
  addTriggeredEvent: (eventId: string) => void;
  setActiveEvent: (event: any | null) => void;

  chatHistory: Message[];
  displayHistory: Message[];

  // Meta State
  userCoins: number;
  setUserCoins: (coins: number) => void;

  addMessage: (message: Message) => void;
  updateLastMessage: (newText: string) => void; // Partial text update
  replaceLastMessage: (message: Message) => void; // [Fix] Full replacement (Atomic Snapshot)
  clearHistory: () => void;
  truncateHistory: (keepCount: number) => void;

  // [NEW] Story Log (Persistent Narrative History)
  storyLog: StoryLogEntry[];
  addStoryLogEntry: (entry: StoryLogEntry) => void;

  turnCount: number;
  incrementTurnCount: () => void;

  // Visual State
  currentBackground: string;
  setBackground: (bg: string) => void;

  currentBgm: string | null; // [New] Persisted BGM State
  setBgm: (bgm: string | null) => void;
  bgmVolume: number; // 0.0 to 1.0
  setBgmVolume: (vol: number) => void;
  sfxVolume: number; // 0.0 to 1.0
  setSfxVolume: (vol: number) => void;

  characterExpression: string;
  setCharacterExpression: (expr: string) => void;

  playerName: string;
  setPlayerName: (name: string) => void;
  isGodMode?: boolean; // God Mode Debug Flag
  setGodMode: (active: boolean) => void;

  // Lore & Prompt State
  activeCharacters: string[];
  deadCharacters?: string[]; // [NEW] List of dead character IDs
  setActiveCharacters: (chars: string[]) => void;
  addDeadCharacter?: (id: string) => void;
  currentLocation: string;
  setCurrentLocation: (loc: string) => void;
  scenarioSummary: string;
  setScenarioSummary: (summary: string) => void;
  currentEvent: string;
  setCurrentEvent: (event: string) => void;
  // [Deleted] Duplicate Interface Definition

  currentMood: MoodType;
  setMood: (mood: MoodType) => void;

  // [NEW] Last Turn Logic Summary (for PreLogic Context)
  lastTurnSummary: string;
  setLastTurnSummary: (summary: string) => void;

  // Asset Lists
  availableBackgrounds: string[];
  availableCharacterImages: string[];
  availableExtraImages: string[];
  setAvailableAssets: (backgrounds: string[], characters: string[], extraCharacters: string[]) => void;
  setAvailableExtraImages: (extraCharacters: string[]) => void;

  // Dynamic Character Data (Relationship & Memories)
  characterData: Record<string, GameCharacterData>;
  updateCharacterRelationship: (charId: string, value: number) => void;
  // [NEW] Add specific memory to a character
  // [NEW] Add specific memory to a character
  addCharacterMemory: (charId: string, memory: string) => void;
  // [NEW] Update explicit relationship status/speech
  updateCharacterRelationshipInfo: (charId: string, info: Partial<RelationshipInfo>) => void;
  updateCharacterData: (charId: string, data: Partial<GameCharacterData>) => void;

  // Dynamic World Data
  worldData: {
    locations: Record<string, string | { description: string, secrets: string[] }>;
    items: Record<string, string>;
  };
  updateLocation: (id: string, data: any) => void;

  // Stats & Inventory State
  playerStats: PlayerStats;
  statusDescription: string;
  setStatusDescription: (desc: string) => void;
  personalityDescription: string;
  setPersonalityDescription: (desc: string) => void;

  setPlayerStats: (stats: Partial<PlayerStats>) => void;
  inventory: Item[];
  addItem: (item: Item) => void;
  removeItem: (itemId: string, amount?: number) => void;

  // VN State
  scriptQueue: ScriptSegment[];
  setScriptQueue: (queue: ScriptSegment[]) => void;
  currentSegment: ScriptSegment | null;
  setCurrentSegment: (segment: ScriptSegment | null) => void;
  choices: ScriptSegment[];
  setChoices: (choices: ScriptSegment[]) => void;

  // New Phone System
  textMessageHistory: Record<string, { sender: string; content: string; timestamp: number }[]>;
  addTextMessage: (partner: string, message: { sender: string; content: string; timestamp: number }) => void;

  // Settings
  language: 'ko' | 'en' | 'ja' | null;
  setLanguage: (lang: 'ko' | 'en' | 'ja') => void;

  // Time & Day System
  day: number;
  time: string;
  setDay: (day: number) => void;
  setTime: (time: string) => void;
  incrementDay: () => void;

  resetGame: (forceId?: string) => void;

  // [NEW] Story Model Selection
  storyModel: string;
  setStoryModel: (model: string) => void;

  // Loaded Game Logic Functions (Not persisted, reloaded on init)
  getSystemPromptTemplate?: (state: any, language: 'ko' | 'en' | 'ja' | null) => string;
  getRankInfo?: (input: string | number) => any;
  backgroundMappings?: Record<string, string>;
  events?: any[]; // Dynamic events list
  initialScenario?: string;
  wikiData?: any; // [NEW] Added wikiData
  characterMap?: Record<string, string>;
  extraMap?: Record<string, string>;
  constants?: {
    FAMOUS_CHARACTERS: string;
    CORE_RULES: string;
    [key: string]: string;
  };

  lore?: any;
  characterCreationQuestions?: any[]; // [NEW] Added for generic creation support

  // [New] Dynamic Extra Character Mappings
  extraOverrides?: Record<string, string>;
  setExtraOverride: (name: string, imageKey: string) => void;

  // [New] Narrative Systems (Goals & Tension)


  goals: GameGoal[];
  addGoal: (goal: GameGoal) => void;
  updateGoal: (id: string, updates: Partial<GameGoal>) => void;

  tensionLevel: number; // 0-100
  setTensionLevel: (level: number) => void;
  updateTensionLevel: (delta: number) => void;

  // [NEW] Unified Skills System (Replaces Martial Arts)
  skills: Skill[];
  addSkill: (skill: Skill) => void;
  updateSkill: (id: string, updates: Partial<Skill>) => void;

  // [NEW] Choise History for Adaptive Choices
  choiceHistory: ChoiceHistoryEntry[];
  addChoiceToHistory: (entry: ChoiceHistoryEntry) => void;

  // [New] Session Overrides (Hidden Characters)
  personaOverride?: string; // Key for alternate Persona (e.g. Non-possessor)
  scenarioOverride?: string; // Key for alternate Start Scenario
  disabledEvents?: string[]; // List of Event IDs to block
  protagonistImageOverride?: string; // [New] Forces specific image file for '주인공'

  setHiddenOverrides: (overrides: {
    persona?: string,
    scenario?: string,
    disabledEvents?: string[],
    protagonistImage?: string
  }) => void;

  // [NEW] Session Bridging (Fix for SPA Auth Loss)
  sessionUser: any | null; // using 'any' to avoid import issues, conceptually 'User'
  setSessionUser: (user: any | null) => void;

  // [New] Deferred Logic Application
  pendingLogic: any | null;
  // [New] Cloud Save System
  lastCloudSave: number | null;
  saveToCloud: () => Promise<void>;
  loadFromCloud: (gameId?: string) => Promise<boolean>;
  checkForCloudConflict: () => Promise<{ hasConflict: boolean, cloudTurn: number, localTurn: number, cloudTime: string } | null>;

  // [NEW] Ending System
  endingType: 'none' | 'bad' | 'good' | 'true';
  setEndingType: (type: 'none' | 'bad' | 'good' | 'true') => void;
}

export interface ChoiceHistoryEntry {
  text: string;
  type: 'selected' | 'input';
  timestamp: number;
}

export interface Skill {
  id: string;
  name: string;
  rank: string; // e.g. "3성", "절정"
  type: string; // "Swordsmanship", "Neigong"
  description: string;
  proficiency: number; // 0-100
  effects: string[];
  createdTurn: number;
}

export interface GameGoal {
  id: string;
  description: string;
  type: 'MAIN' | 'SUB';
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  createdTurn: number;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  level: number;
  exp: number;
  fame: number;
  fate: number;
  playerRank: string;
  neigong: number; // [Wuxia] Internal Energy (Years)
  final_goal?: string; // [Wuxia] Character's ultimate objective
  faction: string;
  personalitySummary: string;
  str: number; agi: number; int: number; vit: number; luk: number;
  skills: Skill[]; // [Modified] Now array of Skill objects
  personality: {
    morality: number; courage: number; energy: number; decision: number;
    lifestyle: number; openness: number; warmth: number; eloquence: number;
    leadership: number; humor: number; lust: number;
  };
  relationships: Record<string, number>;
  active_injuries?: string[]; // [New]
  memories?: string[]; // [New] Character-specific memories
  fatigue: number; // [New] 0-100
  narrative_perspective?: string; // [New] '1인칭' or '3인칭'
  gender: 'male' | 'female'; // [New] Player Gender

  // [Wuxia] Martial Arts System
  growthStagnation: number; // Turn count without growth
  fameTitleIndex?: number; // [New] Index for FAME_TITLES
}

export interface Skill {
  id: string;
  name: string;
  type: string; // 검법, 도법, 권법, etc.
  rank: string; // 삼류, 이류, ... 현경
  description: string;
  proficiency: number; // 0-100
  effects: string[];
  createdTurn: number;
}

export interface RelationshipInfo {
  status: string | null;      // e.g. "Friend", "Lover", "Enemy"
  speechStyle: string | null; // e.g. "Polite", "Casual", "Archaic"
}

export interface StoryLogEntry {
  turn: number;
  content: string;
  type: 'desc' | 'dialogue' | 'event' | 'narrative';
  timestamp: number;
}

export interface SaveSlotMetadata {
  id: number;
  gameId: string;
  date: string; // ISO String
  summary?: string; // [Modified] Optional, deprecated
  playtime: number; // Seconds (Future)
  turn: number;
  location: string;
  // [NEW] Enhanced Save Info
  playerName?: string;
  mainGoal?: string;
  playerRank?: string; // [NEW]
}

export interface GameCharacterData {
  id: string;
  name: string;
  relationship?: number;
  memories?: string[];
  relationshipInfo?: RelationshipInfo; // [NEW] Explicit Social Contract
  lastActiveTurn?: number; // [NEW] Fatigue System: Last turn character was active (on-stage)
  [key: string]: any; // Allow extensibility
}

export interface Item {
  id: string;
  name: string;
  description: string;
  quantity: number;
}

// Initial Data Helper
const INITIAL_STATS: PlayerStats = {
  hp: 100, maxHp: 100,
  mp: 50, maxMp: 50,
  gold: 0,
  level: 0, exp: 0, // [Modified] Start at Level 0 (Ordinary Person)
  fame: 0,
  fate: 0,
  playerRank: '삼류',
  neigong: 0,
  faction: '무소속',
  personalitySummary: "",
  str: 10, agi: 10, int: 10, vit: 10, luk: 10,
  skills: [],
  personality: {
    morality: 0, courage: 0, energy: 0, decision: 0,
    lifestyle: 0, openness: 0, warmth: 0, eloquence: 0,
    leadership: 0, humor: 0, lust: 0
  },
  relationships: {},
  active_injuries: [],
  fatigue: 0,
  narrative_perspective: '3인칭', // Default
  gender: 'male', // Default Gender
  growthStagnation: 0,
  fameTitleIndex: 0
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      activeGameId: 'god_bless_you', // Default
      storyModel: MODEL_CONFIG.STORY, // Default to Configured Model
      isDataLoaded: false,
      isHydrated: false, // Start false

      setHydrated: (hydrated) => set({ isHydrated: hydrated }),

      setStoryModel: (model) => set({ storyModel: model }),

      // Save/Load Actions
      saveToSlot: async (slotId: number | string, gameId?: string) => {
        const state = get();
        const targetGameId = gameId || state.activeGameId;
        const key = (slotId === 'auto')
          ? `vn_autosave_${targetGameId}`
          : `vn_save_${targetGameId}_${slotId}`;

        const metadata: SaveSlotMetadata = {
          id: typeof slotId === 'number' ? slotId : -1, // -1 for auto
          gameId: targetGameId,
          date: new Date().toISOString(),
          // summary: state.lastTurnSummary ... (Removed as per request)
          playtime: 0, // Placeholder
          turn: state.turnCount,
          location: state.currentLocation,
          // [NEW] Enhanced Info
          playerName: state.playerName,
          mainGoal: state.playerStats.final_goal || state.goals?.find(g => g.type === 'MAIN' && g.status === 'ACTIVE')?.description || "생존",
          playerRank: state.playerStats.playerRank
        };

        // Create a Clean Snapshot
        // We only persist the "Game State" parts, not the methods
        // zustand/persist handles the main persistence, but manual slots are separate
        const snapshot = {
          // Meta
          metadata,
          // Core State
          turnCount: state.turnCount,
          activeGameId: targetGameId,
          userCoins: state.userCoins,
          // Narrative
          chatHistory: state.chatHistory,
          displayHistory: state.displayHistory, // [Fix] Persist Display History too
          storyLog: state.storyLog,
          scenarioSummary: state.scenarioSummary,
          lastTurnSummary: state.lastTurnSummary, // Important for Logic
          // World
          currentLocation: state.currentLocation,
          currentBackground: state.currentBackground,
          currentBgm: state.currentBgm,
          characterExpression: state.characterExpression,
          // Data
          characterData: state.characterData,
          inventory: state.inventory,
          playerStats: state.playerStats,
          goals: state.goals,
          skills: state.skills,
          worldData: state.worldData,
          // Technical
          triggeredEvents: state.triggeredEvents,
          activeEvent: state.activeEvent,
          pendingLogic: state.pendingLogic,
          // [Fix] Persist Execution State
          scriptQueue: state.scriptQueue,
          currentSegment: state.currentSegment,
          choices: state.choices,
          // Config
          playerName: state.playerName,
          language: state.language,
          isGodMode: state.isGodMode,
          // Lists
          activeCharacters: state.activeCharacters,
          deadCharacters: state.deadCharacters,
          extraOverrides: state.extraOverrides,
          choiceHistory: state.choiceHistory,
          endingType: state.endingType,

          timestamp: Date.now()
        };

        try {
          // [Fix] Sanitize snapshot to remove any accidental functions (DataCloneError)
          // Specifically 'setHydrated' or other actions that might have leaked into 'activeEvent' or 'any' types.
          const sanitized = JSON.parse(JSON.stringify(snapshot));
          await idbSet(key, sanitized);
          console.log(`[Store] Saved to slot ${slotId} (${key})`);

          // Only update metadata list for MANUAL numbered slots
          if (typeof slotId === 'number') {
            const metaKey = `vn_metadata_${targetGameId}`;
            const existingMeta = (await idbGet(metaKey)) || [];
            const newMetaList = existingMeta.filter((m: any) => m.id !== slotId);
            newMetaList.push(metadata);
            newMetaList.sort((a: any, b: any) => a.id - b.id);
            await idbSet(metaKey, newMetaList);
          }

        } catch (e) {
          console.error(`[Store] Failed to save to slot ${slotId}:`, e);
          throw e; // Propagate to UI
        }
      },

      loadFromSlot: async (slotId: number | string, gameId?: string) => {
        const state = get();
        // [Fix] Prefer passed gameId logic for Title Screen usage
        const targetGameId = gameId || state.activeGameId;
        const key = (slotId === 'auto')
          ? `vn_autosave_${targetGameId}`
          : `vn_save_${targetGameId}_${slotId}`;

        try {
          const snapshot = await idbGet(key);
          if (!snapshot) {
            console.warn(`[Store] No save found for slot ${slotId}`);
            return false;
          }

          console.log(`[Store] Loading from slot ${slotId} (${key})...`);

          // Hydrate State
          set({
            // Helper: We simply merge the snapshot into state
            // Be careful with objects that need deep merge vs replacement.
            // For Load, REPLACEMENT is usually safer to avoid ghost state.

            // Core
            turnCount: snapshot.turnCount,
            activeGameId: snapshot.activeGameId || targetGameId, // Ensure ID matches
            userCoins: snapshot.userCoins, // Maybe keep global? No, save state has coins at that time.

            // Narrative
            chatHistory: snapshot.chatHistory || [],
            displayHistory: snapshot.displayHistory || [],
            storyLog: snapshot.storyLog || [],
            scenarioSummary: snapshot.scenarioSummary || "",
            lastTurnSummary: snapshot.lastTurnSummary || "",

            // World & Visuals
            currentLocation: snapshot.currentLocation,
            currentBackground: snapshot.currentBackground,
            currentBgm: snapshot.currentBgm,
            characterExpression: snapshot.characterExpression,

            // Data
            characterData: snapshot.characterData || {},
            inventory: snapshot.inventory || [],
            playerStats: snapshot.playerStats || INITIAL_STATS, // Fallback
            goals: snapshot.goals || [],
            skills: snapshot.skills || [],
            worldData: snapshot.worldData || { locations: {}, items: {} },

            // Technical
            triggeredEvents: snapshot.triggeredEvents || [],
            activeEvent: snapshot.activeEvent || null,
            pendingLogic: snapshot.pendingLogic || null,

            // [Fix] Restore Execution State
            choices: snapshot.choices || [],
            scriptQueue: snapshot.scriptQueue || [],
            currentSegment: snapshot.currentSegment || null,

            // Config
            playerName: snapshot.playerName,
            // language: snapshot.language, // Keep User Preference? Or Load? -> Usually Preference dominates, but let's see.
            // Logic: If I saved in EN, do I want to load in EN? Probably yes for consistency of generated text.

            // Lists
            activeCharacters: snapshot.activeCharacters || [],
            deadCharacters: snapshot.deadCharacters || [],
            extraOverrides: snapshot.extraOverrides || [],
            choiceHistory: snapshot.choiceHistory || [],
            endingType: snapshot.endingType || 'none',

            isDataLoaded: true, // Mark as ready
          });

          // [Fix] Rehydrate Static Data after Slot Load as well
          const loadedGameId = snapshot.activeGameId || targetGameId;
          try {
            const staticData = await DataManager.loadGameData(loadedGameId);
            set({
              lore: staticData.lore || {},
              worldData: staticData.world || { locations: {}, items: {} },
              availableBackgrounds: staticData.backgroundList || [],
              availableCharacterImages: staticData.characterImageList || [],
              availableExtraImages: staticData.extraCharacterList || [],
              backgroundMappings: staticData.backgroundMappings || {},
              // functions...
            });
          } catch (e) { console.warn("[Store] Static data rehydrate failed on loadFromSlot", e); }

          // Trigger a lightweight consistency check or re-render trigger if needed
          return true;

        } catch (e) {
          console.error(`[Store] Failed to load slot ${slotId}:`, e);
          return false;
        }
      },

      deleteSlot: async (slotId: number | string, gameId?: string) => {
        const state = get();
        const targetGameId = gameId || state.activeGameId;
        const key = (slotId === 'auto')
          ? `vn_autosave_${targetGameId}`
          : `vn_save_${targetGameId}_${slotId}`;

        try {
          await idbDel(key);
          console.log(`[Store] Deleted slot ${slotId}`);

          // Only update metadata if manual
          if (typeof slotId === 'number') {
            const metaKey = `vn_metadata_${targetGameId}`;
            const existingMeta = (await idbGet(metaKey)) || [];
            const newMetaList = existingMeta.filter((m: any) => m.id !== slotId);
            await idbSet(metaKey, newMetaList);
          }
        } catch (e) {
          console.error(`[Store] Failed to delete slot ${slotId}:`, e);
          throw e;
        }
      },

      listSaveSlots: async (gameId: string) => {
        const metaKey = `vn_metadata_${gameId}`;
        try {
          return (await idbGet(metaKey)) || [];
        } catch (e) {
          return [];
        }
      },

      // [NEW] Session Bridging
      sessionUser: null,
      setSessionUser: (user) => set({ sessionUser: user }),

      setGameId: async (id: string, reset?: boolean) => {
        console.log("[Store] setGameId called with:", id);
        console.log("[Store] Current Choices BEFORE setGameId:", get().choices);
        set({ isDataLoaded: false });
        try {
          const data = await DataManager.loadGameData(id);

          // Process Characters
          const initialCharacterData: Record<string, any> = {};
          const charList = data.characters;

          if (Array.isArray(charList)) {
            charList.forEach((c: any) => {
              if (c.name) initialCharacterData[c.name] = c;
            });
          } else {
            Object.assign(initialCharacterData, charList);
          }

          // Transform for State
          const existingCharData = get().characterData || {};
          const charState = Object.values(initialCharacterData).reduce((acc: any, char: any) => {
            // [Fix] Use Normalized Key (Defaulting to 'ko' if not set yet, or rely on internal store check)
            // But we can check get().language
            const lang = get().language || undefined;
            const normalizedKey = normalizeCharacterId(char.id || char.name, lang);

            const existing = existingCharData[normalizedKey] || {};

            acc[normalizedKey] = {
              ...char,
              id: normalizedKey, // Enforce Normalized ID inside object
              // [Fix] Preserve Dynamic Fields from Persistence
              relationship: existing.relationship ?? char.relationship ?? 0,
              memories: existing.memories?.length ? existing.memories : (char.memories || []),
              relationshipInfo: existing.relationshipInfo || char.relationshipInfo || { status: null, speechStyle: null },
            };
            return acc;
          }, {});

          // [Refactor] Load Logic from Registry
          const config = GameRegistry.get(id);
          if (!config) {
            console.error(`[Store] Unknown Game ID: ${id}`);
            // Fallback to DataManager default logic or error handling
          }

          set((state) => {
            const isDifferentGame = state.activeGameId !== id;
            if (isDifferentGame || reset) {
              // ... RESET LOGIC ...
              // Existing logic
              return {
                activeGameId: id,
                isDataLoaded: true,
                lore: data.lore,
                worldData: data.world, // Changed from data.worldData to data.world to match original
                availableBackgrounds: data.backgroundList,
                availableCharacterImages: data.characterImageList || [],
                availableExtraImages: data.extraCharacterList || [],
                backgroundMappings: config?.assets.backgroundMap || data.backgroundMappings, // Re-added config logic
                events: data.events, // Load events
                initialScenario: data.scenario,
                wikiData: data.wikiData,
                characterMap: data.characterMap, // Added
                extraMap: data.extraMap, // Added
                constants: data.constants, // Added
                characterCreationQuestions: data.characterCreationQuestions, // Added
                characterData: charState, // Reset to initial static state (relationships 0)
                getSystemPromptTemplate: config?.getSystemPromptTemplate || data.getSystemPromptTemplate,
                getRankInfo: config?.getRankInfo || data.getRankInfo,

                // Reset Play State
                turnCount: 0,
                chatHistory: [],
                displayHistory: [],
                storyLog: [],
                activeCharacters: [],
                activeEvent: null,
                triggeredEvents: [],
                inventory: [],
                playerStats: JSON.parse(JSON.stringify(INITIAL_STATS)), // Deep Copy
                goals: [],
                skills: [],
                choices: [],
                scriptQueue: [],
                currentSegment: null,
                currentBackground: '', // Will be set by init logic or script
                characterExpression: 'normal', // [Fix logic]
                currentBgm: null,
                pendingLogic: null,
                endingType: 'none', // Reset Ending
              };
            }
            // Just update static data if same game
            return {
              activeGameId: id,
              isDataLoaded: true,
              lore: data.lore,
              worldData: data.world, // Changed from data.worldData to data.world to match original
              availableBackgrounds: data.backgroundList,
              availableCharacterImages: data.characterImageList || [],
              availableExtraImages: data.extraCharacterList || [],
              backgroundMappings: config?.assets.backgroundMap || data.backgroundMappings, // Update mappings
              events: data.events, // Load events
              initialScenario: data.scenario,
              wikiData: data.wikiData,
              characterMap: data.characterMap, // Added
              extraMap: data.extraMap, // Added
              constants: data.constants, // Added
              characterCreationQuestions: data.characterCreationQuestions, // Added
              getSystemPromptTemplate: config?.getSystemPromptTemplate || data.getSystemPromptTemplate,
              getRankInfo: config?.getRankInfo || data.getRankInfo,
            };
          });

          // If we are switching games, we should probably reset the session unless it's just a reload.
          // Logic for "Fresh Start" vs "Reload" needs to be handled by caller.

        } catch (e) {
          console.error("Failed to set game ID:", e);
        }
      },

      chatHistory: [],
      displayHistory: [],
      storyLog: [],

      addStoryLogEntry: (entry) => set((state) => ({
        storyLog: [...state.storyLog, entry]
      })),

      triggeredEvents: [],
      activeEvent: null,
      addTriggeredEvent: (eventId) => set((state) => ({
        triggeredEvents: [...state.triggeredEvents, eventId]
      })),
      setActiveEvent: (event) => set({ activeEvent: event }),

      userCoins: 0,
      setUserCoins: (coins) => set({ userCoins: coins }),

      addMessage: (message) => set((state) => ({
        chatHistory: [...state.chatHistory, message],
        displayHistory: [...(state.displayHistory || []), message]
      })),
      updateLastMessage: (newText) => set((state) => {
        const history = [...state.chatHistory];
        if (history.length === 0) return {};
        const lastMsg = { ...history[history.length - 1], text: newText };
        history[history.length - 1] = lastMsg;

        // [Fix] Also update displayHistory to ensure HistoryModal sees the changes
        const displayHistory = state.displayHistory ? [...state.displayHistory] : [...history];
        if (displayHistory.length > 0) {
          displayHistory[displayHistory.length - 1] = {
            ...displayHistory[displayHistory.length - 1],
            text: newText
          };
        }

        return { chatHistory: history, displayHistory };
      }),
      replaceLastMessage: (message) => set((state) => {
        const history = [...state.chatHistory];
        if (history.length > 0) history[history.length - 1] = message;

        const display = state.displayHistory ? [...state.displayHistory] : [];
        if (display.length > 0) display[display.length - 1] = message;

        return { chatHistory: history, displayHistory: display };
      }),
      clearHistory: () => set({ chatHistory: [], displayHistory: [] }),
      truncateHistory: (keepCount) => set((state) => {
        let newHistory = state.chatHistory.slice(-keepCount);
        if (newHistory.length > 0 && newHistory[0].role === 'model') {
          newHistory = newHistory.slice(1);
        }
        return { chatHistory: newHistory };
      }),

      turnCount: 0,
      incrementTurnCount: () => {
        set((state) => ({ turnCount: state.turnCount + 1 }));
        // [Cloud] Auto-save removed from here to prevent saving "Limbo" state.
        // Moved to setChoices.
      },

      currentBackground: '/assets/backgrounds/Default_Fallback.jpg',
      setBackground: (bg) => set({ currentBackground: bg }),

      currentBgm: null,
      setBgm: (bgm) => set({ currentBgm: bgm }),
      bgmVolume: 0.5,
      setBgmVolume: (vol) => set({ bgmVolume: Math.max(0, Math.min(1, vol)) }),
      sfxVolume: 0.5,
      setSfxVolume: (vol) => set({ sfxVolume: Math.max(0, Math.min(1, vol)) }),

      characterExpression: 'normal',
      setCharacterExpression: (expr) => set({ characterExpression: expr }),

      playerName: '주인공',
      setPlayerName: (name) => set({ playerName: name }),
      isGodMode: false,
      setGodMode: (active) => set({ isGodMode: active }),

      activeCharacters: [],
      deadCharacters: [], // [NEW] Added for death tracking
      setActiveCharacters: (chars) => set((state) => {
        // [New] Fatigue System Tracking
        // Update 'lastActiveTurn' for all characters currently becoming active.
        const updates: Record<string, GameCharacterData> = {};
        const currentTurn = state.turnCount;

        chars.forEach(id => {
          const normalizedId = normalizeCharacterId(id, state.language || undefined);
          const existing = state.characterData[normalizedId];

          // Only update if it changes or is new (to avoid infinite re-renders if used in effects, though this is set state)
          // Actually we MUST update it every turn if they remain active? 
          // The logic says "turnsSinceExit". So we only need to record the LAST turn they were seen.
          // If they are active NOW (Turn 10), set lastActiveTurn = 10.
          // Next turn (Turn 11), if they are NOT active, turnsSinceExit = 11 - 10 = 1.
          updates[normalizedId] = {
            ...(existing || { id: normalizedId, name: normalizedId, relationship: 0, memories: [] }),
            lastActiveTurn: currentTurn
          };
        });

        return {
          activeCharacters: chars,
          characterData: {
            ...state.characterData,
            ...updates
          }
        };
      }),
      addDeadCharacter: (id) => set((state) => ({ deadCharacters: [...(state.deadCharacters || []), id] })),
      currentLocation: '폐가', // Default Wuxia Start (Abandoned House)
      setCurrentLocation: (loc) => set({ currentLocation: loc }),
      scenarioSummary: '',
      setScenarioSummary: (summary) => set({ scenarioSummary: summary }),
      currentEvent: '',
      setCurrentEvent: (event) => set({ currentEvent: event }),
      currentMood: 'daily',
      setMood: (mood) => set({ currentMood: mood }),

      // [Deleted] Redundant Property
      // [Deleted] Duplicate Implementation

      lastTurnSummary: '',
      setLastTurnSummary: (summary) => set({ lastTurnSummary: summary }),

      availableBackgrounds: [],
      availableCharacterImages: [],
      availableExtraImages: [],
      setAvailableAssets: (backgrounds, characters, extraCharacters) => set({
        availableBackgrounds: backgrounds,
        availableCharacterImages: characters,
        availableExtraImages: extraCharacters
      }),
      setAvailableExtraImages: (extraCharacters) => set({ availableExtraImages: extraCharacters }),

      characterData: {}, // Initialized empty, filled by setGameId
      updateCharacterRelationship: (charId, value) => set((state) => {
        const normalizedId = normalizeCharacterId(charId, state.language || undefined);
        const char = state.characterData[normalizedId];
        // Auto-create if missing (Safe Fallback)
        const effectiveChar = char || { id: normalizedId, name: normalizedId, relationship: 0, memories: [] };

        return {
          characterData: {
            ...state.characterData,
            [normalizedId]: { ...effectiveChar, relationship: value }
          }
        };
      }),
      addCharacterMemory: (charId, memory) => set((state) => {
        const normalizedId = normalizeCharacterId(charId, state.language || undefined);
        const currentData = state.characterData[normalizedId] || {
          id: normalizedId, name: normalizedId, relationship: 0, memories: []
        };
        const currentMemories = currentData.memories || [];

        // Avoid duplicates
        if (currentMemories.includes(memory)) return {};

        let newMemories = [...currentMemories, memory];

        // [Safety] Hard Limit Cap to prevent infinite bloat (50 max)
        if (newMemories.length > 50) {
          newMemories = newMemories.slice(-50);
        }

        return {
          characterData: {
            ...state.characterData,
            [normalizedId]: {
              ...currentData,
              memories: newMemories
            }
          }
        };
      }),
      // [NEW] Update Explicit Relationship Status & Speech Style
      updateCharacterRelationshipInfo: (charId, info) => set((state) => {
        const normalizedId = normalizeCharacterId(charId, state.language || undefined);
        const char = state.characterData[normalizedId];

        const effectiveChar = char || { id: normalizedId, name: normalizedId, relationship: 0, memories: [] };

        const currentInfo = effectiveChar.relationshipInfo || { status: null, speechStyle: null };
        const newInfo = { ...currentInfo, ...info };

        return {
          characterData: {
            ...state.characterData,
            [normalizedId]: {
              ...effectiveChar,
              relationshipInfo: newInfo
            }
          }
        };
      }),
      updateCharacterData: (id, data) => set((state) => {
        const normalizedId = normalizeCharacterId(id, state.language || undefined);
        const existingChar = state.characterData[normalizedId];
        if (!existingChar) return {};
        return {
          characterData: {
            ...state.characterData,
            [normalizedId]: { ...existingChar, ...data }
          }
        };
      }),

      worldData: { locations: {}, items: {} }, // Initialized empty
      updateLocation: (id, data) => set((state) => ({
        worldData: {
          ...state.worldData,
          locations: {
            ...state.worldData.locations,
            [id]: typeof state.worldData.locations[id] === 'string'
              ? { description: state.worldData.locations[id] as string, ...data }
              : { ...(state.worldData.locations[id] as object), ...data }
          }
        }
      })),

      statusDescription: "건강함",
      setStatusDescription: (desc) => set({ statusDescription: desc }),
      personalityDescription: "평범함",
      setPersonalityDescription: (desc) => set({ personalityDescription: desc }),

      playerStats: INITIAL_STATS,
      setPlayerStats: (stats) => set((state) => ({
        playerStats: { ...state.playerStats, ...stats }
      })),

      inventory: [],
      addItem: (item) => set((state) => {
        const existing = state.inventory.find(i => i.id === item.id);
        if (existing) {
          return {
            inventory: state.inventory.map(i =>
              i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
            )
          };
        }
        return { inventory: [...state.inventory, item] };
      }),
      removeItem: (itemId, amount = 1) => set((state) => {
        const existing = state.inventory.find(i => i.id === itemId);
        if (!existing) return {};
        const newQuantity = existing.quantity - amount;
        if (newQuantity <= 0) {
          return { inventory: state.inventory.filter(i => i.id !== itemId) };
        }
        return {
          inventory: state.inventory.map(i =>
            i.id === itemId ? { ...i, quantity: newQuantity } : i
          )
        };
      }),

      scriptQueue: [],
      setScriptQueue: (queue) => {
        set({ scriptQueue: queue });
        // [Fix] Auto Save on Script Update (Linear Progress Persistence)
        if (queue && queue.length > 0) {
          get().saveToSlot('auto');
        }
      },
      currentSegment: null,
      setCurrentSegment: (segment) => set({ currentSegment: segment }),
      choices: [],
      setChoices: (choices) => {
        console.log("[Store] setChoices called with:", choices);
        if (choices.length === 0) console.trace("[Store] setChoices([]) called from:");
        set({ choices });

        // [Cloud] Auto-save Trigger: Only save when user input is required (Stable State)
        // This prevents saving empty states during processing.
        if (choices.length > 0) {
          console.log('[Store] Auto-saving at Choice Point');
          get().saveToCloud();
          // [Fix] Also save to Local Auto Slot (Per-Game Mode Isolation)
          get().saveToSlot('auto');
        }
      },

      textMessageHistory: {},
      addTextMessage: (partner, message) => set((state) => {
        const history = { ...state.textMessageHistory };
        // Create shallow copy of the specific array to avoid mutating state
        const partnerHistory = history[partner] ? [...history[partner]] : [];

        const lastMsg = partnerHistory[partnerHistory.length - 1];
        if (lastMsg && lastMsg.content === message.content && lastMsg.sender === message.sender) {
          return {};
        }

        partnerHistory.push(message);
        history[partner] = partnerHistory;

        return { textMessageHistory: history };
      }),

      language: 'ko',
      setLanguage: (lang) => set({ language: lang }),

      day: 1,
      time: 'Morning',
      setDay: (day) => set({ day }),
      setTime: (time) => set({ time }),
      incrementDay: () => set((state) => ({ day: state.day + 1, time: 'Morning' })),



      extraOverrides: {},
      setExtraOverride: (name, imageKey) => set((state) => ({
        extraOverrides: { ...state.extraOverrides, [name]: imageKey }
      })),

      goals: [],
      addGoal: (goal) => set((state) => {
        // [Fix] Prevent Duplicates (Check by Description)
        const exists = state.goals.some(g => g.description.trim() === goal.description.trim() && g.status === 'ACTIVE');
        if (exists) return {};
        return { goals: [...state.goals, goal] };
      }),
      updateGoal: (id, updates) => set((state) => ({
        goals: state.goals.map(g => g.id === id ? { ...g, ...updates } : g)
      })),

      tensionLevel: 0,
      setTensionLevel: (level) => set({ tensionLevel: Math.max(-100, Math.min(100, level)) }),
      updateTensionLevel: (delta) => set((state) => ({
        tensionLevel: Math.max(-100, Math.min(100, state.tensionLevel + delta))
      })),

      endingType: 'none',
      setEndingType: (type) => set({ endingType: type }),

      // [NEW] Unified Skill Implementation
      skills: [],
      addSkill: (skill) => set((state) => ({
        skills: [...state.skills, skill]
      })),
      updateSkill: (id, updates) => set((state) => ({
        skills: state.skills.map(s => s.id === id ? { ...s, ...updates } : s)
      })),

      setHiddenOverrides: (overrides) => {
        set((state) => ({
          personaOverride: overrides.persona !== undefined ? overrides.persona : state.personaOverride,
          scenarioOverride: overrides.scenario !== undefined ? overrides.scenario : state.scenarioOverride,
          disabledEvents: overrides.disabledEvents !== undefined ? overrides.disabledEvents : state.disabledEvents,
          protagonistImageOverride: overrides.protagonistImage !== undefined ? overrides.protagonistImage : state.protagonistImageOverride
        }));
      },

      choiceHistory: [],
      addChoiceToHistory: (entry) => set((state) => {
        const newHistory = [...state.choiceHistory, entry];
        // Keep only the last 20 entries to prevent context bloat
        return { choiceHistory: newHistory.slice(-20) };
      }),

      resetGame: (forceId?: string) => {
        PromptManager.clearPromptCache();
        // [Fix] Capture current ID to ensure it persists explicitly
        // If forceId is provided (e.g. from session recovery), use it.
        const currentActiveGameId = forceId || get().activeGameId;

        set({
          activeGameId: currentActiveGameId, // [Fix] Re-assert activeGameId
          chatHistory: [],
          displayHistory: [],
          currentBackground: 'default',
          characterExpression: 'normal',
          activeCharacters: [],
          currentLocation: 'home',
          // playerName: '주인공', // [Modified] Preserve playerName on reset (User request)
          scenarioSummary: '',
          turnCount: 0,
          day: 1,
          time: 'Morning',
          currentEvent: '',
          currentMood: 'daily',
          // [Deleted] Duplicate Reset Logic

          lastTurnSummary: '',
          statusDescription: '건강함',
          personalityDescription: '평범함',
          playerStats: (() => {
            const stats = JSON.parse(JSON.stringify(INITIAL_STATS));
            if (currentActiveGameId === 'god_bless_you') {
              stats.gold = 100000;
              stats.level = 0; // Ensure Level 0
            }
            return stats;
          })(), // [Fix] Deep clone to prevent polluted reference
          inventory: [],
          scriptQueue: [],
          currentSegment: null,
          choices: [],
          textMessageHistory: {},
          triggeredEvents: [],
          activeEvent: null,
          extraOverrides: {},
          characterData: {}, // [Fix] Clear character data so it reloads fresh on next init
          lore: {}, // [Fix] Clear lore as well
          goals: [],
          tensionLevel: 0,
        });
      },

      pendingLogic: null,
      setPendingLogic: (logic: any) => set({ pendingLogic: logic }),

      // [Cloud Save Implementation]
      lastCloudSave: null,

      saveToCloud: async () => {
        const state = get();
        const user = state.sessionUser;
        if (!user) return;

        console.log("[Store] Starting Cloud Save...");
        const supabase = createClient();
        if (!supabase) return;

        try {
          // 1. Prepare Data (Filter non-essential & huge static data)
          const {
            // Functions & Actions
            saveToCloud, loadFromCloud, checkForCloudConflict,
            setGameId, addMessage, updateLastMessage, incrementTurnCount, // ...exclude all methods

            // Static / Cache Data (Re-fetched on load)
            isDataLoaded,
            lore, worldData, availableBackgrounds, availableCharacterImages, availableExtraImages, backgroundMappings,

            // Session specific
            sessionUser, lastCloudSave,

            // Target Data to Save
            ...dataToSave
          } = state;

          // 2. Optimize History (Remove Snapshots)
          const optimizedChatHistory = state.chatHistory.map(msg => {
            const { snapshot, ...rest } = msg; return rest;
          });
          const optimizedDisplayHistory = state.displayHistory.map(msg => {
            const { snapshot, ...rest } = msg; return rest;
          });

          // 3. Construct Payload
          const payload = {
            ...dataToSave,
            chatHistory: optimizedChatHistory,
            displayHistory: optimizedDisplayHistory,
            // Ensure choices/queue are saved
            choices: state.choices,
            scriptQueue: state.scriptQueue,
            currentSegment: state.currentSegment
          };

          // 4. Compress
          const jsonString = JSON.stringify(payload);
          const compressed = LZString.compressToUTF16(jsonString);

          // 5. Upload
          const { error } = await supabase
            .from('game_saves')
            .upsert({
              user_id: user.id,
              game_id: state.activeGameId,
              save_data: { v: 1, data: compressed }, // Wrap in object for jsonb
              turn_count: state.turnCount,
              updated_at: new Date().toISOString()
            });

          if (error) {
            console.error("[Store] Cloud Save Failed:", JSON.stringify(error, null, 2));
          } else {
            console.log(`[Store] Cloud Save Success (Turn ${state.turnCount})`);
            set({ lastCloudSave: Date.now() });
          }
        } catch (e) {
          console.error("[Store] Cloud Save Exception:", e);
        }
      },

      loadFromCloud: async (gameId?: string) => {
        const state = get();
        const user = state.sessionUser;
        if (!user) return false;

        const queryGameId = gameId || state.activeGameId;
        console.log("[Store] loadFromCloud (v2) called. GameID Arg:", gameId, "Active:", state.activeGameId, "Target:", queryGameId);

        const supabase = createClient();
        if (!supabase) return false;

        try {
          const { data, error } = await supabase
            .from('game_saves')
            .select('save_data')
            .eq('user_id', user.id)
            .eq('game_id', queryGameId)
            .order('updated_at', { ascending: false })
            .limit(1);

          if (error) {
            console.error("[Store] Cloud Load Error:", error);
            return false;
          }

          const row = data && data.length > 0 ? data[0] : null;

          if (!row) {
            console.warn("[Store] No Cloud Save Found");
            return false;
          }

          // Decompress
          const wrapper = row.save_data as any; // { v: 1, data: ... }
          const compressed = wrapper.data || wrapper; // Handle both just in case

          let parsed: Partial<GameState> = {};

          if (typeof compressed === 'string') {
            const decompressed = LZString.decompressFromUTF16(compressed);
            if (!decompressed) throw new Error("Decompression failed");
            parsed = JSON.parse(decompressed);
          } else {
            parsed = compressed; // Fallback for raw json
          }

          // Hydrate
          // [Fix] Rehydrate Static Data (stripped during saveToCloud) using DataManager
          const targetGameId = parsed.activeGameId || state.activeGameId || 'wuxia';

          let staticData: any = {};
          try {
            console.log(`[Store] Rehydrating static data for ${targetGameId}...`);
            staticData = await DataManager.loadGameData(targetGameId);
          } catch (err) {
            console.error("[Store] Failed to rehydrate static data:", err);
            // Fallback: Continue without static data (might cause issues but better than hard crash)
          }

          set({
            ...parsed,
            // Merge Static Data
            lore: staticData.lore || {},
            worldData: staticData.world || { locations: {}, items: {} },
            availableBackgrounds: staticData.backgroundList || [],
            availableCharacterImages: staticData.characterImageList || [],
            availableExtraImages: staticData.extraCharacterList || [],
            backgroundMappings: staticData.backgroundMappings || {},
            getSystemPromptTemplate: staticData.getSystemPromptTemplate, // Restore functions if needed (though store has them usually?) 
            // Actually, we can't easily restore functions from DataManager object to Store root if they aren't part of initial state shape managed by store creator?
            // The store creator defines methods. 
            // DataManager returns: { lore, ... }
            // We should ensure 'events' and 'characterMap' are also restored if they are used.
            characterMap: staticData.characterMap || {},
            extraMap: staticData.extraMap || {},
            constants: staticData.constants || {}, // If used

            isDataLoaded: true, // Mark data as loaded
            // Ensure methods are not overwritten (spread order protects them if they are in prototype/store definition, 
            // but here we are merging into state object. Zustand handles merging.)

            // [Fix] Explicitly Restore Execution State for Cloud Load
            choices: parsed.choices || [],
            scriptQueue: parsed.scriptQueue || [],
            currentSegment: parsed.currentSegment || null,
          });

          console.log("[Store] Cloud Save Loaded Successfully");
          return true;

        } catch (e) {
          console.error("[Store] Load Exception:", e);
          return false;
        }
      },

      checkForCloudConflict: async () => {
        const state = get();
        const user = state.sessionUser;
        if (!user) return null;

        const supabase = createClient();
        if (!supabase) return null;

        const { data, error } = await supabase
          .from('game_saves')
          .select('updated_at, turn_count')
          .eq('user_id', user.id)
          .eq('game_id', state.activeGameId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !data) return null;

        const cloudTime = new Date(data.updated_at).getTime();
        // We don't track local updated_at precisely in state, but we can compare turn counts or rely on Login Event
        // Or we can add `lastSaved` to state.
        // For now, let's assume if Cloud exists we check if it looks 'newer' or 'different'.
        // Logic: If Cloud Turn > Local Turn, it's definitely a conflict/newer.
        // If Cloud Turn < Local Turn, we might strictly ignore or warn?

        const localTurn = state.turnCount;

        if (data.turn_count > localTurn) {
          return {
            hasConflict: true,
            cloudTurn: data.turn_count,
            localTurn: localTurn,
            cloudTime: data.updated_at
          };
        }
        return null;
      },
    }),
    {
      name: 'vn-game-storage-v2',
      partialize: (state) => {
        // [Optimization] Exclude huge static data and ephemeral execution state
        const {
          // Functions (Automatically excluded but listed for clarity)
          getSystemPromptTemplate,
          getRankInfo,
          setAvailableAssets,

          // Static content that rehydrates from files
          lore,
          worldData,
          availableBackgrounds,
          availableCharacterImages,
          availableExtraImages,
          backgroundMappings,

          // Ephemeral execution state (no need to persist, should reset on reload)
          // scriptQueue, // [Persisted]
          // currentSegment, // [Persisted]
          // choices, // [Persisted]
          isDataLoaded,

          // The State itself to process
          chatHistory,
          displayHistory,
          ...persistedState
        } = state;

        // [Crucial] Strip Snapshots from history to prevent recursion & quota explosion
        // Snapshots are only for intra-session rewind, not needed across reloads
        const lightweightChatHistory = chatHistory.map(msg => {
          const { snapshot, ...rest } = msg;
          return rest;
        });

        const lightweightDisplayHistory = displayHistory.map(msg => {
          const { snapshot, ...rest } = msg;
          return rest;
        });

        return {
          ...persistedState,
          choices: state.choices, // [Fix] Explicitly persist
          scriptQueue: state.scriptQueue, // [Fix] Explicitly persist
          currentSegment: state.currentSegment, // [Fix] Explicitly persist
          chatHistory: lightweightChatHistory,
          displayHistory: lightweightDisplayHistory
        };
      },
      storage: {
        getItem: async (name: string) => {
          // 1. Try IndexedDB first
          try {
            const idbValue = await idbGet(name);
            if (idbValue) {
              // console.log(`[Store] Loaded ${name} from IndexedDB`);
              return idbValue;
            }
          } catch (e) {
            console.error('[Store] Failed to load from IDB:', e);
          }

          // 2. Fallback: Migration from localStorage
          const localStr = localStorage.getItem(name);
          if (localStr) {
            try {
              console.log(`[Store] Migrating ${name} from localStorage to IndexedDB...`);
              const parsed = JSON.parse(localStr);
              // Save to IDB for next time
              await idbSet(name, parsed);
              // Clear old data to free up space (Safety: Only after parse success)
              localStorage.removeItem(name);
              return parsed;
            } catch (e) {
              console.error('[Store] Failed to migrate corrupted localStorage data:', e);
              localStorage.removeItem(name); // It's bad anyway
              return null;
            }
          }
          return null;
        },
        setItem: async (name: string, value: any) => {
          try {
            // [Fix] DataCloneError prevention
            // IndexedDB cannot clone functions. Since we were using localStorage (JSON),
            // using JSON serialization here is safe and effectively strips all functions/proxies.
            const sanitized = JSON.parse(JSON.stringify(value));
            await idbSet(name, sanitized);
          } catch (e) {
            console.error('[Store] Failed to save to IDB:', e);
          }
        },
        removeItem: async (name: string) => {
          await idbDel(name);
        },
      },
      onRehydrateStorage: () => (state) => {
        console.log("[Store] Rehydration Finished.", state ? "Success" : "No State");
        // [Fix] Signal availability using the Store Instance directly
        // 'state' here is the rehydrated JSON (no methods), so state.setHydrated is undefined.
        // We must reach into the store to set the flag on the opaque state.
        useGameStore.getState().setHydrated(true);
      }
    }
  )
);
