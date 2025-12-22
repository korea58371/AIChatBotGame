import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Message } from './store';
import { PromptManager } from './prompt-manager';
import { getLogicPrompt, getStaticLogicPrompt, getDynamicLogicPrompt } from '@/data/prompts/logic';

// Removed static SYSTEM_PROMPT in favor of dynamic generation

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

export async function generateResponse(
    apiKey: string,
    history: Message[],
    userMessage: string,
    gameState: any, // Pass the full game state to generate the prompt
    language: 'ko' | 'en' | null
) {
    if (!apiKey) throw new Error('API Key is missing');

    console.log(`[Gemini] generateResponse called. gameState.playerStats.luk: ${gameState.playerStats?.luk}`);

    const genAI = new GoogleGenerativeAI(apiKey);

    // Generate dynamic system prompt based on current game state

    // [SERVER REHYDRATION FIX]
    // If getSystemPromptTemplate is missing (because functions don't survive network serialization),
    // and we have activeGameId, we try to reload it dynamically.
    if (!gameState.getSystemPromptTemplate && gameState.activeGameId) {
        console.log(`[Gemini] Rehydrating System Prompt for game: ${gameState.activeGameId}`);
        try {
            // Dynamic import based on game ID
            const systemModule = await import(`@/data/games/${gameState.activeGameId}/prompts/system`);
            if (systemModule && systemModule.getSystemPromptTemplate) {
                gameState.getSystemPromptTemplate = systemModule.getSystemPromptTemplate;
            }
        } catch (e) {
            console.warn(`[Gemini] Failed to rehydrate system prompt for ${gameState.activeGameId}:`, e);
        }
    }

    const staticPrompt = await PromptManager.getSharedStaticContext(gameState);
    const dynamicPrompt = PromptManager.generateSystemPrompt(gameState, language, userMessage);

    // [DEBUG] Check Lore Injection
    console.log("--- [Main Model Static Input (Lore & Context)] ---");
    console.log(staticPrompt.substring(0, 3000) + "\n... (Truncated for readability) ...");
    console.log("----------------------------------------------");

    // [DEBUG] Check Lore Injection
    if (gameState.lore) {
        console.log(`[Gemini] Lore Data Present. Keys: ${Object.keys(gameState.lore).join(', ')}`);
        console.log(`[Gemini] Lore Data approx length: ${JSON.stringify(gameState.lore).length} chars`);
    } else {
        console.warn("[Gemini] ⚠️ Lore Data is MISSING in gameState!");
    }

    // [DEBUG LOG] Requested by user to see "New Input"
    console.log("--- [Main Model New Input (Dynamic Prompt)] ---");
    console.log(dynamicPrompt);
    console.log("---------------------------------------------");

    // [CONTEXT CACHING] Concatenate Static + Dynamic
    const systemPrompt = staticPrompt + dynamicPrompt;

    // Main Story Model: Gemini 3 Pro (Prioritize quality)
    const modelsToTry = [
        'gemini-3-pro-preview', // Correct ID from documentation, gemini-3-pro-preview, gemini-3-flash-preview
        'gemini-2.5-flash', // Stable fallback
        'gemini-2.5-flash', // Fast fallback
    ];

    let lastError;

    for (const modelName of modelsToTry) {
        try {
            console.log(`Trying story model: ${modelName}`);

            const modelConfig: any = {
                model: modelName,
                safetySettings
            };

            // [Gemini 3 Optimization] Enable Native Thinking
            if (modelName === 'gemini-3-pro-preview') {
                modelConfig.thinkingConfig = {
                    includeThoughts: false, // Thoughts are hidden by default
                    thinkingLevel: "high"
                };
            }
            modelConfig.systemInstruction = systemPrompt;

            const model = genAI.getGenerativeModel(modelConfig);

            // [OPTIMIZATION]
            // If we have a summary, we don't need the full history.
            // Truncate to recent dialogue (e.g., last 10 messages = 5 turns).
            // This prevents "Double Counting" (Summary + Full History) and saves massive tokens.
            let effectiveHistory = history;
            if (gameState.scenarioSummary && gameState.scenarioSummary.length > 50) {
                // Keep last 10 messages
                effectiveHistory = history.slice(-10);
            }

            // Sanitize history for Gemini API (Must start with 'user')
            let processedHistory = effectiveHistory.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }],
            }));

            // Fix 1: Protocol requires strictly alternating roles starting with 'user'.
            // If the history starts with 'model', prepend a dummy 'user' message.
            if (processedHistory.length > 0 && processedHistory[0].role === 'model') {
                processedHistory = [
                    { role: 'user', parts: [{ text: "..." }] }, // Dummy context starter
                    ...processedHistory
                ];
            }

            const chatSession = model.startChat({
                history: processedHistory,
            });

            const result = await chatSession.sendMessage(userMessage);
            const response = result.response;
            return {
                text: response.text(),
                usageMetadata: response.usageMetadata,
                systemPrompt: systemPrompt,
                usedModel: modelName
            };

        } catch (error: any) {
            console.error(`Story Model ${modelName} failed:`, error.message || error);
            lastError = error;
            // Continue to next model in list
        }
    }

    throw lastError || new Error("All story models failed.");
}

