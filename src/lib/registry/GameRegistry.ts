import React from 'react';
import { GameState } from '../store';
import { GameData } from '../engine/data-manager';
import { ProgressionConfig } from '../engine/progression-types';

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
    };

    // [5] Mood Prompts (Factory)
    getMoodPrompts: () => Record<string, string>;

    // [6] Scalability Extensions (Encapsulated Logic)
    formatCharacter: (char: any, mode: string, state?: any) => string;
    resolveRegion: (location: string) => string | null;
    loadGameData: () => Promise<GameData>;

    // [7] New Localized Logic (Refactored from PromptManager)
    resolveBackgroundName: (key: string, state: any) => string;

    // [8] Universal Progression System (Data-Driven Growth)
    progressionConfig?: ProgressionConfig;

    // [9] Director Guide (Tone & World Rules for Narrative Director)
    getDirectorGuide?: () => string;

    // [10] Regional Context (Director에게 전달할 지역/세력 정보 — 게임별 동적 생성)
    getRegionalContext?: (location: string) => string;

    // [11] Post-Logic Location Hint (AI에게 지역명 작성 규칙 전달 — 게임별 포맷)
    getPostLogicLocationHint?: () => string;

    // [12] Director Examples (게임별 Director 예시 문구 — NO SPOILERS 등)
    getDirectorExamples?: () => { good: string; bad: string };

    // [13] Director Pacing Guide (pacing.ts에서 현재 턴에 맞는 phase별 연출 노트 + 성장 가이드를 Director에 주입)
    getDirectorPacingGuide?: (turnCount: number) => string | null;
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
