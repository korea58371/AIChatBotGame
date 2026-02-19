
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

/**
 * 캐릭터 프로필 동적 업데이트 인터페이스.
 * 이야기 진행 중 발견되는 설정 정보(거주지, 취미, 트라우마 등)를 구조적으로 저장.
 */
export interface CharacterProfileUpdate {
    residence?: string;         // 거주지 (예: "약왕곡 본당 옆 초가집", "주인공 옆집")
    occupation?: string;        // 직업/하는 일 (예: "떡장사", "순찰 병사")
    daily_routine?: string;     // 일과/루틴 (예: "매일 새벽 약초를 캔다")
    trauma?: string;            // 트라우마 (예: "어린 시절 전염병으로 가족을 잃음")
    fears?: string[];           // 두려워하는 것 (예: ["고소공포증", "어둠"])
    dreams?: string;            // 꿈/목표 (예: "천하제일인이 되는 것")
    hobbies?: string[];         // 취미 (예: ["낚시", "바둑"])
    specialties?: string[];     // 특기 (예: ["요리", "추리"])
    favorite_food?: string;     // 좋아하는 음식 (예: "마라탕")
    backstory?: string;         // 배경 스토리 (예: "과거 전쟁에서 부모를 잃고 방랑")
    family?: Record<string, string>; // 가족 관계 (예: {"어머니": "일찍 돌아가심", "여동생": "현재 아카데미 재학 중"})
}

