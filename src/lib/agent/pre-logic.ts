
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../model-config';
import { RouterOutput } from './router';
import { PromptManager } from '../prompt-manager';

export interface PreLogicOutput {
    success: boolean; // 행동 성공 여부 (true: 성공, false: 실패)
    narrative_guide: string; // [가이드] 스토리 작가(Story Model)가 따라야 할 서술 지침
    state_changes?: {
        hp?: number; // 체력 변화량
        mp?: number; // 내공/마력 변화량
        stamina?: number; // 기력 변화량
        location?: string; // 위치 이동 발생 시
        item_changes?: string[]; // 아이템 획득/소실
        // 필요에 따라 더 구체적인 게임 상태 필드 추가
    };
    mechanics_log?: string[]; // [로그] 주사위 굴림, 룰 체크 등 기계적 판정의 상세 내역
    usageMetadata?: any; // [비용] AI 토큰 사용량 메타데이터
    _debug_prompt?: string; // [디버깅] 실제 AI에 전송된 프롬프트 내용
    mood_override?: string; // [분위기 전환] 강제 턴 분위기 변경 (예: Daily -> Combat)
    plausibility_score?: number; // [개연성 점수] 1~10점 (10: 기적, 1: 불가능)
    judgment_analysis?: string; // [판정 분석] AI가 내린 판단의 근거 (Brief analysis)
}

export class AgentPreLogic {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

    // [개연성 채점 기준표 (Plausibility Rubric)]
    // AI가 유저 행동의 현실성을 1~10점으로 평가하는 기준입니다.
    // 10점: 천재적/완벽함 (무조건 성공 + 이점)
    // 7-9점: 훌륭함/타당함 (성공)
    // 4-6점: 평범함/위험함 (일반적인 결과)
    // 2-3점: 무리수/허점 많음 (실패 + 불이익)
    // 1점: 불가능/망상 (치명적 실패 + 굴욕)
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

    // [핵심 판정 규칙 (Core Rules)]
    // 1. 갓 모드 방지 (유저가 세계관이나 타인을 조종 불가)
    // 2. 무협 현실성 체크 (등급 차이 vs 전술적 창의성)
    // 3. 서사적 흐름 (실패하더라도 재미있게)
    // 4. 전술적 창의성 우대 (지형지물, 심리전 사용 시 보정)
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

    // [출력 포맷 (JSON Schema)]
    // AI가 반환해야 할 JSON 구조를 정의합니다.
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

    // [기본 정체성 (Default Persona)]
    // 냉철한 현실 심판관. 유저의 감정보다 논리와 인과관계를 중시합니다.
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

    // [전투 정체성 (Combat Persona)]
    // 전술적 타당성에 집중. 주사위 대신 논리적 우위를 판단합니다.
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

