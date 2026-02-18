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
1. **Plot Planning**: Design 3-5 plot beats for this turn based on the situation.
2. **Context Requirements**: Tell the system which character data is needed.
3. **Subtle Hooks**: Plant foreshadowing hints as BEHAVIOR/ATMOSPHERE directives.
4. **Tone Setting**: Set the emotional tone for the turn.
5. **Regional Awareness**: Use the Regional Landscape data to make geopolitically coherent decisions.

[ABSOLUTE RULES]
1. **NO SPOILERS**: Never reveal the "truth" behind foreshadowing in your output.
   - ✅ "${goodEx}"
   - ❌ "${badEx}"
2. **RESPECT PRELOGIC**: If plausibility_score is low (1-3), the action MUST fail.
3. **PACING**: Don't force drama every turn. If the mood is peaceful, keep it peaceful.
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

[Context Requirements Guide]
- combat_characters: Characters who will FIGHT this turn → inject full skill data
- first_encounter: Characters meeting the player for FIRST TIME → inject full appearance
- emotional_focus: Characters in emotional scenes → inject memories & inner personality
- skill_usage: Specific skills that will be used (optional)

[Output Schema (JSON)]
{
    "plot_beats": ["Beat 1", "Beat 2", "Beat 3"],
    "emotional_direction": "CharA: emotion / CharB: emotion",
    "tone": "tension → relief",
    "context_requirements": {
        "combat_characters": ["한글이름"],
        "first_encounter": ["한글이름"],
        "emotional_focus": ["한글이름"],
        "skill_usage": { "한글이름": ["skillName"] }
    },
⚠️ context_requirements의 캐릭터 키는 반드시 **한글 이름** (예: "도예린", "왕노야")을 사용하십시오. 영문 ID나 부연 설명을 붙이지 마십시오.
    "subtle_hooks": ["Hook as behavior/atmosphere directive"],
    "state_updates": {
        "momentum_focus": "일상|수련|로맨스|분쟁|탐험",
        "thread_updates": [{"id": "thread_id", "status": "active|paused|resolved", "summary": "..."}],
        "foreshadowing_updates": [{"id": "seed_id", "new_status": "planted|growing", "hint": "이번 턴에 심은 힌트"}]
    }
}`.trim();
    }

    // ===== 유저 프롬프트 (동적 컨텍스트) =====

    private static buildUserPrompt(input: DirectorInput): string {
        const { preLogic, characters, directorState, userInput, location, turnCount, activeGoals, lastTurnSummary, regionalContext, recentHistory, playerProfile, castingSuggestions, gameGuide } = input;

        // 캐릭터 요약
        const charSummary = characters.map(c =>
            `- ${c.name} (${c.title}) [${c.rank}] ${c.faction} | 호감도: ${c.relationship} | tags: ${c.tags.join(',')}`
        ).join('\n');

        // Director 이력 (최근 7턴 — 패턴 반복 방지)
        const recentLog = directorState.recentLog.slice(-7).map(log => {
            const chars = log.mentioned_characters?.length ? ` (캐릭터: ${log.mentioned_characters.join(', ')})` : '';
            return `  Turn ${log.turn}: [${log.tone}] ${log.plot_beats.join(' → ')}${chars}`;
        }).join('\n');

        // 떡밥 상태
        const foreshadowingStatus = directorState.foreshadowing
            .filter(f => f.status !== 'revealed')
            .map(f => `  - [${f.status}] ${f.id}: 힌트 ${f.hints_given.length}회 (priority: ${f.priority})`)
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

[INSTRUCTION]
Design this turn's plot. Be concise.
⚠️ YOU MUST follow the [Tone & World Guide] above — it defines the game's genre, world, and rules. Do NOT invent content from other genres.
${turnCount <= 1 ? '⚠️ This is the FIRST TURN. Introduce the world gently per the game guide. Do not assume any prior story context.' : ''}
Respect the mood, pacing, and regional context.
You may incorporate Casting Candidates into plot_beats if they fit the situation naturally.

⚠️ [캐릭터 등퇴장 패턴 규칙 (CRITICAL)]
- **목적 기반 등장**: 캐릭터가 등장할 때는 반드시 **용건/목적**이 있어야 합니다. 그 목적이 해결되거나 실패할 때까지 함께 행동하는 것이 자연스럽습니다.
- **"등장 → 리액션 → 즉시 퇴장" 패턴 금지**: 의미 있는 캐릭터가 등장해서 "헐!" 하고 놀란 뒤 바로 떠나는 전개는 비현실적입니다.
- **엑스트라 예외**: 행인, 점원, 택시기사 등 일회성 역할은 짧은 등퇴장이 허용됩니다.
- **자연스러운 퇴장**: 퇴장 시에도 이유가 있어야 합니다 (약속, 전화, 업무 등).

⚠️ [캐릭터 식별자 규칙 (CRITICAL)]
- context_requirements, plot_beats, subtle_hooks 등 **모든 출력에서 캐릭터를 지칭할 때 반드시 한글 이름**을 사용하십시오.
- [Characters Present]와 [Casting Candidates]에 표시된 한글 이름을 그대로 사용하십시오.
- ❌ 금지: 영문 ID, 괄호 부연("왕노야(사부)"), 축약("세아"), 별명
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

        return newState;
    }
}