// Logic Model: Gemini 2.5 Flash (Optimized for speed & JSON)
export async function generateGameLogic(
    apiKey: string,
    lastUserMessage: string,
    lastAiResponse: string,
    gameState: any // [CHANGED] Accepts full GameState to generate shared static prompt
) {
    if (!apiKey) throw new Error('API Key is missing');

    // [New] Dynamic Event Filtering
    // 1. Load Events (If not in state, try to import)
    // Note: State might have 'events' from DataManager
    let validEvents = [];
    if (gameState.activeGameId === 'wuxia') {
        const events = gameState.events || [];
        // Filter by condition
        validEvents = events.filter((e: any) => {
            if (e.once && e.triggered) return false; // Already triggered? (Needs persistence logic if 'triggered' flag exists)
            // For now, simple condition check. Logic model will decide if it fits.
            // We need to execute the condition function.
            // PROBLEM: Functions don't survive serialization if events came from Client.
            // DataManager loads valid functions on Server.
            // If gameState.events has functions, we can run them.
            // If condition code is serialized or missing, we can't run it.

            // Fallback: If condition is a function, run it.
            if (typeof e.condition === 'function') {
                try { return e.condition(gameState); } catch (err) { return false; }
            }
            return false;
        });

        console.log(`[GeminiLogic] Valid Events: ${validEvents.length} / ${events.length}`);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // [CONTEXT CACHING] Reuse the SAME static prefix
    const staticPrompt = await PromptManager.getSharedStaticContext(gameState);

    const modelsToTry = ['gemini-3-pro-preview', 'gemini-3-pro-preview']; // Logic uses 2.5 Flash

    for (const modelName of modelsToTry) {
        try {
            console.log(`Trying logic model: ${modelName}`);

            // [NEW] Static Prompt for Context Caching
            const rankCriteria = gameState.lore?.martial_arts_levels || null;
            const staticLogicPrompt = getStaticLogicPrompt(gameState.activeGameId, rankCriteria);

            const model = genAI.getGenerativeModel({
                model: modelName,
                safetySettings,
                generationConfig: { responseMimeType: "application/json" },
                systemInstruction: staticLogicPrompt // [OPTIMIZATION] Cache the Rules & Format
            });

            // Logic Prompt (Dynamic Suffix)
            // Note: We need to pass pruned stats for logic processing logic, but PromptManager uses full state.
            // Ideally, we prune stats separately.
            const stats = gameState.playerStats || {};
            // Prune huge arrays to save tokens in the Dynamic part (Static part is already big but cached)
            const {
                characterData,
                availableBackgrounds,
                availableCharacterImages,
                availableExtraImages,
                chatHistory, // [Optimize] Remove history from stats dumping (Passed separately as strings)
                displayHistory,
                worldData: _unusedWorldData, // [FIX] Exclude worldData from prunedStats (Renamed to avoid conflict)
                lore, // [CRITICAL FIX] Exclude Lore from Logic Model (It uses huge tokens and isn't needed for logic)
                ...prunedStats
            } = gameState;

            const worldData = gameState.worldData || { locations: {}, items: {} }; // Fallback to empty if missing

            // Get lightweight context for Logic Model
            const logicContext = PromptManager.getLogicModelContext(gameState);

            // [NEW] Dynamic Prompt (Stats & Action)
            const prompt = getDynamicLogicPrompt(
                prunedStats,
                lastUserMessage,
                lastAiResponse,
                logicContext,
                worldData,
                validEvents // [NEW] Pass filtered events to logic prompt
            );

            // [DEBUG LOG] Verify Logic Model Prompt Size
            console.log("--- [Logic Model Input Prompt] ---");
            console.log(prompt);
            console.log("----------------------------------");

            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            console.log("Raw Logic Response:", text); // Debug Log

            try {
                const json = JSON.parse(text);
                console.log("Parsed Logic JSON:", json); // Debug Log

                // Attach usage metadata if available
                if (response.usageMetadata) {
                    json._usageMetadata = response.usageMetadata;
                }

                // Attach debug info
                json._debug_prompt = prompt;
                json._debug_raw_response = text;

                // Post-Process: Event Trigger
                // If Logic Model selected an event, we need to locate its prompt
                if (json.triggerEventId && gameState.events) {
                    const selectedEvent = gameState.events.find((e: any) => e.id === json.triggerEventId);
                    if (selectedEvent) {
                        console.log(`[GeminiLogic] TRIGGERING EVENT: ${selectedEvent.name} (${selectedEvent.id})`);
                        // Inject the prompt into next state's currentEvent field
                        json.currentEvent = selectedEvent.prompt;
                    }
                }

                return json;
            } catch (e) {
                console.error("Failed to parse logic JSON:", e);
                // Try to extract JSON if it's wrapped in markdown code blocks
                const match = text.match(/```json([\s\S]*?)```/);
                if (match) {
                    try {
                        const json = JSON.parse(match[1]);
                        console.log("Parsed Logic JSON (from markdown):", json); // Debug Log

                        // Attach debug info
                        json._debug_prompt = prompt;
                        json._debug_raw_response = text;

                        return json;
                    } catch (e2) {
                        console.error("Failed to parse extracted JSON:", e2);
                    }
                }
                // If parsing failed, continue to next model (maybe model output was bad)
                throw new Error("JSON parsing failed");
            }

        } catch (error: any) {
            console.warn(`Logic Model ${modelName} failed:`, error.message || error);
            // Continue to next model
        }
    }

    return null;
}

// Memory Summarization Model: Gemini 1.5 Flash (Cost-efficient)
export async function generateSummary(
    apiKey: string,
    currentSummary: string,
    recentDialogue: Message[]
) {
    if (!apiKey) return currentSummary;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        safetySettings
    });

    const dialogueText = recentDialogue.map(msg =>
        `${msg.role === 'user' ? 'Player' : 'AI'}: ${msg.text}`
    ).join('\n');

    const prompt = `
    당신은 방대한 판타지 서사시를 기록하는 '왕실 서기'입니다.
    현재까지의 [누적 줄거리]와 [최근 발생한 사건]을 통합하여, 다음 이야기를 진행하는 데 필요한 완벽한 요약본을 갱신해야 합니다.

    [입력 데이터]
    1. 누적 줄거리 (과거): ${currentSummary || "없음"}
    2. 최근 대화 (현재): 
    ${dialogueText}

    [작성 지침]
    1. **인과관계 유지**: 과거의 사건이 현재 어떤 결과로 이어졌는지 명시하십시오.
    2. **상태 변화 기록**: 최근 대화에서 획득한 아이템, 부상, NPC와의 관계 변화(호감도 등)를 반드시 텍스트에 포함하십시오.
    3. **불필요한 대화 삭제**: "안녕", "밥 먹었어?" 같은 잡담은 제거하고 핵심 사건 위주로 서술하십시오.
    4. **시점**: "플레이어는 ~했다"와 같이 3인칭 관찰자 시점을 유지하십시오.

    [갱신된 요약본]:
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        console.log("Generated Summary:", text);
        return text;
    } catch (error: any) {
        console.warn("Summarization failed:", error.message || error);
        return currentSummary; // Return old summary on failure
    }
}

// [Startup Warmup]
// Fire-and-forget request to create/warm the cache.
export async function preloadCache(apiKey: string, initialState: any) {
    if (!apiKey) return;
    try {
        console.log("[Gemini] Pre-loading cache...");

        // 1. Get the Exact Same Static Prompt as normal requests
        const staticPrompt = await PromptManager.getSharedStaticContext(initialState, initialState.activeChars, initialState.spawnCandidates);


        // 2. Configure Model
        // MATCH THE MAIN MODEL: gemini-3-pro-preview
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-pro-preview',
            systemInstruction: staticPrompt,
        }, {
            apiVersion: 'v1beta',
        });

        // 3. Send a dummy prompt
        await model.generateContent("System Initialization (Warmup)");

        console.log("[Gemini] Cache Warmup Request Sent!");
    } catch (e) {
        console.error("[Gemini] Cache Warmup Failed:", e);
    }
}

// =========================================================
// Turn Orchestration Logic
// =========================================================

const SUMMARY_THRESHOLD = 3;

export async function handleGameTurn(
    apiKey: string,
    state: any,             // State including turnCount and summary
    history: Message[],     // UI display history
    userInput: string
) {
    console.log(`[handleGameTurn] Turn: ${state.turnCount}, Summary Length: ${state.scenarioSummary?.length || 0
        }`);

    // 1. Add user message to a temporary history for the AI call
    // Note: The caller updates the actual UI history. This is for the AI logic.
    // If we want to strictly follow the user's snippet, we operate on the list passed.
    const newHistory = [...history, { role: 'user', text: userInput } as Message];

    // 2. Main Story Model
    // State should already have the summary injected via PromptManager in generateResponse
    const storyResult = await generateResponse(
        apiKey,
        history,
        userInput,
        state,
        'ko' // Default to Korean as per context
    );

    // 3. Game Logic Model
    const logicResult = await generateGameLogic(
        apiKey,
        userInput,
        storyResult.text,
        state
    );

    // Merge logic result into nextState (Conceptually)
    // The actual state update depends on the caller (client or server action) applying the JSON.
    // But for the purpose of summarization, we need to know the *next* turn count.

    let nextState = { ...state, ...logicResult };

    // [New] Process Time & Survival Logic
    const currentStats = nextState.playerStats || {};
    let currentFatigue = currentStats.fatigue || 0;

    // 1. Fatigue Update from Logic
    if (logicResult.fatigueChange) {
        currentFatigue = Math.max(0, Math.min(100, currentFatigue + logicResult.fatigueChange));
    }

    // 2. Time & Sleep Logic
    let currentDay = nextState.day || 1;
    let currentTime = nextState.time || 'Morning';
    const timePhases = ['Morning', 'Afternoon', 'Evening', 'Night'];

    if (logicResult.isSleep) {
        // Sleep Action
        if (currentTime === 'Night') {
            // Full Rest: Next Day
            currentDay++;
            currentTime = 'Morning';
            currentFatigue = 0; // Reset Fatigue
            // Recover HP/MP bonus could be handled by Logic output, but we ensure fatigue reset here.
        } else {
            // Nap: Reduce Fatigue, Advance Time
            currentFatigue = Math.max(0, currentFatigue - 30);
            const nextIdx = (timePhases.indexOf(currentTime) + 1) % 4;
            if (nextIdx === 0) currentDay++; // Wrapped around (unlikely for day nap but safe)
            currentTime = timePhases[nextIdx];
        }
    } else if (logicResult.timeProgress) {
        // Normal Time Progression
        let idx = timePhases.indexOf(currentTime);
        idx++;
        if (idx >= timePhases.length) {
            idx = 0;
            currentDay++; // Night -> Morning triggers next day
        }
        currentTime = timePhases[idx];
    }

    // Apply Time/Fatigue Updates to State
    nextState.day = currentDay;
    nextState.time = currentTime;
    nextState.playerStats = { ...currentStats, fatigue: currentFatigue };

    // Logic result might have specific fields like hpChange, etc. 
    // We are interested in 'turnCount' and 'scenarioSummary'.
    // The user's snippet implies we handle turn counting here or assume it's passed.
    // If the state passed in is the *current* state (before this turn), we should increments turn info.

    const currentTurnCount = (state.turnCount || 0) + 1;

    // Update summary if threshold reached
    let newSummary = state.scenarioSummary;

    if (currentTurnCount > 0 && currentTurnCount % SUMMARY_THRESHOLD === 0) {
        console.log(`[handleGameTurn] Triggering Memory Summarization at turn ${currentTurnCount}...`);

        // A. Select recent dialogue (Last 10 turns = 20 messages)
        // We use newHistory which includes the latest user message.
        // We also need the model's response we just generated.
        const fullDialogue = [...newHistory, { role: 'model', text: storyResult.text } as Message];
        const recentDialogue = fullDialogue.slice(-SUMMARY_THRESHOLD * 2);

        // B. Generate Summary
        newSummary = await generateSummary(
            apiKey,
            state.scenarioSummary || "",
            recentDialogue
        );

        console.log("[handleGameTurn] New Summary Generated.");
    }

    return {
        reply: storyResult.text,
        logic: logicResult,
        summary: newSummary,
        turnCount: currentTurnCount,
        storyResult: storyResult
    };
}
