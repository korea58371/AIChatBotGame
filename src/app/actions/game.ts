'use server';

import { PromptManager } from '@/lib/engine/prompt-manager';
import {
    generateResponse,
    generateGameLogic,
    generateSummary,
    generateCharacterMemorySummary,
    preloadCache
} from '@/lib/ai/gemini';
import { EventManager } from '@/lib/engine/event-manager';
import { DataManager } from '@/lib/engine/data-manager';
import { MODEL_CONFIG } from '@/lib/ai/model-config';
import { AgentOrchestrator } from '@/lib/agent/orchestrator'; // [NEW] 오케스트레이터 임포트
import { Message } from '@/lib/store';
// import fs from 'fs';
// import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("GEMINI_API_KEY가 환경 변수에 설정되지 않았습니다!");
}

// [NEW] 통합 에이전트 턴 액션 (Unified Agent Turn Action)
export async function serverAgentTurn(
    history: Message[],
    userMessage: string,
    gameState: any,
    language: 'ko' | 'en' | null,
    modelName: string = MODEL_CONFIG.STORY,
    isDirectInput: boolean = false
) {
    console.log(`[ServerAction] 에이전트 턴 시작. Luk: ${gameState.playerStats?.luk}`);
    if (!API_KEY) throw new Error("서버 API 키가 누락되었습니다");

    await hydrateGameState(gameState);

    gameState.isDirectInput = isDirectInput || gameState.isDirectInput || false;

    // 5단계 워크플로우 실행
    return await AgentOrchestrator.executeTurn(
        API_KEY,
        gameState,
        history,
        userMessage,
        language,
        modelName
    );
}

// [New] Phase 1 Action
export async function serverAgentTurnPhase1(
    history: Message[],
    userMessage: string,
    gameState: any,
    language: 'ko' | 'en' | null,
    modelName: string = MODEL_CONFIG.STORY,
    isDirectInput: boolean = false
) {
    console.log(`[ServerAction] Phase 1 Start. Luk: ${gameState.playerStats?.luk}`);
    if (!API_KEY) throw new Error("Server API Key Missing");

    await hydrateGameState(gameState);
    gameState.isDirectInput = isDirectInput || gameState.isDirectInput || false;

    const result = await AgentOrchestrator.executeStoryPhase(
        API_KEY,
        gameState,
        history,
        userMessage,
        language,
        modelName
    );

    // [Fix] Sanitize effectiveGameState and Strip Heavy Static Data
    if (result.effectiveGameState) {
        const state = JSON.parse(JSON.stringify(result.effectiveGameState));

        // [OPTIMIZATION] Strip Static Data (Re-hydrated in Phase 2)
        delete state.availableBackgrounds;
        delete state.availableCharacterImages;
        delete state.availableExtraImages;
        delete state.backgroundMappings;
        delete state.extraMap;
        delete state.lore;
        delete state.constants;

        // We keep worldData/characterData as they may contain dynamic unlocks/relationships
        // that are not yet persisted or need to be passed to Phase 2.

        result.effectiveGameState = state;
    }

    return result;
}

// [New] Phase 2 Action
export async function serverAgentTurnPhase2(
    history: Message[],
    userMessage: string,
    gameState: any,
    storyText: string,
    language: 'ko' | 'en' | null
) {
    console.log(`[ServerAction] Phase 2 Start.`);
    if (!API_KEY) throw new Error("Server API Key Missing");

    // Hydration might be redundant if gameState is passed from Phase 1, but safer.
    await hydrateGameState(gameState);

    return await AgentOrchestrator.executeLogicPhase(
        API_KEY,
        gameState,
        history,
        userMessage,
        storyText,
        language
    );
}

// Helper for Rehydration
async function hydrateGameState(gameState: any) {
    if (gameState.activeGameId) {
        try {
            const { DataManager } = await import('@/lib/engine/data-manager');
            const data = await DataManager.loadGameData(gameState.activeGameId);

            if (data.lore) gameState.lore = data.lore;
            if (data.backgroundMappings) gameState.backgroundMappings = data.backgroundMappings;
            if (data.extraMap) gameState.extraMap = data.extraMap;
            // [Fix] Hydrate constants
            if (data.constants) gameState.constants = data.constants;

            // [Fix] Hydrate System Prompt Logic
            if (data.getSystemPromptTemplate) gameState.getSystemPromptTemplate = data.getSystemPromptTemplate;
            if (data.getRankInfo) gameState.getRankInfo = data.getRankInfo;

            // [Optimization] Hydrate Asset Lists & World Data on Server
            if (data.backgroundList) gameState.availableBackgrounds = data.backgroundList;
            if (data.characterImageList) gameState.availableCharacterImages = data.characterImageList;
            if (data.extraCharacterList) gameState.availableExtraImages = data.extraCharacterList;

            // [Optimization] Hydrate World Data if missing or partial (Reference-Only Strategy)
            if (data.world) {
                // If client sends NO worldData, use server data.
                if (!gameState.worldData || Object.keys(gameState.worldData.locations).length === 0) {
                    gameState.worldData = data.world;
                } else {
                    // If mixed (dynamic updates), we might need merge. 
                    // But for now, assuming worldData is mostly static descriptions -> Use Server Reference?
                    // Dynamic changes (secrets unlocked) are usually small.
                    // IMPORTANT: Client logic updates `worldData` state for unlocks.
                    // If we overwrite with static server data, we lose unlocks.
                    // So we should MERGE.
                    // However, deep merge object is expensive.
                    // Strategy: The Client Payload should ONLY contain the *Dynamic Deltas* if possible?
                    // Too complex for now.
                    // Let's just hydrate `worldData` IF the client explicitly omitted it (sanitized).
                    // In VisualNovelUI, I will omit `worldData` completely?
                    // No, "Unlocked Secrets" needed.
                    // For 4MB limit, `worldData` text is big.
                    // But `playerStats` and `history` are bigger?
                    // Let's start with Asset Lists. Be conservative with World Data.
                }
            }

            if (data.characters) {
                if (!gameState.characterData || Object.keys(gameState.characterData).length === 0) {
                    gameState.characterData = data.characters;
                } else {
                    Object.keys(data.characters).forEach(key => {
                        const staticChar = data.characters[key];
                        const dynamicChar = gameState.characterData[key];

                        if (dynamicChar) {
                            gameState.characterData[key] = {
                                ...staticChar,
                                ...dynamicChar,
                                memories: dynamicChar.memories || staticChar.memories || [],
                                discoveredSecrets: dynamicChar.discoveredSecrets || staticChar.discoveredSecrets || [],
                                relationships: { ...staticChar.relationships, ...dynamicChar.relationships },
                                id: dynamicChar.id || staticChar.id || key
                            };
                        } else {
                            gameState.characterData[key] = staticChar;
                        }
                    });
                }
            }
        } catch (e) {
            console.error(`[ServerAction] Rehydration Failed:`, e);
        }
    }
}

