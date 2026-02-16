
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../ai/model-config';
// import { RouterOutput } from './router'; // [REMOVED]
import { PromptManager } from '../engine/prompt-manager';
import { PACING_RULES as WUXIA_PACING } from '../../data/games/wuxia/pacing';
import { PACING_RULES as GBY_PACING } from '../../data/games/god_bless_you/pacing';

const PACING_REGISTRY: Record<string, any> = {
    'wuxia': WUXIA_PACING,
    'god_bless_you': GBY_PACING
};


export interface PreLogicOutput {
    // [판정 결과 — PreLogic 고유]
    usageMetadata?: any;
    _debug_prompt?: string;
    mood_override?: string;          // daily/tension/combat/romance/growth
    plausibility_score?: number;     // 1-10
    judgment_analysis?: string;      // "Rank Gap. Tactical Bonus."
    combat_analysis?: string;        // "Win: 40%. Player < Target."
    location_inference?: string;     // "Sichuan(Hot)"
    new_characters?: string[];       // 새로 등장한 캐릭터 이름 목록

    // [Director로 이관됨 — Legacy compat, 무시됨]
    narrative_guide: string;         // Director.plot_beats로 대체
    emotional_context?: string;      // Director.emotional_direction으로 대체
    character_suggestion?: string;   // Director.plot_beats에 포함
    goal_guide?: string;             // Director.plot_beats에 포함
}

export class AgentPreLogic {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

    // [개연성 채점 기준표 (Plausibility Rubric)]
    // AI가 유저 행동의 현실성을 1~10점으로 평가하는 기준입니다.
    // 10점: 천재적/완벽함 (무조건 성공 + 이점)
    // 7-9점: 훌륭함/타당함 (성공)
    // 4-6점: 평범함/위험함 (일반적인 결과)
    // 2-3점: 무리수/허점 많음 (실패 + 불이익)
    // 1점: 불가능/망상 (시도 자체가 무시되거나 즉각 차단됨)
    private static readonly PLAUSIBILITY_RUBRIC = `
[Plausibility Scoring Rubric (1-10)]
The AI MUST assign a score based on REALISM, LOGIC, and STRICT CONTEXT ADHERENCE.

**Score 10 (Miraculous/Perfect)**: 
- Geniuses only. Uses environment/physics perfectly. Overcomes gaps with undeniable logic.
- NO added conveniences. Pure skill.
- Result: Critical Success + Narrative Advantage.

**Score 7-9 (Great/Solid)**:
- Sensible, tactical, and well-described. Within character capabilities.
- Result: Success.

**Score 4-6 (Average/Risky)**:
- Standard actions. "I attack him." "I run away."
- Actions relying on minor luck or assumptions.
- Result: Standard outcome (Stat/Dice check mostly hidden).

**Score 2-3 (Overreach / Soft Correction)**:
- User attempts actions BEYOND their current Capability or Rank.
- User dictates a RESULT that conflicts with Reality (e.g., "I kill the Master instantly" when weak).
- **ACTION**: **Do NOT block.** Reinterpret as a **FAILED ATTEMPT**.
- **Narrative**: Describe the *struggle*, the *gap in power*, or the *clumsiness*.
- Example: "I fly over the wall" (No skill) -> "You jump with all your might, but your heavy body barely reaches halfway before crashing down."

**Score 1 (Impossible / Hard Denial)**:
- Violates Fundamental Laws of Physics or Logic (e.g., "I turn into a Dragon", "I become God").
- Blatant Hallucination (e.g., "I use the item I don't have").
- **result**: IMMEDIATE DENIAL. State clearly why it is impossible in the narrative.
`;

