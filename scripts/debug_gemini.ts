import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAICacheManager } from '@google/generative-ai/server';
import dotenv from 'dotenv';
import path from 'path';

// Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY not found in .env or .env.local");
    process.exit(1);
}

const MODEL_NAME = 'gemini-flash-latest';

async function runTest(label: string, systemPromptLength: number, userMsgLength: number, useThinking: boolean, useCache: boolean = false) {
    console.log(`\n\n[Test: ${label}] Starting...`);
    console.log(`- Model: ${MODEL_NAME}`);
    console.log(`- System: ~${systemPromptLength} chars, User: ~${userMsgLength} chars`);
    console.log(`- Thinking: ${useThinking ? 'ON (High)' : 'OFF'}`);
    console.log(`- Cache: ${useCache ? 'ON' : 'OFF'}`);

    const genAI = new GoogleGenerativeAI(API_KEY!);
    const cacheManager = new GoogleAICacheManager(API_KEY!);

    let modelConfig: any = {
        model: MODEL_NAME,
    };

    if (useThinking) {
        modelConfig.thinkingConfig = { includeThoughts: true, thinkingLevel: "high" };
    }

    // Generate dummy system prompt
    const systemInstruction = "You are a Game Master. ".repeat(Math.ceil(systemPromptLength / 22));

    let cachedContentName;
    if (useCache) {
        try {
            console.log(`[${label}] Creating Cache...`);
            const cacheResult = await cacheManager.create({
                model: MODEL_NAME,
                contents: [{ role: 'user', parts: [{ text: systemInstruction }] }], // System instruction as content for cache? Or systemInstruction prop?
                // Cache API requires 'contents' usually. For system prompt, we might map it or check docs.
                // Standard: systemInstruction is cached if part of creating cache.
                // Actually `create` takes `systemInstruction`.
                systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
                ttlSeconds: 300,
            });
            cachedContentName = cacheResult.name;
            console.log(`[${label}] Cache Created: ${cachedContentName}`);
            modelConfig.cachedContent = { name: cachedContentName };
        } catch (e: any) {
            console.warn(`[${label}] Cache Creation Failed (likely 1.5 Pro only?):`, e.message);
        }
    } else {
        modelConfig.systemInstruction = systemInstruction;
    }

    // Explicit v1beta for Thinking
    const model = genAI.getGenerativeModel(modelConfig, { apiVersion: 'v1beta' });

    const chat = model.startChat({ history: [] });
    // Simulate large user message (History)
    const message = "Continue game. " + "User Action... ".repeat(Math.ceil(userMsgLength / 15));

    console.log(`[${label}] Sending Request...`);
    const start = Date.now();

    try {
        const result = await chat.sendMessageStream(message);

        let firstReceived = false;
        let textLen = 0;
        let thoughtCount = 0;

        for await (const chunk of result.stream) {
            const now = Date.now();
            if (!firstReceived) {
                console.log(`[${label}] 🚀 TTFT (First Chunk): ${now - start}ms`);
                firstReceived = true;
            }

            // Inspect candidates for thoughts
            if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
                const parts = chunk.candidates[0].content.parts;
                // Simply count parts
                // console.log("Part:", JSON.stringify(parts[0]).substring(0, 50));
            }
            try {
                const t = chunk.text();
                if (t) textLen += t.length;
            } catch (e) {
                thoughtCount++;
            }
        }

        const totalTime = Date.now() - start;
        console.log(`[${label}] ✅ Complete. Total: ${totalTime}ms. Output: ${textLen} chars. ThoughtChunks: ${thoughtCount}`);

        // Cleanup Cache
        if (cachedContentName) {
            await cacheManager.delete(cachedContentName);
            console.log(`[${label}] Cache Deleted.`);
        }

    } catch (e: any) {
        console.error(`[${label}] ❌ Failed:`, e.message);
    }
}

async function main() {
    console.log("=== GEMINI LATENCY DIAGNOSTIC TOOL v2 ===");

    // Test 1: Baseline (Short, No Think, No Cache)
    // await runTest("Baseline", 100, 100, false);

    // Test 2: Thinking (Short, Think ON, No Cache)
    await runTest("Thinking_Short", 100, 100, true);

    // Test 3: Uncached Large System (30k System, 100 User, Think ON)
    // await runTest("Uncached_30k_Sys", 30000, 100, true, false);

    // Test 4: Real Scenario Uncached (30k System, 8k User, Think ON)
    await runTest("Real_Uncached", 30000, 8000, true, false);

    // Test 5: Real Scenario CACHED (30k System cached, 8k User, Think ON)
    await runTest("Real_Cached", 30000, 8000, true, true);
    // Test 6: Real Scenario CACHED NO THINKING
    await runTest("Real_Cached_NoThink", 30000, 8000, false, true);
}

main();
