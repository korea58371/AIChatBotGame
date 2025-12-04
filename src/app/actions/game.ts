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
