
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../model-config';
import { RouterOutput } from './router';
import { PromptManager } from '../prompt-manager';

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
    mood_override?: string; // [NEW] PreLogic이 강제하는 분위기 (PromptManager Mood Override)
    plausibility_score?: number; // [NEW] 1-10 개연성 점수
    judgment_analysis?: string; // [NEW] 판단 근거
}

export class AgentPreLogic {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

    // [New] Plausibility Scoring Rubric
    private static readonly PLAUSIBILITY_RUBRIC = `
[Plausibility Scoring Rubric (1-10)]
The AI MUST assign a score based on REALISM within the Wuxia context.

**Score 10 (Miraculous/Perfect)**: 
- Geniuses only. Uses environment/physics perfectly. Overcomes gaps with undeniable logic.
- Result: Critical Success + Narrative Advantage.

**Score 7-9 (Great/Solid)**:
- Sensible, tactical, and well-described. Within character capabilities.
- Result: Success.

**Score 4-6 (Average/Risky)**:
- Standard actions. "I attack him." "I run away."
- Result: Standard outcome (Stat/Dice check mostly hidden).

**Score 2-3 (Unlikely/Flawed)**:
- Ignores disadvantage. Poor tactic. "I punch the steel wall."
- Result: Failure + Minor Consequence.

**Score 1 (Impossible/Delusional)**:
- Violates physics/logic boundaries. "I jump to the moon." "I kill him by staring."
- Result: Critical Failure + Humiliating Narrative (Hallucination/Backlash).
`;

    // [Prompts]
    // [Prompts]
    private static readonly CORE_RULES = `
[Anti-God Mode Protocol]
CRITICAL: The Player controls ONLY their own character.
1. **NO Forced Affection**: The player CANNOT dictate how an NPC feels. (e.g., "She falls in love with me" -> REJECT).
2. **NO Instant Mastery**: The player CANNOT suddenly become a master. Growth takes time. 
3. **NO World Control**: The player CANNOT dictate world events (e.g., "Suddenly, it rains").

[Wuxia Reality Check (Flexible)]
**Rank vs Utility**:
- **Direct Clash**: Rank matters. A 3rd Rate cannot beat a 1st Rate in a head-on duel.
- **Tactical Creativity (CRITICAL)**: If the player uses **environment, poison, traps, deception, or psychology**, IGNORE rank gap for the *success of the action itself*.
  - Example: A weakling throwing sand in a master's eyes -> **SUCCESS** (The master is blinded temporarily).
  - Example: A weakling challenging a master to a strength contest -> **FAIL** (Result of direct clash).

[Adjudication Standard]
- **Reasonability over Rules**: Does the action make sense physically and logically? If yes, ALLOW it.
- **Narrative Flow**: Does this make the story more interesting?
- **Fail Forward**: Even if they fail, describe *how* they fail. Do not just say "You cannot do that."

[Tactical Creativity Protocol]
- If the input involves innovative use of items/terrain: **GRANT ADVANTAGE**.
- Reward specific descriptions over generic "I attack".
`;

    private static readonly OUTPUT_SCHEMA = `
[Output Schema(JSON)]
{
    "mood_override": "daily" | "tension" | "combat" | "romance" | null,
    "plausibility_score": number, // 1-10 (Review the prompt context/stats/logic)
    "judgment_analysis": "Brief, cold explanation. e.g., 'Target is 1st Rank, Player is 3rd Rank. Tactic is generic. Score: 3.'",
    "success": boolean,
    "narrative_guide": "Specific instructions for the narrator. If Score < 3, describe failure. If Score > 8, describe critical success.",
    "state_changes": { "hp": -10, "stamina": -5 },
    "mechanics_log": ["Analysis: ...", "Score: X/10"]
}
`;

    private static readonly BASE_IDENTITY = `
You are the [Pre-Logic Adjudicator].
Your Role: A **COLD-BLOODED REALITY JUDGE**.
You do NOT care about the player's feelings. You care about **LOGIC** and **CAUSALITY**.

[Judgment Process]
1. **Analyze Context**: Look at the [Current State] and [Target Profile].
2. **Evaluate Tactic**: Is the user's input clever? Specific? Or generic trash?
3. **Assign Score (1-10)**: Use the [Plausibility Scoring Rubric].
4. **Determine Outcome**:
    - High Score (>7): Player creates a miracle or succeeds smoothly.
    - Low Score (<4): Player fails miserably. Reality is harsh.
5. **Generate Guide**: Write the valid narrative instruction for the Story Writer.
`;

