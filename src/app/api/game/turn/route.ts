import { NextRequest, NextResponse } from 'next/server';
import { AgentOrchestrator } from '@/lib/agent/orchestrator';
import { MODEL_CONFIG } from '@/lib/model-config';
import { DataManager } from '@/lib/data-manager';

// Force dynamic since we use streams and api keys
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Use Node.js runtime for full fs access if needed (though DataManager might use fs)

const API_KEY = process.env.GEMINI_API_KEY;

// Minimal Hydration Logic
async function hydrateGameState(gameState: any) {
    if (gameState.activeGameId) {
        try {
            const data = await DataManager.loadGameData(gameState.activeGameId);

            // Core Logic/Lore Hydration
            if (data.lore) gameState.lore = data.lore;
            if (data.backgroundMappings) gameState.backgroundMappings = data.backgroundMappings;
            if (data.extraMap) gameState.extraMap = data.extraMap;
            if (data.constants) gameState.constants = data.constants;

            // Prompt Hydration (Server Functions)
            if (data.getSystemPromptTemplate) gameState.getSystemPromptTemplate = data.getSystemPromptTemplate;
            if (data.getRankInfo) gameState.getRankInfo = data.getRankInfo;

            // Asset Lists
            if (data.backgroundList) gameState.availableBackgrounds = data.backgroundList;
            if (data.characterImageList) gameState.availableCharacterImages = data.characterImageList;
            if (data.extraCharacterList) gameState.availableExtraImages = data.extraCharacterList;

            // World Data (Read-only reference if missing)
            if (data.world && (!gameState.worldData || Object.keys(gameState.worldData.locations || {}).length === 0)) {
                gameState.worldData = data.world;
            }

            // Character Data Merge
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
            console.error(`[API] Hydration Failed:`, e);
        }
    }
}

export async function POST(req: NextRequest) {
    if (!API_KEY) {
        return NextResponse.json({ error: 'Server API Key Missing' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { history, userInput, gameState, language, modelName } = body;

        // Perform Hydration
        await hydrateGameState(gameState);
        gameState.isDirectInput = true; // Streaming implies direct input usually

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                try {
                    const generator = AgentOrchestrator.executeTurnStream(
                        API_KEY,
                        gameState,
                        history,
                        userInput,
                        language || 'ko',
                        modelName || MODEL_CONFIG.STORY
                    );

                    for await (const chunk of generator) {
                        // Protocol: JSON string + newline
                        // chunk is { type: 'text'|'data', content: ... }
                        const payload = JSON.stringify(chunk) + '\n';
                        controller.enqueue(encoder.encode(payload));
                    }
                } catch (e: any) {
                    console.error("[API] Stream Error:", e);
                    const errorPayload = JSON.stringify({ type: 'error', content: e.message || 'Unknown Error' }) + '\n';
                    controller.enqueue(encoder.encode(errorPayload));
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson', // Newline Delimited JSON
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
