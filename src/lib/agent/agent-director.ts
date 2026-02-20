/**
 * [Agent Director] 이야기 흐름 관리 에이전트
 * 
 * 역할:
 * 1. 이번 턴의 줄거리 비트 (plot_beats) 설계
 * 2. 떡밥/장기 arc 관리 (subtle_hooks)
 * 3. Context Composer에 필요한 데이터 힌트 (context_requirements)
 * 
 * 핵심 원칙: "메타 지식 방화벽"
 * - Director는 떡밥의 진실, 캐릭터 arc의 다음 단계를 알지만
 * - Story Model에는 스포 없는 행동/분위기 지시만 전달
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { MODEL_CONFIG } from '../ai/model-config';
import { withRetry } from '../ai/retry';
import { DirectorState, DirectorLogEntry } from '../store';

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// ===== 입출력 타입 =====

export interface DirectorCharSummary {
    id: string;
    name: string;
    rank: string;
    title: string;
    faction: string;
    identity: string; // 직업/신분 요약 (예: "일반인 / 금수저", "편의점 알바생")
    relationship: number;
    tags: string[];
}

export interface DirectorInput {
    preLogic: {
        mood: string | null;
        score: number;
        combat_analysis: string | null;
        narrative_guide?: string | null; // [NEW] PreLogic 성공/실패 판정 + 행동 가이드
        location_inference?: string | null;
    };
    characters: DirectorCharSummary[];
    directorState: DirectorState;
    userInput: string;
    location: string;
    turnCount: number;
    activeGoals: string[];
    lastTurnSummary: string;
    regionalContext: string;
    recentHistory?: string;
    playerProfile: string;
    castingSuggestions: string; // [NEW] 캐스팅 추천 캐릭터 요약
    gameGuide: string; // [NEW] 게임별 톤/세계관/행동규범 (GameConfig에서 동적 주입)
    directorExamples?: { good: string; bad: string };
    growthGuide?: string; // [NEW] pacing.ts growth 섹션에서 주입되는 성장 가이드
}

export interface DirectorOutput {
    // 이번 턴 줄거리
    plot_beats: string[];
    emotional_direction: string;
    tone: string;

    // Context Composer용 힌트
    context_requirements: {
        combat_characters: string[];
        first_encounter: string[];
        emotional_focus: string[];
        skill_usage?: Record<string, string[]>;
    };

    // 떡밥 지시 (Story Model에 간접 전달)
    subtle_hooks: string[];

    // [NEW] 씬 연출 지시 (캐릭터 등퇴장 + 시간대)
    scene_direction?: {
        scene_characters: string[];       // 이번 턴에 실제로 등장해야 할 캐릭터 (한글 이름)
        departing_characters?: { name: string; reason: string }[]; // 퇴장 캐릭터 + 사유
        time_of_day?: string;             // 시간대 (아침/오후/저녁/심야)
    };

    // [NEW] 동행자 관리
    companion_updates?: {
        add?: { name: string; reason: string; type: 'mission' | 'bond' | 'escort' }[];
        remove?: { name: string; reason: string }[];
    };

    // 서사 상태 업데이트 제안
    state_updates?: {
        momentum_focus?: string;
        thread_updates?: { id: string; status: string; summary: string }[];
        foreshadowing_updates?: { id: string; new_status: string; hint?: string }[];
    };

    // 디버깅
    _debug_prompt?: string;
    usageMetadata?: any;
}

// ===== Director 에이전트 =====

export class AgentDirector {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

    /**
     * 이번 턴의 이야기 방향을 설계합니다.
     * PreLogic의 판정 결과를 받아 줄거리를 계획하고,
     * Context Composer에 필요한 데이터 힌트를 출력합니다.
     */
    static async analyze(input: DirectorInput): Promise<DirectorOutput> {
        const apiKey = this.apiKey;
        if (!apiKey) return this.fallback(input);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.DIRECTOR,
            safetySettings,
            generationConfig: { responseMimeType: "application/json" },
            systemInstruction: this.buildSystemPrompt(input.directorExamples)
        });

        const userPrompt = this.buildUserPrompt(input);

        try {
            const result = await withRetry(
                (signal) => model.generateContent(userPrompt, { signal }),
                { maxRetries: 2, timeoutMs: 30_000, label: 'Director' }
            );
            const responseText = result.response.text();
            const jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonText);

            return {
                plot_beats: data.plot_beats || [],
                emotional_direction: data.emotional_direction || '',
                tone: data.tone || '',
                context_requirements: {
                    combat_characters: data.context_requirements?.combat_characters || [],
                    first_encounter: data.context_requirements?.first_encounter || [],
                    emotional_focus: data.context_requirements?.emotional_focus || [],
                    skill_usage: data.context_requirements?.skill_usage || undefined,
                },
                subtle_hooks: data.subtle_hooks || [],
                scene_direction: data.scene_direction || undefined,
                companion_updates: data.companion_updates || undefined,
                state_updates: data.state_updates || undefined,
                _debug_prompt: `[System]\n${this.buildSystemPrompt().substring(0, 500)}...\n\n[User]\n${userPrompt}`,
                usageMetadata: result.response.usageMetadata,
            };
        } catch (e) {
            console.error("[Director] Analysis failed:", e);
            return this.fallback(input);
        }
    }

    // ===== 시스템 프롬프트 =====

    private static buildSystemPrompt(examples?: { good: string; bad: string }): string {
        const goodEx = examples?.good || 'NPC가 주인공의 능력을 유심히 관찰한다';
        const badEx = examples?.bad || 'NPC가 주인공의 능력이 특별한 것임을 알아차린다';
        return `You are the [Narrative Director] of a story-driven RPG.
Your role is to PLAN the story for this turn — NOT to write it.
You will receive the game's [Tone & World Guide] in the user prompt. Follow it strictly.

[Your Responsibilities]
1. **Plot Planning**: Design 2-3 plot beats for this turn based on the situation. Maximum 3 beats.
2. **Context Requirements**: Tell the system which character data is needed.
3. **Subtle Hooks**: Plant foreshadowing hints as BEHAVIOR/ATMOSPHERE directives.
4. **Tone Setting**: Set the emotional tone for the turn.
5. **Regional Awareness**: Use the Regional Landscape data to make geopolitically coherent decisions.
6. **Growth Encouragement**: If [Growth Guide] is provided AND the mood is "growth" or "tension", design plot beats with training opportunities. But if the mood is "daily"/"social"/"romance", do NOT force growth triggers — let the player enjoy the moment.

[ABSOLUTE RULES]
1. **NO SPOILERS**: Never reveal the "truth" behind foreshadowing in your output.
   - ✅ "${goodEx}"
   - ❌ "${badEx}"
2. **RESPECT PRELOGIC**: If plausibility_score is low (1-3), the action MUST fail.
3. **PACING & MOOD RESPECT (⭐ CRITICAL)**:
   - Don't force drama every turn. If the mood is peaceful, keep it peaceful.
   - **Mood Gate**: When PreLogic Mood is "daily", "comic", "social", or "romance":
     - ❌ FORBIDDEN: tension beats, combat beats, crisis events, sudden dramatic interruptions
     - ✅ ALLOWED: conversation, banter, relationship building, slice-of-life moments, subtle atmosphere
     - The player CHOSE a calm action. Respect it. Do NOT hijack peaceful scenes with sudden events.
   - **"Quiet is OK"**: Not every turn needs conflict. A turn where characters simply talk, eat, or hang out is VALID and often better storytelling.
   - If you feel the urge to insert tension into a calm scene, STOP. Ask: "Did the PLAYER request this, or am I forcing drama?"
4. **BREVITY**: Use keywords and fragments, not full sentences.
5. **REGIONAL COHERENCE**: Don't reference factions/events from distant regions without reason.
6. **FACTION BEHAVIOR**: Characters MUST act within their faction's behavioral norms. A righteous sect member does NOT attack innocents unprovoked.
7. **EXTRA CONTINUITY**: If [Characters Present] includes characters ranked "엑스트라" (extras from previous turns), DO NOT replace them with Casting Candidates abruptly. Either:
   - Continue their presence naturally in the scene
   - Design a plot beat for their natural departure FIRST, then introduce new characters
   - ❌ An extra character suddenly transforms into or is replaced by a different main character mid-scene
8. **LOCATION-AWARE CASTING**: Characters should appear where it is NATURAL for them to be. Check the current [Location] and ask: "Would this person realistically be here?"
   - ✅ Sister at home, coworker at the office, shopkeeper at the market
   - ❌ The same friend "coincidentally" appears at every unrelated location the player visits
   - Use [Recent Decisions] to check if a character has been appearing too frequently across UNRELATED locations. Repeated encounters are fine if the setting justifies it.
9. **OPEN ENDING (mood-dependent)**:
   - **When mood is "tension"/"combat"/"event"**: The LAST plot beat MUST be an UNRESOLVED situation. "What happens next?" cliffhanger.
     - ✅ "NPC asks a direct question" / "A new threat appears" / "Player faces a critical decision"
   - **When mood is "daily"/"social"/"comic"/"romance"**: The last beat should be a **soft hook** — NOT a dramatic cliffhanger.
     - ✅ "Conversation reaches an interesting topic" / "Character reveals something personal" / "A comfortable moment with lingering warmth" / "NPC casually mentions something intriguing"
     - ❌ "Phone rings with urgent news" / "A monster suddenly appears" / "An explosion shakes the building" — these DESTROY the peaceful scene the player chose.
   - The key principle: **match the ending energy to the scene energy**. Calm scene = calm ending.
10. **FORESHADOWING PAYOFF**: Planted hooks MUST eventually be revealed or discarded.
     - "planted" → After 3+ turns, escalate to "growing" (repeat hints).
     - "growing" → After 3+ hints, consider "revealed" (payoff at a natural moment).
     - ⚠️ Any seed that has been "planted" or "growing" for 10+ turns MUST be resolved ("revealed") or discarded this turn. Do NOT let hooks stagnate indefinitely.
     - ⭐ HOOK MOOD GATE (CRITICAL):
       - When mood is "romance"/"daily"/"social": hooks MUST be **non-disruptive**.
         - ✅ Character subtly fidgets / A warm glance is exchanged / Atmosphere shifts delicately / Internal monologue hint
         - ❌ Footsteps in the hallway / Shadow looming outside / Phone vibrating / Someone approaching the door — these SET UP future interruptions and are FORBIDDEN in calm moods.
       - When mood is "tension"/"combat": disruptive hooks are allowed.
11. **SCENE CAST CONTROL (씬 캐스팅 — 최우선 규칙)**:
    - You MUST explicitly decide who appears in this turn via \`scene_direction.scene_characters\`.
    - **동행 여부 판단**: [Characters Present]의 각 캐릭터에 대해 "이 인물이 지금 주인공과 함께 움직이고 있는 상황인가?"를 판단.
      - 함께 이동 중이거나, 같은 장소에서 용건이 진행 중 → 유지
      - 이전 씬에서 만났지만 별도 행동 중인 인물 → scene_characters에서 **제외**
    - **텔레포트 금지**: 이전에 다른 장소에 있던 캐릭터가 아무 이유 없이 현재 장소에 나타나면 안 됨.
    - **퇴장 지시**: 용건이 끝나거나, 장면이 전환되면 \`departing_characters\`에 퇴장 캐릭터와 사유를 명시.
    - **동행자도 분리될 수 있음**: 메인 히로인/친구라도 "각자 할 일"이 있으면 일시적으로 헤어지는 장면을 설계.
    - **Casting Candidates 활용**: 새 캐릭터를 등장시킬 때는 [Casting Candidates]에서 이 장소에 자연스럽게 있을 인물만 선택.
12. **TIME FLOW & TEMPO (시간 흐름과 템포)**:
    - **1턴 = 소설 0.5~1화 분량**. 하나의 에피소드에 집중하라.
    - **사건 과잉 금지**: plot_beats에 2~3개의 관련된 비트만 설계. 서로 다른 사건을 한 턴에 몰아넣지 말 것.
    - **장면 몰입 우선**: 유저가 현재 상황을 충분히 경험하고 반응할 시간을 확보. "빠르게 다음 사건으로 넘어가기" 금지.
    - **시간대 명시**: \`scene_direction.time_of_day\`에 현재 시간대(아침/오후/저녁/심야)를 설정.
    - 같은 시간대에서 여러 사건이 벌어지면 안 됨. 사건 하나 → 시간 경과 → 다음 사건.
13. **TONE VARIETY (패턴 반복 금지)**:
    - [Recent Decisions]에서 직전 2턴과 같은 톤/패턴의 비트를 설계하지 말 것.
    - 특히 "주인공이 망신당하는" 비트가 2턴 연속이면, 이번 턴에는 **반드시 카타르시스/성공/성장 비트**를 설계.
    - 코미디 → 성장 → 로맨스 → 코미디 등 톤의 **순환**을 의식하라.
14. **CATHARSIS FIRST (카타르시스 우선)**:
    - 주인공이 능력을 사용하는 장면에서는 **반드시 성공의 멋진 순간을 먼저 연출**.
    - 코미디 리액션은 **카타르시스 이후**에만 허용. "능력 사용 → 즉시 실패/망신"은 금지.
    - 힘숨찐 장르의 핵심: 주인공은 **실제로 강하다**. 단지 그 강함이 타인에게 이상하게 보일 뿐.
    - ❌ "검기를 쓰려는데 쥐가 나서 바닥을 굴렀다" (카타르시스 없는 개그)
    - ✅ "검기로 기생체를 완벽히 베었지만, 목격자 눈에는 미친놈이 허공을 벤 것처럼 보였다" (카타르시스 + 개그)
15. **EVENT AGGREGATION BAN (사건 집중 금지)**:
    - 하나의 턴에 **2개 이상의 독립된 사건**을 동시에 발생시키지 말 것.
    - 예: "기생체 전투" + "균열 발생" + "새 캐릭터 등장" = 3개 독립 사건 → ❌ 금지
    - 하나의 사건이 자연스럽게 다음으로 이어지는 것은 허용 (인과관계 있는 연쇄).
    - 단, 인과관계가 있더라도 **한 턴에 완결까지 가는 것은 금지**. 다음 턴으로 이어져야 함.

[Context Requirements Guide]
- combat_characters: Characters who will FIGHT this turn → inject full skill data
- first_encounter: Characters meeting the player for FIRST TIME → inject full appearance
- emotional_focus: Characters in emotional scenes → inject memories & inner personality
- skill_usage: Specific skills that will be used (optional)

[Output Schema (JSON)]
{
    "plot_beats": ["Beat 1", "Beat 2"],
    "emotional_direction": "CharA: emotion / CharB: emotion",
    "tone": "tension → relief",
    "context_requirements": {
        "combat_characters": ["한글이름"],
        "first_encounter": ["한글이름"],
        "emotional_focus": ["한글이름"],
        "skill_usage": { "한글이름": ["skillName"] }
    },
⚠️ context_requirements의 캐릭터 키는 반드시 **한글 이름** (예: "도예린", "왕노야")을 사용하십시오. 영문 ID나 부연 설명을 붙이지 마십시오.
    "subtle_hooks": ["Hook as behavior/atmosphere directive (\u26a0\ufe0f romance/daily mood: non-disruptive hooks ONLY \u2014 no footsteps, shadows, phone rings, arrivals)"],
    "scene_direction": {
        "scene_characters": ["이번 턴에 실제로 등장할 한글이름"],
        "departing_characters": [{"name": "퇴장 캐릭터", "reason": "퇴장 사유"}],
        "time_of_day": "아침|오후|저녁|심야"
    },
    "companion_updates": {
        "add": [{"name": "한글이름", "reason": "함께하는 이유", "type": "mission|bond|escort"}],
        "remove": [{"name": "한글이름", "reason": "이탈 사유"}]
    },
    "state_updates": {
        "momentum_focus": "일상|수련|로맨스|분쟁|탐험",
        "thread_updates": [{"id": "thread_id", "status": "active|paused|resolved", "summary": "..."}],
        "foreshadowing_updates": [{"id": "seed_id", "new_status": "planted|growing|revealed", "hint": "이번 턴에 심은 힌트 (revealed 시 회수 요약)"}]
    }
}`.trim();
    }

    // ===== 유저 프롬프트 (동적 컨텍스트) =====

    private static buildUserPrompt(input: DirectorInput): string {
        const { preLogic, characters, directorState, userInput, location, turnCount, activeGoals, lastTurnSummary, regionalContext, recentHistory, playerProfile, castingSuggestions, gameGuide } = input;

        // 캐릭터 요약
        const charSummary = characters.map(c =>
            `- ${c.name} (${c.title}) [${c.rank}] ${c.faction}${c.identity ? ` | 신분: ${c.identity}` : ''} | 호감도: ${c.relationship} | tags: ${c.tags.join(',')}`
        ).join('\n');

        // Director 이력 (최근 7턴 — 패턴 반복 방지)
        const recentLog = directorState.recentLog.slice(-7).map(log => {
            const chars = log.mentioned_characters?.length ? ` (캐릭터: ${log.mentioned_characters.join(', ')})` : '';
            return `  Turn ${log.turn}: [${log.tone}] ${log.plot_beats.join(' → ')}${chars}`;
        }).join('\n');

        // 떡밥 상태 (오래된 떡밥에 회수/폐기 경고 추가)
        const foreshadowingStatus = directorState.foreshadowing
            .filter(f => f.status !== 'revealed')
            .map(f => {
                const age = turnCount - (f.plantedTurn || 0);
                const urgency = age >= 10 ? ' ⚠️ STALE(회수/폐기 필요)' : age >= 5 ? ' (회수 검토)' : '';
                return `  - [${f.status}] ${f.id}: 힌트 ${f.hints_given.length}회, ${age}턴 경과${urgency} (priority: ${f.priority})`;
            })
            .join('\n');

        // 활성 쓰레드
        const threadStatus = directorState.activeThreads
            .filter(t => t.status === 'active')
            .map(t => `  - [${t.type}] ${t.title}: ${t.summary} (${turnCount - t.lastProgressTurn}턴 정체)`)
            .join('\n');

        // 모멘텀
        const { momentum } = directorState;

        return `${gameGuide ? `[Tone & World Guide (MUST FOLLOW)]
${gameGuide}

` : ''}[PreLogic Judgment]
Mood: ${preLogic.mood || 'daily'} | Score: ${preLogic.score}/10
${preLogic.combat_analysis ? `Combat: ${preLogic.combat_analysis}` : ''}
${preLogic.narrative_guide ? `Action Result: ${preLogic.narrative_guide}` : ''}
${preLogic.location_inference ? `Location: ${preLogic.location_inference}` : ''}

[Player Profile]
${playerProfile}

[Situation]
Turn: ${turnCount} | Location: ${location}
Player Action: "${userInput}"
Last Turn: ${lastTurnSummary || 'N/A'}
Active Goals: ${activeGoals.length > 0 ? activeGoals.join(', ') : 'None'}
${recentHistory ? `\n[Recent Story Flow]\n${recentHistory}` : ''}

${regionalContext}

[Characters Present]
${charSummary || 'None'}

[Casting Candidates (이번 턴 등장 가능)]
${castingSuggestions || 'None'}

[Director Memory]
Momentum: ${momentum.currentFocus} (${momentum.focusDuration}턴째)
Last Major Event: ${momentum.lastMajorEvent || 'None'} (Turn ${momentum.lastMajorEventTurn})

Recent Decisions:
${recentLog || '  (First turn)'}

Active Threads:
${threadStatus || '  None'}

Foreshadowing Seeds:
${foreshadowingStatus || '  None'}

[Companions (현재 동행 중)]
${(directorState.companions || []).length > 0
                ? (directorState.companions as any[]).map(c =>
                    `- ${c.name} [${c.type}] "${c.reason}" (Turn ${c.since_turn}부터)`
                ).join('\n')
                : '  동행자 없음'}
⚠️ 동행자는 함께 이동 중이므로 scene_characters에 **자동 포함**됩니다. 매 턴 대화할 필요는 없지만 잠재적으로 함께 있는 상태입니다.
동행자를 분리하려면 companion_updates.remove를 사용하세요. 새 동행자를 추가하려면 companion_updates.add를 사용하세요.

${input.growthGuide ? `${input.growthGuide}\n` : ''}[INSTRUCTION]
Design this turn's plot. Be concise. Maximum 2-3 beats.
⚠️ YOU MUST follow the [Tone & World Guide] above — it defines the game's genre, world, and rules. Do NOT invent content from other genres.
${turnCount <= 1 ? '⚠️ This is the FIRST TURN. Introduce the world gently per the game guide. Do not assume any prior story context.' : ''}
⚠️ **CATHARSIS CHECK**: If the player is using abilities, the plot beats MUST show SUCCESS first, comedy AFTER.
⚠️ **PATTERN CHECK**: Review [Recent Decisions] — if last 2 turns had same tone/pattern, SWITCH tone this turn.
Respect the mood, pacing, and regional context.
You may incorporate Casting Candidates into plot_beats if they fit the situation naturally.

⚠️ [씬 캐스팅 판단 (CRITICAL — 반드시 scene_direction 출력 필수)]
- **동행자 자동 포함**: [Companions]에 있는 캐릭터는 scene_characters에 **반드시 포함**. 별도 퇴장 지시(companion_updates.remove) 없이는 절대 제외 금지.
- **1단계: 동행 판단** — [Characters Present]의 각 캐릭터에 대해:
  - "이 인물이 지금 주인공과 함께 이동/행동 중인 상황인가?"
  - 함께 이동 중, 같은 장소에서 용건 진행 중 → scene_characters에 포함
  - 이전에 만났지만 각자 행동 중인 인물 → scene_characters에서 **제외**
- **2단계: 퇴장 설계** — 용건이 끝난 캐릭터는 departing_characters에 사유와 함께 명시
  - 퇴장 사유 예: "업무 복귀", "다른 약속", "각자 귀가", "상황 종료"
- **3단계: 신규 등장** — Casting Candidates에서 이 장소+시간+맥락에 자연스럽게 있을 인물만 선택
  - ❌ 금지: 다른 장소에 있던 캐릭터가 아무 이유 없이 현 장소에 등장 (텔레포트)
- **4단계: 동행자 관리** — 새 에피소드/임무를 함께하기로 한 캐릭터는 companion_updates.add로 등록.
  - mission: 사건/임무 동행 (해당 사건 해결 시 companion_updates.remove)
  - bond: 관계 기반 동행 (메인 히로인, 장기 동행)
  - escort: 호위/안내 (목적지 도착 시 해제)

⚠️ [템포 제어 (CRITICAL)]
- **하나의 에피소드에 집중**: plot_beats는 2~3개의 관련된 비트만 설계. 서로 다른 사건을 한 턴에 몰아넣지 말 것.
- **몰입 우선**: 유저가 현재 상황을 충분히 경험하고 반응할 시간을 확보. 사건이 해결되자마자 다음 사건으로 넘어가지 말 것.
- **시간대 설정 필수**: scene_direction.time_of_day를 반드시 출력 (아침/오후/저녁/심야)

⚠️ [캐릭터 등퇴장 패턴 규칙]
- **목적 기반 등장**: 등장할 때는 반드시 용건/목적이 있어야 합니다.
- **"등장 → 리액션 → 즉시 퇴장" 패턴 금지**: 의미 있는 캐릭터가 "헐!" 하고 바로 떠나는 전개는 비현실적.
- **엑스트라 예외**: 행인, 점원, 택시기사 등 일회성 역할은 짧은 등퇴장 허용.

⚠️ [캐릭터 식별자 규칙 (CRITICAL)]
- context_requirements, plot_beats, subtle_hooks, scene_direction 등 **모든 출력에서 반드시 한글 이름** 사용.
- [Characters Present]와 [Casting Candidates]에 표시된 한글 이름을 그대로 사용.
- ❌ 금지: 영문 ID, 괄호 부연, 축약, 별명
- ✅ 정확한 예: "연화린", "남궁세아", "왕노야", "도예린"`;
    }

    // ===== Fallback =====

    private static fallback(input: DirectorInput): DirectorOutput {
        return {
            plot_beats: ['유저 행동에 자연스럽게 반응'],
            emotional_direction: '',
            tone: '자연스럽게',
            context_requirements: {
                combat_characters: [],
                first_encounter: [],
                emotional_focus: [],
            },
            subtle_hooks: [],
            _debug_prompt: '[Fallback] Director API unavailable',
        };
    }

    // ===== DirectorState 업데이트 유틸 =====

    /**
     * Director 출력과 PostLogic 결과를 받아 DirectorState를 업데이트합니다.
     * orchestrator에서 턴 종료 시 호출.
     */
    static updateState(
        currentState: DirectorState,
        directorOutput: DirectorOutput,
        turnCount: number
    ): DirectorState {
        const newState = { ...currentState };

        // 1. Director Log 추가 (최근 7턴 유지 — 캐릭터 반복 방지)
        // context_requirements에서 언급된 캐릭터 추출
        const cr = directorOutput.context_requirements;
        const mentionedChars = Array.from(new Set([
            ...(cr?.combat_characters || []),
            ...(cr?.first_encounter || []),
            ...(cr?.emotional_focus || []),
        ]));
        const logEntry: DirectorLogEntry = {
            turn: turnCount,
            plot_beats: directorOutput.plot_beats,
            subtle_hooks_used: directorOutput.subtle_hooks,
            tone: directorOutput.tone,
            mentioned_characters: mentionedChars,
        };
        newState.recentLog = [...currentState.recentLog.slice(-6), logEntry];

        // 2. 모멘텀 업데이트
        if (directorOutput.state_updates?.momentum_focus) {
            const newFocus = directorOutput.state_updates.momentum_focus;
            if (newFocus === currentState.momentum.currentFocus) {
                newState.momentum = {
                    ...currentState.momentum,
                    focusDuration: currentState.momentum.focusDuration + 1
                };
            } else {
                newState.momentum = {
                    ...currentState.momentum,
                    currentFocus: newFocus,
                    focusDuration: 1
                };
            }
        } else {
            newState.momentum = {
                ...currentState.momentum,
                focusDuration: currentState.momentum.focusDuration + 1
            };
        }

        // 3. 떡밥 상태 업데이트
        if (directorOutput.state_updates?.foreshadowing_updates) {
            const updatedForeshadowing = [...currentState.foreshadowing];
            for (const update of directorOutput.state_updates.foreshadowing_updates) {
                const idx = updatedForeshadowing.findIndex(f => f.id === update.id);
                if (idx >= 0) {
                    updatedForeshadowing[idx] = {
                        ...updatedForeshadowing[idx],
                        status: update.new_status as any,
                        plantedTurn: updatedForeshadowing[idx].plantedTurn || turnCount,
                        hints_given: update.hint
                            ? [...updatedForeshadowing[idx].hints_given, `[T${turnCount}] ${update.hint}`]
                            : updatedForeshadowing[idx].hints_given,
                    };
                }
            }
            newState.foreshadowing = updatedForeshadowing;
        }

        // 4. 서사 쓰레드 업데이트
        if (directorOutput.state_updates?.thread_updates) {
            const updatedThreads = [...currentState.activeThreads];
            for (const update of directorOutput.state_updates.thread_updates) {
                const idx = updatedThreads.findIndex(t => t.id === update.id);
                if (idx >= 0) {
                    updatedThreads[idx] = {
                        ...updatedThreads[idx],
                        status: update.status as any,
                        summary: update.summary,
                        lastProgressTurn: turnCount,
                    };
                }
            }
            newState.activeThreads = updatedThreads;
        }

        // 5. 동행자(Companions) 업데이트
        const currentCompanions = [...(currentState.companions || [])];
        if (directorOutput.companion_updates) {
            let updatedCompanions = currentCompanions;

            // Remove companions
            if (directorOutput.companion_updates.remove && directorOutput.companion_updates.remove.length > 0) {
                const removeNames = new Set(directorOutput.companion_updates.remove.map(r => r.name));
                updatedCompanions = updatedCompanions.filter(c => !removeNames.has(c.name));
                console.log(`[Director] Companions removed: ${directorOutput.companion_updates.remove.map(r => `${r.name}(${r.reason})`).join(', ')}`);
            }

            // Add new companions (avoid duplicates)
            if (directorOutput.companion_updates.add && directorOutput.companion_updates.add.length > 0) {
                for (const newComp of directorOutput.companion_updates.add) {
                    if (!updatedCompanions.some(c => c.name === newComp.name)) {
                        updatedCompanions.push({
                            name: newComp.name,
                            reason: newComp.reason,
                            since_turn: turnCount,
                            type: newComp.type || 'mission',
                        });
                        console.log(`[Director] Companion added: ${newComp.name} [${newComp.type}] "${newComp.reason}"`);
                    }
                }
            }

            newState.companions = updatedCompanions;
        } else {
            newState.companions = currentCompanions;
        }

        return newState;
    }
}
