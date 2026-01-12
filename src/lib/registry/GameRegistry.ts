import React from 'react';
import { GameState } from '../store';

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
    // Returns the game-specific System Prompt logic function
    getSystemPromptTemplate: (state: any, language: 'ko' | 'en' | 'ja' | null) => string;

    // Returns Rank/Level info based on Fame/Exp or Rank Key
    getRankInfo: (input: string | number) => any;

    // [3] UI Components
    // Dynamic component loading for HUD
    components: {
        HUD: React.ComponentType<any>;
    };

    // [4] Assets & Mappings
    assets: {
        bgmMap: Record<string, string[]>;
        bgmAliases: Record<string, string>;
        backgroundMap: Record<string, string>;
    };

    // [5] Mood Prompts (Factory)
    getMoodPrompts: () => Record<string, string>;
}

class GameRegistryImpl {
    private games: Map<string, GameConfig> = new Map();

    register(config: GameConfig) {
        if (this.games.has(config.id)) {
            console.warn(`[GameRegistry] Overwriting existing game config for '${config.id}'`);
        }
        this.games.set(config.id, config);
        console.log(`[GameRegistry] Registered game: ${config.id}`);
    }

    get(id: string): GameConfig | undefined {
        return this.games.get(id);
    }

    getAll(): GameConfig[] {
        return Array.from(this.games.values());
    }
}

export const GameRegistry = new GameRegistryImpl();
