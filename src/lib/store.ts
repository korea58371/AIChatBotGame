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
  apiKey: string;
  setApiKey: (key: string) => void;

  chatHistory: Message[]; // Active context for AI (truncated)
  displayHistory: Message[]; // Full history for UI display
  addMessage: (message: Message) => void;
  clearHistory: () => void;
  truncateHistory: (keepCount: number) => void;

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
  // Base Stats
  str: number; // Strength
  agi: number; // Agility
  int: number; // Intelligence
  vit: number; // Vitality
  luk: number; // Luck
  // New Stats
  skills: string[];
  personality: {
    selfishness: number;
    heroism: number;
    morality: number;
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
      apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
      setApiKey: (key) => set({ apiKey: key }),

      chatHistory: [],
      displayHistory: [],
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

      currentBackground: 'default',
      setBackground: (bg) => set({ currentBackground: bg }),

      characterExpression: 'normal',
      setCharacterExpression: (expr) => set({ characterExpression: expr }),

      playerName: '김현준',
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

      // Dynamic Character Data Init
      characterData: initialCharacterData,
      updateCharacter: (id, data) => set((state) => ({
        characterData: {
          ...state.characterData,
          [id]: { ...state.characterData[id], ...data }
        }
      })),

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

      // Stats Init
      playerStats: {
        hp: 100, maxHp: 100,
        mp: 50, maxMp: 50,
        gold: 0,
        level: 1, exp: 0,
        str: 10, agi: 10, int: 10, vit: 10, luk: 10,
        skills: [],
        personality: { selfishness: 0, heroism: 0, morality: 50 },
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
        currentBackground: 'default',
        characterExpression: 'normal',
        activeCharacters: [],
        currentLocation: 'home',
        scenarioSummary: '',
        currentEvent: '',
        currentMood: 'daily',
        playerStats: {
          hp: 100, maxHp: 100,
          mp: 50, maxMp: 50,
          gold: 0,
          level: 1, exp: 0,
          str: 10, agi: 10, int: 10, vit: 10, luk: 10,
          skills: [],
          personality: { selfishness: 0, heroism: 0, morality: 50 },
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
      name: 'vn-game-storage',
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { apiKey, ...rest } = state;
        return rest;
      },
    }
  )
);
