'use server';

import { generateResponse, generateGameLogic, generateSummary, preloadCache } from '@/lib/gemini';
import { AgentOrchestrator } from '@/lib/agent/orchestrator'; // [NEW] 오케스트레이터 임포트
import { Message } from '@/lib/store';
// import fs from 'fs';
// import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("GEMINI_API_KEY가 환경 변수에 설정되지 않았습니다!");
}

// [NEW] 통합 에이전트 턴 액션 (Unified Agent Turn Action)
export async function serverAgentTurn(
    history: Message[],
    userMessage: string,
    gameState: any,
    language: 'ko' | 'en' | null,
    modelName: string = 'gemini-3-pro-preview', // [NEW] Default to Pro
    isDirectInput: boolean = false
) {
    console.log(`[ServerAction] 에이전트 턴 시작. Luk: ${gameState.playerStats?.luk}`);
    if (!API_KEY) throw new Error("서버 API 키가 누락되었습니다");

    // [서버 사이드 재수화 (RE-HYDRATION)]
    if (gameState.activeGameId) {
        try {
            const { DataManager } = await import('@/lib/data-manager');
            const data = await DataManager.loadGameData(gameState.activeGameId);
            if (data.lore) gameState.lore = data.lore;
            if (data.backgroundMappings) gameState.backgroundMappings = data.backgroundMappings;
            if (data.extraMap) gameState.extraMap = data.extraMap;
        } catch (e) {
            console.error(`[ServerAction] 재수화 실패:`, e);
        }
    }

    gameState.isDirectInput = isDirectInput || gameState.isDirectInput || false;

    // 5단계 워크플로우 실행
    return await AgentOrchestrator.executeTurn(
        API_KEY,
        gameState,
        history,
        userMessage,
        language,
        modelName // [NEW] Pass model name
    );
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

    // [서버 사이드 재수화 (RE-HYDRATION)]
    // 클라이언트는 대역폭 절약을 위해 'lore'를 보내지 않습니다. 여기서 로드해야 합니다.
    if (gameState.activeGameId) {
        try {
            const { DataManager } = await import('@/lib/data-manager');
            const data = await DataManager.loadGameData(gameState.activeGameId);
            if (data.lore) {
                console.log(`[ServerAction] ${gameState.activeGameId}에 대한 Lore 재수화. 키 개수: ${Object.keys(data.lore).length}`);
                gameState.lore = data.lore;
            }
            if (data.backgroundMappings) {
                gameState.backgroundMappings = data.backgroundMappings;
            }
            if (data.extraMap) {
                gameState.extraMap = data.extraMap;
            }
        } catch (e) {
            console.error(`[ServerAction] ${gameState.activeGameId}에 대한 lore/maps 재수화 실패:`, e);
        }
    }

    // 프롬프트 로직을 위해 gameState에 isDirectInput 전달
    // [FIX] 우선순위: 인자 > 기존 상태 > 기본값 False
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
