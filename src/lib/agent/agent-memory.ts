
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../ai/model-config';
import { TaggedMemory, WorldEvent } from '../store';

// [Helper] JSON 정제 함수 (Markdown Code Block 제거)
function cleanJsonText(text: string): string {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : text;
}

// Safety settings (매우 관대)
const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
    { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any },
];

export interface AgentMemoryOutput {
    character_memories: Record<string, TaggedMemory[]>;
    world_events: WorldEvent[];
    _debug_system_prompt?: string;
    _debug_prompt?: string;
    _debug_output?: any;
    usageMetadata?: any;
}

/**
 * [NEW] 기억 소멸(Decay) 규칙 계산
 * 태그와 중요도에 따라 기억의 만료 턴을 결정합니다.
 *
 * | 카테고리 | 조건                                          | 수명    |
 * |----------|-----------------------------------------------|---------|
 * | 영구     | secret, trauma, growth (importance ≥ 2)       | ∞ (null)|
 * | 장기     | bond, conflict, promise (importance ≥ 2)      | 50턴    |
 * | 중기     | importance = 1, tag ≠ general                 | 20턴    |
 * | 단기     | general                                       | 10턴    |
 */
function computeExpiry(
    tag: string,
    importance: number,
    currentTurn: number
): number | null {
    // 영구: 핵심 기억은 절대 소멸하지 않음
    const PERMANENT_TAGS = ['secret', 'trauma', 'growth'];
    if (PERMANENT_TAGS.includes(tag) && importance >= 2) {
        return null; // 영구 보존
    }

    // 장기: 관계/갈등/약속 (중요도 2 이상)
    const LONG_TERM_TAGS = ['bond', 'conflict', 'promise'];
    if (LONG_TERM_TAGS.includes(tag) && importance >= 2) {
        return currentTurn + 50;
    }

    // 중기: 일반이 아닌 태그의 낮은 중요도
    if (tag !== 'general' && importance >= 1) {
        return currentTurn + 20;
    }

    // 단기: general 태그
    return currentTurn + 10;
}

/**
 * AgentMemory: 스토리 텍스트를 분석하여 캐릭터별 태그 기억 + 세계 사건을 생성하는 독립 에이전트.
 * PostLogic의 character_memories를 대체하며, Phase 2 파이프라인에서 병렬 실행됩니다.
 */
export class AgentMemory {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

    static getSystemPrompt(activeCharacterIds: string[], turnCount: number): string {
        const charList = activeCharacterIds.length > 0
            ? activeCharacterIds.join(', ')
            : '(없음)';

        return `당신은 '기록관(記錄官)'입니다. 이번 턴의 대화를 분석하여 **장기적으로 기억할 가치가 있는 사건**만 추출합니다.

[역할]
- 이번 턴에서 발생한 중요한 사건, 감정 변화, 약속, 비밀, 갈등을 캐릭터별로 분류하여 기록합니다.
- 일상적인 인사, 이동, 반복 행동은 기록하지 않습니다.
- 세계 차원의 중대 사건(팩션 변동, 전쟁, 자연재해 등)도 별도 기록합니다.

[현재 등장 캐릭터]
${charList}

[현재 턴]
${turnCount}

[태그 분류]
- bond: 유대감, 우정, 사랑, 협력 관계 형성
- conflict: 갈등, 적대, 대립, 배신
- secret: 비밀 공유, 은밀한 정보, 숨겨진 진실 발견
- trauma: 트라우마, 부상, 상실, 충격적 경험
- growth: 성장, 새로운 무공/기술 습득, 승급, 깨달음
- promise: 약속, 맹세, 거래, 계약
- general: 위 태그에 해당하지 않는 일반 기억

[중요도]
- 1: 일상적 (가벼운 대화, 소소한 사건)
- 2: 중요 (관계 변화, 전투 결과, 중요 발견)
- 3: 핵심 (인생 전환점, 죽음, 배신, 핵심 비밀)

[Output Schema (JSON)]
{
  "character_memories": {
    "소소": [
      { "text": "기억 내용 (한국어)", "tag": "bond", "importance": 2, "subject": "주인공", "keywords": ["식사", "야시장"] }
    ]
  },
  "world_events": [
    { "text": "세계 사건 내용 (한국어)", "scope": "local" }
  ]
}

[필드 설명]
- subject: 이 기억이 **누구에 대한 것인지** (예: "주인공", "소소", "남궁세아"). 반드시 한글 이름.
- keywords: SNS 해시태그처럼 기억의 핵심 키워드 1~3개 (예: ["식사", "데이트"], ["전투", "부상"], ["비밀", "고백"])

[규칙]
1. 기억은 무조건 **한국어**로 작성하세요.
2. ⚠️ 캐릭터 키는 반드시 **한글 이름** (예: "소소", "한설희", "남궁세아")을 사용하세요. 영문 ID(예: "soso", "han_seol")는 절대 사용 금지.
3. 이번 턴에 기억할 내용이 없으면 빈 객체를 반환하세요: { "character_memories": {}, "world_events": [] }
4. 플레이어(주인공)의 기억도 "주인공" 키로 기록 가능합니다.
5. 한 캐릭터당 최대 2개의 기억만 기록하세요. 가장 중요한 것만.
6. subject는 반드시 기입하세요. 기억이 특정 인물과의 상호작용이면 그 인물, 자기 자신에 대한 것이면 "자신".
7. keywords는 1~3개의 짧은 단어로. 문장이 아닌 **명사/동사** 위주.
8. world_events는 개인 차원이 아닌 세계/지역 차원의 사건만 기록하세요. scope는:
   - local: 현재 장소/마을 수준
   - regional: 지역/세력 수준
   - global: 세계/대륙 수준
9. JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`;
    }

