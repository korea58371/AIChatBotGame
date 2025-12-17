'use server';

import { generateResponse, generateGameLogic, generateSummary, preloadCache } from '@/lib/gemini';
import { Message } from '@/lib/store';

const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables!");
}

export async function serverGenerateResponse(
    history: Message[],
    userMessage: string,
    gameState: any,
    language: 'ko' | 'en' | null
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
        } catch (e) {
            console.error(`[ServerAction] Failed to re-hydrate lore for ${gameState.activeGameId}:`, e);
        }
    }

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

export async function getExtraCharacterImages(gameId: string = 'god_bless_you') {
    try {
        const fs = require('fs');
        const path = require('path');
        const extraCharDir = path.join(process.cwd(), 'public', 'assets', gameId, 'ExtraCharacters');

        if (!fs.existsSync(extraCharDir)) {
            console.warn(`ExtraCharacters directory not found: ${extraCharDir}`);
            return [];
        }

        const files = fs.readdirSync(extraCharDir);
        // Filter for images
        const images = files.filter((file: string) => /\.(jpg|jpeg|png|webp)$/i.test(file));
        // Return without extension? Or with?
        // PromptManager expects "Name_Emotion".
        // If file is "Name_Emotion.png", we return "Name_Emotion".
        return images.map((file: string) => file.replace(/\.(jpg|jpeg|png|webp)$/i, ''));
    } catch (e) {
        console.error("Failed to load extra characters:", e);
        return [];
    }
}

export async function getBackgroundList(gameId: string) {
    try {
        const fs = require('fs');
        const path = require('path');
        const bgDir = path.join(process.cwd(), 'public', 'assets', gameId, 'backgrounds');

        if (!fs.existsSync(bgDir)) {
            console.warn(`Backgrounds directory not found: ${bgDir}`);
            return [];
        }

        const files = fs.readdirSync(bgDir);
        // Filter images
        const images = files.filter((file: string) => /\.(jpg|jpeg|png|webp)$/i.test(file));
        // Return filenames (e.g., "Category_Location_Detail.jpg")
        return images;
    } catch (e) {
        console.error("Failed to load background list:", e);
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
