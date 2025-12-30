
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../model-config';

export interface PostLogicOutput {
    mood_update?: string;
    relationship_updates?: Record<string, number>; // ID: 변경량
    stat_updates?: Record<string, number>; // [NEW] Personality Stat Updates (morality, eloquence, etc.)
    new_memories?: string[];
    character_memories?: Record<string, string[]>; // [NEW] Character specific memories
    activeCharacters?: string[]; // [NEW] Active characters in scene
    summary_trigger?: boolean;
    usageMetadata?: any; // [Cost] 토큰 사용량
    _debug_prompt?: string; // [Debug] 실제 프롬프트
}

export class AgentPostLogic {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    private static readonly SYSTEM_PROMPT = `
You are the [Post-Logic Analyst].
Your job is to read the generated story turn and identify IMPLICIT changes in the game state.
Focus on: Emotion (Mood), Relationships, Long-term Memories, and PERSONALITY SHIFTS.

[Rules]
- Personality Stats: morality, courage, energy, decision, lifestyle, openness, warmth, eloquence, leadership, humor, lust.
- Range: -100 to 100.
- Update logic:
  - Lying/Stealing -> morality -2
  - Heroic act/Sacrifice -> morality +3
  - Witty remark -> humor +2
  - Leading the party -> leadership +2

[Output Schema (JSON)]
{
  "mood_update": "tension" | "romance" | "daily" | null,
  "relationship_updates": { "character_id": 5, "another_char": -2 },
  "stat_updates": { "morality": -2, "eloquence": 1 },
  "character_memories": { 
      "soso": ["Player praised my cooking", "Player asked about my past"], 
      "chilsung": ["Player defeated me", "Player gave me a healing potion"] 
  },
  "activeCharacters": ["soso", "chilsung"], // [NEW] List of character IDs actively SPEAKING or ACTING.
  "summary_trigger": false
}
[Critically Important]
- For 'activeCharacters', list EVERY character ID that speaks or performs an action in the text.
- For 'character_memories', extract 1 key memory per active character if they had significant interaction with the player this turn.
- If a character merely observes, do not generate a memory unless they have an internal reaction.
`;

    static async analyze(
        userMessage: string,
        aiResponse: string,
        currentMood: string
    ): Promise<PostLogicOutput> {
        if (!this.apiKey) return {};

        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.LOGIC, // 표준 Logic/Flash 모델 사용
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
${this.SYSTEM_PROMPT}

[Interaction]
User: ${userMessage}
AI: ${aiResponse}

[Current State]
Mood: ${currentMood}

Analyze implicit changes:
`;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            console.log(`[PostLogic] Raw Output:\n${text}`); // [DEBUG]
            const data = JSON.parse(text);
            return { ...data, usageMetadata: result.response.usageMetadata, _debug_prompt: prompt };
        } catch (e) {
            console.warn("PostLogic 분석 실패 (치명적이지 않음):", e);
            return {};
        }
    }
}
