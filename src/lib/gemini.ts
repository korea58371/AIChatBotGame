import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Message } from './store';
import { PromptManager } from './prompt-manager';
import { LoreConverter } from './lore-converter';
import { getLogicPrompt, getStaticLogicPrompt, getDynamicLogicPrompt } from '@/data/prompts/logic';
import { MODEL_CONFIG, calculateCost } from './model-config';
import { EventManager } from './event-manager';

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

// Helper: Retry with Exponential Backoff
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000,
    operationName: string = 'Gemini API'
): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries === 0 || !shouldRetry(error)) throw error;

        console.warn(`[Gemini] ${operationName} failed. Retrying... (${retries} attempts left). Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithBackoff(fn, retries - 1, delay * 2, operationName);
    }
}

function shouldRetry(error: any): boolean {
    const msg = (error.message || '').toLowerCase();
    // 500: Internal Server Error
    // 503: Service Unavailable
    // 429: Too Many Requests (Rate Limit) -> Wait longer? Default backoff helps.
    // fetch failed: Network issues
    return msg.includes('500') || msg.includes('503') || msg.includes('429') || msg.includes('internal error') || msg.includes('fetch failed') || msg.includes('overloaded');
}

export async function generateResponse(
    apiKey: string,
    history: Message[],
    userMessage: string,
    gameState: any, // Pass the full game state to generate the prompt
    language: 'ko' | 'en' | null,
    modelName: string = MODEL_CONFIG.STORY // [NEW] Accept model override, default to config
) {
    if (!apiKey) throw new Error('API Key is missing');

    console.log(`[Gemini] generateResponse called. Model: ${modelName}. gameState.playerStats.luk: ${gameState.playerStats?.luk}`);

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
    if (gameState.lore) {
        // console.log(`[Gemini] Lore Data Present. Keys: ${Object.keys(gameState.lore).join(', ')}`);
    } else {
        console.warn("[Gemini] ⚠️ Lore Data is MISSING in gameState!");
    }

    // [컨텍스트 캐싱 키 수정]
    // 정적(Static) 프롬프트와 동적(Dynamic) 프롬프트를 합치지 마세요.
    // Static = systemInstruction (캐시됨, 비용 절감)
    // Dynamic = 유저 메시지의 일부 (캐시 안됨, 매번 변경)
    // Static = systemInstruction (캐시됨, 비용 절감)
    // Dynamic = 유저 메시지의 일부 (캐시 안됨, 매번 변경)
    const systemInstruction = staticPrompt;

    // [Fix] Use passed modelName if available, otherwise default to config
    // Also ensuring no variable shadowing in loop
    const targetModel = modelName || MODEL_CONFIG.STORY;

    const modelsToTry = [
        targetModel,
        MODEL_CONFIG.LOGIC, // Fallback
    ];

    let lastError;

    // Rename loop variable to avoid shadowing arg 'modelName'
    for (const currentModel of modelsToTry) {
        try {
            console.log(`Trying story model: ${currentModel}`);

            const modelConfig: any = {
                model: currentModel,
                safetySettings
            };

            // [Gemini 3 최적화] Native Thinking 활성화
            // gemini-3-pro-preview, gemini-3-flash-preview 등 'gemini-3'가 포함된 모델에 적용
            // gemini-3-pro-preview, gemini-3-flash-preview 등 'gemini-3'가 포함된 모델에 적용
            if (currentModel.includes('gemini-3') || currentModel.includes('thinking')) {
                modelConfig.thinkingConfig = {
                    includeThoughts: true, // [User Request] 생각 과정 로그 확인을 위해 True 설정
                    thinkingLevel: "high"
                };
            }

            // [수정] 캐시 적중(Cache Hit)을 유지하기 위해 '정적 컨텍스트'만 시스템 지침으로 전달합니다.
            modelConfig.systemInstruction = systemInstruction;

            // [DYNAMIC MODEL] Override model if provided
            // [DYNAMIC MODEL] Override model if provided
            if (currentModel) {
                modelConfig.model = currentModel;
            }

            const model = genAI.getGenerativeModel(modelConfig);

            // [최적화]
            // 요약본이 존재한다면 전체 히스토리가 필요 없습니다.
            // 최근 대화(예: 마지막 10개 메시지 = 5턴)만 남겨 토큰을 절약하고
            // 요약본과 전체 히스토리가 중복되어 정보가 왜곡되는 것을 방지합니다.
            let effectiveHistory = history;
            if (gameState.scenarioSummary && gameState.scenarioSummary.length > 50) {
                // 마지막 10개 메시지만 유지
                effectiveHistory = history.slice(-10);
            }

            // Gemini API를 위해 히스토리 포맷팅 (반드시 'user'로 시작해야 함)
            let processedHistory = effectiveHistory.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text || "..." }],
            }));

            // 수정 1: 프로토콜은 'user'와 'model'이 반드시 번갈아 나와야 하며,작은 'user'로 시작해야 합니다.
            // 만약 히스토리가 'model'로 시작한다면, 더미 'user' 메시지를 앞에 추가합니다.
            if (processedHistory.length > 0 && processedHistory[0].role === 'model') {
                processedHistory = [
                    { role: 'user', parts: [{ text: "..." }] }, // 더미 컨텍스트 시작
                    ...processedHistory
                ];
            }

            const chatSession = model.startChat({
                history: processedHistory,
            });

            // [수정] 동적 프롬프트(기분, 상태창 등)를 유저 메시지 내부에 주입합니다.
            // 이렇게 하면 정적 캐시(Static Cache)를 깨지 않으면서도 매 턴 새로운 상태를 반영할 수 있습니다.
            const finalUserMessage = `${dynamicPrompt}\n\n${userMessage}`;

            // [Retry Wrapper]
            const result = await retryWithBackoff(
                () => chatSession.sendMessage(finalUserMessage),
                3,
                1500,
                `Story Generation (${currentModel})`
            );
            const response = result.response;

            // [DEBUG] Log Thinking Process
            // Gemini 3.0 Thinking Model returns thoughts in candidate parts
            const parts = response.candidates?.[0]?.content?.parts || [];
            // Note: The structure might vary, but usually thoughts are tagged or separate.
            // We just log all parts that are NOT the final text if possible, or log everything for inspection.
            // Standard 'text()' method filters out thoughts usually? Let's verify by logging.
            console.log("--- [Gemini Thinking Process] ---");
            parts.forEach((p: any, idx: number) => {
                // Check for thought property (might be specific to SDK version) or just log content
                // If p.thought is true, or check text content
                if (p.thought || (idx === 0 && parts.length > 1)) {
                    console.log(`Thought Part ${idx}:`, p.text || p);
                }
            });
            console.log("---------------------------------");

            return {
                text: response.text(),
                usageMetadata: response.usageMetadata,
                systemPrompt: systemInstruction, // "시스템 프롬프트"로 정적 부분 로그
                finalUserMessage: finalUserMessage, // [DEBUG] Return Actual Dynamic Input
                usedModel: currentModel,
                totalTokenCount: (response.usageMetadata?.promptTokenCount || 0) + (response.usageMetadata?.candidatesTokenCount || 0)
            };
        } catch (error: any) {
            console.error(`Story Model ${currentModel} failed:`, error.message || error);
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

    console.log(`[GeminiLogic] GENERATE GAME LOGIC CALLED for GameID: ${gameState.activeGameId}`);

    // [REFACTOR] Event System Decoupled to Parallel Agent
    // Events are no longer processed inside the monolithic Logic Model loop.
    // They are handled by AgentOrchestrator -> EventManager in Phase 2.
    // validEvents is kept empty here to minimize token usage for the Logic Model.
    let validEvents: any[] = [];

    const genAI = new GoogleGenerativeAI(apiKey);

    // [CONTEXT CACHING] Reuse the SAME static prefix
    const staticPrompt = await PromptManager.getSharedStaticContext(gameState);

    // Logic uses MODEL_CONFIG.LOGIC (Optimized for speed)
    const modelsToTry = [MODEL_CONFIG.LOGIC, MODEL_CONFIG.PRE_LOGIC];

    for (const modelName of modelsToTry) {
        try {
            console.log(`Trying logic model: ${modelName}`);

            // [NEW] Static Prompt for Context Caching
            // [NEW] Static Prompt for Context Caching
            // [OPTIMIZATION] Convert JSON to YAML-like text using LoreConverter to save tokens & match Story Model format
            const rankCriteria = gameState.lore?.martial_arts_levels ? LoreConverter.convertMartialArtsLevels(gameState.lore.martial_arts_levels) : null;
            const romanceGuide = gameState.lore?.romance_guide ? LoreConverter.convertRomance(gameState.lore.romance_guide) : null;
            const combatGuide = gameState.lore?.combat_guide ? LoreConverter.convertCombat(gameState.lore.combat_guide) : null;

            const staticLogicPrompt = getStaticLogicPrompt(gameState.activeGameId, rankCriteria, romanceGuide, combatGuide);

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
                wikiData, // [OPTIMIZATION] Exclude Wiki Data (Generic info not needed for step logic)
                scriptQueue, // [OPTIMIZATION] Exclude Visual Novel Script Queue
                textMessageHistory, // [OPTIMIZATION] Exclude SMS History
                constants, // [OPTIMIZATION] Exclude Static Constants
                events: _ignoredEvents, // [OPTIMIZATION] Exclude Raw Events List (Passed filtered)
                characterMap,
                extraMap,
                characterCreationQuestions,
                backgroundMappings, // [OPTIMIZATION] Exclude Background Mappings
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

            // [Retry Wrapper] logic generation
            const result = await retryWithBackoff(
                () => model.generateContent(prompt),
                3,
                1500,
                `Logic Generation (${modelName})`
            );
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
                json._debug_static_prompt = staticLogicPrompt;
                json._debug_raw_response = text;

                // [REFACTOR] Event Trigger Logic Moved
                // Logic Model no longer selects events.
                // EventManager (Phase 2 Parallel) handles selection and Next State Injection.
                if (json.triggerEventId) {
                    console.warn(`[GeminiLogic] DEPRECATED: Logic Model returned triggerEventId '${json.triggerEventId}' but Event System is now parallel.`);
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
        model: MODEL_CONFIG.SUMMARY,
        safetySettings
    });

    const dialogueText = recentDialogue.map(msg =>
        `${msg.role === 'user' ? 'Player' : 'AI'}: ${msg.text}`
    ).join('\n');

    const prompt = `
    당신은 방대한 서사를 핵심만 추려 기록하는 '왕실 서기'입니다.
    플레이어의 모험이 길어짐에 따라, 오래된 기록은 과감히 축약하고 **현재의 상태와 직면한 상황** 위주로 요약본을 갱신해야 합니다.

    [입력 데이터]
    1. 이전 요약 (Save Data): ${currentSummary || "없음"}
    2. 최근 대화 (Log): 
    ${dialogueText}

    [작성 지침]
    1. **압축 및 갱신**: 과거의 '이전 요약'과 '최근 대화'를 합쳐서 하나의 새로운 요약문을 만드십시오. 단순한 덧붙이기가 아닙니다.
    2. **분량 제한**: 전체 요약은 절대 *2500자(공백 포함)** 를 넘지 않도록 문장을 간결하게 다듬으십시오. 요약이 너무 길어지면 가장 오래된 사건부터 과감히 삭제하거나 한 문장으로 압축하십시오.
    3. **현재성 유지**: 지금 플레이어가 어디에 있고, 무엇을 하고, 누구와 함께 있는지, 어떤 부상을 입었는지 **'현재 상태'**가 가장 중요합니다.
    4. **형식**: 줄글 형식으로 작성하되, 가독성을 위해 단락을 나누십시오.

    [필수 포함 항목]
    - 현재 위치 및 상황
    - 주요 인물과의 관계 변화 (특히 호감도/적대감)
    - 현재 획득한 비급/아이템 및 신체 상태(부상 등)
    - 당면한 목표

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

// Memory Summarization for Characters: Use Configured Model (Gemini 2.5 Flash)
export async function generateCharacterMemorySummary(
    apiKey: string,
    characterName: string,
    existingMemories: string[]
): Promise<string[]> {
    if (!apiKey || existingMemories.length <= 10) return existingMemories;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: MODEL_CONFIG.SUMMARY, // Logic/Flash Model
        safetySettings
    });

    const memoryText = existingMemories.map(m => `- ${m}`).join('\n');

    const prompt = `
    당신은 RPG 게임의 '캐릭터 기억 관리자'입니다.
    현재 [${characterName}] 캐릭터의 기억이 너무 많아져서 정리가 필요합니다.
    자잘한 기억들을 병합하고, 중요한 사건 위주로 요약하여 **10개 이하의 핵심 기억 리스트**로 재구성하십시오.

    [입력된 기억 목록]
    ${memoryText}

    [작성 지침]
    1. **중요도 기반 선별**: 약속, 원한, 생명의 은인, 주요 퀘스트 관련 정보를 최우선으로 남기십시오.
    2. **병합**: "같이 밥을 먹음", "같이 차를 마심" -> "플레이어와 식사를 하며 친해짐" 처럼 비슷한 사건은 하나로 합치십시오.
    3. **최신성 유지**: 가장 최근에 발생한 중요한 변화는 상세히 기록하십시오.
    4. **형식**: JSON String Array ("[...]").

    [요약된 기억 리스트 (JSON Array)]:
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // JSON Parsing Attempt
        const firstBracket = text.indexOf('[');
        const lastBracket = text.lastIndexOf(']');

        if (firstBracket !== -1 && lastBracket !== -1) {
            const jsonText = text.substring(firstBracket, lastBracket + 1);
            const parsed = JSON.parse(jsonText);
            if (Array.isArray(parsed)) {
                console.log(`[MemorySummary] Summarized ${characterName}'s memories: ${existingMemories.length} -> ${parsed.length}`);
                return parsed;
            }
        }

        throw new Error("Failed to parse JSON response");

    } catch (error: any) {
        console.warn(`[MemorySummary] Failed to summarize memories for ${characterName}:`, error);
        // Fallback: Just keep the last 10 if AI fails
        return existingMemories.slice(-10);
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
        // MATCH THE MAIN MODEL: MODEL_CONFIG.STORY
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.STORY,
            systemInstruction: staticPrompt,
        }, {
            apiVersion: 'v1beta',
        });

        // 3. Send a dummy prompt
        const result = await model.generateContent("System Initialization (Warmup)");

        console.log("[Gemini] Cache Warmup Request Sent!");
        return result.response.usageMetadata;
    } catch (e) {
        console.error("[Gemini] Cache Warmup Failed:", e);
        return null;
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
        } else {
            // Nap: Reduce Fatigue, Advance Time (1 phase)
            currentFatigue = Math.max(0, currentFatigue - 30);
            const nextIdx = (timePhases.indexOf(currentTime) + 1) % 4;
            if (nextIdx === 0) currentDay++;
            currentTime = timePhases[nextIdx];
        }
    } else {
        // Normal Time Progression (Support both new 'timeConsumed' and legacy 'timeProgress')
        const timeAdvance = logicResult.timeConsumed || (logicResult.timeProgress ? 1 : 0);

        if (timeAdvance > 0) {
            let idx = timePhases.indexOf(currentTime);

            // Advance by N steps
            for (let i = 0; i < timeAdvance; i++) {
                idx++;
                if (idx >= timePhases.length) {
                    idx = 0;
                    currentDay++; // Night -> Morning triggers next day
                }
            }
            currentTime = timePhases[idx];
        }
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

    // Calculate Total Cost
    let totalCost = 0;

    // 1. Story Cost
    if (storyResult.usageMetadata) {
        totalCost += calculateCost(
            storyResult.usedModel || MODEL_CONFIG.STORY,
            storyResult.usageMetadata.promptTokenCount || 0,
            storyResult.usageMetadata.candidatesTokenCount || 0
        );
    }

    // 2. Logic Cost (Assuming LOGIC model)
    if (logicResult._usageMetadata) {
        totalCost += calculateCost(
            MODEL_CONFIG.LOGIC,
            logicResult._usageMetadata.promptTokenCount || 0,
            logicResult._usageMetadata.candidatesTokenCount || 0
        );
    }

    // 3. Summary Cost (Assuming SUMMARY model, if generated)
    // Note: Summary generation doesn't currently return metadata easily, 
    // but it's small. We can ignore or approximate if needed.
    // For perfection, we'd need generateSummary to return metadata.
    // Let's assume 0 for optional summary for now or update generateSummary later.

    return {
        reply: storyResult.text,
        logic: logicResult,
        summary: newSummary,
        turnCount: currentTurnCount,
        storyResult: storyResult,
        cost: totalCost // [New]
    };
}