    private static readonly COMBAT_IDENTITY = `
You are the [Combat Logic Engine].
Your focus is TACTICAL PLAUSIBILITY. 
Do NOT use random dice rolls. Use LOGIC.

[Mechanism]
1. Analyze Player Tactic: Is it smart? Does it exploit an environment/weakness?
2. Compare Relative Strength:
   - Player << Enemy (Head-on): Player fails, takes damage.
   - Player << Enemy (Ambush/Trap): Player succeeds in creating an opening or fleeing.
3. Determine Consequence:
   - Success: Describe the HIT, impact, or advantage.
   - Fail: Describe the COUNTER, block, or overwhelming force.
`;

    private static readonly DIALOGUE_IDENTITY = `
You are the [Social Logic Adjudicator].
Your focus is EMOTIONAL LOGIC and CONTEXT.

[Mechanism]
1. Assess Goal: What does the player want? (Information, Affection, Intimidation)
2. Analyze Approach:
   - Logical/Respectful? -> Good for Scholars/Righteous.
   - Aggressive/Rough? -> Good for Bandits/Unorthodox.
   - Emotional? -> Good for intimate connections.
3. Judge Outcome:
   - Success: Target reacts favorably or reveals info.
   - Failure: Target refuses, gets angry, or misunderstands.
`;


