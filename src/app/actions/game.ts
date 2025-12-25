'use server';

import { generateResponse, generateGameLogic, generateSummary, preloadCache } from '@/lib/gemini';
import { Message } from '@/lib/store';
// import fs from 'fs';
// import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables!");
}

export async function serverGenerateResponse(
    history: Message[],
    userMessage: string,
    gameState: any,
    language: 'ko' | 'en' | null,
    isDirectInput: boolean = false
) {
    console.log(`[ServerAction] Received gameState. Luk: ${gameState.playerStats?.luk} (${typeof gameState.playerStats?.luk})`);
    if (!API_KEY) throw new Error("Server API Key is missing");

    // [SERVER-SIDE RE-HYDRATION]
    // The client does not send 'lore' to save bandwidth. We must load it here.
    if (gameState.activeGameId) {
        try {
            const { DataManager } = await import('@/lib/data-manager');
            const data = await DataManager.loadGameData(gameState.activeGameId);
            if (data.lore) {
                console.log(`[ServerAction] Re-hydrated Lore for ${gameState.activeGameId}. Keys: ${Object.keys(data.lore).length}`);
                gameState.lore = data.lore;
            }
            if (data.backgroundMappings) {
                gameState.backgroundMappings = data.backgroundMappings;
            }
            if (data.extraMap) {
                gameState.extraMap = data.extraMap;
            }
        } catch (e) {
            console.error(`[ServerAction] Failed to re-hydrate lore/maps for ${gameState.activeGameId}:`, e);
        }
    }

    // Pass isDirectInput to gameState for Prompt Logic
    // [FIX] Priority: Argument > Existing State > Default False
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

// [OPTIMIZATION] Use Pre-generated Assets Manifest to avoid Vercel Bundling 300MB+ images
// import fs from 'fs'; // Removed to prevent NFT bundling
// import path from 'path'; // Removed

// Import the generated manifest
// @ts-ignore
import assetsManifest from '@/data/assets.json';

export async function getExtraCharacterImages(gameId: string = 'god_bless_you') {
    try {
        const gameAssets = (assetsManifest as any)[gameId];
        if (!gameAssets || !gameAssets.extraCharacters) return [];
        return gameAssets.extraCharacters;
    } catch (e) {
        console.error("Failed to load extra characters from manifest:", e);
        return [];
    }
}

export async function getCharacterImages(gameId: string = 'god_bless_you') {
    try {
        const gameAssets = (assetsManifest as any)[gameId];
        if (!gameAssets || !gameAssets.characters) return [];
        return gameAssets.characters;
    } catch (e) {
        console.error("Failed to load character images from manifest:", e);
        return [];
    }
}

// import fs from 'fs'; // Removed
// import path from 'path'; // Removed
// Ensure assetsManifest is loaded
console.log(`[GameActions] Assets Manifest loaded: ${!!assetsManifest}`);

export async function getBackgroundList(gameId: string) {
    try {
        console.log(`[GameActions] getBackgroundList called for ${gameId}`);
        if (!assetsManifest) {
            console.error("[GameActions] assetsManifest is undefined!");
            return [];
        }
        const gameAssets = (assetsManifest as any)[gameId];
        if (!gameAssets || !gameAssets.backgrounds) return [];
        return gameAssets.backgrounds;
    } catch (e) {
        console.error("Failed to load background list from manifest:", e);
        return [];
    }
}

export async function serverPreloadCache(gameState: any) {
    if (!API_KEY) return;
    try {
        await preloadCache(API_KEY, gameState);
    } catch (e) {
        console.error("Server Preload Error:", e);
    }
}
