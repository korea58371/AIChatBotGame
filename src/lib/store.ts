import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ScriptSegment } from '@/lib/script-parser';
import initialCharacterData from '@/data/prompts/characters.json';
import initialWorldData from '@/data/prompts/world.json';
import { MoodType } from '@/data/prompts/moods';

export interface Message {
  role: 'user' | 'model';
  text: string;
}

interface GameState {
  // Event System State
  triggeredEvents: string[]; // IDs of events already triggered
  activeEvent: any | null; // The event to be processed in the next prompt (Typing 'any' to avoid circular dependency for now, or import GameEvent)
  addTriggeredEvent: (eventId: string) => void;
  setActiveEvent: (event: any | null) => void;


  chatHistory: Message[]; // Active context for AI (truncated)
  displayHistory: Message[]; // Full history for UI display

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
  activeCharacters: string[]; // List of character IDs currently in scene
  setActiveCharacters: (chars: string[]) => void;
  currentLocation: string; // Key from world.json
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
  // Natural Language State (from Logic Model)
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

  // Settings
  language: 'ko' | 'en' | null;
  setLanguage: (lang: 'ko' | 'en') => void;

  resetGame: () => void;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  level: number;
  exp: number;
  fame: number; // Added Fame
  fate: number; // Added Fate (Intervention Resource)
  playerRank: string; // Added Player Rank
  personalitySummary: string; // Added Personality Summary from Logic Model
  // Base Stats
  str: number; // Strength
  agi: number; // Agility
  int: number; // Intelligence
  vit: number; // Vitality
  luk: number; // Luck
  // New Stats
  skills: string[];
  personality: {
    morality: number;
    courage: number;
    energy: number;
    decision: number;
    lifestyle: number;
    openness: number;
    warmth: number;
    eloquence: number;
    leadership: number;
    humor: number; // Serious/Solemn (-100) <-> Playful/Witty (+100)
    lust: number; // Ascetic/Pure (-100) <-> Lustful/Perverted (+100)
  };
  relationships: Record<string, number>; // Character ID -> Affinity (0-100)
}

export interface Item {
  id: string;
  name: string;
  description: string;
  quantity: number;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({


      chatHistory: [],
      displayHistory: [],

      // Event System
      triggeredEvents: [],
      activeEvent: null,
      addTriggeredEvent: (eventId) => set((state) => ({
        triggeredEvents: [...state.triggeredEvents, eventId]
      })),
      setActiveEvent: (event) => set({ activeEvent: event }),

      // Meta State
      userCoins: 0,
      setUserCoins: (coins) => set({ userCoins: coins }),

      addMessage: (message) => set((state) => ({
        chatHistory: [...state.chatHistory, message],
        displayHistory: [...(state.displayHistory || []), message]
      })),
      clearHistory: () => set({ chatHistory: [], displayHistory: [] }),
      truncateHistory: (keepCount) => set((state) => {
        let newHistory = state.chatHistory.slice(-keepCount);
        // Gemini API requires the first message to be from 'user'.
        // If the truncated history starts with 'model', remove it.
        if (newHistory.length > 0 && newHistory[0].role === 'model') {
          newHistory = newHistory.slice(1);
        }
        return { chatHistory: newHistory };
      }),

      turnCount: 0,
      incrementTurnCount: () => set((state) => ({ turnCount: state.turnCount + 1 })),

      currentBackground: '/assets/backgrounds/Default_Fallback.png',
      setBackground: (bg) => set({ currentBackground: bg }),

      characterExpression: 'normal',
      setCharacterExpression: (expr) => set({ characterExpression: expr }),

      playerName: '주인공',
      setPlayerName: (name) => set({ playerName: name }),

      // Lore State Init
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

      characterData: (Array.isArray(initialCharacterData) ? initialCharacterData : []).reduce((acc: any, char: any) => {
        // Use Name as ID (User preference)
        const id = char.name;
        acc[id] = { ...char, id };
        return acc;
      }, {}),
      updateCharacter: (id, data) => set((state) => {
        const existingChar = state.characterData[id];
        let baseChar = existingChar;

        // If character doesn't exist in state, try to find it in static data by Name
        if (!baseChar) {
          const staticChar = (initialCharacterData as any[]).find((c: any) => c.name === id);
          if (staticChar) {
            baseChar = { ...staticChar, id };
          } else {
            baseChar = { id, name: id, ...data }; // Fallback for completely new characters
          }
        }

        return {
          characterData: {
            ...state.characterData,
            [id]: { ...baseChar, ...data }
          }
        };
      }),

      // Dynamic World Data Init
      worldData: initialWorldData,
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

      // Status Description (Natural Language)
      statusDescription: "건강함",
      setStatusDescription: (desc) => set({ statusDescription: desc }),
      personalityDescription: "평범함",
      setPersonalityDescription: (desc) => set({ personalityDescription: desc }),

      // Stats Init
      playerStats: {
        hp: 100, maxHp: 100,
        mp: 50, maxMp: 50,
        gold: 0,
        level: 1, exp: 0,
        fame: 0,
        fate: 0,
        playerRank: '일반인',
        personalitySummary: "", // Initial empty summary
        str: 10, agi: 10, int: 10, vit: 10, luk: 10,
        skills: [],
        personality: {
          morality: 0,
          courage: 0,
          energy: 0,
          decision: 0,
          lifestyle: 0,
          openness: 0,
          warmth: 0,
          eloquence: 0,
          leadership: 0,
          humor: 0,
          lust: 0
        },
        relationships: {}
      },
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

      // VN State Init
      scriptQueue: [],
      setScriptQueue: (queue) => set({ scriptQueue: queue }),
      currentSegment: null,
      setCurrentSegment: (segment) => set({ currentSegment: segment }),
      choices: [],
      setChoices: (choices) => set({ choices: choices }),

      // Settings
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
        playerStats: {
          hp: 100, maxHp: 100,
          mp: 50, maxMp: 50,
          gold: 0,
          level: 1, exp: 0,
          fame: 0, // Added Fame
          fate: 0, // Added Fate
          playerRank: '일반인', // Added Player Rank
          personalitySummary: "", // Added Personality Summary
          str: 10, agi: 10, int: 10, vit: 10, luk: 10,
          skills: [],
          personality: {
            morality: 0,
            courage: 0,
            energy: 0,
            decision: 0,
            lifestyle: 0,
            openness: 0,
            warmth: 0,
            eloquence: 0,
            leadership: 0,
            humor: 0,
            lust: 0
          },
          relationships: {}
        },
        inventory: [],
        scriptQueue: [],
        currentSegment: null,
        choices: [],
        characterData: initialCharacterData, // Reset characters too
        worldData: initialWorldData // Reset world too
      }),
    }),
    {
      name: 'vn-game-storage-v1',
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return state;
      },
    }
  )
);
