import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Message } from './store';
import { PromptManager } from './prompt-manager';

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
    const systemPrompt = PromptManager.generateSystemPrompt(gameState, language, userMessage);

    // Main Story Model: Gemini 3 Pro (Prioritize quality)
    const modelsToTry = [
        'gemini-3-pro-preview', // Correct ID from documentation /gemini-3-pro-preview 임시 수정
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
            modelConfig.systemInstruction = systemPrompt;

            const model = genAI.getGenerativeModel(modelConfig);

            const chatSession = model.startChat({
                history: history.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.text }],
                })),
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
            console.warn(`Model ${modelName} failed:`, error.message || error);
            lastError = error;
            // Continue to next model
        }
    }

    console.error("All story models failed.", lastError);
    throw new Error(`All story models failed. Last error: ${lastError?.message || JSON.stringify(lastError)}`);
}

// Game Logic Model: Gemini 2.5 Flash (Prioritize speed)
export async function generateGameLogic(
    apiKey: string,
    lastUserMessage: string,
    lastAiResponse: string,
    currentStats: any
) {
    if (!apiKey) return null;

    const genAI = new GoogleGenerativeAI(apiKey);

    // Try user's preferred model first, then fallback
    const logicModels = ['gemini-2.5-flash', 'gemini-2.5-flash'];

    for (const modelName of logicModels) {
        try {
            console.log(`Trying logic model: ${modelName}`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: "application/json" },
                safetySettings
            });

            // Prune currentStats to remove heavy character data AND asset lists (Token Optimization)
            const {
                characterData,
                availableBackgrounds,
                availableCharacterImages,
                availableExtraImages,
                scriptQueue, // Also remove script queue
                ...prunedStats
            } = currentStats;
            const worldData = currentStats.worldData || require('../data/prompts/world.json'); // Fallback to static if missing

            // Get lightweight context for Logic Model
            const logicContext = PromptManager.getLogicModelContext(currentStats);

            const prompt = `
            You are a Game Master (GM) managing the backend logic of a text RPG.
            Analyze the latest interaction and update the player's status, inventory, personality, and relationships.

            Current Stats: ${JSON.stringify(prunedStats)}
            User Action: "${lastUserMessage}"
            AI Response: "${lastAiResponse}"

            Reference Data:
            ${logicContext}
            - Valid Locations: ${Object.keys(worldData.locations).join(', ')}
            - Valid Items: ${Object.keys(worldData.items).join(', ')}

            Rules:
            1. **Inventory Enforcement (CRITICAL):** 
               - The player CANNOT use an item they do not have in their 'Current Stats' inventory. 
               - If the user tries to use a non-existent item, ignore the action or mark it as failed in the narrative (handled by story model), but DO NOT remove it from inventory here.
            2. **Status Updates:**
               - **HP (Health)**:
                 - 100% (Healthy), 80% (Minor Injury), 50% (Moderate Injury), 30% (Critical), 10% (Near Death), 0% (Death).
                 - If the player gets hurt, reduce HP based on these thresholds.
               - **MP (Mental Power)**:
                 - 100% (Full Will), 80% (Calm), 60% (Stress), 40% (Shaken), 20% (Panic), 0% (Lost Will).
                 - If the player uses magic or suffers mental trauma, reduce MP based on these thresholds.
               - If the player earns money, increase gold.
            3. **Item Management:**
               - If the player gains an item, add it (use IDs from Valid Items if possible).
               - If the player uses a valid item from inventory, remove it.
            4. **Personality Shifts (CRITICAL):**
               - Analyze the user's action and update the following 9 personality traits (-100 to +100).
               - **Morality**: Evil/Selfish (-100) <-> Good/Altruistic (+100)
               - **Courage**: Cowardly/Cautious (-100) <-> Brave/Reckless (+100)
               - **Energy**: Introverted (-100) <-> Extroverted (+100)
               - **Decision**: Emotional/Idealistic (-100) <-> Logical/Realistic (+100)
               - **Lifestyle**: Spontaneous (-100) <-> Planned (+100)
               - **Openness**: Conservative (-100) <-> Open/Innovative (+100)
               - **Warmth**: Cold (-100) <-> Warm/Kind (+100)
               - **Eloquence**: Quiet/Inarticulate (-100) <-> Eloquent/Persuasive (+100)
               - **Leadership**: Submissive/Follower (-100) <-> Dominant/Leader (+100)
               - **Humor**: Serious/Solemn (-100) <-> Playful/Witty (+100)
               - **Lust**: Ascetic/Pure (-100) <-> Lustful/Perverted (+100)
               - **Change Magnitude**: Small (+/- 1-2), Medium (+/- 3-5), Large (+/- 6-10).
               - Only update traits that are clearly affected by the user's action.

            5. **Base Stat Updates (NEW):**
               - Physical training/feat -> Increase STR or VIT (+1)
               - Agility/Stealth feat -> Increase AGI (+1)
               - Intellectual feat/Study -> Increase INT (+1)
               - Lucky event -> Increase LUK (+1)
            6. **Fate Intervention (Luck System) (CRITICAL):**
               - **Intervention Detection**: Check if the user is trying to FORCE a result (e.g., "I found a legendary sword", "She fell in love with me", "I suddenly became strong") without a corresponding in-game justification or choice.
               - **Fate Intervention (Cost)**:
                 - If intervention is detected, calculate a COST (10-100+ depending on impact).
                 - **Calculate 'fateChange'**:
                   - If (Current Fate >= Cost): 'fateChange' = -Cost.
                   - If (Current Fate < Cost):
                     - 'fateChange' = -Current Fate (consume all Fate to 0).
                     - **Luck Penalty**: You must ALSO reduce Luck ('luk') by the remaining cost (Cost - Current Fate). Include this in 'statChange.luk' (e.g., -5).
               - **Fate Accumulation (Misfortune)**:
                 - If the user suffers damage, humiliation, loss, or bad luck -> INCREASE 'Fate' (+1 to +10).
                 - Do NOT increase 'Luck' for misfortune.
               - **Lucky Events**:
                 - If the user experiences random good luck (finding money, etc.) -> INCREASE 'Luck' (+1 to +5).
            7. **Fame System (NEW):**
               - **Heroic/Notable Deed**: If the player saves someone, defeats a strong enemy, or gains public attention -> Increase fame (+1 to +50).
               - **Named Character Interaction**: If the player builds a relationship, joins forces, or has a significant interaction with a Named Character (already defined in the world) -> Increase fame (+1 to +10). Being associated with famous people makes you famous.
               - **Shameful Act**: If the player runs away, commits a crime, or is humiliated -> Decrease fame (-1 to -50).
               - **Fame Thresholds**: 0 (Nobody), 100 (Known Locally), 500 (City Famous), 1000 (National Hero).
            8. **Relationships:**
               - If the player helps or compliments a character, increase affinity (+1 to +10).
               - If the player insults or hurts a character, decrease affinity (-1 to -10).
               - Identify characters by their ID (e.g., 'Mina', 'Elara').
            9. **Character Updates (CRITICAL - MEMORY MANAGEMENT):**
               - **Memories**: You are the custodian of character memory.
               - **FILTER TRIVIALITY**: DO NOT record mundane actions like eating, walking, sleeping, or minor greetings unless they have significant plot relevance.
               - **CONSOLIDATE**: If a character has multiple memories about the same topic (e.g., "Likes bread", "Ate bread", "Wants bread"), MERGE them into one concise memory (e.g., "Loves bread and feels happy when eating it").
               - **SIGNIFICANCE**: Only record events that change relationships, reveal secrets, or advance the main plot.
               - **NO MIND READING (STRICT)**: 
                 - You MUST NOT record the user's internal thoughts, intentions, or narration that was not spoken aloud.
                 - ONLY record what the character explicitly SAW (actions), HEARD (dialogue), or EXPERIENCED directly.
                 - If the user thought "I should give up", but didn't say it, the character DOES NOT KNOW they gave up.
               - **FORMAT**: Return the **COMPLETE NEW LIST** of memories. If no changes, return the existing list.
               - **LIMIT**: Try to keep the memory list under 10 items per character by consolidating.
               - If a NEW character is introduced, add them.
               - ID should be the Character Name (e.g., '천서윤', '유화영').
               - **RELATIONSHIP INFO**: Update the following details based on the interaction:
                 - **relation**: Current relationship with protagonist (e.g., "Stranger", "Lover", "Enemy").
                 - **callSign**: How they address the protagonist (e.g., "You", "Master", "Oppa").
                 - **speechStyle**: "Formal" (Jondaemal) or "Informal" (Banmal).
                 - **endingStyle**: Typical sentence ending (e.g., "~yo", "~da", "~nida").
                 - **EXIT TAG (IMPORTANT)**: If a character leaves the scene (closes door, walks away, says goodbye and exits), append '<떠남>' to the end of their final dialogue line.
                   Example: "Goodbye, see you tomorrow. <떠남>"
            10. **Location Updates:**
               - If the narrative indicates the player has moved to a new location, return the new location ID in 'newLocation'.
               - **Secrets/Clues**: You can ADD, REMOVE, or UPDATE secrets. Return the **COMPLETE NEW LIST** of secrets for that location.
               - If a secret is resolved (e.g., "Found blood" -> "Discovered it was A's blood"), replace the old entry with the new one or remove it if no longer relevant.
               - Use 'locationUpdates' to update description or secrets of current/other locations.

            Output JSON format:
            {
                "hpChange": number,
                "mpChange": number,
                "goldChange": number,
                "expChange": number,
                "fameChange": number,
                "fateChange": number, // Added Fate Change (Negative for intervention cost, Positive for misfortune)
                "statChange": { "str": number, "agi": number, "int": number, "vit": number, "luk": number },
                "newLocation": string | null,
                "newItems": [ { "id": string, "name": string, "description": string, "quantity": number } ],
                "removedItemIds": [ string ],
                "personalityChange": { 
                    "morality": number,
                    "courage": number,
                    "energy": number,
                    "decision": number,
                    "lifestyle": number,
                    "openness": number,
                    "warmth": number,
                    "eloquence": number,
                    "leadership": number,
                    "humor": number,
                    "lust": number
                },
                "relationshipChange": [ { "characterId": string, "change": number } ],
                "newSkills": [ string ],
                "characterUpdates": [ 
                    { 
                        "id": string, 
                        "name": string, 
                        "description": string, 
                        "memories": [ string ],
                        "relationshipInfo": {
                            "relation": string, 
                            "callSign": string, 
                            "speechStyle": string, 
                            "endingStyle": string
                        }
                    } 
                ],
                "locationUpdates": [
                    {
                        "id": string,
                        "description": string,
                        "secrets": [ string ]
                    }
                ],
                "newMood": "daily" | "combat" | "romance" | "comic" | "tension" | "erotic" | null,
                "activeCharacters": [ string ] // List of character IDs currently present in the scene
            }

            **Mood Detection Rules:**
            - **combat**: Physical conflict, fighting, or immediate threat of violence.
            - **romance**: Emotional intimacy, confession, or romantic tension.
            - **comic**: Funny situations, jokes, or lighthearted banter.
            - **tension**: Suspense, mystery, or ominous atmosphere.
            - **erotic**: Sexual acts or high sexual tension (within safety guidelines).
            - **daily**: Default state, casual conversation, or none of the above.
            - If the mood changes, return the new mood string. If it stays the same, return null.

            **Active Characters Rule:**
            - Identify ALL characters currently present in the scene based on the narrative.
            - Return their IDs (e.g., '천서윤', '유화영').
            - If a character leaves, exclude them from this list.
            - If the player is alone, return an empty list [].
            `;

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

// =========================================================
// Turn Orchestration Logic
// =========================================================

const SUMMARY_THRESHOLD = 10;

export async function handleGameTurn(
    apiKey: string,
    state: any,             // State including turnCount and summary
    history: Message[],     // UI display history
    userInput: string
) {
    console.log(`[handleGameTurn] Turn: ${state.turnCount}, Summary Length: ${state.scenarioSummary?.length || 0}`);

    // 1. Add user message to a temporary history for the AI call
    // Note: The caller updates the actual UI history. This is for the AI logic.
    // If we want to strictly follow the user's snippet, we operate on the list passed.
    const newHistory = [...history, { role: 'user', text: userInput } as Message];

    // 2. Main Story Model
    // State should already have the summary injected via PromptManager in generateResponse
    const storyResult = await generateResponse(
        apiKey,
        newHistory, // Pass full or sliced history? generateResponse calls startChat with it.
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
