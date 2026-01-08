import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ScriptSegment } from '@/lib/script-parser';
import { MoodType } from '@/data/prompts/moods';
import { DataManager, GameData } from './data-manager';
import { PromptManager } from './prompt-manager';
import { MODEL_CONFIG } from './model-config';

export interface Message {
  role: 'user' | 'model';
  text: string;
  snapshot?: Partial<GameState>; // [New] State snapshot for rewind
}

export interface GameState {
  // Game Configuration
  activeGameId: string;
  setGameId: (id: string) => Promise<void>;
  isDataLoaded: boolean;

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
  updateLastMessage: (newText: string) => void; // [Fix] Allow updating last message for async content
  clearHistory: () => void;
  truncateHistory: (keepCount: number) => void;

  turnCount: number;
  incrementTurnCount: () => void;

  // Visual State
  currentBackground: string;
  setBackground: (bg: string) => void;

  currentBgm: string | null; // [New] Persisted BGM State
  setBgm: (bgm: string | null) => void;

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
  language: 'ko' | 'en' | null;
  setLanguage: (lang: 'ko' | 'en') => void;

  // Time & Day System
  day: number;
  time: string;
  setDay: (day: number) => void;
  setTime: (time: string) => void;
  incrementDay: () => void;

  resetGame: () => void;

  // [NEW] Story Model Selection
  storyModel: string;
  setStoryModel: (model: string) => void;

  // Loaded Game Logic Functions (Not persisted, reloaded on init)
  getSystemPromptTemplate?: (state: any, language: 'ko' | 'en' | 'ja' | null) => string;
  getRankInfo?: (fame: number) => any;
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

export interface GameCharacterData {
  id: string;
  name: string;
  relationship?: number;
  memories?: string[];
  relationshipInfo?: RelationshipInfo; // [NEW] Explicit Social Contract
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
  level: 1, exp: 0,
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
      activeGameId: 'wuxia', // Default
      storyModel: MODEL_CONFIG.STORY, // Default to Configured Model
      isDataLoaded: false,

      setStoryModel: (model) => set({ storyModel: model }),

      setGameId: async (id: string) => {
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
          const charState = Object.values(initialCharacterData).reduce((acc: any, char: any) => {
            acc[char.name] = { ...char, id: char.id || char.name }; // ID is English ID if exists, else Name
            return acc;
          }, {});

          set({
            activeGameId: id,
            worldData: data.world,
            characterData: charState,
            // We also need to store functions/mappings transiently or in state?
            // Functions cannot be persisted by default.
            // We will need to re-load them when the app starts if we persist state.
            // For now, we will add them to the state but exclude from persistence.
            getSystemPromptTemplate: data.getSystemPromptTemplate,
            getRankInfo: data.getRankInfo,
            backgroundMappings: data.backgroundMappings,
            events: data.events, // Load events
            isDataLoaded: true,

            // Also update available backgrounds list
            availableBackgrounds: data.backgroundList,
            availableCharacterImages: data.characterImageList || [],
            availableExtraImages: data.extraCharacterList || [],

            // Reset game when switching? Maybe optional.
            // For now, let's reset to ensure clean state.
            initialScenario: data.scenario,
            wikiData: data.wikiData,
            characterMap: data.characterMap, // Added
            extraMap: data.extraMap, // Added
            constants: data.constants, // Added
            lore: data.lore, // Added
            characterCreationQuestions: data.characterCreationQuestions, // Added
          });

          // If we are switching games, we should probably reset the session unless it's just a reload.
          // Logic for "Fresh Start" vs "Reload" needs to be handled by caller.

        } catch (e) {
          console.error("Failed to set game ID:", e);
        }
      },

      chatHistory: [],
      displayHistory: [],

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
      clearHistory: () => set({ chatHistory: [], displayHistory: [] }),
      truncateHistory: (keepCount) => set((state) => {
        let newHistory = state.chatHistory.slice(-keepCount);
        if (newHistory.length > 0 && newHistory[0].role === 'model') {
          newHistory = newHistory.slice(1);
        }
        return { chatHistory: newHistory };
      }),

      turnCount: 0,
      incrementTurnCount: () => set((state) => ({ turnCount: state.turnCount + 1 })),