// [LEGACY] 폴백 또는 부분 업데이트를 위해 유지
export async function serverGenerateResponse(
    history: Message[],
    userMessage: string,
    gameState: any,
    language: 'ko' | 'en' | null,
    isDirectInput: boolean = false
) {
    console.log(`[ServerAction] gameState 수신됨. Luk: ${gameState.playerStats?.luk} (${typeof gameState.playerStats?.luk})`);
    if (!API_KEY) throw new Error("서버 API 키가 누락되었습니다");

    await hydrateGameState(gameState);

    // 프롬프트 로직을 위해 gameState에 isDirectInput 전달
    gameState.isDirectInput = isDirectInput || gameState.isDirectInput || false;

    return generateResponse(API_KEY, history, userMessage, gameState, language);
}

export async function serverGenerateGameLogic(
    lastUserMessage: string,
    lastAiResponse: string,
    gameState: any
) {
    if (!API_KEY) return null;
    return generateGameLogic(API_KEY, lastUserMessage, lastAiResponse, gameState);
}

export async function serverGenerateSummary(
    currentSummary: string,
    recentDialogue: Message[]
) {
    if (!API_KEY) return currentSummary;
    return generateSummary(API_KEY, currentSummary, recentDialogue);
}

export async function serverGenerateCharacterMemorySummary(
    characterName: string,
    existingMemories: string[]
) {
    if (!API_KEY) return existingMemories;
    const { generateCharacterMemorySummary } = await import('@/lib/ai/gemini');
    return generateCharacterMemorySummary(API_KEY as string, characterName, existingMemories);
}

// [최적화] Vercel이 300MB+ 이미지를 번들링하는 것을 방지하기 위해 미리 생성된 Assets Manifest 사용
// import fs from 'fs'; // NFT 번들링 방지를 위해 제거
// import path from 'path'; // 제거됨

// 생성된 manifest 임포트
// @ts-ignore
import assetsManifest from '@/data/assets.json';

export async function getExtraCharacterImages(gameId: string = 'god_bless_you') {
    try {
        const gameAssets = (assetsManifest as any)[gameId];
        if (!gameAssets || !gameAssets.extraCharacters) return [];
        return gameAssets.extraCharacters;
    } catch (e) {
        console.error("Manifest에서 엑스트라 캐릭터 로드 실패:", e);
        return [];
    }
}

export async function getCharacterImages(gameId: string = 'god_bless_you') {
    try {
        const gameAssets = (assetsManifest as any)[gameId];
        if (!gameAssets || !gameAssets.characters) return [];
        return gameAssets.characters;
    } catch (e) {
        console.error("Manifest에서 캐릭터 이미지 로드 실패:", e);
        return [];
    }
}

// import fs from 'fs'; // 제거됨
// import path from 'path'; // 제거됨
// assetsManifest가 로드되었는지 확인
console.log(`[GameActions] Assets Manifest 로드됨: ${!!assetsManifest}`);

export async function getBackgroundList(gameId: string) {
    try {
        console.log(`[GameActions] ${gameId}에 대해 getBackgroundList 호출됨`);
        if (!assetsManifest) {
            console.error("[GameActions] assetsManifest가 정의되지 않았습니다!");
            return [];
        }
        const gameAssets = (assetsManifest as any)[gameId];
        if (!gameAssets || !gameAssets.backgrounds) return [];
        return gameAssets.backgrounds;
    } catch (e) {
        console.error("Manifest에서 배경 목록 로드 실패:", e);
        return [];
    }
}

export async function serverPreloadCache(gameState: any) {
    if (!API_KEY) return;
    try {
        return await preloadCache(API_KEY, gameState);
    } catch (e) {
        console.error("서버 프리로드 오류:", e);
    }
}

