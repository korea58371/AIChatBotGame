'use server';

import { generateResponse, generateGameLogic, generateSummary } from '@/lib/gemini';
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
    return generateResponse(API_KEY, history, userMessage, gameState, language);
}

export async function serverGenerateGameLogic(
    lastUserMessage: string,
    lastAiResponse: string,
    currentStats: any
) {
    if (!API_KEY) return null;
    return generateGameLogic(API_KEY, lastUserMessage, lastAiResponse, currentStats);
}

export async function serverGenerateSummary(
    currentSummary: string,
    recentDialogue: Message[]
) {
    if (!API_KEY) return currentSummary;
    return generateSummary(API_KEY, currentSummary, recentDialogue);
}

export async function getExtraCharacterImages() {
    try {
        const fs = require('fs');
        const path = require('path');
        const extraCharDir = path.join(process.cwd(), 'public', 'assets', 'ExtraCharacters');

        if (!fs.existsSync(extraCharDir)) {
            console.warn(`ExtraCharacters directory not found: ${extraCharDir}`);
            return [];
        }

        const files = fs.readdirSync(extraCharDir);
        // Return filenames without extension, or with extension if preferred?
        // standard characters seem to be names like "강지수_기본" and the file is "강지수_기본.png".
        // The file list I saw included extensions.
        // I should return the name without extension for consistency if the system prompt expects names.
        // But wait, the standard asset list "강지수_기본" implies the filename is "강지수_기본.png".
        // So I will strip .png, .jpg, etc.

        return files.filter((file: string) => /\.(png|jpg|jpeg|webp)$/i.test(file))
            .map((file: string) => path.parse(file).name);
    } catch (error) {
        console.error("Error reading ExtraCharacters:", error);
        return [];
    }
}