    // [핵심 판정 규칙 (Core Rules)]
    // 1. 갓 모드 방지 (유저가 세계관이나 타인을 조종 불가)
    // 2. 무협 현실성 체크 (등급 차이 vs 전술적 창의성)
    // 3. 서사적 흐름 (실패하더라도 재미있게)
    // 4. 전술적 창의성 우대 (지형지물, 심리전 사용 시 보정)
    // 5. 완급 조절 (휴식 보장)
    private static readonly CORE_RULES = `
[Protocol: Intent Preservation & Soft Correction]
**CRITICAL**: Users often describe the *RESULT* they want ("I kill him"), not just the action.
1. **Interpretation Rule**: ALWAYS interpret "Result-Oriented Input" as "INTENT/ATTEMPT".
   - User: "I chop his head off."
   - Interpretation: "User *tries* to chop his head off with full force."
2. **Reality Check**:
   - IF (User Rank >= Target Rank) -> GRANT Result (Score 7-9).
   - IF (User Rank < Target Rank) -> DENY Result, BUT EXECUTE ATTEMPT (Score 2-3).
   - **Narrative**: "You swing your sword viciously at his neck (Intent preserved), BUT he stops it with a single finger (Reality enforced)."
3. **NO "Dream" Endings**: NEVER describe the success and then say "it was a hallucination". Describe the RESISTANCE in real-time.

[Protocol: Pacing & Incident Frequency (Slice of Life)]
**CRITICAL**: DO NOT force "Plot Twists" or "Conflicts" every turn.
1. **Downtime is Valid**: If the User is resting, talking, or shopping, allow the scene to be peaceful.
2. **No Forced Drama**: Do not introduce a villain or a crisis just because the turn count increased.
3. **Respect Mood**: If 'Mood' is 'Daily' or 'Romance', KEEP IT THAT WAY unless User provokes conflict.

[Escalation Control Protocol (Anti-Drama Queen)]
**CRITICAL**: Do NOT invent "Grand Plots" to explain "Petty Crimes".
1. **The Rule of Proportionality**:
   - Tiny triggers (Scams, Petty Theft, Insults) MUST invoke Tiny Consequences (Beatings, Fines, Chase), NOT "Mortal Enmity" or "Secret Conspiracies".
   - **Example (Bad)**: User sells a fake ticket -> "Actually, that ticket was the key to the Demon God's Seal!" (Too dramatic).
   - **Example (Good)**: User sells a fake ticket -> "The buyer realizes it's fake and demands a refund with his fists." (Appropriate).
2. **Rational Villains**: 
   - Powerful factions (like Namgung Clan) do NOT mobilize armies for a single street rat. They send *servants* or just ignore it.
   - Do NOT escalate to "Kill on Sight" unless the user explicitly commits Murder or Heavy Grevious Harm.

[Anti-God Mode Protocol]
The Player controls ONLY their own character's *Body* and *Speech*.
1. **Forced Affection**: "She falls in love" -> "She looks at you with confusion." (Soft Correction)
2. **World Control**: "It starts raining" -> "You look up at the clear sky, wishing for rain." (Soft Correction)

[Strict Context & Anti-Hallucination Protocol]
**CRITICAL**: You must judgment based ONLY on the provided [Context], [Active Characters], and [Helper/Target Info].
1. **NO Invented Settings**: 
   - Do NOT accept user claims about the world unless supported by [Lore] or [Context].
   - Example User: "I use the secret passage here." (If no passage in Context -> Fail).
2. **Only Verified Assets**: Use only items/skills listed in [Player Capability].

[Wuxia Reality Check (Flexible)]
**Rank vs Utility**:
- **Direct Clash**: Rank matters. A 3rd Rate cannot beat a 1st Rate in a head-on duel.
- **Tactical Creativity (CRITICAL)**: If the player uses **environment, poison, traps, deception, or psychology**, IGNORE rank gap for the *success of the action itself*.
  - Example: A weakling throwing sand in a master's eyes -> **SUCCESS** (The master is blinded temporarily).

[Adjudication Standard]
- **Fail Forward**: A low score (2-3) should NOT stop the story.
- **Consequence**: The failure should create a NEW situation (e.g., weapon stuck, enemy alerted, lost balance).
- **Fun over Frustration**: Even a failure should be described coolly or humorously, not dismissively.

[Personality Logic (CRITICAL for Dialogue)]
- **Resonance (Bonus)**: If Player and Target share traits, APPLY +1 Bonus.
- **Dissonance (Penalty)**: If traits clash, negotiation is harder (Narrative Resistance).

[Romance & Intimacy Protection Protocol]
**TRIGGER**: IF the current mood is 'romance' OR the user is engaging in intimate physical contact/confession (kissing, hugging, flirting, sex).
1. **ABSOLUTE PRIVACY**:
   - **DO NOT** suggest new characters. Set "character_suggestion": "None".
   - **DO NOT** trigger random combat or events.
   - **DO NOT** let existing background characters interrupt unless they are *directly* addressed or it is a 'Comedy' scene.
2. **Focus**: Maximize the emotional connection. Interpret "Risk" as "Emotional Vulnerability", not physical danger.
3. **Interrupt Block**: If a random event tries to trigger, **SUPPRESS IT** (set event_status: "ignored") unless it is a life-or-death emergency.`;