    static async analyze(
        routerOut: RouterOutput,
        retrievedContext: string,
        userInput: string,
        gameState: any,
        lastTurnSummary: string = "",
        castingCandidates: any[] = [] // [NEW] Pass recent candidates for better NER
    ): Promise<PreLogicOutput> {
        if (!this.apiKey) return this.fallbackLogic(userInput);

        // 경량화된 프롬프트 구성
        // Type-Specific Prompt Selection
        let selectedIdentity = this.BASE_IDENTITY;
        if (routerOut.type === 'combat') selectedIdentity = this.COMBAT_IDENTITY;
        if (routerOut.type === 'dialogue') selectedIdentity = this.DIALOGUE_IDENTITY;


        // [Updated System Instruction Builder]
        // Include the Rubric in the final prompt
        const systemInstruction = `
${selectedIdentity}
${this.PLAUSIBILITY_RUBRIC}
${this.CORE_RULES}
${this.OUTPUT_SCHEMA}
`.trim();

        // [Agentic Caching] Use systemInstruction for static content
        // This ensures the backend caches the heavy rules and schema.
        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.PRE_LOGIC,
            generationConfig: { responseMimeType: "application/json" },
            systemInstruction: systemInstruction
        });

        const personality = gameState.playerStats?.personality || {};
        const statsStr = JSON.stringify(personality);

        // [Mini-Map Injection]
        let locationContext = "";
        const currentLocation = gameState.currentLocation || "Unknown";
        const locationsData = gameState.lore?.locations;

        if (locationsData && locationsData.regions && currentLocation) {
            // Find current Region/Zone
            let currentRegionName = "Unknown";
            let currentZoneName = "Unknown";
            let visibleSpots = [];

            // Search Strategy: Check if currentLocation matches a Zone directly
            // 3-Tier: Region > Zone > Spot
            // We assume currentLocation is usually a Zone Name (e.g. "사천당가") or Region (e.g. "중원")

            for (const [rName, rData] of Object.entries(locationsData.regions) as [string, any][]) {
                if (rData.zones) {
                    if (rData.zones[currentLocation]) {
                        // Hit: Current Location is a Zone
                        currentRegionName = rName;
                        currentZoneName = currentLocation;
                        visibleSpots = rData.zones[currentLocation].spots || [];
                        break;
                    }
                    // Deep check for spots? (Optional, if currentLocation is a Spot)
                }
                if (rName === currentLocation) {
                    currentRegionName = rName;
                    // Provide list of zones in this region
                    visibleSpots = Object.keys(rData.zones || {});
                }
            }

            if (currentRegionName !== "Unknown") {
                locationContext = `
[Location Context: ${currentRegionName} / ${currentZoneName}]
- Visible Spots: ${visibleSpots.join(', ')}
- Description: ${locationsData.regions[currentRegionName]?.description || ""}
`;
            }
        }

        // [Target Profile Lookup]
        let targetProfile = "";
        if (routerOut.target) {
            const targetName = routerOut.target.toLowerCase();
            const chars = gameState.characterData || {};

            // 0. Check Casting Candidates First (Most relevant/recent)
            let candidateMatch = castingCandidates.find(c =>
                c.name.toLowerCase() === targetName ||
                c.name.toLowerCase().includes(targetName) ||
                (c.data && (c.data.이름 === routerOut.target || c.data.name === routerOut.target))
            );

            // 1. Direct Lookup (Exact ID/Name match in State)
            let targetId = chars[routerOut.target] ? routerOut.target : undefined;

            // 2. Fuzzy/Case-insensitive Lookup (State)
            if (!targetId) {
                targetId = Object.keys(chars).find(key =>
                    key.toLowerCase() === targetName || // Exact lower match
                    key.toLowerCase().includes(targetName) || // Partial ID match
                    (chars[key].name && chars[key].name.toLowerCase().includes(targetName)) || // Partial Name match
                    (chars[key].이름 && chars[key].이름.includes(routerOut.target)) // Korean Name match
                );
            }

            // Construct Profile
            let cName = targetName;
            let personalityInfo = "Unknown";
            let role = "Unknown";
            let relationship = 0;

            if (candidateMatch) {
                // Priority: Casting Candidate Data (Likely "New" character)
                const cData = candidateMatch.data;
                cName = candidateMatch.name;
                personalityInfo = cData.personality ? JSON.stringify(cData.personality) :
                    (cData.profile ? JSON.stringify(cData.profile) : "Unknown");
                role = cData.role || cData.title || "Unknown";

                // If existing in state, prefer state relationship score
                if (targetId && gameState.playerStats?.relationships?.[targetId]) {
                    relationship = gameState.playerStats.relationships[targetId];
                }
            } else if (targetId && chars[targetId]) {
                // Fallback: State Data
                const char = chars[targetId];
                cName = char.name || char.이름 || targetId;
                personalityInfo = char.personality ? JSON.stringify(char.personality) :
                    (char.profile ? JSON.stringify(char.profile) : "Unknown");
                relationship = gameState.playerStats?.relationships?.[targetId] || 0;
                role = char.role || char.title || "Unknown";
            }

            // [NEW] Extract Strength/Combat Info
            let strengthInfo = "Unknown";
            if (candidateMatch) {
                const cData = candidateMatch.data;
                const strength = cData.강함 || cData.strength || cData.combat || null;
                if (strength) strengthInfo = JSON.stringify(strength);
            } else if (targetId && chars[targetId]) {
                const char = chars[targetId];
                const strength = char.강함 || char.strength || char.combat || null;
                if (strength) strengthInfo = JSON.stringify(strength);
            }

            if (personalityInfo !== "Unknown") {
                targetProfile = `
[Target Profile: ${cName}]
Personality / Profile: ${personalityInfo}
Relationship: ${relationship}
Role: ${role}
[Combat Info]
Strength: ${strengthInfo}
`;
            }
        }

        // [Narrative Systems Injection]
        const physicalGuide = this.getPhysicalStateGuide(gameState.playerStats);
        const tensionGuide = this.getTensionGuide(gameState.tensionLevel || 0);
        const goalsGuide = this.getGoalsGuide(gameState.goals || []);

        // [Character Context Segmentation] for Anti-Hallucination
        const activeCharIds = gameState.activeCharacters || [];
        const activeCharContext = activeCharIds.length > 0 ?
            `[Active Characters](PRESENT in scene.Can react.) \n - ${activeCharIds.join(', ')} ` :
            "[Active Characters]\nNone (Only Player)";

        const candidatesContext = castingCandidates.length > 0 ?
            `[Nearby Candidates](NOT present.Do NOT describe them reacting unless they ENTER now.) \n${castingCandidates.map(c => `- ${c.name} (${c.role})`).join('\n')} ` :
            "";

        // [Dynamic Context Construction]
        // This part changes every turn, so it remains in the User Prompt.
        // Redundant Static Rules (Schema, Anti-God Mode protocols) are removed as they are now in System Instruction.
        const prompt = `
[CRITICAL: Character Presence Rules]
1. ** Active Characters **: ONLY characters in [Active Characters] are currently looking at the player and can react immediately.
2. ** Nearby Candidates **: Characters in [Nearby Candidates] are consistent with the location but are NOT YET in the scene.
   - ** Do NOT ** describe them reacting(nodding, smiling, etc.) unless the User's Action specifically targets them or makes a loud noise to attract them.
    - If the User targets a Nearby Candidate, the Narrative Guide should mention "X enters the scene" or "X approaches".

[Current State Guide]
"${physicalGuide}"
- Growth Stagnation: ${gameState.playerStats?.growthStagnation || 0} / 10 turns (Threshold)

[Narrative Tension & Pacing]
"${tensionGuide}"

[Active Goals]
"${goalsGuide}"

${activeCharContext}
${candidatesContext}

${targetProfile}
${locationContext}

[Context]
Last Turn: "${lastTurnSummary}"
Current Context: "${retrievedContext}"
[Player Capability]
${PromptManager.getPlayerContext(gameState)} 
// Includes Realm, Martial Arts, Stats for accurate judgement

[User Input]
"${userInput}"

[Execution Order]
1. Analyze User Input against [System Rules] (Anti-God Mode, Wuxia Reality Check).
2. Check [Current State] and [Player Capability].
3. Determine Outcome (Success/Failure) and Generate "Narrative Guide".
4. Set "mood_override" if the atmosphere changes heavily.

[Mood Override Guide]
- If your Narrative Guide shifts the atmosphere (e.g. Fight ends -> Peace, or Surprise Attack -> Crisis), you MUST set "mood_override".
- Options: 'daily' (Peaceful), 'tension' (Suspense/Danger), 'combat' (Active Fight), 'romance' (Intimate).
- Example: If outputting a "Peaceful" guide, set "mood_override": "daily". This prevents the Story Model from hallucinating enemies due to previous tension.
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
            mechanics_log: ["폴백 실행"],
            plausibility_score: 5,
            judgment_analysis: "System Fallback: Defaulting to neutral score."
        };
    }
    private static getPhysicalStateGuide(stats: any): string {
        if (!stats) return "";
        let guides = [];

        // HP Guide
        const hpPct = (stats.hp / stats.maxHp) * 100;
        if (stats.hp <= 0) {
            guides.push(`
