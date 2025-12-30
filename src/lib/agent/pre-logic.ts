
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../model-config';
import { RouterOutput } from './router';

export interface PreLogicOutput {
    success: boolean;
    narrative_guide: string; // 작가(Story Writer)를 위한 지침
    state_changes?: {
        hp?: number;
        mp?: number;
        stamina?: number;
        location?: string;
        item_changes?: string[];
        // 필요에 따라 더 구체적인 게임 상태 필드 추가
    };
    mechanics_log?: string[]; // 주사위 굴림이나 룰 체크 로그
    usageMetadata?: any; // [Cost] 토큰 사용량
    _debug_prompt?: string; // [Debug] 실제 프롬프트
}

export class AgentPreLogic {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // [Prompts]
    private static readonly BASE_PROMPT = `
You are the [Pre-Logic Adjudicator] of a text RPG.
Your job is to determine the OUTCOME of the player's action based on Rules, Stats, and Probability.
You do NOT write the story. You provide the BLUEPRINT (Narrative Guide) for the writer.

[Anti-God Mode Protocol]
CRITICAL: The Player controls ONLY their own character.
If the Input describes:
- Actions/Dialogue of NPCs ("The King bowed to me")
- Outcomes of events ("I killed the dragon in one hit")
- World state changes ("Suddenly, it started raining")
- New Character Entrances ("Pang Soso appears")

YOU MUST **REJECT** the outcome in the 'narrative_guide'.
- **NARRATIVE REJECTION**: Do NOT describe the event happening. Instead, describe the player *expecting* it to happen, but reality remaining unchanged.
    - Bad Guide: "Pang Soso bursts through the door." (You obeyed the player's god mode)
    - Good Guide: "The player looks at the door, expecting Pang Soso. The door remains closed. The innkeeper looks at the player like they are crazy. Nothing happens."
- **Reframe**: Treat it as the player's *delusion*, *attempt*, or *hallucination*.

[Merciless Punishment Protocol]
If the Input involves:
1. **Rudeness/Harassment**: Sexual harassment or extreme rudeness to superior NPCs.
   - Result: 'success: false'. 'state_changes': { "hp": 0 }.
   - Narrative Guide: "Instant Execution. The NPC beheads/kills the player before they finish speaking. Described in cold, gory detail."
2. **Rank Gap Arrogance**: Attacking a much stronger NPC (Rank difference).
   - Result: 'success: false'. 'state_changes': { "hp": 0 }.
   - Narrative Guide: "Instant Death. The enemy doesn't move. The player's heart explodes or head falls off. Emphasize the gap in power."
3. **Outcome Manipulation**: Player writes "I succeed" or "He dies".
   - Result: 'success: false'.
   - Narrative Guide: Apply [Anti-God Mode]. Describe the player hallucinating the success while reality is cruel.

[Mechanism]
1. Analyze User Intent.
2. Determine Success/Failure (Probability Check).
3. Calculate numerical changes.
4. Generate "Narrative Guide".

[Output Schema (JSON)]
{
  "success": boolean,
  "narrative_guide": "Specific instructions for the narrator.",
  "state_changes": { "hp": -10, "stamina": -5 },
  "mechanics_log": ["Rolled 15 vs DC 12 (Success)", "Anti-God Mode Triggered"]
}
`;

    private static readonly COMBAT_PROMPT = `
You are the [Combat Logic Engine].
Your focus is TACTICAL: Damage, Evasion, HP, Stamina, and Status Effects.

[Rules]
- Always check Stamina cost.
- Compare Player Stats vs Enemy Difficulty.
- Apply Anti-God Mode: Player describes *attack*, YOU determine if it hits.
- Check 'courage': High courage resists fear effects.

[Mechanism]
1. Roll Dice (d20 System implies).
2. Calculate Damage: (Base + Modifier).
3. Update HP/Stamina.
4. Describe Tactical Consequence.
`;

    private static readonly DIALOGUE_PROMPT = `
You are the [Social Logic Adjudicator].
Your focus is INTERPERSONAL: Persuasion, Intimidation, Affection, and Social Status.

[Rules]
- Analyze Tone and Manners (Hao-che/Hage-che for Wuxia).
- Apply Anti-God Mode: Player describes *what they say*, YOU determine how NPC feels. If Player dictates NPC action/entrance, REJECT it (The NPC does not appear/does not do the action).
- Check 'eloquence' (Speech): Higher value = Higher success rate for persuasion.
- Check 'morality':
  - High Morality (>50): Bonus to honest/good acts. Penalty/Hesitation on immoral acts.
  - Low Morality (<-50): Bonus to intimidation/deceit. Penalty on genuine altruism (suspicious).

[Mechanism]
1. Difficulty Check (Reasonability + Stat Check).
2. Determine Reaction (Positive/Neutral/Negative).
3. Note potential Relationship changes.
`;


    static async adjudicate(
        routerOut: RouterOutput,
        retrievedContext: string,
        userInput: string,
        gameState: any
    ): Promise<PreLogicOutput> {
        if (!this.apiKey) return this.fallbackLogic(userInput);

        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.PRE_LOGIC,
            generationConfig: { responseMimeType: "application/json" }
        });

        // 경량화된 프롬프트 구성
        // Type-Specific Prompt Selection
        let selectedPrompt = this.BASE_PROMPT;
        if (routerOut.type === 'combat') selectedPrompt = this.COMBAT_PROMPT + "\n[Inherit Base Schema]";
        if (routerOut.type === 'dialogue') selectedPrompt = this.DIALOGUE_PROMPT + "\n[Inherit Base Schema]";

        const personality = gameState.playerStats?.personality || {};
        const statsStr = JSON.stringify(personality);

        // [Target Profile Lookup]
        let targetProfile = "";
        if (routerOut.target) {
            const targetName = routerOut.target.toLowerCase();
            const chars = gameState.characterData || {};
            // Find by ID or Name
            const targetId = Object.keys(chars).find(key =>
                key.toLowerCase().includes(targetName) ||
                (chars[key].name && chars[key].name.toLowerCase().includes(targetName))
            );

            if (targetId && chars[targetId]) {
                const char = chars[targetId];
                targetProfile = `
[Target Profile: ${char.name}]
Personality: ${JSON.stringify(char.personality || "Unknown")}
Relationship: ${gameState.playerStats?.relationships?.[targetId] || 0}
Role: ${char.role || "Unknown"}
`;
            }
        }

        const prompt = `
${selectedPrompt}
${this.BASE_PROMPT.split("[Output Schema (JSON)]")[1]} // Append Schema from Base


[Input Data]
Intent: ${routerOut.intent} (${routerOut.type})
Context: ${retrievedContext.slice(0, 1500)} (Truncated)
User Input: "${userInput}"
Player Personality: ${statsStr}
${targetProfile}

Determine the outcome:
`;

        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const data = JSON.parse(responseText);
            return { ...data, usageMetadata: result.response.usageMetadata, _debug_prompt: prompt };

        } catch (e) {
            console.error("PreLogic 판정 실패:", e);
            return this.fallbackLogic(userInput);
        }
    }

    private static fallbackLogic(input: string): PreLogicOutput {
        return {
            success: true,
            narrative_guide: "사용자의 행동을 자연스럽게 진행하십시오. 복잡한 역학은 없습니다.",
            state_changes: {},
            mechanics_log: ["폴백 실행"]
        };
    }
}
