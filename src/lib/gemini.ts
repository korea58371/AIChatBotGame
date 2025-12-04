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

    const genAI = new GoogleGenerativeAI(apiKey);

    // Generate dynamic system prompt based on current game state
    const systemPrompt = PromptManager.generateSystemPrompt(gameState, language, userMessage);

    // Main Story Model: Gemini 3 Pro (Prioritize quality)
    const modelsToTry = [
        'gemini-2.5-flash', // Correct ID from documentation /gemini-3-pro-preview 임시 수정
        'gemini-2.5-pro', // Stable fallback
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
                usageMetadata: response.usageMetadata
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
    const logicModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];

    for (const modelName of logicModels) {
        try {
            console.log(`Trying logic model: ${modelName}`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: "application/json" },
                safetySettings
            });

            // Prune currentStats to remove heavy character data (Token Optimization)
            const { characterData, ...prunedStats } = currentStats;
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
               - If the player gets hurt, reduce HP.
               - If the player uses magic, reduce MP.
               - If the player earns gold, increase gold.
            3. **Item Management:**
               - If the player gains an item, add it (use IDs from Valid Items if possible).
               - If the player uses a valid item from inventory, remove it.
            4. **Personality Shifts:**
               - Selfish acts -> Increase selfishness (+1 to +5)
               - Heroic acts -> Increase heroism (+1 to +5)
               - Immoral acts -> Decrease morality (-1 to -10)
               - Moral acts -> Increase morality (+1 to +5)
            5. **Base Stat Updates (NEW):**
               - Physical training/feat -> Increase STR or VIT (+1)
               - Agility/Stealth feat -> Increase AGI (+1)
               - Intellectual feat/Study -> Increase INT (+1)
               - Lucky event -> Increase LUK (+1)
            6. **Relationships:**
               - If the player helps or compliments a character, increase affinity (+1 to +10).
               - If the player insults or hurts a character, decrease affinity (-1 to -10).
               - Identify characters by their ID (e.g., 'Mina', 'Elara').
            7. **Character Updates (CRITICAL - MEMORY MANAGEMENT):**
               - **Memories**: You are the custodian of character memory.
               - **FILTER TRIVIALITY**: DO NOT record mundane actions like eating, walking, sleeping, or minor greetings unless they have significant plot relevance.
               - **CONSOLIDATE**: If a character has multiple memories about the same topic (e.g., "Likes bread", "Ate bread", "Wants bread"), MERGE them into one concise memory (e.g., "Loves bread and feels happy when eating it").
               - **SIGNIFICANCE**: Only record events that change relationships, reveal secrets, or advance the main plot.
               - **FORMAT**: Return the **COMPLETE NEW LIST** of memories. If no changes, return the existing list.
               - **LIMIT**: Try to keep the memory list under 10 items per character by consolidating.
               - If a NEW character is introduced, add them.
               - ID should be lowercase English (e.g., 'guard_captain').
            8. **Location Updates:**
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
                "statChange": { "str": number, "agi": number, "int": number, "vit": number, "luk": number },
                "newLocation": string | null,
                "newItems": [ { "id": string, "name": string, "description": string, "quantity": number } ],
                "removedItemIds": [ string ],
                "personalityChange": { 
                    "selfishness": number, 
                    "heroism": number, 
                    "morality": number 
                },
                "relationshipChange": [ { "characterId": string, "change": number } ],
                "newSkills": [ string ],
                "characterUpdates": [ 
                    { 
                        "id": string, 
                        "name": string, 
                        "description": string, 
                        "memories": [ string ] 
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
            - Return their IDs (e.g., 'kim_dain', 'wang_wei').
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

                return json;
            } catch (e) {
                console.error("Failed to parse logic JSON:", e);
                // Try to extract JSON if it's wrapped in markdown code blocks
                const match = text.match(/```json([\s\S]*?)```/);
                if (match) {
                    try {
                        const json = JSON.parse(match[1]);
                        console.log("Parsed Logic JSON (from markdown):", json); // Debug Log
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const dialogueText = recentDialogue.map(msg =>
        `${msg.role === 'user' ? 'Player' : 'AI'}: ${msg.text}`
    ).join('\n');

    const prompt = `
    당신은 TRPG 스토리 게임의 '기록관'입니다.
    지금까지의 줄거리(Current Summary)와 최근 대화 내용(Recent Dialogue)이 주어집니다.
    이 두 가지를 합쳐서, 게임의 흐름을 잃지 않도록 핵심 내용을 포함한 '새로운 줄거리 요약'을 작성하세요.

    [규칙]
    1. 제 3자의 관점에서 서술할 것.
    2. 중요한 사건, 획득한 아이템, 만난 NPC의 이름은 반드시 포함할 것.
    3. 분량은 500자 이내로 압축할 것.
    4. 문체는 건조하고 명확하게 작성할 것.

    [기존 줄거리]
    ${currentSummary || "이야기가 막 시작되었습니다."}

    [최근 대화]
    ${dialogueText}

    [새로운 요약본]
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
