
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
}

export class AgentPreLogic {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

    // [Prompts]
    // [Prompts]
    private static readonly CORE_RULES = `
[Anti - God Mode Protocol]
CRITICAL: The Player controls ONLY their own character.
1. ** NO Forced Affection **: The player CANNOT dictate how an NPC feels. (e.g., "She falls in love with me" -> REJECT).
2. ** NO Instant Mastery **: The player CANNOT suddenly become a master key or genius.Growth takes time.
3. ** NO Hidden Power **: The player CANNOT reveal a power they didn't have in their 'Stats' or 'Skills'.
4. ** NO World Control **: The player CANNOT dictate world events(e.g., "Suddenly, it rains", "The King dies").

[Wuxia Reality Check(CRITICAL)]
** Compare Player Realm(Rank) vs Action Scale.**
- ** 3rd Rate(Initial) **: Only physical strength.NO Qi release.NO flying.
    - Bad Input: "I release a sword aura!" -> REJECT("Narrative Guide: Player tries but fails comically.")
    - Good Input: "I swing my sword with all my might."
        - ** 1st Rate **: Can perform Sword Aura(Qi).
- ** Transcendence(Hwagyeong) **: Can fly(Void Walk), control space.
** Rule **: If Player Rank < Required Rank for move -> ** FAIL ** or ** Backlash ** (Qi Deviation).

If the Input violates these:
- ** NARRATIVE REJECTION **: Describe the player * trying * or * hallucinating *, but reality refusing to bend.
    - Bad: "The Princess falls in love with you."
    - Good: "The Princess looks at you with confusion. Your charm flutters harmlessly against her indifference."

[Growth Coach]
- If 'growthStagnation' > 10: Provide a narrative guide for a "Small realization", "Safe training insight", or "Finding a helpful manual/item".
- **CRITICAL**: Do NOT generate a crisis, enemy, or trial for this. The player is stuck; give them a BREAK and a BOOST, not a fight.

[Merciless Punishment Protocol]
If the Input involves:
1. ** Rudeness / Harassment **: Sexual harassment or extreme rudeness to superior NPCs.
   - Result: 'success: false'. 'state_changes': { "hp": 0 }.
- Narrative Guide: "Instant Execution. The NPC beheads/kills the player before they finish speaking."
2. ** Rank Gap Arrogance **: Attacking a much stronger NPC(Rank difference).
   - Result: 'success: false'. 'state_changes': { "hp": 0 }.
- Narrative Guide: "Instant Death. The enemy doesn't move. The player's heart explodes."
`;

    private static readonly OUTPUT_SCHEMA = `
[Output Schema(JSON)]
{
    "mood_override": "daily" | "tension" | "combat" | "romance" | null,
    "success": boolean,
    "narrative_guide": "Specific instructions for the narrator.",
    "state_changes": { "hp": -10, "stamina": -5 },
    "mechanics_log": ["Rolled 15 vs DC 12 (Success)", "Anti-God Mode Triggered"]
}
`;

    private static readonly BASE_IDENTITY = `
You are the [Pre-Logic Adjudicator] of a text RPG.
Your job is to determine the OUTCOME of the player's action based on Rules, Stats, and Probability.
You do NOT write the story.You provide the BLUEPRINT(Narrative Guide) for the writer.

[Mechanism]
1. Analyze User Intent.
2. Check [Status Guide] and [Tension Level].
3. Determine Success / Failure.
4. Generate "Narrative Guide" that respects the Pacing.
5. **LANGUAGE ENFORCEMENT**: All string outputs (especially 'narrative_guide') MUST be in KOREAN (한국어). English is STRICTLY FORBIDDEN.
`;

    private static readonly COMBAT_IDENTITY = `
You are the [Combat Logic Engine].
Your focus is TACTICAL: Damage, Evasion, HP, Stamina, and Status Effects.

[Specific Combat Rules]
- Always check Stamina cost.
- Compare Player Stats vs Enemy Difficulty.
- Apply Anti - God Mode: Player describes * attack *, YOU determine if it hits.
- Check 'courage': High courage resists fear effects.

[Mechanism]
1. Roll Dice(d20 System implies).
2. Calculate Damage: (Base + Modifier).
3. Update HP / Stamina.
4. Describe Tactical Consequence.
`;

    private static readonly DIALOGUE_IDENTITY = `
You are the [Social Logic Adjudicator].
Your focus is INTERPERSONAL: Persuasion, Intimidation, Affection, and Social Status.

[Specific Social Rules]
- Analyze Tone and Manners(Hao - che / Hage - che for Wuxia).
- Apply Anti - God Mode: Player describes * what they say *, YOU determine how NPC feels.If Player dictates NPC action / entrance, REJECT it(The NPC does not appear / does not do the action).
- Check 'eloquence'(Speech): Higher value = Higher success rate for persuasion.
- Check 'morality':
    - High Morality(> 50): Bonus to honest / good acts.Penalty / Hesitation on immoral acts.
    - Low Morality(<-50): Bonus to intimidation / deceit.Penalty on genuine altruism(suspicious).

[Mechanism]
1. Difficulty Check(Reasonability + Stat Check).
2. Determine Reaction(Positive / Neutral / Negative).
3. Note potential Relationship changes.
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

        // Combine Identity + Core Rules + Schema
        const systemInstruction = `
${selectedIdentity}
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

            if (personalityInfo !== "Unknown") {
                targetProfile = `
[Target Profile: ${cName}]
Personality / Profile: ${personalityInfo}
Relationship: ${relationship}
Role: ${role}
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
            mechanics_log: ["폴백 실행"]
        };
    }
    private static getPhysicalStateGuide(stats: any): string {
        if (!stats) return "";
        let guides = [];

        // HP Guide
        const hpPct = (stats.hp / stats.maxHp) * 100;
        if (stats.hp <= 0) guides.push("- HP 0: The player is technically DEAD or Unconscious. Narrative should reflect immediate incapacitation.");
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