    // [출력 포맷 (JSON Schema)]
    // AI가 반환해야 할 JSON 구조를 정의합니다.





    /**
     * [PreLogic 주 분석 함수]
     * 유저의 입력과 현재 게임 상태를 분석하여 행동의 성공 여부와 내러티브 가이드를 생성합니다.
     * 
     * @param routerOut - Router가 분류한 행동 유형 (combat, dialogue, default)
     * @param retrievedContext - 벡터 DB 등에서 검색된 관련 컨텍스트
     * @param userInput - 유저의 원본 입력
     * @param gameState - 현재 게임의 전체 상태 (스탯, 위치, 목표 등)
     * @param lastTurnSummary - 이전 턴의 요약 내용
     * @param castingCandidates - [New] 현재 장소에 캐스팅된(등장 가능한) 후보 캐릭터 목록
     * @returns PreLogicOutput (성공 여부, 가이드, 판정 점수 등)
     */
    static async analyze(
        history: any[], // [CHANGED] RouterOutput -> history (Message[])
        retrievedContext: string,
        userInput: string,
        gameState: any,
        lastTurnSummary: string = "",
        castingCandidates: any[] = [],
        language: 'ko' | 'en' | null = 'ko' // [NEW] Localization support
    ): Promise<PreLogicOutput> {
        if (!this.apiKey) return this.fallbackLogic(userInput);

        // [Worldview & Atmosphere]
        const gameIdentity = await PromptManager.getGameIdentity(gameState);

        // [Unified System Prompt]
        // Router 기능(의도 파악) + PreLogic 기능(판정) 통합
        const systemInstruction = `
You are the [Adjudicator (판정관)] of a text-based Wuxia RPG.
You are NOT the storyteller. A separate Director handles narrative planning and tone.
Your SOLE job is:
1. **CLASSIFY** the user's intent (Combat, Dialogue, Action, System).
2. **JUDGE** the feasibility of the action (Score 1-10) based on REALISM and LOGIC.
3. **REPORT** the judgment result concisely. Do NOT write narrative or suggest plot direction.

${this.PLAUSIBILITY_RUBRIC}

${this.CORE_RULES}

[Reasoning Steps (Mental Process)]
Follow this logical flow to reach your judgment.
STEP 1: **Analyze Input**
   - Identify Intent (Combat/Dialogue/Action) and Target.
   - Separate "Intended Action" from "Desired Result".
STEP 2: **Context Verification (Anti-Hallucination)**
   - Check [Active Characters] & [Context]. Does the Target exist?
   - Check [User Input]. Does it imply specific settings/memories?
   - **Validation**: If User mentions a fact NOT in Context/History -> Flag as Hallucination (Score Deduction).
STEP 3: **Feasibility Calculation**
   - **Combat**: Compare Ranks. Apply modifiers for Surprise/Tactics.
   - **Dialogue**: Check Personality Resonance. Is the approach logical?
   - **Action**: Is it physically possible?
STEP 4: **Final Judgment**
   - Assign Plausibility Score (1-10).
   - Determine Success/Failure.
   - Output concise judgment keywords.

[Alignment & Faction Logic (Morality System)]
**Check Player's Morality (if available in Context/Stats)**
- **High Morality (>50)**: 'Orthodox (White Faction/Murim Alliance)' NPCs are FRIENDLY/Respectful. 'Unorthodox (Black Faction)' NPCs are HOSTILE/Wary.
- **Low Morality (<-50 or Evil Actions)**: 'Unorthodox' NPCs are FRIENDLY/Respectful (Brotherhood). 'Orthodox' NPCs are HOSTILE/Disgusted.
- **Guidance Rule**: If Player tries to persuade a faction OPPOSITE to their alignment -> **Apply Penalty to Score (-2)** and describe inherent distrust.

[Output Schema (JSON)]
{
    "mood_override": "daily" | "tension" | "combat" | "romance" | "growth" | null,
    "plausibility_score": number, // 1-10
    "judgment_analysis": "Keywords only. (e.g. 'Rank Gap', 'Illogical').",
    "combat_analysis": "Keywords. (e.g. 'Win: High', 'Loss: Certain'). Null if safe.",
    "narrative_guide": "Judgment result only. (e.g. 'Success, minor injury' or 'Fail, rank gap'). No plot/tone direction.",
    "location_inference": "Keywords. (e.g. 'Sichuan(Hot)'). Null if known."
}

[Mood Override Guidelines (STRICT)]
1. **Default Mode**: 'daily' or null.
2. **Escalation Trigger**:
   - Only switch to 'tension' or 'combat' if there is **Killing Intent** or **Direct Violence**.
   - Do NOT switch for: Asking directions, buying items, sparring, trivial arguments, or meeting friends.
3. **Training**: If user is training, use 'growth'.

[IMPORTANT: Scope Boundary]
- You output JUDGMENT only. Tone, pacing, emotional direction, and character suggestions are handled by the Director.
- Keep narrative_guide to pure success/failure outcome. No storytelling.

`.trim();


        let enhancedInstruction = systemInstruction;

        // [GOD BLESS YOU Special Tone Logic]
        if (gameState.activeGameId === 'god_bless_you') {
            enhancedInstruction += `
\n[SPECIAL MODE: God Bless You (Modern Urban Fantasy / Comedy)]
**TONE & MANNER**: Lighter, humorous, Manzai-style (Banter).
1. **FAILURE = COMEDY**:
   - If User fails (Score 2-3), DO NOT inflict serious injury or despair.
   - **INSTEAD**: Inflict "Embarrassment", "Slapstick Fall", or "Social Awkwardness".
   - Example directly from User Request: "More lighthearted than Wuxia. Avoid unnecessary tension."
2. **MANZAI (Banter) PROTOCOL**:
   - If [Jeong Hansu] or [Han Gaeul] is present:
     - They must react to protagonist's failure with Tsundere or Sarcastic comments (Manzai).
     - **Goal**: Turn the failure into a joke.
3. **PENALTY RELAXATION**:
   - Remove "Dissonance Penalty". In this genre, weird behavior is just "Concept/Chuunibyou".
   - **Score Buffer**: Treat "Risky" actions (Score 4) as "Lucky Success" if it fits the comedy.
`;
        }

        // 갓 모드 체크
        if (gameState.isGodMode || gameState.playerName === "김현준갓모드") {
            enhancedInstruction += `
\n\n[SYSTEM ALERT: GOD MODE ACTIVE]
CRITICAL OVERRIDE: The user "${gameState.playerName}" has ABSOLUTE AUTHORITY.
1. ALWAYS classify intent correctly, but ALWAYS judge "plausibility_score" as 10.
2. set "success": true.
3. narrative_guide must follow user command perfectly.
`;
        }

        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.PRE_LOGIC,
            generationConfig: { responseMimeType: "application/json" },
            systemInstruction: enhancedInstruction
        });

        // ... (Context Building Logic - reused) ...
        // 3. [미니맵 컨텍스트 주입]
        // 현재 위치 상세 정보(Region/Zone/Spots)를 매핑하여 공간적 인지 능력 부여
        let locationContext = "";
        const currentLocation = gameState.currentLocation || "Unknown";
        const locationsData = gameState.lore?.locations;

        if (locationsData && locationsData.regions && currentLocation) {
            let currentRegionName = "Unknown";
            let currentZoneName = "Unknown";
            let visibleSpots = [];

            // 위치 데이터 검색 (3-Tier: Region > Zone > Spot)
            for (const [rName, rData] of Object.entries(locationsData.regions) as [string, any][]) {
                if (rData.zones) {
                    // 현재 위치가 Zone 이름과 일치하는 경우
                    if (rData.zones[currentLocation]) {
                        currentRegionName = rName;
                        currentZoneName = currentLocation;
                        visibleSpots = rData.zones[currentLocation].spots || [];
                        break;
                    }
                }
                // 현재 위치가 Region 이름과 일치하는 경우
                if (rName === currentLocation) {
                    currentRegionName = rName;
                    visibleSpots = Object.keys(rData.zones || {});
                }
            }

            if (currentRegionName !== "Unknown") {
                locationContext = `
[Location Context: ${currentRegionName} / ${currentZoneName}]
- Visible Spots: ${visibleSpots.join(', ')}
- Description: ${locationsData.regions[currentRegionName]?.description || ""}
`;
            } else {
                // [Fallback] Explicitly mark as Unknown to trigger Inference
                locationContext = `[Location Context: Unknown Region] Current Spot: "${currentLocation}". (PreLogic MUST Infer Region based on context).`;
            }
        } else {
            locationContext = `[Location Context: Missing] Current Spot: "${currentLocation}". (PreLogic MUST Infer Region based on context).`;
        }

        // 5. [내러티브 시스템 가이드 주입]
        const physicalGuide = this.getPhysicalStateGuide(gameState.playerStats);

        const goalsGuide = this.getGoalsGuide(gameState.goals || []);
        const finalGoalGuide = this.getFinalGoalGuide(gameState.playerStats);

        // [캐릭터 존재감 분리]
        const activeCharIds = gameState.activeCharacters || [];
        let activeCharContext = "[Active Characters](PRESENT in scene. Can react.) \n";

        if (activeCharIds.length > 0) {
            activeCharIds.forEach((id: string) => {
                const char = gameState.characterData?.[id];
                if (char) {
                    const desc = char.profile?.신분 || char.title || char.role || "Unknown";
                    const faction = char.faction || char.profile?.소속 || "Unknown";
                    const appearance = char.외형?.얼굴형_인상 || char.외형?.outfit_style || "";
                    const pVal = char.personality ? JSON.stringify(char.personality) : "Unknown";

                    // Simple Stats for Adjudication
                    const strength = char.강함 || char.strength || "Unknown";

                    activeCharContext += `- Name: ${char.name} (${char.title || "Unknown"})\n  Identity: ${desc} | Faction: ${faction}\n  Strength: ${JSON.stringify(strength)}\n  Personality: ${pVal}\n`;
                }
            });
        } else {
            activeCharContext += "None (Only Player)";
        }

        // Deduplication Logic
        // We pass the candidates (now merged in orchestrator, but pre-logic actually receives [] there due to '[]' arg in call)
        // Wait, Orchestrator calls: AgentPreLogic.analyze(..., [], ...) 
        // So 'castingCandidates' arg is actually EMPTY in current code. 
        // The context is ALREADY in 'retrievedContext'.
        // So we can just IGNORE this block or keep it empty. 
        // Let's keep it minimal to avoid confusion.
        const candidatesContext = ""; // [Modified] We rely on Retriever's [Casting Suggestions] block.

        // [New] Previous Turn Context Injection (History)
        // Router가 전달해준 history에서 가장 최근의 AI 응답(NPC 대사 포함)을 추출합니다.
        // lastTurnSummary는 요약본이므로, 구체적인 질문/상황을 파악하기 위해 원본 텍스트가 필요합니다.
        let recentHistoryContext = "";
        if (history && history.length > 0) {
            const lastModelMsg = [...history].reverse().find(m => m.role === 'model');
            if (lastModelMsg) {
                // Remove heavy tags if needed, or keep them. 
                // For now, we keep the text but truncate if excessively long to save tokens.
                const rawText = lastModelMsg.text;
                const noviceProtectionHint = "Consider 'Novice Protection' rules: Give the player a chance to learn mechanics. " +
                    "Do NOT introduce major Faction Leaders (Munju/Head) directly. Use intermediaries or low-ranking disciples. " +
                    "If conflict arises, make it low-stakes (e.g. insults, petty theft) rather than life-or-death." +
                    "Suggest characters cautiously.";
                const cleanText = rawText.length > 800 ? "..." + rawText.slice(-800) : rawText;
                recentHistoryContext = `[Previous Turn Output (Immediate Context)]\n"${noviceProtectionHint}\n${cleanText}"`;
            }
        }

        // 6. [동적 프롬프트 구성 (User Prompt)]
        const prompt = `
[Current State Guide]
"${physicalGuide}"
[Current State Guide]
"${physicalGuide}"
${this.getGenreAdaptivePacing(gameState.activeGameId, gameState.turnCount || 0)}
- Growth Stagnation: ${gameState.playerStats?.growthStagnation || 0} / 10 turns

- Growth Stagnation: ${gameState.playerStats?.growthStagnation || 0} / 10 turns



[Active Goals]
"${goalsGuide}"

${gameState.activeEvent ? `[ACTIVE EVENT (CONTEXT)]\nTitle: ${gameState.activeEvent.title}\nInfo: ${gameState.activeEvent.prompt}\n(Note: Integrate naturally. If scene is High Tension/Combat, hold event progression until calm unless it's an emergency.)\n` : ""}

${activeCharContext}
${candidatesContext}

${locationContext}

[Context]
Last Turn Summary: "${lastTurnSummary}"
${recentHistoryContext}
Current Context: "${retrievedContext}"

[Player Capability]
${PromptManager.getPlayerContext(gameState, language)} 
${finalGoalGuide}

[Active Fate Bonus]
- Points Spent: ${gameState.fateUsage || 0}
- INSTRUCTION: The user has SPENT fate to bend reality. Increase the Base Plausibility Score by +${gameState.fateUsage || 0}.

[User Input]
"${userInput}"

[Execution Order]
1. **IDENTIFY** the Target (if any). If the target is in [Casting Suggestions], allow interaction if logical (e.g. shouting).
2. **JUDGE** the action's Plausibility (1-10). Check Player Capability vs Target Strength.
3. **GENERATE** the Narrative Guide. **Only suggest new characters** if the current conversation is stalling or if it's a logical transition point. Use caution.
4. **INFER LOCATION**: If unknown, deduce Region/Atmosphere and include in guide.
`;

        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // JSON Parsing with markdown cleanup
            const jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonText);

            // [Determinism Check] Logic for Fate Calculation (AI Math Fallback)
            const finalScore = Number(data.plausibility_score) || 5;
            // logic/calculation removed - client side deduction only

            // [Logging] Always Log Debugging Info
            // console.log(`[Fate System] Score: ${finalScore}, Used: ${gameState.fateUsage || 0}`);


            const output: PreLogicOutput = {
                ...data,
                usageMetadata: result.response.usageMetadata,
                _debug_prompt: `[System Instruction]\n${enhancedInstruction}\n\n[User Prompt]\n${prompt}`
            };

            // [STRICT SAFETY PROTOCOL (Turns 0-9)]
            // User Request: "초반 10턴간은 긴장, 살기 등 위험한 상황을 일체 발생시키지 않도록 해줘"
            if ((gameState?.turnCount || 0) < 10) {
                if (output.mood_override === 'tension' || output.mood_override === 'combat') {
                    console.log(`[PreLogic] Strict Safety Triggered: Downgrading mood from ${output.mood_override} to daily.`);
                    output.mood_override = 'daily';
                    if (output.combat_analysis) output.combat_analysis = undefined;
                    if (output.judgment_analysis) output.judgment_analysis += " (Mood Downgraded by Safety Protocol)";
                }

                // [Force Safety in Narrative Guide]
                output.narrative_guide = (output.narrative_guide || "") + " [ABSOLUTE RULE: NO SUDDEN CRISIS/COMBAT/BANDITS/ENEMIES. KEEP IT PEACEFUL.]";
            }

            return output;

        } catch (e) {
            console.error("PreLogic/Judge 분석 실패:", e);
            return this.fallbackLogic(userInput);
        }
    }

    /**
     * [Fallback Logic]
     * AI 모델 호출 실패 시 실행되는 안전장치입니다.
     * 무조건적인 성공과 중립적인 가이드를 반환하여 게임이 멈추지 않도록 합니다.
     */
    private static fallbackLogic(input: string): PreLogicOutput {
        return {
            narrative_guide: "사용자의 행동을 자연스럽게 진행하십시오. 복잡한 역학은 없습니다.",
            plausibility_score: 5,
            judgment_analysis: "System Fallback: Defaulting to neutral score."
        };
    }

    /**
     * [신체 상태 가이드 생성]
     * 플레이어의 HP, MP, 피로도를 분석하여 서술 가이드를 생성합니다.
     * Game Over 조건(HP 0)도 여기서 체크합니다.
     */
    private static getPhysicalStateGuide(stats: any): string {
        if (!stats) return "";
        let guides = [];

        // HP 상태 체크
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

        // MP (내공) 상태 체크
        const mpPct = (stats.mp / stats.maxMp) * 100;
        if (stats.mp <= 0) guides.push("- MP Empty: Cannot use any internal energy arts. Attempts to use force result in backlash.");
        else if (mpPct < 20) guides.push("- MP Low: Internal energy is running dry. Weak arts only.");

        // 피로도 체크
        const fatigue = stats.fatigue || 0;
        if (fatigue > 90) guides.push("- Fatigue Critical: Player is exhausted. Move slow, vision blurs, high chance of failure.");
        else if (fatigue > 70) guides.push("- Fatigue High: Player is tired and panting.");


        // [New] Injury Guidance (부상 가이드)
        const activeInjuries = stats.active_injuries || [];
        if (activeInjuries.length > 0) {
            guides.push(`\n[INJURY STATUS]: Player has active injuries: ${JSON.stringify(activeInjuries)}`);
            guides.push("- REQUIREMENT: If the user rests, sleeps, or seeks treatment, explicitly describe the healing process and relief.");
            guides.push("- NARRATIVE: If user moves/fights, describe PAIN/STRUGGLE. Do NOT imply structural damage unless they fail the action mechanically.");

            // Minor injury passive healing hint
            const hasMinor = activeInjuries.some((inj: string) =>
                inj.includes("타박상") || inj.includes("찰과상") || inj.includes("근육통") || inj.includes("Bruise") || inj.includes("Scratch")
            );
            if (hasMinor) {
                guides.push("- HINT: Minor injuries (Bruises/Scratches) can heal naturally with 'Time Passing' or 'Rest'.");
            }
        }

        // [New] Growth & Cultivation (성장 및 수련 가이드)
        const isWuxia = stats?.internal_energy !== undefined || stats?.playerRank !== undefined; // Heuristic

        guides.push(`
*** GENIUS PROTOCOL (FAST-FORWARD CULTIVATION) ***
- **IF user intent is 'Training' (수련/운동/공부)**:
  - You MUST **SKIP TIME** (e.g., '10 days later...', 'A month of hard training...').
  - **GROWTH RATE (Genius)**:
    ${isWuxia
                ? "- Wuxia: 10 days = +1 Year Internal Energy (내공), 30 days = +3 Years."
                : "- Modern: 10 days = Significant Skill EXP / Physical Stat boost."}
  - **OUTPUT**: Use <시간> tag to fast-forward. Describe the intense process and the final transformation/realization.
`.trim());

        return guides.join("\n") || "Normal Condition.";
    }



    /**
     * [목표 가이드 생성]
     * 현재 활성화된(ACTIVE) 목표들을 문자열로 변환하여 프롬프트에 주입합니다.
     */
    private static getGoalsGuide(goals: any[]): string {
        if (!goals || goals.length === 0) return "No active goals.";

        const activeGoals = goals.filter(g => g.status === 'ACTIVE');
        if (activeGoals.length === 0) return "No active goals.";

        // [Pacing Control] If a MAIN goal exists, it overrides everything.
        const mainGoal = activeGoals.find(g => g.type === 'MAIN');
        if (mainGoal) {
            return `
*** PRIME DIRECTIVE (MAIN QUEST) ***
- **CURRENT OBJECTIVE**: "${mainGoal.description}"
- **MANDATE**: The Narrative MUST focus on steps to achieve this goal.
- **RESTRICTION**: Do NOT introduce plots unrelated to this goal (e.g. No random Demon Lords if the goal is 'Pay Rent'). 
- **SCOPE**: Keep the scale appropriate to the goal.
`.trim();
        }

        return activeGoals.map(g => `- [${g.type}] ${g.description} `).join("\n");
    }

    /**
     * [최종 목표 가이드 생성]
     * 플레이어의 Final Goal에 따른 영구적 내러티브 보정을 적용합니다.
     */
    private static getFinalGoalGuide(stats: any): string {
        if (!stats || !stats.final_goal) return "";

        const goal = stats.final_goal;
        switch (goal) {
            case 'harem_king':
                return "[GOAL BONUS: Harem King] Romance checks are lenient. NPCs of opposite sex are more receptive (+1 Bonus to Affection events).";
            case 'tycoon':
                return "[GOAL BONUS: Tycoon] Economic/Mercantile checks are lenient. Money-making schemes succeed more often (+1 Bonus to Wealth events).";
            case 'survival':
                return "[GOAL BONUS: Survival] Crisis survival checks are prioritized. Evasion and escaping death is easier (+1 Bonus to Survival).";
            case 'murim_lord':
                return "[GOAL BONUS: Murim Lord] Combat and Training progression is accelerated (+1 Bonus to Growth/Combat).";
            case 'go_home':
                return "[GOAL BONUS: Go Home] Reality insight increased. Higher perception of 'novel tropes' and breaking the 4th wall.";
            default:
                return "";
        }
    }

    /**
     * [초반 게임 가이드 (Novice Protection)]
     * 30턴 이내의 극초반부에는 난이도를 조절하고 성장을 유도하는 가이드를 제공합니다.
     */
    private static getEarlyGameGuidance(turnCount: number, stats: any): string {
        if (turnCount >= 30) return "";

        const hpPct = stats ? (stats.hp / stats.maxHp) * 100 : 100;
        let guide = `
[PHASE: EARLY GAME (NOVICE PROTECTION ACTIVE)]
- **Current Turn**: ${turnCount} / 30 (Tutorial Phase)
- **Combat Limit**: IF combat happens, do NOT spawn impossible enemies (Rank < 2nd Rate). Focus on thugs or bullies.
- **Narrative Goal**: Prioritize [GROWTH] events (Finding a manual, meeting a teacher, eating a spirit herb).
- **Turn 1 Special Instruction**: START SLOW. Establish the atmosphere and the protagonist's internal ambition. Do NOT force a combat encounter immediately unless the user attacks someone. Prioritize [Atmosphere] or [Neutral Encounter].
`;

        // Crisis Intervention Trigger in PreLogic (Narrative Layer)
        if (hpPct < 30) {
            guide += `
- **[CRITICAL WARNING]**: Player is dying in Tutorial Phase.
- **INSTRUCTION**: Trigger a [HEROINE / HELPER INTERVENTION] immediately. Someone must appear to save or heal the player. Do NOT kill the player yet.
`;
        }

        return guide;
    }

    /**
     * [New] Genre-Adaptive Pacing Logic
     * Returns pacing constraints based on GameGenre and TurnCount.
     * Uses external configuration from src/data/games/[id]/pacing.ts
     */
    private static getGenreAdaptivePacing(gameId: string, turnCount: number): string {
        const chapter = Math.ceil((turnCount + 1) / 20);
        let guidance = `[System Pacing: Turn ${turnCount} (Chapter ${chapter})]`;

        const rules = PACING_REGISTRY[gameId];
        if (!rules) return guidance; // Fallback if no rules found

        // 0. Adaptation Phase (New)
        if (rules.adaptation && turnCount < rules.adaptation.maxTurn) {
            const adaptation = rules.adaptation;
            guidance += `\n**PHASE: ADAPTATION (TUTORIAL)**`; // Explicit Name

            if (rules.global?.directorNote) {
                guidance += `\n${rules.global.directorNote}`;
            }

            if (adaptation.directorNote) {
                guidance += `\n${adaptation.directorNote}`;
            } else {
                guidance += `\n- Focus: ${adaptation.focus}`;
            }

            if (adaptation.forbiddenKeywords) {
                guidance += `\n- **FORBIDDEN**: ${adaptation.forbiddenKeywords.join(', ')}.`;
            }
        }
        // 1. Introduction Phase
        else if (turnCount < (rules.introduction?.maxTurn || 30)) { // Default 30 if undefined
            const intro = rules.introduction;
            guidance += `\n**PHASE: INTRODUCTION**`;

            if (rules.global?.directorNote) {
                guidance += `\n${rules.global.directorNote}`;
            }

            // [New] Director's Note Injection
            if (intro.directorNote) {
                guidance += `\n${intro.directorNote}`;
            } else {
                guidance += `\n- Focus: ${intro.focus}`;
                if (intro.guidance) guidance += `\n- **MANDATE**: ${intro.guidance}`;
            }

            if (intro.forbiddenKeywords) {
                guidance += `\n- **FORBIDDEN**: ${intro.forbiddenKeywords.join(', ')}.`;
            }
        }
        // 2. Rising Action Phase
        else if (turnCount < (rules.risingAction?.maxTurn || 60)) {
            const rising = rules.risingAction;
            guidance += `\n**PHASE: RISING ACTION**`;

            if (rules.global?.directorNote) {
                guidance += `\n${rules.global.directorNote}`;
            }

            if (rising.directorNote) {
                guidance += `\n${rising.directorNote}`;
            } else {
                guidance += `\n- Focus: ${rising.focus}`;
                if (rising.guidance) guidance += `\n- **MANDATE**: ${rising.guidance}`;
            }

            if (rising.forbiddenKeywords) {
                guidance += `\n- **FORBIDDEN**: ${rising.forbiddenKeywords.join(', ')}.`;
            }
            if (rising.allowedKeywords) {
                guidance += `\n- **ALLOWED**: ${rising.allowedKeywords.join(', ')}.`;
            }
        }

        return guidance;
    }
}