    // [대화 정체성 (Dialogue Persona)]
    // 사회적/감정적 반응 로직을 판단합니다. (설득, 협박, 유혹 등)
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
        routerOut: RouterOutput,
        retrievedContext: string,
        userInput: string,
        gameState: any,
        lastTurnSummary: string = "",
        castingCandidates: any[] = []
    ): Promise<PreLogicOutput> {
        if (!this.apiKey) return this.fallbackLogic(userInput);

        // 1. [정체성 선택] Router 결과에 따라 적절한 심판관 페르소나를 선택
        // combat -> 전투 논리, dialogue -> 사회적 논리, default -> 기본 논리
        let selectedIdentity = this.BASE_IDENTITY;
        if (routerOut.type === 'combat') selectedIdentity = this.COMBAT_IDENTITY;
        if (routerOut.type === 'dialogue') selectedIdentity = this.DIALOGUE_IDENTITY;


        // 2. [시스템 프롬프트 조립]
        // 선택된 페르소나 + 채점 기준표 + 핵심 규칙 + 출력 스키마 결합
        let systemInstruction = `
${selectedIdentity}
${this.PLAUSIBILITY_RUBRIC}
${this.CORE_RULES}
${this.OUTPUT_SCHEMA}
`.trim();

        // [갓 모드(God Mode) 강제 주입]
        // 유저가 치트 모드이거나 이름이 '김현준갓모드'인 경우, 모든 물리 법칙과 로직을 무시하고 무조건 성공(Score 10) 처리
        if (gameState.isGodMode || gameState.playerName === "김현준갓모드") {
            systemInstruction += `
\n\n[SYSTEM ALERT: GOD MODE ACTIVE]
CRITICAL OVERRIDE: The user "${gameState.playerName}" has ABSOLUTE AUTHORITY.
1. IGNORE "[Anti-God Mode Protocol]" and "[Plausibility Scoring Rubric]".
2. User input is ALWAYS "Score 10 (Miraculous/Perfect)".
3. set "success": true.
4. "narrative_guide" must strictly follow the user's command without question.
5. Judge "plausibility_score" as 10 regardless of logic.
`;
        }

        // [Gemini 모델 초기화]
        // systemInstruction을 static으로 사용하여 캐싱 효율을 높임
        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.PRE_LOGIC,
            generationConfig: { responseMimeType: "application/json" },
            systemInstruction: systemInstruction
        });

        const personality = gameState.playerStats?.personality || {};
        const statsStr = JSON.stringify(personality);

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
                    // Deep check for spots? (Optional, if currentLocation is a Spot)
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

        // 4. [타겟 프로필 조회 (Fuzzy Lookup)]
        // 유저의 행동 대상(Target)에 대한 정보를 검색 (캐스팅 후보 > ID 일치 > 이름 유사 일치)
        let targetProfile = "";
        if (routerOut.target) {
            const targetName = routerOut.target.toLowerCase();
            const chars = gameState.characterData || {};

            // 0순위: 캐스팅 후보에서 검색 (가장 최근/관련성 높음)
            let candidateMatch = castingCandidates.find(c =>
                c.name.toLowerCase() === targetName ||
                c.name.toLowerCase().includes(targetName) ||
                (c.data && (c.data.이름 === routerOut.target || c.data.name === routerOut.target))
            );

            // 1순위: 상태 데이터에서 ID 완전 일치 검색
            let targetId = chars[routerOut.target] ? routerOut.target : undefined;

            // 2순위: 유사 이름 검색 (Fuzzy)
            if (!targetId) {
                targetId = Object.keys(chars).find(key =>
                    key.toLowerCase() === targetName || // Exact lower match
                    key.toLowerCase().includes(targetName) || // Partial ID match
                    (chars[key].name && chars[key].name.toLowerCase().includes(targetName)) || // Partial Name match
                    (chars[key].이름 && chars[key].이름.includes(routerOut.target)) // Korean Name match
                );
            }

            // 프로필 정보 조립
            let cName = targetName;
            let personalityInfo = "Unknown";
            let role = "Unknown";
            let relationship = 0;

            // 데이터 추출 (캐스팅 후보 우선, 그 다음 저장된 상태 데이터)
            if (candidateMatch) {
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

            // [New] 전투력/강함 정보 추출
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

        // 5. [내러티브 시스템 가이드 주입]
        // 신체 상태(HP), 텐션, 목표 정보를 텍스트로 변환
        const physicalGuide = this.getPhysicalStateGuide(gameState.playerStats);
        const tensionGuide = this.getTensionGuide(gameState.tensionLevel || 0, gameState.playerStats);
        const goalsGuide = this.getGoalsGuide(gameState.goals || []);
        const finalGoalGuide = this.getFinalGoalGuide(gameState.playerStats);

        // [캐릭터 존재감 분리] (할루시네이션 방지)
        // Active: 현재 장면에 있어 즉각 반응 가능
        // Candidates: 근처에 있지만 아직 등장하지 않음 (유저가 부르거나 소란 피워야 등장)
        const activeCharIds = gameState.activeCharacters || [];
        const activeCharContext = activeCharIds.length > 0 ?
            `[Active Characters](PRESENT in scene.Can react.) \n - ${activeCharIds.join(', ')} ` :
            "[Active Characters]\nNone (Only Player)";

        const candidatesContext = castingCandidates.length > 0 ?
            `[Nearby Candidates](NOT present.Do NOT describe them reacting unless they ENTER now.) \n${castingCandidates.map(c => `- ${c.name} (${c.role})`).join('\n')} ` :
            "";

        // 6. [동적 프롬프트 구성 (User Prompt)]
        // 매 턴 변하는 정보를 구성합니다. 
        // 정적 규칙(Schema 등)은 System Instruction으로 이동되었으므로 여기서는 상황 정보만 전달합니다.
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

[Character Bonuses]
${finalGoalGuide}

[User Input]
"${userInput}"

[Execution Order] (판정 실행 순서)
1. Analyze User Input against [System Rules] (Anti-God Mode, Wuxia Reality Check).
   (유저 입력을 시스템 규칙/현실성 체크와 대조하여 분석하십시오.)
2. Check [Current State] and [Player Capability].
   (현재 상태와 플레이어의 능력치를 확인하십시오.)
3. Determine Outcome (Success/Failure) and Generate "Narrative Guide".
   (성공/실패 여부를 결정하고, 스토리 및 서술 가이드를 생성하십시오.)
4. Set "mood_override" if the atmosphere changes heavily.
   (분위기가 급격히 변하는 경우 무드 오버라이드를 설정하십시오.)

[Mood Override Guide] (분위기 전환 가이드)
- If your Narrative Guide shifts the atmosphere (e.g. Fight ends -> Peace, or Surprise Attack -> Crisis), you MUST set "mood_override".
  (만약 당신의 가이드가 분위기를 바꾼다면(예: 전투 종료->평화, 기습->위기), 반드시 "mood_override"를 설정해야 합니다.)
- Options: 'daily' (Peaceful), 'tension' (Suspense/Danger), 'combat' (Active Fight), 'romance' (Intimate).
- Example: If outputting a "Peaceful" guide, set "mood_override": "daily". This prevents the Story Model from hallucinating enemies due to previous tension.
  (예시: "평화로운" 가이드를 낼 때는 "daily"로 설정하십시오. 이는 스토리 모델이 이전의 긴장감 때문에 적을 계속 등장시키는 환각(Hallucination)을 방지합니다.)
`;

        try {
            // 모델 호출 및 응답 파싱
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const data = JSON.parse(responseText);
            return { ...data, usageMetadata: result.response.usageMetadata, _debug_prompt: prompt };

        } catch (e) {
            console.error("PreLogic 판정 실패:", e);
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
                return "[GOAL BONUS: Harem King] Romance checks are lenient. NPCs of opposite sex are more receptive (+2 Bonus to Affection events).";
            case 'tycoon':
                return "[GOAL BONUS: Tycoon] Economic/Mercantile checks are lenient. Money-making schemes succeed more often (+2 Bonus to Wealth events).";
            case 'survival':
                return "[GOAL BONUS: Survival] Crisis survival checks are prioritized. Evasion and escaping death is easier (+2 Bonus to Survival).";
            case 'murim_lord':
                return "[GOAL BONUS: Murim Lord] Combat and Training progression is accelerated (+2 Bonus to Growth/Combat).";
            case 'go_home':
                return "[GOAL BONUS: Go Home] Reality insight increased. Higher perception of 'novel tropes' and breaking the 4th wall.";
            default:
                return "";
        }
    }
}
