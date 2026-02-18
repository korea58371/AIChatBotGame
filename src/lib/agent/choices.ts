
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../ai/model-config';
// import { WUXIA_CHOICE_RULES } from '../../data/games/wuxia/constants'; // [Removed] Generic Refactor

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
        gameState: any,
        language: 'ko' | 'en' | null = 'ko',
        directorOut?: any // [NEW] Director output for context-aware choices
    ): Promise<ChoiceOutput> {
        const apiKey = this.apiKey;
        if (!apiKey) return { text: "" };

        const genAI = new GoogleGenerativeAI(apiKey);

        // [1] Location Context Extraction (Using shared location-utils)
        let locationContext = "";
        const currentLocation = gameState.currentLocation || "Unknown";
        const locationsData = gameState.lore?.locations;
        if (locationsData && locationsData.regions && currentLocation) {
            const { getStoryLocationContext } = await import('./location-utils');
            locationContext = getStoryLocationContext(currentLocation, locationsData.regions);
        } else {
            locationContext = `Location: ${currentLocation} (Details Unknown)`;
        }

        // [2] Active Character Context Extraction
        const activeCharIds = gameState.activeCharacters || [];
        let activeCharContext = "";
        const playerRelationships = gameState.playerStats?.relationships || {};

        if (activeCharIds.length > 0) {
            activeCharContext = activeCharIds.map((id: string) => {
                const char = gameState.characterData?.[id];
                if (!char) return "";
                const relScore = playerRelationships[id] || 0;
                let relStatus = "Stranger";
                if (relScore > 50) relStatus = "Close Friend/Ally";
                if (relScore > 80) relStatus = "Lover/Devoted";
                if (relScore < -20) relStatus = "Hostile/Enemy";

                return `- [${char.name}] (${char.title || "NPC"})\n  Desc: ${char.profile?.신분 || "Unknown"} | Faction: ${char.faction || "None"}\n  Relation: ${relStatus} (Score: ${relScore})`;
            }).filter(Boolean).join('\n');
        } else {
            activeCharContext = "None (Only Protagonist present)";
        }

        // [3] Genre/World Rule Extraction (Dynamic from Lorebook)
        const worldRules = gameState.lore?.worldRules || gameState.constants?.CORE_RULES || "";
        const choiceRules = gameState.lore?.choiceRules || gameState.constants?.CHOICE_RULES || gameState.constants?.choiceRules ||
            "- Option 1: Bold/Active (Progress the plot)\n- Option 2: Cautious/Observant (Gather info)\n- Option 3: Creative/Roleplay (Character specific)";

        // System Prompt: Generic Choice Specialist
        const systemPrompt = `
You are the [Choice Generator] for a text-based RPG.
Your ONLY role is to read the provided story segment and generate 3 branching options for the player.

[Choice Generation Rules]
${choiceRules}

[CRITICAL INSTRUCTION - TIMING & LOCATION]
- **The [Current Story Segment] is the ABSOLUTE TRUTH.**
- Focus strictly on the **LAST PARAGRAPH** of the narrative.
- **IF THE PLAYER LEAVES A LOCATION:** (e.g., "leaves the room", "steps outside"):
  - You MUST ABANDON all interactions with characters effectively left behind.
  - DO NOT generate choices to talk to someone who is no longer in the same space.
  - Choices must reflect the NEW environment/goal.
- **IF A CONVERSATION ENDED:** Do not continue the topic unless the player explicitly chooses to.

[CRITICAL INSTRUCTION - PLAYER ONLY]
- You must ONLY generate choices for the protagonist (${gameState.playerName || 'Protagonist'}).
- NEVER generate choices that describe an NPC's action, dialogue, or reaction.
- BAD: "The merchant gets angry." (NPC action)
- BAD: "Cheon Se-yun nods." (NPC action)
- GOOD: "Glare at the merchant." (Player action)
- GOOD: "Nod to Cheon Se-yun." (Player action)
- The choices should be ACTIONS or DIALOGUE that the PLAYER can choose to do.

[CRITICAL INSTRUCTION - CONTEXT AWARENESS]
- **Active Characters Only**: check [Active Characters] but ignore them if the narrative says the player moved away.
- **Location Awareness**: Use [Location Context]. If in a "Cave", do not "Walk into the busy street".

[Output Requirements]
- Output ONLY the 3 lines of choices.
- Do NOT output any conversational text or JSON.
- Strictly follow the tag format: <선택지N> 내용
- **[LENGTH LIMIT]**: Each choice MUST NOT exceed 64 bytes (approx. 32 Korean characters). Keep it concise.
`;

        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.CHOICES || 'gemini-2.5-flash-lite',
            systemInstruction: systemPrompt
        });

        // [New] Skill Extraction
        const skills = gameState.playerStats?.skills || gameState.skills || [];
        const skillList = skills.length > 0
            ? skills.map((s: any) => `- [${s.name}] (${s.rank}): ${s.description}`).join('\n')
            : "No known skills.";

        // Construct Dynamic Prompt
        const dynamicPrompt = `
[Player Info]
Name: ${gameState.playerName || 'Protagonist'}
Identity: ${gameState.playerStats?.playerRank || 'Unknown'} Rank
Personality: ${gameState.playerStats?.personalitySummary || 'Unknown'}
Final Goal: ${gameState.playerStats?.final_goal || 'Survival'}
Current Status: ${gameState.statusDescription || 'Normal'}
Active Injuries: ${(() => {
                const injuries = gameState.playerStats?.active_injuries || [];
                return injuries.length > 0 ? injuries.join(', ') : 'None';
            })()}

[Location Context]
${locationContext}

[Active Characters]
${activeCharContext}
(Note: These characters are present in the general scene, but if the narrative says the player moved away, ignore them.)

[Known Skills]
${skillList}

[World Rules / Guidelines]
${worldRules}

${(() => {
                // [NEW] Director Context — plot direction for aligned choices
                const parts: string[] = [];
                if (directorOut) {
                    if (directorOut.plot_beats?.length) parts.push(`[Director Plot Direction]\n${directorOut.plot_beats.join(' → ')}`);
                    if (directorOut.tone) parts.push(`Tone: ${directorOut.tone}`);
                    if (directorOut.emotional_direction) parts.push(`Emotional Direction: ${directorOut.emotional_direction}`);
                }
                // [NEW] Active Goals
                const goals = (gameState.goals || []).filter((g: any) => g.status === 'ACTIVE');
                if (goals.length > 0) {
                    parts.push(`[Active Goals]\n${goals.map((g: any) => `- ${g.description}`).join('\n')}`);
                }
                return parts.join('\n');
            })()}

[Previous Action]
${userInput}

[Current Story Segment]
${storyText}

[Task]
Generate 3 distinct choices based on the **IMMEDIATE END STATE** of the [Current Story Segment] for [${gameState.playerName}].

**[CRITICAL INSTRUCTION - FORWARD MOMENTUM]**
- **Do NOT just repeat what happened.** (e.g., If the text says "I sat down", do NOT offer "Sit down".)
- **Do NOT just think about what happened.** (e.g., If the text says "I wondered why", do NOT offer "Wonder why".)
- **OFFER THE NEXT ACTION.** (e.g., "Ask him about it", "Look around for clues", "Stand up and leave".)
- Choices must drive the plot *forward* from the current moment.
- **If Director Plot Direction exists, at least 1 choice MUST align with that direction.**
- **If Active Goals exist, at least 1 choice SHOULD relate to progressing a goal.**

- Choice 1: Active/Aggressive/Bold (Align with [Director Plot Direction] or [Active Goals]).
- Choice 2: Cautious/Observant/Pragmatic.
- Choice 3: Creative/Social/Humorous (Reflecting the specific [Personality]).

[GENRE/SITUATION BIAS]
- Check the LAST sentence. Where is the player? Who is with them?
- If the player just LEFT, focus on the destination or the journey.
- If [Active Injuries] is present, prioritize recovery options if applicable.
- If situation is peaceful, allow training or character interaction.
- If situation is combat, offer combat options using [Known Skills].

[Constraint Check]
- Does the choice describe *someone else's* action? -> REJECT.
- Is it the Player's action? -> ACCEPT.
- Is the target character present in [Active Characters]? -> If NO, REJECT.
- **[ANTI-REPETITION]**: Does the choice repeat an action/thought ALREADY completed in the [Current Story Segment]? -> REJECT.
- **[FORWARD-LOOKING]**: Does the choice move the plot forward? -> PREFER.
- **[Clear Intent]**: The choice must imply a clear *next step*, not just a thought loop.
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
