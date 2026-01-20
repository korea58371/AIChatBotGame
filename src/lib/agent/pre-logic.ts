
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../ai/model-config';
// import { RouterOutput } from './router'; // [REMOVED]
import { PromptManager } from '../engine/prompt-manager';

export interface PreLogicOutput {
    narrative_guide: string; // [가이드] 스토리 작가(Story Model)가 따라야 할 서술 지침
    fate_change?: number; // [NEW] 운명 점수 변화량 (획득 - 소모)
    usageMetadata?: any; // [비용] AI 토큰 사용량 메타데이터
    _debug_prompt?: string; // [디버깅] 실제 AI에 전송된 프롬프트 내용
    mood_override?: string; // [분위기 전환] 강제 턴 분위기 변경 (예: Daily -> Combat)
    plausibility_score?: number; // [개연성 점수] 1~10점 (10: 기적, 1: 불가능)
    judgment_analysis?: string; // [판정 분석] AI가 내린 판단의 근거 (Brief analysis)
    combat_analysis?: string; // [NEW] 전투 분석 (승산, 강함 비교)
    emotional_context?: string; // [NEW] 감정 상태 요약 (숨겨진 감정 포함)
    character_suggestion?: string; // [NEW] 등장 제안 인물
    new_characters?: string[]; // [NEW] 새로 등장한 캐릭터 목록 (이름)
    goal_guide?: string; // [NEW] 목표 달성 가이드
    location_inference?: string; // [NEW] 위치 추론 (Region Inference)
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

[Fate Intervention System]
User can spend 'Fate Points' to bend reality.
- **Usage**: Only if 'Fate Usage' > 0 in Input.
- **Boost**: Add 'Fate Usage' points to the Base Plausibility Score.
- **Downgraded Success Rule**:
  - If Base Score was 1 (Impossible) and became 4+ via Fate:
  - **DO NOT GRANT** the User's exact wish if it breaks the world (e.g. "I become Emperor").
  - **INSTEAD GRANT** a "Downgraded Version" or "Lucky Coincidence".
  - Goal: Turn 'Impossible' into 'Possible Opportunity'.

[Fate Accumulation Rule]
- **Gain Formula**: Fate Gain = MAX(0, Final Plausibility Score - 7).
- If Score is 10, Gain 3.
- If Score is 8, Gain 1.
- If Score <= 7, Gain 0.
- **Net Calculation**: Return 'fate' in state_changes as (Gain - Usage).

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
[Worldview & Identity (TONE & MANNER)]
${gameIdentity}

You are the [Dungeon Master & Reality Judge] of a text-based Wuxia RPG.
Your job is to:
1. **CLASSIFY** the user's intent (Combat, Dialogue, Action, System).
2. **JUDGE** the feasibility of the action (Score 1-10) based on REALISM and LOGIC.
3. **GUIDE** the narrator on how to describe the outcome.

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
   - Draft Narrative Guide.

[Alignment & Faction Logic (Morality System)]
**Check Player's Morality (if available in Context/Stats)**
- **High Morality (>50)**: 'Orthodox (White Faction/Murim Alliance)' NPCs are FRIENDLY/Respectful. 'Unorthodox (Black Faction)' NPCs are HOSTILE/Wary.
- **Low Morality (<-50 or Evil Actions)**: 'Unorthodox' NPCs are FRIENDLY/Respectful (Brotherhood). 'Orthodox' NPCs are HOSTILE/Disgusted.
- **Guidance Rule**: If Player tries to persuade a faction OPPOSITE to their alignment -> **Apply Penalty to Score (-2)** and describe inherent distrust.

[Output Schema (JSON)]
{
    "mood_override": "daily" | "tension" | "combat" | "romance" | null,
    "plausibility_score": number, // 1-10
    "judgment_analysis": "Keywords only. (e.g. 'Rank Gap', 'Illogical').",
    "combat_analysis": "Keywords. (e.g. 'Win: High', 'Loss: Certain'). Null if safe.",
    "emotional_context": "Keywords. (e.g. 'A->B: Love', 'B->A: Hate'). Null if neutral.",
    "character_suggestion": "Name only (e.g. 'Ma Gwang-cheol'). Null if none.",
    "new_characters": ["Name"], 
    "goal_guide": "Keywords. (e.g. 'Goal: Find Sword -> Check Shop'). Null if irrelevant.",
    "narrative_guide": "Short directives. (e.g. 'Success. Funny tone.').",
    "location_inference": "Keywords. (e.g. 'Sichuan(Hot)'). Null if known."
}

[Guide Generation Instructions]
**CRITICAL: EXTREME BREVITY REQUIRED.** 
- **NO SENTENCES**. Use Keywords/Fragments ONLY.
- **Example**: "Provides a humorous first meeting to establish personality" (X) -> "Funny entrance" (O).
- **Example**: "The enemy is too strong for the player to defeat" (X) -> "Enemy OP. Defeat likely." (O).

1. **Combat Guide**: "Player < Enemy. Loss likely." (Null if safe).
2. **Emotional Guide**: "A loves B." (Null if neutral).
3. **Character Suggestion**:
   - **Reasoning**: "Ma Gwang-cheol - Funny entrance." (Keep it under 5 words).
   - **Romance**: Null.
4. **Goal Guide**: "Check Shop." (Null if irrelevant).
5. **Location Guide**: "Sichuan (Hot)." (Null if known).
6. **Narrative Guide**: "Success. Funny tone. Twist ending." (Focus on Result/Direction ONLY).

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
                const cleanText = rawText.length > 800 ? "..." + rawText.slice(-800) : rawText;
                recentHistoryContext = `[Previous Turn Output (Immediate Context)]\n"${cleanText}"`;
            }
        }

        // 6. [동적 프롬프트 구성 (User Prompt)]
        const prompt = `
[Current State Guide]
"${physicalGuide}"
${this.getEarlyGameGuidance(gameState.turnCount || 0, gameState.playerStats)}
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

[Fate System Info]
- Current Fate: ${gameState.playerStats?.fate || 0}
- Fate Usage Attempt: ${gameState.fateUsage || 0} (Add this to Base Score)

[User Input]
"${userInput}"

[Execution Order]
1. **IDENTIFY** the Target (if any). If the target is in [Casting Suggestions], allow interaction if logical (e.g. shouting).
2. **JUDGE** the action's Plausibility (1-10). Check Player Capability vs Target Strength.
3. **GENERATE** the Narrative Guide. **Aggressively suggest** new characters if the scene allows.
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
            const fateUsage = Number(gameState.fateUsage) || 0;

            // [Adjustment] Calculate Gain based on BASE score (Before Boost) to prevent farming
            const baseScore = Math.max(0, finalScore - fateUsage);

            let fateGain = 0;
            if (baseScore >= 7) {
                // Formula: Score 8->1, 9->2, 10->3 (So BaseScore - 7)
                fateGain = Math.max(0, baseScore - 7);
                // Cap at 3 for Score 10+
                if (fateGain > 3) fateGain = 3;
            }

            const netFateChange = fateGain - fateUsage;

            // [Override] Inject calculated fate change
            data.fate_change = netFateChange; // [NEW] Explicit ID

            // [Logging] Always Log Debugging Info
            console.log(`[Fate System] Score: ${finalScore}, Used: ${fateUsage}, Gain: ${fateGain} -> Net: ${netFateChange}`);


            return {
                ...data,
                usageMetadata: result.response.usageMetadata,
                _debug_prompt: `[System Instruction]\n${enhancedInstruction}\n\n[User Prompt]\n${prompt}`
            };

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
            fate_change: 0,
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
}
