
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

[Skill Generation Rules] (STRICT)
1. **Formal Name Requirement**: Only create a Skill if the narrative explicitly mentions a **Formal Martial Arts Name** (Proper Noun).
   - "Used *Jujutsu* to throw the enemy" -> [Create Skill: "Jujutsu"]
   - "Practiced *Jeowang Gunrimbo*" -> [Create/Update Skill: "Jeowang Gunrimbo"]
   - "Grabbed the enemy and slammed them" -> [IGNORE - Generic Action]
   - "Bound enemy with powerful Qi" -> [IGNORE - Simple Application]
2. **Prevent Redundancy**:
   - Do NOT create separate skills for variations. Merge them into the existing relevant skill family.
   - If player has "Basic Sword", and learns "Fast Basic Sword", just update "Basic Sword" proficiency.
3. **Minimize Clutter**:
   - Do not create skills for one-off improvisations.
   - Verify if it sounds like a permanent technique (e.g. ends in Art, Method, Step, Style).

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
        const currentSkills = gameState.playerStats?.skills || [];

        // [NEW] Dynamic Prompt Injection
        let genrePrompt = "";
        if (activeGameId === 'wuxia') genrePrompt = WUXIA_SKILL_PROMPT;
        else if (activeGameId === 'god_bless_you') genrePrompt = GBY_SKILL_PROMPT;

        const skillListInfo = currentSkills.length > 0
            ? currentSkills.map((s: any) => `- [ID: "${s.id}"] ${s.name} (${s.rank}): ${s.description}`).join('\n')
            : "No existing skills.";

        const context = `
[Context]
Game Mode: ${activeGameId}
Current Level: ${playerLevel}
Current Turn: ${turnCount}

[Current Player Skills] (CHECK THIS FIRST)
${skillListInfo}

${genrePrompt}

[Input Story]
User Action: "${userInput}"
Narrative:
"""
${storyText}
"""

[Instruction]
1. Analyze the narrative for progression (Level/Skills).
2. **CRITICAL**: Compare new moves against [Current Player Skills].
   - If the move is a variation/application of an existing skill (e.g. "Fast [Skill A]", "Strong [Skill A]"), do NOT create a new skill.
   - Instead, output an entry in 'updated_skills' for that existing ID with a proficiency boost (proficiency_delta).
   - ONLY create a 'new_skill' if it is a completely new technique with a distinct formal name that cannot be merged into an existing one.
   - Ensure new skill IDs do not clash with existing IDs.
3. Determine 'level_delta' based on the intensity of training/combat/events.
`;

        try {
            const result = await model.generateContent(context);
            const response = result.response;
            const text = response.text();

            try {
                const json = JSON.parse(text);

                // [Safety Guard] ID Duplication Check & Auto-Merge
                if (json.new_skills && Array.isArray(json.new_skills)) {
                    const existingIds = new Set(currentSkills.map((s: any) => s.id));

                    json.new_skills = json.new_skills.filter((ns: any) => {
                        if (existingIds.has(ns.id)) {
                            // ID Collision -> Auto-convert to Update (Integration)
                            if (!json.updated_skills) json.updated_skills = [];
                            // Check if already in updated_skills to avoid double counting
                            const alreadyUpdated = json.updated_skills.find((us: any) => us.id === ns.id);
                            if (!alreadyUpdated) {
                                json.updated_skills.push({
                                    id: ns.id,
                                    proficiency_delta: 10 // Substantial boost since it was generated as a "New Skill"
                                });
                            }
                            return false; // Remove from new_skills
                        }
                        return true; // Keep unique new skills
                    });
                }

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
