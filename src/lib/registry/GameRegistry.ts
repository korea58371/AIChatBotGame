import React from 'react';
import { GameState } from '../store';
import { GameData } from '../engine/data-manager';

/**
 * [Game Registry System]
 * Defines the contract for all game modules.
 * Instead of hardcoding "if (gameId === 'wuxia')", specific games are registered here.
 */

export interface GameConfig {
    id: string;
    name: string; // Display Name (e.g. "천하제일")

    // [1] Identity & Core Prompts
    identity: string; // System Prompt Identity
    behaviorRules: string; // Core Behavior Rules
    outputFormat: string; // Parsing Rules

    // [2] Logic Injection
    // [2] Logic Injection
    // Returns the game-specific System Prompt logic function
    getSystemPromptTemplate: (state: any, language: 'ko' | 'en' | 'ja' | null) => string;

    // [New] Static Context Generation (Delegated from PromptManager)
    getStaticContext: (state: any) => Promise<string>;

    // [New] Logic Prompt Injection
    getLogicPrompt: (
        prunedStats: any,
        lastUserMessage: string,
        lastAiResponse: string,
        logicContext: string,
        worldData: any,
        availableEvents: any[],
        rankCriteria: any
    ) => string;

    getStaticLogicPrompt: (
        gameId: string,
        rankCriteria: any,
        romanceGuide: any,
        combatGuide: any
    ) => string;

    getDynamicLogicPrompt: (
        prunedStats: any,
        lastUserMessage: string,
        lastAiResponse: string,
        logicContext: string,
        worldData: any,
        availableEvents: any[]
    ) => string;

    // Returns Rank/Level info based on Fame/Exp or Rank Key
    getRankInfo: (input: string | number) => any;

    // [3] UI Components
    // Dynamic component loading for HUD
    // [Refactor] Component Registry moved to GameUIRegistry (Client-only)
    // components?: { ... };

    // [4] Assets & Mappings
    assets: {
        bgmMap: Record<string, string[]>;
        bgmAliases: Record<string, string>;
        backgroundMap: Record<string, string>;
    };

    // [5] Mood Prompts (Factory)
    getMoodPrompts: () => Record<string, string>;

    // [6] Scalability Extensions (Encapsulated Logic)
    formatCharacter: (char: any, mode: string, state?: any) => string;
    resolveRegion: (location: string) => string | null;
    loadGameData: () => Promise<GameData>;

    // [7] New Localized Logic (Refactored from PromptManager)
    getRankTitle: (level: number, language?: string) => string;
    resolveBackgroundName: (key: string, state: any) => string;
}

class GameRegistryImpl {
    private games: Map<string, GameConfig> = new Map();

    register(config: GameConfig) {
        if (this.games.has(config.id)) {
            console.warn(`[GameRegistry] Overwriting existing game config for '${config.id}'`);
        }
        this.games.set(config.id, config);
        console.log(`[GameRegistry] Successfully REGISTERED game: ${config.id}. Total Games: ${this.games.size}`);
    }

    get(id: string): GameConfig | undefined {
        return this.games.get(id);
    }

    getAll(): GameConfig[] {
        return Array.from(this.games.values());
    }
}

export const GameRegistry = new GameRegistryImpl();