    /**
     * 스토리 텍스트를 분석하여 캐릭터별 태그 기억 + 세계 사건을 생성합니다.
     */
    static async analyze(
        userInput: string,
        storyText: string,
        gameState: any
    ): Promise<AgentMemoryOutput> {
        const emptyResult: AgentMemoryOutput = {
            character_memories: {},
            world_events: [],
        };

        const apiKey = this.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('[AgentMemory] No API key.');
            return emptyResult;
        }

        const activeCharacterIds = gameState.activeCharacters || [];
        const turnCount = gameState.turnCount || 0;

        const systemPrompt = this.getSystemPrompt(activeCharacterIds, turnCount);

        const userPrompt = `[유저 입력]
${userInput}

[AI 스토리 응답]
${storyText.slice(0, 4000)}

위 내용을 분석하여 기억할 가치가 있는 사건을 JSON으로 추출하세요.`;

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: MODEL_CONFIG.SUMMARY,
                safetySettings,
                systemInstruction: systemPrompt,
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.3,
                },
            });

            const result = await model.generateContent(userPrompt);
            const response = result.response;
            const text = response.text();
            const usageMetadata = response.usageMetadata;

            // Parse JSON
            const cleanText = cleanJsonText(text);
            let parsed: any;
            try {
                parsed = JSON.parse(cleanText);
            } catch (parseErr) {
                console.warn('[AgentMemory] JSON Parse Failed:', parseErr, 'Raw:', text.substring(0, 200));
                return { ...emptyResult, _debug_system_prompt: systemPrompt, _debug_prompt: userPrompt, _debug_output: text, usageMetadata };
            }

            // Validate & Normalize
            const currentLocation = gameState.currentLocation || '';
            const VALID_TAGS = ['bond', 'conflict', 'secret', 'trauma', 'growth', 'promise', 'general'] as const;

            const characterMemories: Record<string, TaggedMemory[]> = {};
            if (parsed.character_memories && typeof parsed.character_memories === 'object') {
                Object.entries(parsed.character_memories).forEach(([charId, memories]: [string, any]) => {
                    if (!Array.isArray(memories)) return;
                    characterMemories[charId] = memories
                        .filter((m: any) => m && typeof m.text === 'string' && m.text.trim())
                        .slice(0, 2) // Max 2 per character
                        .map((m: any) => {
                            const tag = VALID_TAGS.includes(m.tag) ? m.tag : 'general';
                            const importance: 1 | 2 | 3 = [1, 2, 3].includes(m.importance) ? m.importance : 1;

                            // [NEW] 소멸 규칙 계산
                            const expireAfterTurn = computeExpiry(tag, importance, turnCount);

                            // [NEW] keywords 정규화 (문자열 배열, 최대 3개)
                            const keywords = Array.isArray(m.keywords)
                                ? m.keywords.filter((k: any) => typeof k === 'string' && k.trim()).slice(0, 3).map((k: string) => k.trim())
                                : undefined;

                            return {
                                text: m.text.trim(),
                                tag,
                                turn: turnCount,
                                importance,
                                subject: typeof m.subject === 'string' && m.subject.trim() ? m.subject.trim() : undefined,
                                location: currentLocation || undefined,
                                keywords: keywords && keywords.length > 0 ? keywords : undefined,
                                expireAfterTurn,
                            } as TaggedMemory;
                        });
                });
            }

            const worldEvents: WorldEvent[] = [];
            if (Array.isArray(parsed.world_events)) {
                parsed.world_events
                    .filter((e: any) => e && typeof e.text === 'string' && e.text.trim())
                    .slice(0, 3) // Max 3 world events per turn
                    .forEach((e: any) => {
                        worldEvents.push({
                            text: e.text.trim(),
                            turn: turnCount,
                            scope: ['local', 'regional', 'global'].includes(e.scope) ? e.scope : 'local',
                        });
                    });
            }

            console.log(`[AgentMemory] Generated: ${Object.keys(characterMemories).length} chars, ${worldEvents.length} world events`);

            return {
                character_memories: characterMemories,
                world_events: worldEvents,
                _debug_system_prompt: systemPrompt,
                _debug_prompt: userPrompt,
                _debug_output: parsed,
                usageMetadata,
            };
        } catch (error: any) {
            console.error('[AgentMemory] Failed:', error.message || error);
            return { ...emptyResult, _debug_system_prompt: systemPrompt, _debug_prompt: userPrompt };
        }
    }
}
