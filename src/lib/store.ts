import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ScriptSegment } from '@/lib/script-parser';
import { MoodType } from '@/data/prompts/moods';
import { DataManager, GameData } from './data-manager';

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

  // Dynamic Character Data
  characterData: Record<string, any>;
  updateCharacter: (id: string, data: any) => void;

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

  resetGame: () => void;

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
  personalitySummary: string;
  str: number; agi: number; int: number; vit: number; luk: number;
  skills: string[];
  personality: {
    morality: number; courage: number; energy: number; decision: number;
    lifestyle: number; openness: number; warmth: number; eloquence: number;
    leadership: number; humor: number; lust: number;
  };
  relationships: Record<string, number>;
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
  playerRank: '일반인',
  personalitySummary: "",
  str: 10, agi: 10, int: 10, vit: 10, luk: 10,
  skills: [],
  personality: {
    morality: 0, courage: 0, energy: 0, decision: 0,
    lifestyle: 0, openness: 0, warmth: 0, eloquence: 0,
    leadership: 0, humor: 0, lust: 0
  },
  relationships: {}
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      activeGameId: 'god_bless_you', // Default
      isDataLoaded: false,

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
            acc[char.name] = { ...char, id: char.name }; // ID is Name
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

            // Reset game when switching? Maybe optional.
            // For now, let's reset to ensure clean state.
            initialScenario: data.scenario,
            wikiData: data.wikiData,
            characterMap: data.characterMap, // Added
            extraMap: data.extraMap, // Added
            constants: data.constants, // Added
            lore: data.lore, // Added
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

      activeCharacters: [],
      setActiveCharacters: (chars) => set({ activeCharacters: chars }),
      currentLocation: 'home',
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
      updateCharacter: (id, data) => set((state) => {
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

      resetGame: () => set({
        chatHistory: [],
        displayHistory: [],
        currentBackground: 'default',
        characterExpression: 'normal',
        activeCharacters: [],
        currentLocation: 'home',
        scenarioSummary: '',
        turnCount: 0,
        currentEvent: '',
        currentMood: 'daily',
        statusDescription: '건강함',
        personalityDescription: '평범함',
        playerStats: INITIAL_STATS,
        inventory: [],
        scriptQueue: [],
        currentSegment: null,
        choices: [],
        textMessageHistory: {},
        triggeredEvents: [],
        activeEvent: null
      }),
    }),
    {
      name: 'vn-game-storage-v1',
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
