
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../model-config';
import { WUXIA_CHOICE_RULES } from '../../data/games/wuxia/constants';

// Define Interface for Output
export interface ChoiceOutput {
    text: string; // The formatted choice text (<선택지1>... )
    usageMetadata?: any;
    _debug_prompt?: string;
}

export class AgentChoices {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

    /**
     * Generates 3 choices based on the current story context using a lightweight model.
     */
    static async generate(
        userInput: string,
        storyText: string,
        gameState: any, // Basic state for context (playerName, basic stats if needed)
        language: 'ko' | 'en' | null = 'ko'
    ): Promise<ChoiceOutput> {
        const apiKey = this.apiKey;
        if (!apiKey) return { text: "" };

        const genAI = new GoogleGenerativeAI(apiKey);

        // System Prompt: Choice Specialist
        const systemPrompt = `
You are the [Choice Generator] for a text-based Wuxia RPG.
Your ONLY role is to read the provided story segment and generate 3 branching options for the player.

${WUXIA_CHOICE_RULES}

[CRITICAL INSTRUCTION - PLAYER ONLY]
- You must ONLY generate choices for the protagonist (${gameState.playerName || 'Protagonist'}).
- NEVER generate choices that describe an NPC's action, dialogue, or reaction.
- BAD: "The merchant gets angry." (NPC action)
- BAD: "Cheon Se-yun nods." (NPC action)
- GOOD: "Glare at the merchant." (Player action)
- GOOD: "Nod to Cheon Se-yun." (Player action)
- The choices should be ACTIONS or DIALOGUE that the PLAYER can choose to do.

[Output Requirements]
- Output ONLY the 3 lines of choices.
- Do NOT output any conversational text or JSON.
- Strictly follow the tag format: <선택지N> 내용
`;

        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.CHOICES || 'gemini-2.5-flash-lite',
            systemInstruction: systemPrompt
        });

        // [New] Skill Extraction
        const skills = gameState.playerStats?.skills || gameState.skills || [];
        const skillList = skills.length > 0
            ? skills.map((s: any) => `- [${s.name}] (${s.rank}): ${s.description}`).join('\n')
            : "No known martial arts skills.";

        // Construct Dynamic Prompt
        const dynamicPrompt = `
[Player Info]
Name: ${gameState.playerName || 'Protagonist'}
Identity: ${gameState.playerStats?.playerRank || 'Unknown'} Rank Martial Artist
Personality: ${gameState.playerStats?.personalitySummary || 'Modern Earthling possessing a body (Calculator, Pragmatic)'}
Final Goal: ${gameState.playerStats?.final_goal || 'Survival (Avoid Bad Ending)'}
Current Status: ${gameState.statusDescription || 'Normal'}
Active Injuries: ${(() => {
                const injuries = gameState.playerStats?.active_injuries || [];
                return injuries.length > 0 ? injuries.join(', ') : 'None';
            })()}

[Known Skills]
${skillList}

[User Playstyle History]
${(() => {
                // [Adaptive Logic] Summarize History
                const history = gameState.choiceHistory || [];
                if (history.length === 0) return "No prior history. Assume neutral stance.";

                // Analyze Tone (Simple Heuristic for now, or just dump last few)
                const recent = history.slice(-5); // Use last 5 for immediate context
                return recent.map((h: any) => `- [${h.type === 'input' ? 'Direct' : 'Selected'}] ${h.text}`).join('\n');
            })()}

[Previous Action]
${userInput}

[Current Story Segment]
${storyText}

[Task]
Generate 3 distinct choices based on the [Current Story Segment] for [${gameState.playerName}].
- Choice 1: Active/Aggressive/Bold (Align with [Final Goal] and martial spirit). *If combat/danger, suggest using a [Known Skill].*
- Choice 2: Cautious/Observant/Pragmatic (Reflecting a modern transmigrator's wit).
- Choice 3: Creative/Social/Humorous (Reflecting the specific [Personality]).

[WUXIA GENRE BIAS - CRITICAL]
- **INJURY OVERRIDE**: If [Active Injuries] is NOT 'None', OR the story describes pain/damage:
  - **YOU MUST PRIORTIZE [Recovery/Healing]**.
  - Suggest choices like "운기조식하여 상처를 다스린다", "휴식을 취하며 내공으로 회복한다".
  - **DO NOT** suggest strenuous Training if it would worsen the injury.
  
- If the [Current Story Segment] implies **downtime, rest, or safety** AND [Active Injuries] is 'None':
  - **YOU MUST INCLUDE at least one choice related to [Training/Growth] (e.g., "운기조식하여 내공을 쌓는다", "검법의 초식을 연마한다").**
  - This is a Wuxia game; the player expects opportunities to grow stronger constantly.

- If the situation matches the player's [Final Goal], provide a choice that aggressively pursues it.

[Constraint Check]
- Does the choice describe *someone else's* action? -> REJECT.
- Is it the Player's action? -> ACCEPT.

`;
        try {
            const result = await model.generateContent(dynamicPrompt);
            const response = result.response;
            const text = response.text().trim();

            return {
                text: text,
                usageMetadata: response.usageMetadata,
                _debug_prompt: `${systemPrompt}\n\n${dynamicPrompt}`
            };

        } catch (error) {
            console.error("[AgentChoices] Generation Error:", error);
            // Fallback choices in case of error (Safety Net)
            return { text: "<선택지1> 상황을 살핀다.\n<선택지2> 신중하게 행동한다.\n<선택지3> 과감하게 나선다." };
        }
    }
}
