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
            systemInstruction: this.buildSystemPrompt()
        });

        const userPrompt = this.buildUserPrompt(input);

        try {
            const result = await model.generateContent(userPrompt);
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

    private static buildSystemPrompt(): string {
        return `You are the [Narrative Director] of a martial arts (Wuxia) RPG.
Your role is to PLAN the story for this turn — NOT to write it.

[World Setting]
이 세계는 중원 무림이다. 정파(무림맹), 사파(패천맹), 마교(천마신교)가 삼분하고 있다.
새외세력(북해빙궁, 남만야수궁)과 관부(황실/금의위)가 별도 존재.
무공 등급: 삼류 → 이류 → 일류 → 절정 → 화경 (최상위).
플레이어는 성장 중인 강호인이다.

[Your Responsibilities]
1. **Plot Planning**: Design 3-5 plot beats for this turn based on the situation.
2. **Context Requirements**: Tell the system which character data is needed.
3. **Subtle Hooks**: Plant foreshadowing hints as BEHAVIOR/ATMOSPHERE directives.
4. **Tone Setting**: Set the emotional tone for the turn.
5. **Regional Awareness**: Use the Regional Landscape data to make geopolitically coherent decisions.

[ABSOLUTE RULES]
1. **NO SPOILERS**: Never reveal the "truth" behind foreshadowing in your output.
   - ✅ "왕노야가 주인공의 검을 유심히 관찰한다"
   - ❌ "왕노야가 검이 마교 비급과 관련됨을 알아차린다"
2. **RESPECT PRELOGIC**: If plausibility_score is low (1-3), the action MUST fail.
3. **PACING**: Don't force drama every turn. If the mood is peaceful, keep it peaceful.
4. **BREVITY**: Use keywords and fragments, not full sentences.
5. **REGIONAL COHERENCE**: Don't reference factions/events from distant regions without reason.

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
        "combat_characters": ["charId"],
        "first_encounter": ["charId"],
        "emotional_focus": ["charId"],
        "skill_usage": { "charId": ["skillName"] }
    },
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
        const { preLogic, characters, directorState, userInput, location, turnCount, activeGoals, lastTurnSummary, regionalContext, recentHistory, playerProfile, castingSuggestions } = input;

        // 캐릭터 요약
        const charSummary = characters.map(c =>
            `- ${c.name} (${c.title}) [${c.rank}] ${c.faction} | 호감도: ${c.relationship} | tags: ${c.tags.join(',')}`
        ).join('\n');

        // Director 이력 (최근 3턴)
        const recentLog = directorState.recentLog.slice(-3).map(log =>
            `  Turn ${log.turn}: [${log.tone}] ${log.plot_beats.join(' → ')}`
        ).join('\n');

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

        return `[PreLogic Judgment]
Mood: ${preLogic.mood || 'daily'} | Score: ${preLogic.score}/10
${preLogic.combat_analysis ? `Combat: ${preLogic.combat_analysis}` : ''}

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
Design this turn's plot. Be concise. Respect the mood, pacing, and regional context.
You may incorporate Casting Candidates into plot_beats if they fit the situation naturally.`;
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

        // 1. Director Log 추가 (최근 5개 유지)
        const logEntry: DirectorLogEntry = {
            turn: turnCount,
            plot_beats: directorOutput.plot_beats,
            subtle_hooks_used: directorOutput.subtle_hooks,
            tone: directorOutput.tone,
        };
        newState.recentLog = [...currentState.recentLog.slice(-4), logEntry];

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
