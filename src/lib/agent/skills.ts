
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../model-config';
import { Skill } from '../store';
import { RelationshipManager } from '../relationship-manager'; // Context Helper
import { WUXIA_SKILL_PROMPT } from '../../data/games/wuxia/prompts/skills';
import { GBY_SKILL_PROMPT } from '../../data/games/god_bless_you/prompts/skills';

export interface SkillAnalysisOutput {
    new_skills?: Skill[]; // [Modified] Unified Skill Object
    updated_skills?: { id: string, proficiency_delta: number }[]; // [Modified]
    level_delta?: number; // Direct Level Increase (e.g. +0.1, +1.0)
    // Deprecated: realm_update, realm_progress_delta
    stat_updates?: { hp?: number, mp?: number, active_injuries?: string[] };
    audit_log?: string;
    usageMetadata?: any;
    _debug_prompt?: string;
}

export class AgentSkills {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

    private static readonly SYSTEM_PROMPT = `
You are the [Progression & Balancing Arbiter] for the game.
Your goal is to translate narrative combat/training into strict game data (Level & Skills).
You must also act as a REALITY AUDITOR to prevent "God Mode" (OP) exploits.

[Core Constraints]
   - **Level Delta (level_delta)**: Output 'level_delta' (float) to represent growth.
   - **Skill Acquisition**: If new move learned, output 'new_skills'.
   - **Rank Consistency**: You MUST strictly use the values defined in [Skill Rank System] for the 'rank' field.

[Universal Growth Table]
   - **Routine Training**: +0.01 ~ +0.05 Levels
   - **Intense Combat**: +0.1 ~ +0.5 Levels
   - **Consuming Elixirs/Artifacts**: +0.5 ~ +5.0 Levels (depends on item grade)
   - **Enlightenment (Epiphany)**: +1.0 ~ +10.0 Levels (Rare!)

[Reality Audit (The "Yes, But..." Protocol)]
- If a player uses a move FAR beyond their current Level, you must NOT grant them the full power.
- **Nerf**: Grant a "Flawed" or "Unstable" version.
- **Punish**: Apply "active_injuries" (e.g., "Internal Injury", "Mana Burn").

[Output Schema]
{
  "new_skills": [ { "id": "skill_id", "name": "Name", "rank": "Rating", "type": "Type", "description": "Desc", "proficiency": 0, "effects": ["Effect 1"], "createdTurn": 0 } ],
  "updated_skills": [ { "id": "skill_id", "proficiency_delta": 5 } ],
  "level_delta": 0.5,
  "stat_updates": { "hp": -10, "active_injuries": ["Internal Injury"] },
  "audit_log": "Player consumed 100-year Ginseng. Granted +1.5 Levels."
}
`;

    static async analyze(
        userInput: string,
        storyText: string,
        playerLevel: number,
        gameState: any, // Contains activeGameId to switch naming conventions if needed
        turnCount: number
    ): Promise<SkillAnalysisOutput> {
        const apiKey = this.apiKey;
        if (!apiKey) return {};

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.LOGIC,
            generationConfig: { responseMimeType: "application/json" },
            systemInstruction: this.SYSTEM_PROMPT
        });

        const activeGameId = gameState.activeGameId || 'wuxia';

        // [NEW] Dynamic Prompt Injection
        let genrePrompt = "";
        if (activeGameId === 'wuxia') genrePrompt = WUXIA_SKILL_PROMPT;
        else if (activeGameId === 'god_bless_you') genrePrompt = GBY_SKILL_PROMPT;

        const context = `
[Context]
Game Mode: ${activeGameId}
Current Level: ${playerLevel}
Current Turn: ${turnCount}

${genrePrompt}

[Input Story]
User Action: "${userInput}"
Narrative:
"""
${storyText}
"""

[Instruction]
Analyze the narrative for progression (Level/Skills).
Determine 'level_delta' based on the intensity of training/combat/events.
`;

        try {
            const result = await model.generateContent(context);
            const response = result.response;
            const text = response.text();

            try {
                const json = JSON.parse(text);

                // [Safety Guard] Cap Growth
                if (json.level_delta > 10) {
                    json.level_delta = 10;
                    json.audit_log = (json.audit_log || "") + " [System] Growth capped at +10 Levels.";
                }

                return {
                    ...json,
                    usageMetadata: response.usageMetadata,
                    _debug_prompt: context
                };
            } catch (e) {
                console.error("[AgentSkills] JSON Parse Error", e);
                return {};
            }
        } catch (e) {
            console.error("[AgentSkills] API Error", e);
            return {};
        }
    }
}
