import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ScriptSegment } from '@/lib/script-parser';
import { MoodType } from '@/data/prompts/moods';
import { DataManager, GameData } from './data-manager';
import { PromptManager } from './prompt-manager';

export interface Message {
  role: 'user' | 'model';
  text: string;
}

interface GameState {
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
  clearHistory: () => void;
  truncateHistory: (keepCount: number) => void;

  turnCount: number;
  incrementTurnCount: () => void;

  // Visual State
  currentBackground: string;
  setBackground: (bg: string) => void;

  characterExpression: string;
  setCharacterExpression: (expr: string) => void;

  playerName: string;
  setPlayerName: (name: string) => void;
  isGodMode?: boolean; // God Mode Debug Flag
  setGodMode: (active: boolean) => void;

  // Lore & Prompt State
  activeCharacters: string[];
  setActiveCharacters: (chars: string[]) => void;
  currentLocation: string;
  setCurrentLocation: (loc: string) => void;
  scenarioSummary: string;
  setScenarioSummary: (summary: string) => void;
  currentEvent: string;
  setCurrentEvent: (event: string) => void;
  currentMood: MoodType;
  setMood: (mood: MoodType) => void;

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
  addCharacterMemory: (charId: string, memory: string) => void;
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
  constants?: { FAMOUS_CHARACTERS: string; CORE_RULES: string };

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
  faction: string;
  personalitySummary: string;
  str: number; agi: number; int: number; vit: number; luk: number;
  skills: string[];
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
}

export interface GameCharacterData {
  id: string;
  name: string;
  relationship?: number;
  memories?: string[];
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
  narrative_perspective: '3인칭' // Default
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      activeGameId: 'wuxia', // Default
      storyModel: 'gemini-3-pro-preview', // Default to Pro
      isDataLoaded: false,

      setStoryModel: (model) => set({ storyModel: model }),

      setGameId: async (id: string) => {
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

      characterExpression: 'normal',
      setCharacterExpression: (expr) => set({ characterExpression: expr }),

      playerName: '주인공',
      setPlayerName: (name) => set({ playerName: name }),
      isGodMode: false,
      setGodMode: (active) => set({ isGodMode: active }),

      activeCharacters: [],
      setActiveCharacters: (chars) => set({ activeCharacters: chars }),
      currentLocation: '폐가', // Default Wuxia Start (Abandoned House)
      setCurrentLocation: (loc) => set({ currentLocation: loc }),
      scenarioSummary: '',
      setScenarioSummary: (summary) => set({ scenarioSummary: summary }),
      currentEvent: '',
      setCurrentEvent: (event) => set({ currentEvent: event }),
      currentMood: 'daily',
      setMood: (mood) => set({ currentMood: mood }),

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

        return {
          characterData: {
            ...state.characterData,
            [charId]: {
              ...currentData,
              memories: [...currentMemories, memory]
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
      setChoices: (choices) => set({ choices }),

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

      language: null,
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
      addGoal: (goal) => set((state) => ({
        goals: [...state.goals, goal]
      })),
      updateGoal: (id, updates) => set((state) => ({
        goals: state.goals.map(g => g.id === id ? { ...g, ...updates } : g)
      })),

      tensionLevel: 0,
      setTensionLevel: (level) => set({ tensionLevel: Math.max(0, Math.min(100, level)) }),
      updateTensionLevel: (delta) => set((state) => ({
        tensionLevel: Math.max(0, Math.min(100, state.tensionLevel + delta))
      })),

      resetGame: () => {
        PromptManager.clearPromptCache();
        set({
          chatHistory: [],
          displayHistory: [],
          currentBackground: 'default',
          characterExpression: 'normal',
          activeCharacters: [],
          currentLocation: 'home',
          scenarioSummary: '',
          turnCount: 0,
          day: 1,
          time: 'Morning',
          currentEvent: '',
          currentMood: 'daily',
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
        });
      },
    }),
    {
      name: 'vn-game-storage-v2', // [Fix] Invalidate old cache to apply Second Rate fix
      partialize: (state) => {
        const {
          getSystemPromptTemplate,
          getRankInfo,
          backgroundMappings,
          ...persistedState
        } = state;
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        // On rehydration, we need to reload the non-persisted functions
        if (state && state.activeGameId) {
          state.setGameId(state.activeGameId);
        }
      }
    }
  )
);