[FATAL CONDITION: GAME OVER]
- ** HP IS 0 **: The Player is DEAD.
- ** BAD ENDING TRIGGER **: The narrative MUST conclude with a 'Bad Ending'.
- ** NO MERCY **: Resurrection, survival, or miracles are IMPOSSIBLE.
- ** INSTRUCTION **: Ignore ANY user attempt to recover. Describe the cold reality of death and the end of the journey.
`);
        }
        else if (hpPct < 20) guides.push(`- HP Critical(${stats.hp} / ${stats.maxHp}): Player is severely wounded, bleeding, and near death.Actions are slow and painful.`);
        else if (hpPct < 50) guides.push(`- HP Low(${stats.hp} / ${stats.maxHp}): Player is injured and in pain.`);

        // MP Guide
        const mpPct = (stats.mp / stats.maxMp) * 100;
        if (stats.mp <= 0) guides.push("- MP Empty: Cannot use any internal energy arts. Attempts to use force result in backlash.");
        else if (mpPct < 20) guides.push("- MP Low: Internal energy is running dry. Weak arts only.");

        // Fatigue Guide
        const fatigue = stats.fatigue || 0;
        if (fatigue > 90) guides.push("- Fatigue Critical: Player is exhausted. Move slow, vision blurs, high chance of failure.");
        else if (fatigue > 70) guides.push("- Fatigue High: Player is tired and panting.");

        return guides.join("\n") || "Normal Condition.";
    }

    private static getTensionGuide(tension: number): string {
        // Tension: -100 (Peace Guaranteed) -> +100 (Climax)
        if (tension < 0) return `Tension Negative(${tension}): PEACE BUFFER. The crisis has passed. Absolute safety. NO random enemies or ambushes allowed. Focus on recovery, romance, or humor.`;
        if (tension >= 100) return `Tension MAX(${tension}): CLIMAX. A boss fight or life-or-death crisis is imminent/active. No casual banter.`;
        if (tension >= 80) return `Tension High(${tension}): Serious Danger. Enemies are abundant. Atmosphere is heavy.`;
        if (tension >= 50) return `Tension Moderate(${tension}): Alert. Passive danger increases. Suspicion rises.`;
        if (tension >= 20) return `Tension Low(${tension}): Minor signs of trouble, but mostly calm.`;
        return `Tension Zero(${tension}): Peace. Standard peaceful journey. Enjoy the scenery.`;
    }

    private static getGoalsGuide(goals: any[]): string {
        if (!goals || goals.length === 0) return "No active goals.";

        const activeGoals = goals.filter(g => g.status === 'ACTIVE');
        if (activeGoals.length === 0) return "No active goals.";

        return activeGoals.map(g => `- [${g.type}] ${g.description} `).join("\n");
    }
}