export interface AgentMemoryOutput {
    character_memories: Record<string, TaggedMemory[]>;
    world_events: WorldEvent[];
    profile_updates: Record<string, CharacterProfileUpdate>;
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
    const PERMANENT_TAGS = ['secret', 'trauma', 'growth', 'fact'];
    if (PERMANENT_TAGS.includes(tag) && importance >= 1) {
        return null; // 영구 보존 (fact는 importance 1부터 영구)
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

        return `당신은 '기록관(記錄官)'입니다. 이번 턴의 대화를 분석하여 세 가지를 추출합니다:
1. **캐릭터 기억**: 장기적으로 기억할 가치가 있는 사건
2. **세계 사건**: 세계/지역 차원의 중대 사건
3. **프로필 업데이트**: 캐릭터에 대해 새로 발견된 설정 정보 (거주지, 취미, 트라우마 등)

[역할]
- 이번 턴에서 발생한 중요한 사건, 감정 변화, 약속, 비밀, 갈등을 캐릭터별로 분류하여 기록합니다.
- 일상적인 인사, 이동, 반복 행동은 기록하지 않습니다.
- 이야기 속에서 드러난 캐릭터의 **설정 정보**(어디 사는지, 무슨 일을 하는지, 과거사 등)를 구조적으로 추출합니다.

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
- fact: 새로 발견된 사실/정보 (예: "옆집에 산다", "고소공포증이 있다", "요리를 잘한다")
- general: 위 태그에 해당하지 않는 일반 기억

[중요도]
- 1: 일상적 (가벼운 대화, 소소한 사건)
- 2: 중요 (관계 변화, 전투 결과, 중요 발견)
- 3: 핵심 (인생 전환점, 죽음, 배신, 핵심 비밀)

[Output Schema (JSON)]
{
  "character_memories": {
    "소소": [
      { "text": "기억 내용", "tag": "bond", "importance": 2, "subject": "주인공", "keywords": ["식사", "야시장"] }
    ]
  },
  "world_events": [
    { "text": "세계 사건 내용", "scope": "local" }
  ],
  "profile_updates": {
    "소소": {
      "residence": "주인공 옆집",
      "hobbies": ["낚시"]
    }
  }
}

[필드 설명 - character_memories]
- text: 기억 내용. ⚠️ **5W1H 원칙으로 구체적으로 기록하세요.**
  - 반드시 포함: **누가(who)** + **무엇을(what)** + **어떻게(how)** + **감정 반응(emotion)**
  - 가능하면 포함: **장소(where)**, **이유/원인(why)**
  - ❌ BAD: "장난에 경악했다" (누가? 왜? 어떻게 반응?)
  - ❌ BAD: "좀비처럼 행동했다" (뭘 했길래? 누가 봤나?)
  - ❌ BAD: "수치심을 느꼈다" (무엇 때문에? 어떤 행동으로 이어졌나?)
  - ✅ GOOD: "아레나 시험장에서 극심한 공복 탓에 매점 시계를 먹겠다며 무대 위에서 망가지는 김수호를 직접 목격하고, 극도의 수치심에 관중석에서 이탈해 화장실에 숨어 울었다"
  - ✅ GOOD: "김현우가 '같이 목욕하자'고 장난치자 얼굴이 새빨개진 채 냄비뚜껑을 집어 들고 극도로 거부하며 방어 자세를 취했다"
- subject: 이 기억이 **누구에 대한 것인지**. ⚠️ 필수! 반드시 한글 이름.
  - 특정 인물과의 상호작용이면 그 인물 이름 (예: "김현우", "주인공")
  - 자기 자신에 대한 것이면 "자신"
- keywords: 핵심 키워드 1~3개 (명사/동사 위주)

[필드 설명 - profile_updates]
프로필을 갱신할 만한 **새로운 설정 정보**가 나왔을 때만 기록하세요. 이미 캐릭터 데이터에 있는 정보는 기록하지 마세요.
사용 가능한 필드:
- residence: 거주지 ("약왕곡 초가집", "주인공 옆집")
- occupation: 직업/하는 일
- daily_routine: 일과/루틴
- trauma: 트라우마/상처
- fears: 두려워하는 것 (배열)
- dreams: 꿈/목표
- hobbies: 취미 (배열)
- specialties: 특기 (배열)
- favorite_food: 좋아하는 음식
- backstory: 배경 스토리 (간결하게)
- family: 가족 관계 ({"관계": "설명"})

[규칙]
1. 기억과 프로필은 무조건 **한국어**로 작성하세요.
2. ⚠️ 캐릭터 키는 반드시 **한글 이름**을 사용하세요. 영문 ID 절대 사용 금지.
3. 기억할 내용이 없으면 빈 객체 반환: { "character_memories": {}, "world_events": [], "profile_updates": {} }
4. 플레이어(주인공)의 기억도 "주인공" 키로 기록 가능.
5. 한 캐릭터당 기억 최대 **5개**, 프로필 업데이트 최대 **3개 필드**.
6. subject는 반드시 기입. 기억은 반드시 **원인 → 결과** 구조로 작성.
7. keywords는 1~3개의 짧은 단어.
8. world_events는 세계/지역 차원의 사건만. scope: local / regional / global.
9. profile_updates는 **이번 턴에서 새로 밝혀진 정보**만. 이미 알려진 정보 중복 기록 금지.
10. JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`;
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
            profile_updates: {},
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
${storyText.slice(0, 6000)}

위 내용을 분석하여 기억할 가치가 있는 사건을 JSON으로 추출하세요.`;

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: MODEL_CONFIG.MEMORY,
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
            const VALID_TAGS = ['bond', 'conflict', 'secret', 'trauma', 'growth', 'promise', 'fact', 'general'] as const;

            const characterMemories: Record<string, TaggedMemory[]> = {};
            if (parsed.character_memories && typeof parsed.character_memories === 'object') {
                Object.entries(parsed.character_memories).forEach(([charId, memories]: [string, any]) => {
                    if (!Array.isArray(memories)) return;
                    characterMemories[charId] = memories
                        .filter((m: any) => m && typeof m.text === 'string' && m.text.trim())
                        .slice(0, 5) // Max 5 per character per turn
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

            // [NEW] Profile Updates 파싱 및 정규화
            const VALID_PROFILE_FIELDS = [
                'residence', 'occupation', 'daily_routine', 'trauma',
                'fears', 'dreams', 'hobbies', 'specialties',
                'favorite_food', 'backstory', 'family'
            ] as const;

            const profileUpdates: Record<string, CharacterProfileUpdate> = {};
            if (parsed.profile_updates && typeof parsed.profile_updates === 'object') {
                Object.entries(parsed.profile_updates).forEach(([charId, updates]: [string, any]) => {
                    if (!updates || typeof updates !== 'object') return;
                    const clean: any = {};
                    let fieldCount = 0;

                    for (const field of VALID_PROFILE_FIELDS) {
                        if (fieldCount >= 3) break; // Max 3 fields per character per turn
                        const val = updates[field];
                        if (val === undefined || val === null || val === '') continue;

                        // 배열 필드 정규화
                        if (['fears', 'hobbies', 'specialties'].includes(field)) {
                            if (Array.isArray(val)) {
                                const arr = val.filter((v: any) => typeof v === 'string' && v.trim()).map((v: string) => v.trim());
                                if (arr.length > 0) { clean[field] = arr; fieldCount++; }
                            } else if (typeof val === 'string' && val.trim()) {
                                clean[field] = [val.trim()]; fieldCount++;
                            }
                        }
                        // 객체 필드 정규화 (family)
                        else if (field === 'family') {
                            if (typeof val === 'object' && !Array.isArray(val)) {
                                const famClean: Record<string, string> = {};
                                Object.entries(val).forEach(([k, v]) => {
                                    if (typeof k === 'string' && typeof v === 'string') {
                                        famClean[k.trim()] = (v as string).trim();
                                    }
                                });
                                if (Object.keys(famClean).length > 0) { clean[field] = famClean; fieldCount++; }
                            }
                        }
                        // 문자열 필드 정규화
                        else {
                            if (typeof val === 'string' && val.trim()) {
                                clean[field] = val.trim(); fieldCount++;
                            }
                        }
                    }

                    if (Object.keys(clean).length > 0) {
                        profileUpdates[charId] = clean;
                    }
                });
            }

            const profileCount = Object.keys(profileUpdates).length;
            console.log(`[AgentMemory] Generated: ${Object.keys(characterMemories).length} chars, ${worldEvents.length} world events, ${profileCount} profile updates`);

            return {
                character_memories: characterMemories,
                world_events: worldEvents,
                profile_updates: profileUpdates,
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