      currentBackground: '/assets/backgrounds/Default_Fallback.jpg',
      setBackground: (bg) => set({ currentBackground: bg }),

      currentBgm: null,
      setBgm: (bgm) => set({ currentBgm: bgm }),

      characterExpression: 'normal',
      setCharacterExpression: (expr) => set({ characterExpression: expr }),

      playerName: '주인공',
      setPlayerName: (name) => set({ playerName: name }),
      isGodMode: false,
      setGodMode: (active) => set({ isGodMode: active }),

      activeCharacters: [],
      deadCharacters: [], // [NEW] Added for death tracking
      setActiveCharacters: (chars) => set({ activeCharacters: chars }),
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
        const char = state.characterData[charId];
        if (!char) return {};
        return {
          characterData: {
            ...state.characterData,
            [charId]: { ...char, relationship: value }
          }
        };
      }),
      addCharacterMemory: (charId, memory) => set((state) => {
        const currentData = state.characterData[charId] || {
          id: charId, name: charId, relationship: 0, memories: []
        };
        const currentMemories = currentData.memories || [];

        // Avoid duplicates
        if (currentMemories.includes(memory)) return {};

        let newMemories = [...currentMemories, memory];

        // [Safety] Hard Limit Cap to prevent infinite bloat (50 max)
        // Summarization should happen before this, but this is a failsafe.
        if (newMemories.length > 50) {
          newMemories = newMemories.slice(-50);
        }

        return {
          characterData: {
            ...state.characterData,
            [charId]: {
              ...currentData,
              memories: newMemories
            }
          }
        };
      }),
      // [NEW] Update Explicit Relationship Status & Speech Style
      updateCharacterRelationshipInfo: (charId, info) => set((state) => {
        const char = state.characterData[charId];
        // If character doesn't exist yet, we might want to create it or just return.
        // Usually should exist if we are interacting. If not, auto-create basic entry.
        const effectiveChar = char || { id: charId, name: charId, relationship: 0, memories: [] };

        const currentInfo = effectiveChar.relationshipInfo || { status: null, speechStyle: null };
        const newInfo = { ...currentInfo, ...info };

        return {
          characterData: {
            ...state.characterData,
            [charId]: {
              ...effectiveChar,
              relationshipInfo: newInfo
            }
          }
        };
      }),
      updateCharacterData: (id, data) => set((state) => {
        const existingChar = state.characterData[id];
        if (!existingChar) return {};
        return {
          characterData: {
            ...state.characterData,
            [id]: { ...existingChar, ...data }
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
      setScriptQueue: (queue) => set({ scriptQueue: queue }),
      currentSegment: null,
      setCurrentSegment: (segment) => set({ currentSegment: segment }),
      choices: [],
      setChoices: (choices) => {
        console.log("[Store] setChoices called with:", choices);
        if (choices.length === 0) console.trace("[Store] setChoices([]) called from:");
        set({ choices });
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

      resetGame: () => {
        PromptManager.clearPromptCache();
        set({
          chatHistory: [],
          displayHistory: [],
          currentBackground: 'default',
          characterExpression: 'normal',
          activeCharacters: [],
          currentLocation: 'home',
          playerName: '주인공', // [Fix] Reset player name
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
          playerStats: JSON.parse(JSON.stringify(INITIAL_STATS)), // [Fix] Deep clone to prevent polluted reference
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
          skills: [],
          choiceHistory: [], // [Fix] Reset choice history
          userCoins: 0,
          deadCharacters: [], // [Fix] Add missing reset for dead characters
          isGodMode: false, // [Fix] Reset debug mode
          currentBgm: null, // [Fix] Reset BGM
          personaOverride: undefined,
          scenarioOverride: undefined,
          disabledEvents: [],
          protagonistImageOverride: undefined // [Fix] Reset image override
        });
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
      onRehydrateStorage: () => (state) => {
        console.log("[Store] Rehydrating...", state ? "Found State" : "No State");
        if (state) {
          console.log("[Store] Hydrated Choices:", state.choices);
          console.log("[Store] Hydrated Queue:", state.scriptQueue?.length);
        }
        // On rehydration, we need to reload the non-persisted functions
        // logic handled by component mounting
        if (state && state.activeGameId) {
          // We don't verify game ID here to avoid side effects during hydration
        }
      }
    }
  )
);
