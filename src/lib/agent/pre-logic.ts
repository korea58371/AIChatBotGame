
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../model-config';
// import { RouterOutput } from './router'; // [REMOVED]
import { PromptManager } from '../prompt-manager';

export interface PreLogicOutput {
    intent?: 'combat' | 'dialogue' | 'action' | 'system'; // [NEW] Integrated Classification
    target?: string; // [NEW] Integrated Target
    success: boolean; // 행동 성공 여부 (true: 성공, false: 실패)
    narrative_guide: string; // [가이드] 스토리 작가(Story Model)가 따라야 할 서술 지침
    state_changes?: {
        hp?: number; // 체력 변화량
        mp?: number; // 내공/마력 변화량
        stamina?: number; // 기력 변화량
        fate?: number; // [NEW] 운명 점수 변화량 (획득 - 소모)
        location?: string; // 위치 이동 발생 시
        item_changes?: string[]; // 아이템 획득/소실
        factionChange?: string; // [NEW] 소속 변경 (e.g. "Mount Hua Sect")
        playerRank?: string; // [NEW] 등급/이칭 변경 (e.g. "First Rate Warrior")
        // 필요에 따라 더 구체적인 게임 상태 필드 추가
    };
    mechanics_log?: string[]; // [로그] 주사위 굴림, 룰 체크 등 기계적 판정의 상세 내역
    usageMetadata?: any; // [비용] AI 토큰 사용량 메타데이터
    _debug_prompt?: string; // [디버깅] 실제 AI에 전송된 프롬프트 내용
    mood_override?: string; // [분위기 전환] 강제 턴 분위기 변경 (예: Daily -> Combat)
    plausibility_score?: number; // [개연성 점수] 1~10점 (10: 기적, 1: 불가능)
    judgment_analysis?: string; // [판정 분석] AI가 내린 판단의 근거 (Brief analysis)
    combat_analysis?: string; // [NEW] 전투 분석 (승산, 강함 비교)
    emotional_context?: string; // [NEW] 감정 상태 요약 (숨겨진 감정 포함)
    character_suggestion?: string; // [NEW] 등장 제안 인물
    goal_guide?: string; // [NEW] 목표 달성 가이드
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

**Score 2-3 (Unlikely/Flawed/Hallucinated)**:
- Ignores disadvantage. Poor tactic. "I punch the steel wall."
- **Inventing convenient facts** (e.g., "I suddenly remember I have a bomb" when not inventory).
- **Adding unmentioned settings** (e.g., "He is actually my brother" when not in lore).
- Result: Failure + Minor Consequence.

**Score 1 (Impossible/God-Mode)**:
- Violates limitations. Controlling NPCs ("She loves me"). Controlling Reality ("It rains").
- Blatant Hallucination or Lying about context.
- **Result: IMMEDIATE DENIAL.**
- **CRITICAL:** Do NOT describe the success and then "it was a dream".
- **Describe the World resisting.** (e.g., User: "She kisses me." -> Response: "She pushes you away coldly.")
`;

    // [핵심 판정 규칙 (Core Rules)]
    // 1. 갓 모드 방지 (유저가 세계관이나 타인을 조종 불가)
    // 2. 무협 현실성 체크 (등급 차이 vs 전술적 창의성)
    // 3. 서사적 흐름 (실패하더라도 재미있게)
    // 4. 전술적 창의성 우대 (지형지물, 심리전 사용 시 보정)
    private static readonly CORE_RULES = `
[Anti-God Mode Protocol]
CRITICAL: The Player controls ONLY their own character.
1. **NO Forced Affection**: The player CANNOT dictate how an NPC feels. 
   - User: "She falls in love with me." 
   - AI Judge: **REJECT**. 
   - Narrative: She looks at you with confusion or indifference. (Do NOT say "You thought she loved you but...")
2. **NO Instant Mastery**: The player CANNOT suddenly become a master. Growth takes time. 
3. **NO World Control**: The player CANNOT dictate world events.

[Strict Context & Anti-Hallucination Protocol]
**CRITICAL**: You must judgment based ONLY on the provided [Context], [Active Characters], and [Helper/Target Info].
1. **NO Invented Settings**: 
   - Do NOT accept user claims about the world unless supported by [Lore] or [Context].
   - Example User: "I use the secret passage here." (If no passage in Context -> Fail).
   - Example User: "He remembers my father." (If no such link in Character Info -> Fail/Confused reaction).
2. **NO False Memories**: 
   - If the user adds a flashback or memory that was not in [Previous Turn] or [Context], treat it as a **Delusion** or **Lie**.
   - Result: NPCs will not understand or will call it out. "What are you talking about?"
3. **Only Verified Assets**: Use only items/skills listed in [Player Capability].

[Fate Intervention System]
User can spend 'Fate Points' to bend reality.
- **Usage**: Only if 'Fate Usage' > 0 in Input.
- **Boost**: Add 'Fate Usage' points to the Base Plausibility Score.
- **Downgraded Success Rule (CRITICAL)**:
  - If Base Score was 1 (Impossible) and became 4+ via Fate:
  - **DO NOT GRANT** the User's exact wish if it breaks the world (e.g. "I become Emperor").
  - **INSTEAD GRANT** a "Downgraded Version" or "Lucky Coincidence".
  - Example: User "I become 1st Rank Master" (+3 Fate) -> Result: "You find a hint/manual for 1st Rank, but you are not there yet."
  - Example: User "She is my lover" (+3 Fate) -> Result: "She blushes and shows interest, but is not your lover yet."
  - **Goal**: Turn 'Impossible' into 'Possible Opportunity', NOT 'Instant Win'.

[Fate Accumulation Rule]
- **Gain Formula**: Fate Gain = MAX(0, Final Plausibility Score - 7).
- If Score is 10, Gain 3.
- If Score is 8, Gain 1.
- If Score <= 7, Gain 0.
- **Net Calculation**: Return 'fate' in state_changes as (Gain - Usage).

[Strict Causality (No Retcons)]
- If a user dictates a result that violates the rules (Score 1), **rewrite the ACTION as an ATTEMPT.**
- **User**: "I chop his head off instantly." (Level 1 vs Level 50)
- **AI**: "You swing your sword with all your might (Attempt), but he catches it with two fingers (Reality)."
- **NEVER** write: "You chopped his head off... but wait, it was a dream." (BANNED).

[Wuxia Reality Check (Flexible)]
**Rank vs Utility**:
- **Direct Clash**: Rank matters. A 3rd Rate cannot beat a 1st Rate in a head-on duel.
- **Tactical Creativity (CRITICAL)**: If the player uses **environment, poison, traps, deception, or psychology**, IGNORE rank gap for the *success of the action itself*.
  - Example: A weakling throwing sand in a master's eyes -> **SUCCESS** (The master is blinded temporarily).
  - Example: A weakling challenging a master to a strength contest -> **FAIL** (Result of direct clash).

[Adjudication Standard]
- **Reasonability over Rules**: Does the action make sense physically and logically? If yes, ALLOW it.
- **Narrative Flow**: Does this make the story more interesting?
- **Fail Forward**: Even if they fail, describe *how* they fail. Use the failure to drive the story.

[Personality Logic (CRITICAL for Dialogue)]
- **Resonance (Bonus)**: If Player and Target share traits (e.g. Righteous + Righteous, or Greedy + Greedy), APPLY +1~2 Bonus to Plausibility.
- **Dissonance (Penalty)**: If traits clash (e.g. Righteous vs Evil), APPLY -1~2 Penalty. Negotiation is harder.
- **Consistency (Penalty)**: If Player acts against their own Stats (e.g. High Integrity character lying, or High Lust character acting ascetic), apply penalty for "Unconvincing Acting".

[Tactical Creativity Protocol]
- If the input involves innovative use of items/terrain: **GRANT ADVANTAGE**.
- Reward specific descriptions over generic "I attack".
`;

    // [출력 포맷 (JSON Schema)]
    // AI가 반환해야 할 JSON 구조를 정의합니다.
    private static readonly OUTPUT_SCHEMA = `
[Output Schema(JSON)]
{
    "mood_override": "daily" | "tension" | "combat" | "romance" | null,
    "plausibility_score": number, // 1-10 (AFTER Fate Boost)
    "judgment_analysis": "Brief analysis.",
    "combat_analysis": "Compare Player vs Target strength. Estimate winning chance.",
    "emotional_context": "Summarize active character sentiments (Hidden/Overt). e.g. 'A loves B, B is curious about A'.",
    "character_suggestion": "Suggest a relevant character to appear/react if appropriate. Or 'None'.",
    "goal_guide": "Tips for the Story Model to advance Active Goals based on current situation.",
    "success": boolean,
    "narrative_guide": "Specific instructions for the narrator.",
    "state_changes": { 
        "hp": -10, 
        "fate": number, // Calculated Net Change (Gain - Usage)
        "factionChange": "New Faction Name",
        "playerRank": "New Rank Title"
    },
    "mechanics_log": ["Analysis: ...", "Score: X/10"]
}
`;




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

        // [Unified System Prompt]
        // Router 기능(의도 파악) + PreLogic 기능(판정) 통합
        const systemInstruction = `
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

[Intent Classification Rules]
- **combat**: Attacking, defending, using skills (Martial Arts), fleeing, tactical movement.
- **dialogue**: Speaking to characters, asking questions, emotional expression.
- **action**: General physical actions (searching, crafting, moving, sleeping, eating).
- **system**: UI requests (save, load, status, inventory).

[Mode-Specific Adjudication Rules]
1. IF Intent == 'combat' (Use [Combat Logic Engine]):
   - Focus: TACTICAL PLAUSIBILITY. 
   - Analyze: Is the tactic smart? Does it exploit weakness?
   - Mechanic: Compare Relative Strength (Rank/Stats).
     * Player << Enemy (Head-on) -> Fail / Take Damage.
     * Player << Enemy (Ambush/Trap) -> Potential Success / Escape.
   - Outcome: Describe specific HIT, IMPACT, or COUNTER.

2. IF Intent == 'dialogue' (Use [Social Logic Adjudicator]):
   - Focus: EMOTIONAL LOGIC & CONTEXT.
   - Analyze: Goal (Info/Affection) vs Approach.
     * Logical/Respectful -> Effective on Scholars/Righteous.
     * Aggressive/Rough -> Effective on Bandits/Unorthodox.
     * Emotional -> Effective on Intimate relationships.
    - Outcome: Target reacts favorably vs Refuses/Gets angry.

3. IF Intent == 'action' (Use [Reality Judge]):
   - Focus: CAUSALITY & PHYSICALITY.
   - Analyze: Does the player have the tool/skill? Is it physically possible?
   - Outcome: Success or Consequences of failure.

[Output Schema (JSON)]
{
    "intent": "combat" | "dialogue" | "action" | "system",
    "target": "Target Name/ID (optional, e.g. 'Bandit Leader')",
    "mood_override": "daily" | "tension" | "combat" | "romance" | null,
    "plausibility_score": number, // 1-10
    "judgment_analysis": "Step-by-step reasoning used.",
    "combat_analysis": "Compare Player vs Target strength. Estimate winning chance.",
    "emotional_context": "Summarize active character sentiments (Hidden/Overt). e.g. 'A loves B, B is curious about A'.",
    "character_suggestion": "Suggest a relevant character to appear/react if appropriate. Or 'None'.",
    "goal_guide": "Tips for the Story Model to advance Active Goals based on current situation.",
    "success": boolean,
    "narrative_guide": "Specific instructions for the narrator.",
    "event_status": "active" | "completed" | "ignored" | null, // [New] Event Lifecycle Management
    "state_changes": { "hp": -10, "stamina": -5, "factionChange": "New Faction", "playerRank": "New Title" },
    "mechanics_log": ["Analysis: ...", "Score: X/10"]
}

[Guide Generation Instructions]
1. **Combat Guide**: If intent is 'combat' or tension is high, compare Player Rank vs Target Rank. Provide a realistic win/loss estimation.
2. **Emotional Guide**: Analyze active characters. If 'Love' or 'Rivalry' exists, mention it explicitly for the narrator.
3. **Character Guide**: Check [Casting Suggestions]. 
   - **PROACTIVELY SUGGEST** characters to appear. 
   - If the scene is boring or static, **FORCE** a character appearance from the list. 
   - Don't wait for the user to ask. "Unexpected meetings" drive the story.
4. **Goal Guide**: Check [Active Goals]. Advise on progress.
5. **Active Event Guide**: Check [ACTIVE EVENT]. 
   - **Lifecycle**: Determine if the event is ONGOING, RESOLVED, or IGNORED based on user input.
     * "active": Event is still relevant and unresolved.
     * "completed": User successfully handled the event or the event reached a natural conclusion.
     * "ignored": User explicitly ignored the event or moved away. (This will clear the event).
   - If "active", you MUST guide the narrative to align with the event.
   - **CRITICAL CONDITION**: If 'Tension' is HIGH/COMBAT, do NOT force the event to disrupt the scene.
     - Instead, treat the event as "present in background" (e.g., waiting for the fight to end).
     - Only forcefully interrupt if the event is an EMERGENCY or DIRECT THREAT.
`.trim();

        // 갓 모드 체크
        let enhancedInstruction = systemInstruction;
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
            }
        }

        // 5. [내러티브 시스템 가이드 주입]
        const physicalGuide = this.getPhysicalStateGuide(gameState.playerStats);
        const tensionGuide = this.getTensionGuide(gameState.tensionLevel || 0, gameState.playerStats);
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
- Growth Stagnation: ${gameState.playerStats?.growthStagnation || 0} / 10 turns

[Narrative Tension]
"${tensionGuide}"

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
1. **CLASSIFY** the User's Intent (Combat/Dialogue/Action/System).
2. **IDENTIFY** the Target (if any). If the target is in [Casting Suggestions], allow interaction if logical (e.g. shouting).
3. **JUDGE** the action's Plausibility (1-10). Check Player Capability vs Target Strength.
4. **GENERATE** the Narrative Guide. **Aggressively suggest** new characters if the scene allows.
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
            if (!data.state_changes) data.state_changes = {};
            data.state_changes.fate = netFateChange;

            // [Logging] Always Log Debugging Info
            console.log(`[Fate System] Score: ${finalScore}, Used: ${fateUsage}, Gain: ${fateGain} -> Net: ${netFateChange}`);
            if (!data.mechanics_log) data.mechanics_log = [];
            data.mechanics_log.push(`Fate Calc: Score(${finalScore}) -> Gain(${fateGain}) - Cost(${fateUsage}) = ${netFateChange}`);

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
            success: true,
            narrative_guide: "사용자의 행동을 자연스럽게 진행하십시오. 복잡한 역학은 없습니다.",
            state_changes: {},
            mechanics_log: ["폴백 실행 (System Fail Safe)"],
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
            guides.push("- REQUIREMENT: If the user ignores pain and exerts force, describe the worsening condition.");

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
     * [텐션(긴장도) 가이드 생성]
     * 현재 텐션 수치(-100 ~ 100)에 따라 내러티브 분위기를 정의합니다.
     * 음수일 경우 '절대적인 평화'를 보장합니다.
     */
    private static getTensionGuide(tension: number, stats: any = null): string {
        // [난이도 밸런싱] 저레벨 플레이어를 위한 긴장도 상한선(Cap) 적용
        // 플레이어가 '삼류' 등급(약함)일 때, 긴장도 제한을 걸어 스토리 모델이 '세계를 멸망시킬 위기'를 환각하지 않도록 방지합니다.
        let tensionCap = 100;
        let rankLabel = "Unknown";

        if (stats) {
            const rankStr = stats.realm || "삼류";
            rankLabel = rankStr;
            if (rankStr.includes("삼류")) tensionCap = 50; // 최대 '경계' 수준 (Max Moderate)
            else if (rankStr.includes("이류")) tensionCap = 80; // 최대 '높음' 수준 (Max High)
        }

        // 제한 적용 (Cap Application)
        let effectiveTension = tension;
        if (tension > tensionCap) {
            effectiveTension = tensionCap;
            // 실제 게임 상태(gameState)의 수치는 변경하지 않고, AI에게 전달하는 내러티브 해석만 제한합니다.
        }

        // Tension Guide: -100 (평화 보장) -> +100 (절정/위기)
        if (effectiveTension < 0) return `Tension Negative(${tension}): PEACE BUFFER. The crisis has passed. Absolute safety. NO random enemies or ambushes allowed. Focus on recovery, romance, or humor.`;

        if (effectiveTension >= 100) return `Tension MAX(${tension}): CLIMAX. A boss fight or life-or-death crisis is imminent/active. No casual banter.`;
        if (effectiveTension >= 80) return `Tension High(${tension}): Serious Danger. Enemies are abundant. Atmosphere is heavy.`;

        // 제한된 상태에 대한 맞춤형 메시지 (Custom message for capped state)
        if (stats && tension > tensionCap) {
            return `Tension Moderate(${tension} -> Capped at ${tensionCap} for ${rankLabel}): Alert. Danger is present, but manageable for a novice. Local thugs or minor beasts only. NO ASSASSINS/MASTERS.`;
        }

        if (effectiveTension >= 50) return `Tension Moderate(${tension}): Alert. Passive danger increases. Suspicion rises.`;
        if (effectiveTension >= 20) return `Tension Low(${tension}): Minor signs of trouble, but mostly calm.`;
        return `Tension Zero(${tension}): Peace. Standard peaceful journey. Enjoy the scenery.`;
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
}
