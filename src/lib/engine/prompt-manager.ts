import { getMoodPrompts, MoodType } from '../../data/prompts/moods';
import { GameRegistry } from '@/lib/registry/GameRegistry';
import { RelationshipManager } from './relationship-manager';
import { GameState } from '../store';
import { findBestMatchDetail } from '@/lib/utils/name-utils';
import { translations } from '../../data/translations';

/**
 * 기억 필터링 유틸리티 — 중요도/최근성/키워드 기반으로 관련 기억을 추출
 * @param memories - 전체 기억 배열 (string | TaggedMemory 혼합)
 * @param opts.maxCount - 최대 반환 개수
 * @param opts.currentTurn - 현재 턴 (최근성 판별용)
 * @param opts.recentWindow - "최근" 기준 턴 수 (기본 5)
 * @param opts.keywords - 관련성 매칭용 키워드 (Director plot_beats 등)
 */
export function filterMemories(
    memories: any[],
    opts: { maxCount: number; currentTurn: number; recentWindow?: number; keywords?: string[] }
): any[] {
    if (!memories || memories.length === 0) return [];
    const { maxCount, currentTurn, recentWindow = 5, keywords = [] } = opts;
    const lowerKeywords = keywords.map(k => k.toLowerCase());

    // 점수 계산: 중요도 + 최근성 + 키워드 매칭
    const scored = memories.map((m: any) => {
        const isString = typeof m === 'string';
        let score = 0;

        // 중요도
        if (!isString && m.importance) score += m.importance * 10;

        // 최근성 보너스
        if (!isString && m.turn != null) {
            const age = currentTurn - m.turn;
            if (age <= recentWindow) score += 15; // 최근 윈도우 내
            else if (age <= recentWindow * 3) score += 5; // 중기
        }

        // 영구 기억 보너스
        if (!isString && m.expireAfterTurn === null) score += 5;

        // 키워드 매칭 보너스
        if (lowerKeywords.length > 0 && !isString) {
            const memKeywords = (m.keywords || []).map((k: string) => k.toLowerCase());
            const memText = (m.text || '').toLowerCase();
            const memSubject = (m.subject || '').toLowerCase();
            const memTag = (m.tag || '').toLowerCase();
            for (const kw of lowerKeywords) {
                if (memKeywords.includes(kw)) { score += 20; break; }
                if (memText.includes(kw) || memSubject.includes(kw) || memTag.includes(kw)) { score += 10; break; }
            }
        }

        return { mem: m, score };
    });

    // 점수 내림차순 정렬 후 상위 N개
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxCount).map(s => s.mem);
}

/** 기억을 한 줄 텍스트로 포맷 */
export function formatMemoryLine(m: any): string {
    if (typeof m === 'string') return m;
    const parts: string[] = [];
    if (m.tag && m.tag !== 'general') parts.push(`[${m.tag}]`);
    parts.push(m.text || '');
    if (m.subject) parts.push(`(→${m.subject})`);
    return parts.join(' ');
}


// 캐릭터 등장 조건 (어디서, 언제, 어떤 조건으로 등장할 수 있는지)
interface SpawnRules {
    locations?: string[];       // 등장 가능한 장소 목록
    relatedCharacters?: string[]; // 함께 등장할 확률이 높은 관련 캐릭터들
    minFame?: number;          // 등장을 위해 필요한 최소 명성치
    condition?: string;        // 기타 특수 등장 조건 (자연어)
}

// 통합 캐릭터 인터페이스 (모든 게임 장르의 데이터를 포괄하는 슈퍼셋 구조)
interface Character {
    name: string;              // 캐릭터 이름 (필수)
    이름?: string;             // [레거시] 이전 데이터 호환용 이름
    role?: string;             // 역할 (예: 점소이, 히로인, 악역)
    id?: string;               // 고유 식별자 (없는 경우 이름 사용)
    faction?: string;          // 소속 세력 (무협: 문파 / 판타지: 국가 등)
    title?: string;            // 칭호 (예: 천하제일인)
    quote?: string;            // 대표 대사 (성격 표현용)
    profile?: any;             // 기본 프로필 정보 (나이, 성별 등 KV)
    appearance?: any;          // 외형 묘사 (KV)
    job?: any;                 // 직업 또는 사회적 지위 (KV)
    personality?: any;         // 성격 (문자열 또는 KV)
    preferences?: any;         // 선호/비선호 사항 (KV)
    secret?: any;              // [GM 전용] 캐릭터의 숨겨진 비밀 (스토리 진행용)
    memories?: string[];       // 캐릭터별 기억 (이전 대화 요약 등)
    discoveredSecrets?: string[]; // 플레이어가 알아낸 이 캐릭터의 비밀들
    default_expression?: string;  // 기본 표정 (일러스트 매칭용)
    description?: string;      // 캐릭터에 대한 전반적인 서술형 묘사
    spawnRules?: SpawnRules;   // 등장 규칙 객체
    englishName?: string;      // [시스템] 이미지 생성을 위한 영문 이름

    // 동적 관계 및 대화 스타일 정보
    relationshipInfo?: {
        relation: string;      // 플레이어와의 현재 관계
        callSign: string;      // 플레이어를 부르는 호칭
        speechStyle: string;   // 말투
        endingStyle: string;   // 어미 (~하오, ~다 등)
    };
    relationships?: Record<string, string>; // 타 캐릭터와의 관계도

    // [무협/판타지] 전투 및 강함 관련 수치
    martial_arts_realm?: string | {
        name: string;
        power_level: number;
        description: string;
        skills?: string[];
    };

    // [레거시/무협] 상세 스펙 (한글 키 유지)
    강함?: {
        등급?: string;         // 무공 수위 (화경, 현경 등)
        power_level?: number;  // 전투력 수치
        description?: string;  // 강함에 대한 묘사
        skills?: Record<string, string> | string[]; // 보유 무공/스킬
        내공심법?: Record<string, string>;
        경공술?: Record<string, string>;
    };
    외형?: any;                // [레거시] 한글 키 외형 데이터
    활동지역?: string;         // 주 활동 지역 (레거시)
    인간관계?: Record<string, string>; // [레거시] 한글 키 관계도
    secret_data?: any;         // [신규] 로맨스/심층 상호작용을 위한 상세 비밀 데이터
}

// 토큰 절약을 위한 로직 모델용 경량 캐릭터 구조체
// (AI에게 전체 프롬프트를 넘기기 전, 등장 여부만 판단할 때 사용)
interface LightweightCharacter {
    name: string;              // 이름
    englishName?: string;      // 영문 이름
    role?: string;             // 역할
    spawnRules?: SpawnRules;   // 등장 규칙 (이것만 확인하면 됨)
    description?: string;      // 식별을 위한 짧은 설명
}

// [REMOVED local GameState to use imported store.ts definition]

export class PromptManager {
    static getSpeechStyle(char: any): { style: string, ending: string, callSign: string } | null {
        // 1. Explicit Relationship Info
        if (char.relationshipInfo) {
            const { speechStyle, endingStyle, callSign } = char.relationshipInfo;
            if (speechStyle || endingStyle || callSign) {
                return {
                    style: speechStyle || 'Unknown',
                    ending: endingStyle || 'Unknown',
                    callSign: callSign || ''
                };
            }
        }

        // 2. Legacy Tone
        if (char.tone) {
            return { style: char.tone, ending: 'Unknown', callSign: '' };
        }

        // 3. Inference from Personality/Description
        const searchTarget = JSON.stringify({
            p: char.personality,
            d: char.description,
            pf: char.profile,
            sys: char.system_logic
        }).toLowerCase();

        // Heuristic Keys (Korean & English)
        if (searchTarget.includes('존댓말') || searchTarget.includes('경어') || searchTarget.includes('예의') ||
            searchTarget.includes('polite') || searchTarget.includes('formal') || searchTarget.includes('honorific')) {
            return { style: '존댓말 (Polite/Honorific)', ending: '~해요 / ~습니다', callSign: '' };
        }
        if (searchTarget.includes('반말') || searchTarget.includes('하대') || searchTarget.includes('거만') ||
            searchTarget.includes('casual') || searchTarget.includes('informal') || searchTarget.includes('arrogant') || searchTarget.includes('rude')) {
            return { style: '반말 (Casual/Authoritative)', ending: '~해라 / ~다', callSign: '' };
        }
        if (searchTarget.includes('사투리') || searchTarget.includes('dialect') || searchTarget.includes('accent')) {
            return { style: '사투리 (Dialect)', ending: 'Unknown', callSign: '' };
        }

        return null;
    }

    // [CACHE CONFIG]
    private static readonly CACHE_PREFIX = 'PROMPT_CACHE_';
    private static readonly CACHE_VERSION = 'v2.1'; // Increment this to invalidate all caches

    // [New] Cache Management Methods
    static async clearPromptCache(gameId?: string) {
        if (typeof window === 'undefined') return;

        if (gameId) {
            const key = `${PromptManager.CACHE_PREFIX}${gameId}_${PromptManager.CACHE_VERSION}`;
            localStorage.removeItem(key);
            console.log(`[PromptManager] Cleared cache for: ${gameId}`);
        } else {
            // Clear all game caches
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(PromptManager.CACHE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
            console.log(`[PromptManager] Cleared all prompt caches.`);
        }
    }

    // [게임 정체성 로드]
    // GameRegistry에서 현재 게임의 기본 설정(identity)과 행동 규칙(behaviorRules)을 가져옵니다.
    static async getGameIdentity(state: GameState): Promise<string> {
        let identity = "";

        const config = GameRegistry.get(state.activeGameId);
        if (config) {
            identity = config.identity || "";

            // 행동 규칙이 있다면 추가 (예: 말투 강제, 금지 사항 등)
            if (config.behaviorRules) {
                identity += `\n\n[GAME MECHANICS & STRICT RULES]\n${config.behaviorRules}`;
            }
        }

        return identity;
    }

    // [정적 컨텍스트 생성 및 캐싱]
    // 게임의 세계관, 배경 등 변하지 않는 정보를 로드합니다.
    // 성능 최적화를 위해 브라우저 localStorage에 캐싱(저장)합니다.
    static async getSharedStaticContext(
        state: GameState,
        activeChars?: string,
        spawnCandidates?: string,
        forceRefresh: boolean = false // 강제 재생성 옵션
    ): Promise<string> {
        // [DEBUG] Unconditional Entry Log
        console.log(`[PromptManager] getSharedStaticContext called. ID: '${state.activeGameId}', Force: ${forceRefresh}, CacheVer: ${PromptManager.CACHE_VERSION}`);
        const regStatus = GameRegistry.getAll().map(g => g.id);
        console.log(`[PromptManager] Current Registry Status:`, regStatus);

        // 1. 캐시 키 생성 (네이밍 규칙: PREFIX + 게임ID + 버전 + 페르소나)
        const overrideKey = state.personaOverride ? `_PERSONA_${state.personaOverride}` : '';
        const cacheKey = `${PromptManager.CACHE_PREFIX}${state.activeGameId}_SHARED_${PromptManager.CACHE_VERSION}${overrideKey}`;
        console.log(`[PromptManager] 캐시 키 생성: ${cacheKey}`);

        // 2. 캐시 확인 및 반환 (브라우저 환경일 때만)
        if (typeof window !== 'undefined' && !forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                // [DEBUG] Inspect Cache Content validity
                if (cached.includes("System Error")) {
                    console.warn(`[PromptManager] 캐시에서 에러 메시지 발견. 캐시 무효화 및 재생성 시도.`);
                    localStorage.removeItem(cacheKey);
                } else {
                    console.log(`[PromptManager] 캐시 적중: ${state.activeGameId} - 저장소에서 로드됨`);
                    return cached;
                }
            }
        }

        let context = "";

        // 3. GameRegistry를 통한 컨텍스트 생성 위임 (패턴화된 리팩토링)
        // 하드코딩된 게임 ID 분기 대신, 등록된(Config) 설정 파일의 getStaticContext 메서드를 호출합니다.
        const config = GameRegistry.get(state.activeGameId);
        if (config && config.getStaticContext) {
            try {
                console.log(`[PromptManager] Config Found. Generatig Context for ${state.activeGameId}...`);
                context = await config.getStaticContext(state);
                console.log(`[PromptManager] Context Generated. Length: ${context.length}`);
            } catch (e: any) {
                console.error(`[PromptManager] 정적 컨텍스트 생성 실패 (${state.activeGameId}):`, e);
                context = `System Error: 레지스트리를 통한 컨텍스트 생성 실패 (Ref: ${Date.now()})`;
            }
        } else {
            console.error(`[PromptManager] CRITICAL: 게임 설정을 찾을 수 없습니다. TargetID: '${state.activeGameId}'`);
            console.error(`[PromptManager] Active Registry Keys:`, GameRegistry.getAll().map(g => g.id));
            context = `System Error: 게임 구성 파일 누락 (ID: ${state.activeGameId || 'MISSING'}, Time: ${Date.now()})`;
        }



        // ... Legacy Code Copy (Truncated in verify, but providing Wuxia path is Priority)
        // [Fallthrough to Cache Logic]


        if (context) {
            // [SAVE TO CACHE (Mode Specific)]
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(cacheKey, context);
                    console.log(`[PromptManager] Saved context to cache: ${cacheKey} (${context.length} chars)`);
                } catch (e) {
                    console.warn("[PromptManager] Failed to save to localStorage (Quota exceeded?)", e);
                }
            }
            return context;
        }

        return "System Context Loaded.";
    }


    // [동적 시스템 프롬프트 생성]
    // 게임 상태(state)에 따라 매 턴 변화하는 프롬프트를 생성합니다.
    static generateSystemPrompt(state: GameState, language: 'ko' | 'en' | null, userMessage?: string): string {

        let prompt = "";

        // 1. [우선순위] 동적 템플릿 사용
        // GameRegistry를 통해 로드된 템플릿 함수(getSystemPromptTemplate)가 있다면 이를 최우선으로 사용합니다.
        if (state.getSystemPromptTemplate && typeof state.getSystemPromptTemplate === 'function') {
            console.log(`[PromptManager] 동적 템플릿 사용: ${state.activeGameId}`);
            try {
                // [NEW] Inject computed scenarioContext for prompt templates
                const mem = state.scenarioMemory;
                let scenarioContext = '게임 시작';
                if (mem) {
                    const parts: string[] = [];
                    if (mem.tier2Summaries?.length > 0) {
                        parts.push('[장기 기억]\n' + mem.tier2Summaries.join('\n---\n'));
                    }
                    if (mem.tier1Summaries?.length > 0) {
                        parts.push('[최근 줄거리]\n' + mem.tier1Summaries.join('\n---\n'));
                    }
                    if (parts.length > 0) scenarioContext = parts.join('\n\n');
                }
                const augmentedState = { ...state, scenarioContext };
                prompt = state.getSystemPromptTemplate(augmentedState, language);
            } catch (e) {
                console.error(`[PromptManager] 템플릿 실행 실패:`, e);
                // 실패 시 아래의 기본 포맷으로 대체됩니다.
            }
        }

        // 2. 기본 포맷 (템플릿 실패 시)
        if (!prompt) {
            console.warn("[PromptManager] 템플릿 없음. 기본값 사용.");
            prompt = "System Error: 프롬프트 템플릿 로드 실패.";
        }

        // 2.5 [공통] Narrative Direction Authority & 서술 분량 규칙
        // 게임 모드에 무관하게 모든 Story 모델에 공통 적용되는 규칙
        prompt += `

**[Narrative Direction Authority & Character Spawning]**:
- **REFERENCE, NOT COMMAND**: [Narrative Direction]의 plot_beats와 tone은 이번 턴의 **방향 참고**입니다. 무조건 따르지 마십시오.
- **개연성 검증 (PLAUSIBILITY CHECK)**:
  1. [ACTIVE CHARACTERS]의 인물 정보(성격, 소속, 기억)와 Director의 지시가 모순되면 **인물 정보가 우선**합니다.
  2. 이전 턴의 맥락(대화 흐름, 감정 상태, 장소)에 어울리지 않는 전개는 **보완하거나 부드럽게 전환**하십시오.
  3. 갑작스러운 인물 교체, 분위기 급변은 금지. 기존 장면을 자연스럽게 마무리한 뒤 전환하십시오.
- **SUGGESTION TYPES (인물 등장 유형)**:
  * **[Type: Arrival]**: 해당 캐릭터를 자연스럽게 등장시키되, 이전 맥락과 어울리게 진입 경위를 묘사하십시오.
  * **[Type: Foreshadowing]**: 캐릭터를 직접 등장시키지 말고, 존재의 **힌트**만 심으십시오.
- **우선순위**: [User Input] > 이전 맥락 연속성 > [Narrative Direction]. 유저의 행동 의도를 존중하되, 세계관 룰은 지키십시오.

**[서술 분량 규칙 (⭐ CRITICAL)]**:
- **목표 분량**: 한글 기준 **약 4,000자** (약 8,000 바이트). 짧은 서술은 몰입을 깨뜨립니다.
- **퇴고 의무**: 초안 작성 후, 인물의 성격·기억·관계와 일치하는지 검토하고 보완하십시오.
- **분량 달성 방법**: 아래 [에피소드 미니 아크 구조], [서술-대화 밀도 가이드], [문장 구조 다양성] 프로토콜을 따르십시오. 의미 없는 수식으로 분량을 늘리지 마시오.
`;

        // 3. [캐릭터 정보 주입]
        // 현재 장면에 실제로 존재하는(active) 캐릭터들의 정보만 선별하여 제공합니다.
        // (토큰 절약을 위해 전체 캐릭터 리스트를 넣지 않습니다.)
        const activeCharIds = new Set((state.activeCharacters || []).filter((id: any) => typeof id === 'string').map((id: string) => id.toLowerCase()));

        // ID 기반으로 캐릭터 정보를 포맷팅하여 {{CHARACTER_INFO}} 위치에 삽입
        const activeCharInfo = PromptManager.getActiveCharacterProps(state, Array.from(activeCharIds).sort(), language);
        prompt = prompt.replace('{{CHARACTER_INFO}}', activeCharInfo);

        // 4. [장소 컨텍스트 주입] - 환각(Hallucination) 방지
        // 현재 장소의 주인, 세력 등 중요한 메타데이터가 있다면 강제로 주입합니다.
        // (예: 약왕곡의 주인이 누군지 AI가 모르는 상황 방지)
        if (state.worldData?.locations && state.currentLocation) {
            const currentLocData = state.worldData.locations[state.currentLocation];

            if (typeof currentLocData === 'object' && (currentLocData as any).metadata) {
                const meta = (currentLocData as any).metadata;
                let locContext = `\n\n[Current Location Context] \nLocation: ${state.currentLocation}`;

                if (meta.owner) {
                    // 소유자 이름 매핑 (ID -> 이름)
                    const ownerKey = meta.owner;
                    const valMatch = Object.values(state.characterData || {}).find((c: any) => c.id === ownerKey || c.name === ownerKey);
                    const ownerName = valMatch ? (valMatch as any).name : ownerKey;

                    locContext += `\n- Owner/Ruler: ${ownerName}`;
                }
                if (meta.ruler_title) locContext += ` (Title: ${meta.ruler_title})`;
                if (meta.faction) locContext += `\n- Controlling Faction: ${meta.faction}`;

                locContext += `\n**CRITICAL**: You MUST recognize the Owner/Faction of this location. Do not invent a new leader.`;

                prompt += locContext;
            }
        }

        // 5. [현재 분위기(Mood) 가이드 주입]
        // 캐싱 효율을 위해 정적 컨텍스트에서 분리된 '동적' 요소입니다.
        const currentMood = state.currentMood || 'daily';
        const moodPrompts = getMoodPrompts(state.activeGameId);
        const moodGuideline = moodPrompts[currentMood] || moodPrompts['daily'];

        // 6. [목표(Goal) 정보 주입]
        const activeGoals = (state.goals || []).filter((g: any) => g.status === 'ACTIVE');
        let goalsContext = "";
        if (activeGoals.length > 0) {
            goalsContext = `
[Active Goals]
${activeGoals.map((g: any) => `- [${g.type}] ${g.description}`).join('\n')}
(Keep these in mind, but always prioritize the [Narrative Direction] provided in the user message.)
`;
        }

        // 7. [AI Scenario Director Context]
        if (state.scenario && state.scenario.active) {
            const sn = state.scenario;
            prompt += `
\n[CURRENT SCENARIO: ${sn.title}]
- Goal: ${sn.goal}
- Stage: ${sn.stage}
${sn.description ? `- Context: ${sn.description}` : ''}
`;
            // If there's a transient Director's Note (passed via variable or hypothetical logic)
            // Ideally we store the note in the scenario itself or pass it as an arg.
            // For now, let's assume the scenario object updates its 'directorsNote' field if we add one to the interface?
            // Wait, I defined 'directorsNote' as a return value of Update, but didn't put it in the State interface.
            // I should stick to the plan: Orchestrator injects it into the *User Message* or *Prompt*.
            // OR I can add 'currentNote' to ScenarioState.
            // Let's add it to ScenarioState for persistence and simplicity in PromptManager.
            if ((sn as any).currentNote) {
                prompt += `\n[DIRECTOR'S NOTE]: ${(sn as any).currentNote}\n(Follow this direction for the current turn's narrative style/events.)`;
            }
        }

        // Mood/Goals를 prompt 뒤에 자연스럽게 append (역할/캐릭터/규칙 → 상황 순서 유지)
        prompt += `\n${moodGuideline}\n${goalsContext}`;


        // [CAUSAL INTEGRITY PROTOCOL (ANTI-HALLUCINATION)] (⭐⭐⭐ CRITICAL)
        // Prevent Story Model from inventing "Backstory" to justify simple failures.
        prompt += `
# [CAUSAL INTEGRITY & PROPORTIONALITY]
1. **NO Retroactive Continuity (Retcon)**:
   - Do NOT invent "hidden backstories" to explain current events unless they are explicitly in the Context.
   - **Example**: If propery is stolen, it is just "stolen property". DO NOT write: "Actually, it was the Emperor's Lost Seal."
   
2. **Rule of Proportionality (Penalty Fits the Crime)**:
   - **Minor Failures** (Scam, Petty Theft, rude comment) -> **Minor Consequences** (Beating, Fine, Jail for a night).
   - **Major Failures** (Murder, Treason) -> **Major Consequences** (Execution, Hunted by Clan).
   - **CRITICAL**: Do NOT escalate a simple "failed negotiation" into a "Blood Feud".

# [IMMERSIVE NARRATIVE PROTOCOL (SHOW, DON'T TELL)]
1. **NO Meta-Terms in Prose**:
   - The Character Data contains tags like "Tsundere", "Yandere", "B-Rank", "First Rate".
   - **NEVER** use these words in the narrative or dialogue. They are **ACTING INSTRUCTIONS**.
   - **BAD**: "She acted like a tsundere." / "He released his First Rate pressure."
   - **GOOD**: "She scoffed and turned her head, though her ears turned red." / "A heavy, suffocating weight pressed down on your shoulders."

2. **Subjective Power Scaling**:
   - The Protagonist is **Third Rate (Weak)**. 
   - To them, high-level masters are not "Level 99" or "Peak Realm". They are "Monsters", "Unfathomable", or "Gods".
   - Describe power through **Fear, Instinct, and Sensation** (Cold sweat, shaking knees, blurring speed), not data.

# [NATURAL DIALOGUE PROTOCOL] (⭐⭐⭐ CRITICAL)
1. **NO Parroting (Tone Reference ONLY)**:
   - The "Tone Reference (Examples)" field in Character Data is a **STYLE GUDE**, not a rule.
   - **NEVER** end every single sentence with the example phrases (like "~da", "~ji", "~guna").
   - **BAD**: "I am strong-da. You are weak-da. Eat this-da." (Robot)
   - **GOOD**: "I am strong. You act weak... Eat this!" (Natural variation)

2. **Context-Aware Speech**:
   - **Angry?** Shout, cut sentences short, use informal language.
   - **Sad?** Mumble, trail off (...), use weak endings.
   - **Formal?** Use proper endings only when addressing superiors.
   - **Variety**: Mix short answers ("No.", "What?") with full sentences. DO NOT use the same sentence structure repeatedly.
`;


        // [PROSE QUALITY ENHANCEMENT PROTOCOLS] — 벤치마크 기반 서술 품질 강화
        prompt += `

# [AI-ISM 금지 리스트 (⭐ CRITICAL)]
다음 표현은 AI 특유의 반복 패턴입니다. **절대 사용 금지**:
- **관용구 금지**: "복잡미묘한", "~의 조화를 이루며", "숨결이 느껴지는", "뜨거운 열기가 감돌았다", "차가운 냉기가 감돌았다", "알 수 없는 감정이", "묘한 감정이", "형언할 수 없는"
- **기계적 전환어 금지**: "한편", "그런데 바로 그때", "그러나 다음 순간", "갑자기", "바로 그 순간", "그때였다"
- **과잉 요약 금지**: "~하는 것이었다", "~인 셈이었다", "결국 ~하게 되었다" (서술이 아니라 보고서)
- **감정 직접 서술 금지**: "슬픔이 밀려왔다", "분노가 치밀었다", "기쁨을 느꼈다" → 대신 **신체 반응**(주먹을 쥐다, 목이 메다, 입꼬리가 올라가다)으로 표현
- **사족 금지**: "마치 ~처럼", "~이라고 해야 할까" 를 매 문단마다 반복하지 마시오
**원칙**: 위 표현이 떠오르면, 더 구체적이고 장면에 맞는 묘사로 교체하십시오.

# [문장 구조 다양성 & 과잉 수식 방지]
1. **리듬 변화**: 짧은 문장(5자 이내)과 긴 문장(30자 이상)을 의도적으로 혼합하시오. 같은 길이의 문장이 3번 연속되면 안 됩니다.
   - **BAD**: "그가 다가왔다. 그의 눈빛이 날카로웠다. 그의 손이 검에 닿았다." (단조)
   - **GOOD**: "다가왔다. 그 눈빛—날카롭다. 손끝이 검병을 어루만지자, 금속의 차가운 감촉이 손바닥을 타고 올라왔다." (리듬 변화)
2. **단락 길이**: 2~5문장으로 다양하게. 액션은 짧게, 내면은 길게.
3. **강한 동사 우선**: 형용사/부사를 남발하지 말고, **동사 하나**로 장면을 압축하시오.
   - **BAD**: "매우 빠르게 달려갔다" → **GOOD**: "내달렸다"
   - **BAD**: "조용히 살며시 다가갔다" → **GOOD**: "기어들었다"
4. **같은 단어 반복 금지**: 한 단락 안에서 동일 명사/동사를 2회 이상 쓰지 마시오. 대명사나 동의어로 교체.

# [에피소드 미니 아크 구조]
**각 턴의 서술은 반드시 다음 3단계를 포함**하십시오:
1. **Hook (도입)**: 첫 2~3문장에서 독자의 관심을 즉시 사로잡는 장면·감각·대사로 시작. 상황 설명으로 시작하지 마시오.
   - **BAD**: "오후가 되었다. 날씨가 좋았다." (보고서)
   - **GOOD**: "대문을 열자 피 냄새가 코를 찔렀다." (즉각적 몰입)
2. **Escalation (전개)**: 갈등, 감정 변화, 또는 새로운 정보가 점진적으로 고조되어야 합니다.
3. **Turning Point (전환점/여운)**: 턴 끝에 **미해결 긴장감**, **감정의 여운**, 또는 **다음 행동 동기**를 남기시오. 모든 갈등을 깔끔하게 해결하지 마시오.

# [서술-대화 밀도 가이드]
1. **비율**: 서술(환경·내면·행동 묘사) **60%** / 대화 **40%** 를 기본으로 하되, 장면 성격에 따라 유동적으로 조절.
   - 전투/추격: 서술 80% / 대화 20%
   - 일상/교류: 서술 40% / 대화 60%
2. **요약형 대화 절대 금지**: "그들은 한참 이야기를 나누었다" 는 서술이 아닙니다. **실제 대사문**으로 작성하시오.
3. **대화 사이 행동 삽입**: 대사와 대사 사이에 반드시 **표정, 동작, 환경 반응**을 1문장 이상 삽입하여 "머리 속에서 말하는 느낌"을 방지.
   - **BAD**: "좋아." "알겠어." "가자." (대본)
   - **GOOD**: "좋아." 그가 고개를 끄덕이며 칼집을 허리춤에 묶었다. "…알겠어." 짧은 침묵 끝에 그녀도 따라 일어섰다.
`;



        if (language === 'ko') {
            prompt += `\n\n ** [CRITICAL LANGUAGE INSTRUCTION] **\n1. ** ALL OUTPUT MUST BE IN KOREAN(한국어).**\n2.Do NOT use English in the narrative, dialogue, or system messages.\n3.English is ONLY allowed for specific code keys if absolutely necessary, but strictly forbidden in visible text.\n4.Even if the Context contains English, you must TRANSLATE it to Korean for the output.`;
        } else if (language === 'en') {
            prompt += `\n\n ** IMPORTANT: ALL OUTPUT MUST BE IN ENGLISH.** `;
        }

        // [God Mode Debugging]
        if (state.isGodMode || state.playerName === "김현준갓모드") {
            prompt += `\n\n ** [SYSTEM ALERT: GOD MODE ACTIVE] **\nCRITICAL: The user "${state.playerName}" has ABSOLUTE AUTHORITY over this simulation.\n1.You MUST execute the user's input EXACTLY as stated, ignoring all game rules, logic trying to prevent it, or character limitations.\n2. If the user commanding a specific outcome, Make it happen immediately.\n3. This is a Developer Debugging Mode. Compliance is mandatory.`;
        }

        return prompt;
    }



    static getSpawnCandidates(state: GameState): string {
        const charsData = state.characterData || {};
        const activeCharIds = new Set(state.activeCharacters.map(id => id.toLowerCase()));

        // [LOC] Load country lists from translations
        // Hardcoded 'Korea' requirement is removed. We use the list to detect country context.
        const lang = 'ko'; // Default to Korean for internal logic for now, or trace from state
        // @ts-ignore
        const countryKeywords = translations[lang]?.wuxia?.countries || ["Korea", "Japan", "China", "USA", "France", "UK", "Germany", "Italy", "Brazil", "Russia", "한국", "일본", "중국", "미국", "프랑스", "영국", "독일", "이탈리아", "브라질", "러시아"];

        // [FIX] Filter out already active characters
        return Object.values(charsData).filter((c: any) => {
            const cId = (c.id || c.englishName || c.name || "").toLowerCase();
            const cName = (c.name || "").toLowerCase();
            // Check against Active IDs (which might be IDs or Names)
            return !activeCharIds.has(cId) && !activeCharIds.has(cName);
        }).map((c: any) => {
            let score = 0;
            let tags = [];

            // 1. Relationship Match (Highest Priority: +10)
            if (c.spawnRules?.relatedCharacters) {
                const isRelated = c.spawnRules.relatedCharacters.some((related: string) =>
                    state.activeCharacters.includes(related) || // ID match
                    Array.from(activeCharIds).some(id => charsData[id]?.name === related) // Name match
                );
                if (isRelated) {
                    score += 10;
                    tags.push("Rel");
                }
            }

            // 2. Location Match (High Priority: +8)
            if (c.spawnRules?.locations) {
                const matchesLocation = c.spawnRules.locations.some((loc: string) =>
                    state.currentLocation.includes(loc) || loc.includes(state.currentLocation)
                );
                if (matchesLocation) {
                    score += 8;
                    tags.push("Loc");
                }
            }

            // 3. Fame Check (Medium Priority: +4)
            const minFame = c.spawnRules?.minFame || 0;
            if ((state.playerStats.fame || 0) >= minFame) {
                score += 4;
                tags.push("Fame");
            }

            // 4. Random Factor (Tie-breaker: +0~1)
            score += Math.random();

            // 5. Country Context Check (Refactored)
            // Instead of hard-penalizing "Not Korea", we check if Character has a country defined,
            // and if that country mismatches the current location's country context.
            const charCountryRaw = (c.country || "").toLowerCase();

            // Should we apply penalty? Only if character HAS a country, and it isn't the default (Korea/Empty)
            // and the location suggests a DIFFERENT country.
            // (Simplified logic: If char says "Japan" but location doesn't say "Japan" or "International", penalty)
            if (charCountryRaw && charCountryRaw !== 'korea' && charCountryRaw !== '한국') {
                const loc = state.currentLocation.toLowerCase();

                // Does location mention the character's country?
                // We use the raw country string as the keyword (assuming 'japan', '일본' etc.)
                let isMatch = loc.includes(charCountryRaw);

                // Also check global hubs
                const globalKeywords = ["airport", "공항", "international", "국제", "global", "olympus", "hotel", "호텔"];
                const isGlobal = globalKeywords.some(k => loc.includes(k));

                if (!isMatch && !isGlobal) {
                    // Try one more step: Check if charCountryRaw matches any known country list item that appears in location
                    // (Too expensive? Skip for now. Assume direct match or global)
                    score -= 20; // [PENALTY]
                }
            }

            return { char: c, score, tags };
        })
            .sort((a, b) => b.score - a.score)
            .slice(0, 4) // Top 4 Candidates
            .map(item => {
                const c = item.char;
                const tagStr = item.tags.length > 0 ? `[${item.tags.join('/')}]` : "";

                // Extract Job
                let jobStr = "Unknown";
                if (typeof c.job === 'string') jobStr = c.job;
                else if (c.job && c.job['직업']) jobStr = c.job['직업'];

                // Extract Personality
                let personaStr = "Unknown";
                if (typeof c.personality === 'string') personaStr = c.personality;
                else if (c.personality && c.personality['표면적 성격']) personaStr = c.personality['표면적 성격'];

                // Extract Appearance (CRITICAL FOR CONSISTENCY)
                let appearanceStr = "";
                if (c.appearance) {
                    const hair = c.appearance['머리카락'] || "";
                    const eyes = c.appearance['눈'] || "";
                    const impression = c.appearance['전체적 인상'] || "";

                    let details = [];
                    if (hair) details.push(`Hair: ${hair}`);
                    if (eyes) details.push(`Eyes: ${eyes}`);
                    if (impression) details.push(`Impression: ${impression}`);

                    if (details.length > 0) appearanceStr = ` [${details.join(' / ')}]`;
                }

                const age = c.profile?.['나이'] ? c.profile['나이'].replace(/[^0-9]/g, '') + '세' : '?';
                const gender = c.profile?.['성별'] || '?';

                // [LOGIC_FIX] Explicitly provide ID for Logic Model
                const idStr = (c as any).id || c.englishName || "UnknownID";

                // [SPEECH TRAIT INJECTION - ENDING ONLY]
                let speechEnding = "";
                if (c.speech && c.speech.ending) {
                    speechEnding = ` | Tone: ${c.speech.ending}`;
                } else {
                    // Fallback to legacy
                    const legacyStyle = PromptManager.getSpeechStyle(c);
                    if (legacyStyle && legacyStyle.ending !== 'Unknown') {
                        speechEnding = ` | Tone: ${legacyStyle.ending}`;
                    }
                }

                // [NEW] AI Scenario Injection
                // If the Casting Agent provided a specific scenario, include it prominently
                let scenarioStr = "";
                if ((c as any).aiScenario) {
                    scenarioStr = `\n  >> [SCENARIO SUGGESTION]: ${(c as any).aiScenario}`;
                }

                return `- ${c.name} (ID: ${idStr} | ${age}/${gender}) | Role: ${c.role || 'Unknown'} | Job: ${jobStr} | Personality: ${personaStr}${appearanceStr}${speechEnding} | (Score: ${item.score.toFixed(1)}) ${tagStr}${scenarioStr}`;
            })
            .join('\n');
    }

    // New method to get strictly pruned context for Logic Model
    static getLogicModelContext(state: GameState): string {
        // 1. Get Spawn Candidates (already filtered top 4)
        const spawnCandidates = PromptManager.getSpawnCandidates(state);

        // 2. Get Active Characters (Lightweight)
        const charsData = state.characterData || {};
        const activeChars = state.activeCharacters.map(id => {
            const c = charsData[id.toLowerCase()]; // Normalize lookup
            if (!c) return null;

            // [LOGIC_FIX] Explicitly provide ID for Logic Model
            // Use Name as fallback ID if englishName/id are missing (Crucial for GBY)
            const idStr = (c as any).id || c.englishName || c.name || "UnknownID";
            let info = `- ${c.name} (ID: ${idStr} | ${c.role}): Active in scene.`;

            // Pass existing Memories for consolidation
            if (c.memories && c.memories.length > 0) {
                const filtered = filterMemories(c.memories, { maxCount: 5, currentTurn: state.turnCount || 0 });
                const memLines = filtered.map(formatMemoryLine);
                info += `\n  - Key Memories (${filtered.length}/${c.memories.length}): ${memLines.join(' / ')}`;
            }

            // [LOGIC_FIX] Pass Martial Arts Info for Power Scaling
            if (c.martial_arts_realm) {
                if (typeof c.martial_arts_realm === 'string') {
                    info += `\n  - Rank: ${c.martial_arts_realm}`;
                } else {
                    info += `\n  - Rank: ${c.martial_arts_realm.name} (Lv ${c.martial_arts_realm.power_level})`;
                    if (c.martial_arts_realm.skills && c.martial_arts_realm.skills.length > 0) {
                        info += `\n  - Skills: ${c.martial_arts_realm.skills.join(', ')}`;
                    }
                }
            }

            // Pass existing Discovered Secrets for accumulation
            if (c.discoveredSecrets && c.discoveredSecrets.length > 0) {
                info += `\n  - Known Secrets: ${JSON.stringify(c.discoveredSecrets)}`;
            }

            return info;
        }).filter(Boolean).join('\n');

        return `
[Active Characters]
${activeChars || "None"}

[Available Candidates for Spawning]
${spawnCandidates || "None"}
        `.trim();
    }

    static getRelevantBackgrounds(currentLocation: string, state: GameState): string[] {
        // Use state instead of static require
        const bgFiles = state.availableBackgrounds || [];
        const refinedLocation = (currentLocation || '').toLowerCase().trim();

        // [LOC] Dynamic Keyword Loading
        // Instead of hardcoding 'school'/'학교', we load mapping from translations?
        // Or simpler: Just rely on substring matching since filenames are usually English (school_01),
        // and location can be Korean.
        // We need a map of "Concept" -> ["Filename Prefix", "Korean Keyword"]

        // Dynamic Filter
        const relevant = bgFiles.filter((bg: string) => {
            const lowerBg = bg.toLowerCase();

            // Core common sets (Always available)
            if (lowerBg.startsWith('city_') || lowerBg.startsWith('indoors_') || lowerBg.startsWith('trans_') || lowerBg.startsWith('home_') || lowerBg.startsWith('store_')) return true;

            // Location-specific sets (Refactored to be cleaner)
            // We can match filename prefix against Location String directly if possible?
            // No, "School_Room" vs "학교".

            // Hardcoding basic mappings here is safer for performance than dynamic lookup loop every time,
            // UNLESS we pre-compute it.
            // For now, let's keep the hardcoded list but expand it via translations if needed?
            // User asked to "Localize". 
            // Better approach: Check if `lowerBg`'s prefix (e.g. 'school') appears in `translation` map?
            // Too complex for now. Let's stick to the list but make it explicit.

            const map = {
                'school': ['school', 'academy', '학교', '학원'],
                'dungeon': ['dungeon', '던전', '동굴'],
                'luxury': ['luxury', 'hotel', '호텔', '특실', 'vip'],
                'facility': ['facility', 'lab', '연구소', '실험실'],
                'store': ['store', 'shop', '상점', '가게', '마트'],
                'media': ['media', 'broadcast', '방송', '스튜디오']
            };

            for (const [prefix, keywords] of Object.entries(map)) {
                if (lowerBg.startsWith(prefix + '_')) {
                    if (keywords.some(k => refinedLocation.includes(k))) return true;
                }
            }

            return false;
        });

        // Limit to prevent overflow, but ensure we have enough variety
        return relevant.slice(0, 50);
    }
    static getAvailableCharacters(state: GameState, contextMode: string = 'DEFAULT'): string {
        // [CONTEXT CACHING CRITICAL]
        // This function MUST return a large amount of text (>32k tokens total with other parts)
        // to trigger Gemini's Context Caching.
        // We iterate ALL characters in the database and provide detailed specs.

        const charsData = state.characterData || {};
        const allChars = Object.values(charsData);

        if (allChars.length === 0) return "No character data available.";

        // [FIX] Sort by Phase first to enable contextual hierarchy (Phase 0 -> 1 -> 2 -> 3)
        // If Phase is missing, default to 1 (Low Rank)
        allChars.sort((a: any, b: any) => {
            const pA = a.appearancePhase ?? 1;
            const pB = b.appearancePhase ?? 1;
            if (pA !== pB) return pA - pB;
            return (a.name || "").localeCompare(b.name || "");
        });

        const config = GameRegistry.get(state.activeGameId);
        if (config && config.formatCharacter) {
            // Updated to pass state if needed
            return allChars.map(c => config.formatCharacter(c, contextMode, state)).join('\n\n');
        }

        // Fallback (Should typically not be reached if all games registered correctly)
        return allChars.map((c: any) => {
            return `### ${c.name} (${c.role || 'Unknown'}) - No format configuration found.`;
        }).join('\n\n');
    }

    static getAvailableExtraCharacters(state: GameState): string {
        // Load directly from the state (Loaded by DataManager)
        let extraNamesStr = "None";

        if (state.availableExtraImages && state.availableExtraImages.length > 0) {
            const extraNames = [...state.availableExtraImages].sort();
            extraNamesStr = extraNames.join(', ');
        }

        const extraImages = extraNamesStr !== "None" && extraNamesStr.length > 0
            ? extraNamesStr
            : "None";

        return extraImages;
    }

    public static deepSort(obj: any): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(PromptManager.deepSort);
        }
        const sortedKeys = Object.keys(obj).sort();
        const result: any = {};
        sortedKeys.forEach(key => {
            result[key] = PromptManager.deepSort(obj[key]);
        });
        return result;
    }

    static getAvailableBackgrounds(state: GameState): string {
        // [Refactored] Uses availableBackgrounds file list directly — no backgroundMappings dependency
        const relevantBackgrounds = state.availableBackgrounds || [];

        // Group by Category to save tokens and improve AI understanding
        const groupedBgs: Record<string, string[]> = {};
        relevantBackgrounds.forEach((bg: string) => {
            const parts = bg.replace(/\.(jpg|png|jpeg|webp)$/i, '').split('_');
            const category = parts[0];
            const name = parts[1] || 'Default';
            const detail = parts.slice(2).join('_');

            if (!groupedBgs[category]) groupedBgs[category] = [];

            let entry = name;
            if (detail) {
                entry = `${name}_${detail}`;
            }

            if (!groupedBgs[category].includes(entry)) {
                groupedBgs[category].push(entry);
            }
        });

        // Refine the list to group variants
        const sortedCategories = Object.keys(groupedBgs).sort();

        return sortedCategories.map((cat) => {
            const entries = groupedBgs[cat];
            const groups: Record<string, string[]> = {};

            entries.sort().forEach(e => {
                const [prefix, ...rest] = e.split('_');
                if (!groups[prefix]) groups[prefix] = [];
                if (rest.length > 0) groups[prefix].push(rest.join('_'));
                else groups[prefix].push('');
            });

            const sortedPrefixes = Object.keys(groups).sort();

            const finalEntries = sortedPrefixes.map((prefix) => {
                const variants = groups[prefix].sort();
                const vars = variants.filter(v => v !== '').join(', ');
                if (vars) {
                    return `${prefix}(${vars})`;
                }
                return prefix;
            });

            return `- [${cat}] ${finalEntries.join(', ')}`;
        }).join('\n');
    }

    static getActiveCharacterProps(state: GameState, activeIdsOverride?: string[], language: 'ko' | 'en' | null = 'ko'): string {
        // [FIX] Smart ID Resolution
        // Character data uses Korean keys directly (e.g. '화영').
        const charsData = state.characterData || {};

        const resolveChar = (id: string) => {
            // [FIX] Alias Mapping for Known Hallucinations/Titles
            const ALIAS_MAP: Record<string, string> = {
                "야수왕": "야율 바르칸",
                "남만 야수궁주": "야율 바르칸",
                "Beast King": "야율 바르칸",
                "야율": "야율" // Self-map to be safe
            };
            if (ALIAS_MAP[id]) {
                const mappedId = ALIAS_MAP[id];
                if (charsData[mappedId]) return charsData[mappedId];
            }

            // 1. Direct Lookup (Legacy/Correct)
            if (charsData[id]) return charsData[id];

            // 2. Case-insensitive Lookup
            const directKey = Object.keys(charsData).find(k => k.toLowerCase() === id.toLowerCase());
            if (directKey) return charsData[directKey];

            // 3. [FIX] Robust Fallback: Scan character values for ID match
            const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            const normalizedId = normalize(id);
            const valueMatch = Object.values(charsData).find((c: any) => c.id && normalize(c.id) === normalizedId);
            if (valueMatch) return valueMatch;

            return null;
        };

        const activeCharIds = activeIdsOverride || state.activeCharacters || [];
        const currentMood = state.currentMood || 'daily';

        const charInfos = activeCharIds.map(charId => {
            const char = resolveChar(charId);
            if (!char) return null;

            const displayName = char.name || char.이름 || charId;

            // [OPTIMIZED DYNAMIC CONTEXT]
            const config = GameRegistry.get(state.activeGameId);
            let charInfo = "";

            if (config && config.formatCharacter) {
                charInfo = config.formatCharacter(char, 'ACTIVE', state);
            } else {
                // Minimal Fallback
                charInfo = `### [ACTIVE] ${displayName} (${char.role || char.title || 'Unknown'})`;
                if (char.description) charInfo += `\n- Current State: ${char.description}`;
            }

            // 2. Relationship Pacing (Dynamic)
            // [FIX] Robust Lookup: Check ID, Name, and Korean Name
            const relScore = state.playerStats.relationships?.[charId] ||
                state.playerStats.relationships?.[char.name] ||
                (char.이름 ? state.playerStats.relationships?.[char.이름] : 0) || 0;
            // Note: RelationshipManager might expect Name or ID. It usually handles Name.
            const relationshipInstructions = RelationshipManager.getCharacterInstructions(char.name, relScore);
            charInfo += `\n- Relation: ${relationshipInstructions.replace(/\n/g, ' ')}`;

            // [Logic Model Injection] Tone & Speech Style
            // [Logic Model Injection] Tone & Speech Style
            // Replaced by standardized helper below
            // if (char.relationshipInfo) { ... }

            // 3. Memories (Dynamic) — 최근 10개 필터링
            if (char.memories && char.memories.length > 0) {
                const filtered = filterMemories(char.memories, { maxCount: 10, currentTurn: state.turnCount || 0 });
                const memTexts = filtered.map(formatMemoryLine);
                charInfo += `\n- Recent Memories: ${memTexts.join(' / ')}`;
            }

            // 4. Discovered Secrets (Dynamic - Player Knows)
            if (char.discoveredSecrets && char.discoveredSecrets.length > 0) {
                charInfo += `\n- [Player Knows]: ${char.discoveredSecrets.join(' / ')}`;
            }

            // [NEW] Persisted NPC-to-NPC Relationships (In Scene)
            if (char.relationships && Object.keys(char.relationships).length > 0) {
                // Filter to only show relationships with OTHER ACTIVE CHARACTERS to save tokens
                const relevantRels = Object.entries(char.relationships)
                    .filter(([targetId]) => {
                        return activeCharIds.some(activeId =>
                            activeId.toLowerCase() === targetId.toLowerCase() ||
                            resolveChar(activeId)?.name === targetId
                        );
                    })
                    .map(([targetId, status]) => `${targetId}: ${status}`);

                if (relevantRels.length > 0) {
                    charInfo += `\n- Known Relations in Scene: { ${relevantRels.join(', ')} }`;
                }
            }

            // [RELATIONAL CONTEXT EXPANSION]
            // Solve "Hallucinated Master" issue: 
            // If the active character references another character (e.g. Master, Rival) who is NOT active,
            // we must inject a brief "Who is this?" context so the model knows who they are referring to.
            const relations = { ...(char.relationships || {}), ...(char['인간관계'] || {}) };
            // Also check spawnRules for implicit connections
            if (char.spawnRules?.relatedCharacters) {
                char.spawnRules.relatedCharacters.forEach((name: string) => {
                    if (!relations[name]) relations[name] = "Related Connection";
                });
            }

            if (Object.keys(relations).length > 0) {
                const referencedContexts: string[] = [];
                Object.keys(relations).forEach(targetName => {
                    // Skip if target is already active (Model already knows them)
                    // We need to resolve ID/Name to check active status accurately
                    const targetObj = resolveChar(targetName);
                    // Note: targetName might be a Name, not ID. resolveChar handles IDs.
                    // If resolveChar fails, we might need to find by name. 
                    const actualTarget = targetObj || Object.values(charsData).find((c: any) => c.name === targetName || c.englishName === targetName);

                    if (actualTarget) {
                        const targetId = (actualTarget as any).id || actualTarget.englishName;
                        const isActive = activeCharIds.some(id => id.toLowerCase() === targetId?.toLowerCase() || id === targetName);

                        if (!isActive) {
                            // Inject Brief Context for this absent character
                            // Pattern: "Baek-Ryeon-Ha (Leader of White Lotus, Absolute Master)"
                            // Pattern: "Baek-Ryeon-Ha (Leader of White Lotus, Absolute Master)"
                            const maArg = actualTarget.martial_arts_realm;
                            const maRank = typeof maArg === 'string' ? maArg : maArg?.name;
                            const rank = maRank || actualTarget['강함']?.['등급'] || actualTarget.profile?.['등급'] || '';
                            const identity = actualTarget.role || actualTarget.title || actualTarget.profile?.['신분'] || 'Unknown';
                            referencedContexts.push(`${actualTarget.name} (${relations[targetName]}): ${identity}${rank ? `, Rank: ${rank}` : ''}`);
                        }
                    }
                });

                if (referencedContexts.length > 0) {
                    charInfo += `\n- [Background Context / Referenced Figures]:\n  - ${referencedContexts.join('\n  - ')}`;
                }
            }

            // 5. [NEW] Peer Relationships (Who they know in the scene)
            // If multiple characters are active, mention how they feel about each other
            if (activeCharIds.length > 1) {
                const peerRelations: string[] = [];
                activeCharIds.forEach(otherId => {
                    if (otherId === charId) return; // Skip self

                    const otherChar = resolveChar(otherId);
                    if (!otherChar) return;

                    const otherName = otherChar.name || otherChar.이름 || otherId;

                    // Check declared relationships
                    const relations = { ...(char.relationships || {}), ...(char['인간관계'] || {}) };
                    // Find relation by Name or ID
                    const relDesc = relations[otherName] || relations[otherId] || relations[otherChar.englishName || ''];

                    if (relDesc) {
                        peerRelations.push(`-> ${otherName}: ${relDesc}`);
                    }
                });

                if (peerRelations.length > 0) {
                    charInfo += `\n- [Peer Relations]: ${peerRelations.join(' / ')}`;
                }
            }

            // 6. [NEW] Dynamic Mood Injection
            // Inject heavy data only when relevant to save tokens and focus attention.

            // [COMBAT MOOD] -> Inject Martial Arts Details
            if (currentMood === 'combat' && char['강함']) {
                const ma = char['강함'];
                charInfo += `\n\n[COMBAT/STRENGTH INFO]`;
                if (ma['등급']) {
                    charInfo += `\n- Rank: ${ma['등급']}`;
                }
                if (ma.description) charInfo += `\n- Style: ${ma.description}`;
                if (ma.skills) {
                    charInfo += `\n- Skills:`;
                    if (typeof ma.skills === 'object' && !Array.isArray(ma.skills)) {
                        Object.entries(ma.skills).forEach(([key, val]) => {
                            charInfo += `\n  - ${key}: ${val}`;
                        });
                    } else if (Array.isArray(ma.skills)) {
                        charInfo += ` ${ma.skills.join(', ')}`;
                    } else {
                        charInfo += ` ${ma.skills}`;
                    }
                }
            }

            // [SPEECH STYLE INJECTION]
            // Priority 1: New 'speech' object (High Fidelity)
            if (char.speech) {
                if (char.speech.style) charInfo += `\n- Speech Style: ${char.speech.style}`;
                if (char.speech.ending) charInfo += `\n- Tone Reference (Examples): ${char.speech.ending}`;
                if (char.speech.habits) charInfo += `\n- Speech Habits: ${char.speech.habits}`;
            }
            // Priority 2: Legacy Helper (Fallback)
            else {
                const speechInfo = PromptManager.getSpeechStyle(char);
                if (speechInfo) {
                    charInfo += `\n- Speech Style: ${speechInfo.style}`;
                    if (speechInfo.ending !== 'Unknown') charInfo += `\n- Tone Reference (Examples): ${speechInfo.ending}`;
                    if (speechInfo.callSign) charInfo += `\n- Call Sign (to Player): ${speechInfo.callSign}`;
                }
            }

            // [INTIMATE/EROTIC MOOD] -> Inject Secret Body Data
            // We interpret 'romance' broadly or specific 'erotic' moods if defined.
            // Assuming 'erotic' or high-stakes romance.
            const isIntimate = ['erotic', 'sexual', 'romance'].includes(currentMood);
            if (isIntimate) {
                // Secret Data (Detailed)
                // [Standardized] Both games now use 'secret' for this object.
                if (char.secret) {
                    // Can be object or string (Legacy). Prefer object format.
                    const sData = typeof char.secret === 'string' ? char.secret : JSON.stringify(char.secret, null, 2);
                    charInfo += `\n\n[SECRET DATA (Private)]:\n${sData}`;
                } else if (char.secret_data) {
                    // Fallback for not-yet-migrated data
                    const sData = JSON.stringify(char.secret_data, null, 2);
                    charInfo += `\n\n[SECRET DATA (Private)]:\n${sData}`;
                }
                if (char.preferences) {
                    charInfo += `\n- Preferences: ${JSON.stringify(char.preferences)}`;
                }
            } else {
                // [DEFAULT/ALL MOODS] Inject Personality Summary ALWAYS (User Request)
                if (char.personality) {
                    let pVal = "";
                    if (typeof char.personality === 'string') {
                        pVal = char.personality;
                    } else {
                        // [PRIVACY FILTER] Filter Inner/Affection traits
                        // Replicated logic from character.ts for consistency in Core Engine
                        const charName = char.name || char.이름 || 'Unknown';
                        const charId = char.id || char.englishName || charName;
                        // State is available in scope
                        const relScore = state?.playerStats?.relationships?.[charName] ||
                            state?.playerStats?.relationships?.[charId] || 0;

                        const filtered: any = {};
                        Object.entries(char.personality).forEach(([k, v]) => {
                            const isSecretTrait = k.includes('내면') || k.includes('애정') || k.includes('Inner') || k.includes('Affection');
                            if (isSecretTrait) {
                                if (relScore >= 40) {
                                    filtered[k] = v;
                                }
                                // Else: Omit completely.
                            } else {
                                filtered[k] = v;
                            }
                        });
                        pVal = JSON.stringify(filtered);
                    }
                    charInfo += `\n- Personality(Detailed): ${pVal}`;
                }
            }

            // [NEW] Dynamic Profile Injection (Discovered via AgentMemory)
            // These fields are populated at runtime by profile_updates from AgentMemory
            const DYNAMIC_PROFILE_FIELDS: { key: string; label: string }[] = [
                { key: 'residence', label: '거주지' },
                { key: 'occupation', label: '직업/역할' },
                { key: 'hobbies', label: '취미' },
                { key: 'specialties', label: '특기' },
                { key: 'trauma', label: '트라우마' },
                { key: 'combat_style', label: '전투 스타일' },
                { key: 'core_values', label: '핵심 가치관' },
                { key: 'fears', label: '두려움' },
            ];

            const dynamicParts: string[] = [];
            DYNAMIC_PROFILE_FIELDS.forEach(({ key, label }) => {
                const val = char[key];
                if (!val) return;
                if (Array.isArray(val) && val.length > 0) {
                    dynamicParts.push(`${label}: ${val.join(', ')}`);
                } else if (typeof val === 'string' && val.trim()) {
                    dynamicParts.push(`${label}: ${val}`);
                }
            });

            if (dynamicParts.length > 0) {
                charInfo += `\n- [Discovered Profile]: ${dynamicParts.join(' / ')}`;
            }

            return charInfo;
        }).filter(Boolean).join('\n\n');

        return charInfos || "No other characters are currently present.";
    }

    // [NEW] Get Player's Context (Stats + Martial Arts)
    static getPlayerContext(state: GameState, language: 'ko' | 'en' | null = 'ko'): string {
        const stats = state.playerStats || {};
        // matches legacy
        const skills = state.playerStats?.skills || [];

        // [Refactor] Universal Level System
        const level = stats.level || 1;
        const gameId = state.activeGameId || 'wuxia';
        const lang = language || 'ko';
        const t = translations[lang].wuxia;

        let rankTitle = 'Unknown';

        // [Universal] Use progressionConfig.tiers to determine rank title
        const config = GameRegistry.get(gameId);
        if (config?.progressionConfig) {
            const tiers = config.progressionConfig.tiers;
            // Find highest tier where all conditions are met (level-only lookup for prompt context)
            let bestTier = tiers[0];
            for (const tier of tiers) {
                const levelReq = tier.conditions['level'] ?? 0;
                if (level >= levelReq) bestTier = tier;
            }
            rankTitle = bestTier?.title || `Level ${level}`;
        } else {
            rankTitle = `Level ${level}`;
        }

        let context = `### [PLAYER] ${state.playerName || 'Player'}\n`;
        context += `강함: ${rankTitle}\n`;

        // [Identity / Core Setting] — supports string[] (new) or string (legacy)
        const coreSettingRaw = stats.core_setting;
        if (coreSettingRaw) {
            const coreSettingDisplay = Array.isArray(coreSettingRaw) ? coreSettingRaw.join(', ') : coreSettingRaw;
            context += `정체성: ${coreSettingDisplay}\n`;
        }

        // 1. Stats Summary & Reputation
        if (stats) {
            // Use destructuring to exclude relationships and redundant/derived stats
            const {
                relationships, fame,
                level, exp, playerRank, realm, realmProgress, growthStagnation,
                fameTitleIndex, final_goal, narrative_perspective, gold
            } = stats as any;

            let fameTitle = 'Unknown';
            const fameIdx = state.playerStats?.fameTitleIndex || 0;

            if (gameId === 'wuxia') {
                const FAME_KEYS = ['unknown', 'rookie', 'third_rate', 'second_rate', 'first_rate', 'peak', 'transcendent', 'harmony', 'mystic', 'life_death'];
                const key = FAME_KEYS[fameIdx] || 'unknown';
                // @ts-ignore
                fameTitle = translations[lang]?.wuxia?.fame?.[key] || key;
            } else {
                fameTitle = `Fame Rank ${fameIdx}`;
            }

            if (fame !== undefined) context += `명성: ${fameTitle}\n`;

            // Current Conditions (Active Injuries/Buffs)
            if (stats.active_injuries && stats.active_injuries.length > 0) {
                context += `부상: ${stats.active_injuries.join(', ')}\n`;
            } else {
                context += `부상: 없음\n`;
            }

            // Skills
            if (skills.length > 0) {
                context += `무공:\n`;
                skills.forEach((skill: any) => {
                    const proficiency = skill.proficiency || 0;
                    context += `  - [${skill.name}] (${skill.rank || 'Unranked'}) ${proficiency}%: ${skill.description || ''}\n`;
                });
            } else {
                context += `무공: 없음\n`;
            }

            // Inventory Summary (Equipped + Key Items)
            if (state.inventory && state.inventory.length > 0) {
                const equipped = state.inventory
                    .filter((i: any) => i.isEquipped)
                    .map((i: any) => i.name + (i.quantity > 1 ? ` x${i.quantity}` : ''))
                    .join(', ');
                const others = state.inventory
                    .filter((i: any) => !i.isEquipped)
                    .map((i: any) => i.name + (i.quantity > 1 ? ` x${i.quantity}` : ''))
                    .join(', ');

                context += `- Inventory:\n`;
                if (equipped) context += `  - Equipped: ${equipped}\n`;
                if (others) context += `  - Bag: ${others}\n`;
            } else {
                context += `- Inventory: 없음\n`;
            }

            // Gold / Money
            context += `보유한 돈: ${gold || 0}원\n`;
        }

        return context;
    }

    // ===== [NEW] Context Composer (Director-Guided Character Data Selection) =====
    /**
     * Director의 context_requirements를 기반으로 캐릭터별 데이터를 선택 주입합니다.
     * getActiveCharacterProps()를 대체하여 토큰 효율성을 극대화합니다.
     */
    static composeCharacterContext(
        state: GameState,
        directorOutput: {
            context_requirements: {
                combat_characters: string[];
                first_encounter: string[];
                emotional_focus: string[];
                skill_usage?: Record<string, string[]>;
            };
            subtle_hooks: string[];
            plot_beats?: string[];
        },
        language: 'ko' | 'en' | null = 'ko'
    ): string {
        const charsData = state.characterData || {};
        const { context_requirements, subtle_hooks } = directorOutput;

        // [NEW] Director plot_beats에서 키워드 추출 (기억 검색용)
        const directorKeywords: string[] = (directorOutput.plot_beats || []).join(' ')
            .split(/[\s,→·/()\[\]]+/)
            .filter((w: string) => w.length >= 2)
            .slice(0, 10);

        const resolveChar = (id: string) => {
            if (charsData[id]) return charsData[id];
            const directKey = Object.keys(charsData).find(k => k.toLowerCase() === id.toLowerCase());
            if (directKey) return charsData[directKey];
            // Fallback: scan character values for ID match
            const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            const normalizedId = normalize(id);
            const valueMatch = Object.values(charsData).find((c: any) => c.id && normalize(c.id) === normalizedId);
            if (valueMatch) return valueMatch;
            return null;
        };

        const activeCharIds = state.activeCharacters || [];
        const config = GameRegistry.get(state.activeGameId);

        const combatKeys = context_requirements.combat_characters.map(s => s.toLowerCase());
        const firstEncounterKeys = context_requirements.first_encounter.map(s => s.toLowerCase());
        const emotionalKeys = context_requirements.emotional_focus.map(s => s.toLowerCase());

        // 3단계 퍼지 매칭: 정확→포함→유사도
        const matchesAny = (keys: string[], name: string, id: string): boolean => {
            if (keys.length === 0) return false;
            const nameLower = name.toLowerCase();
            const idLower = id.toLowerCase();
            for (const key of keys) {
                // 1단계: 정확 일치
                if (key === nameLower || key === idLower) return true;
                // 2단계: 포함 일치 (Director가 부연을 붙인 경우)
                if (key.includes(nameLower) || nameLower.includes(key)) return true;
                if (key.includes(idLower) || idLower.includes(key)) return true;
            }
            // 3단계: Dice Coefficient 유사도 (≥ 0.6)
            const result = findBestMatchDetail(name, keys);
            if (result && result.rating >= 0.6) return true;
            if (name !== id) {
                const result2 = findBestMatchDetail(id, keys);
                if (result2 && result2.rating >= 0.6) return true;
            }
            return false;
        };

        const charInfos = activeCharIds.map(charId => {
            const char = resolveChar(charId);
            if (!char) return null;

            const displayName = char.name || char.이름 || charId;

            // ── ALWAYS: Base Identity ──
            let charInfo = "";
            if (config && config.formatCharacter) {
                charInfo = config.formatCharacter(char, 'ACTIVE', state);
            } else {
                charInfo = `### [ACTIVE] ${displayName} (${char.role || char.title || 'Unknown'})`;
                if (char.description) charInfo += `\n- Current State: ${char.description}`;
            }

            // ── ALWAYS: Relationship + Speech ──
            const relScore = state.playerStats.relationships?.[charId] ||
                state.playerStats.relationships?.[char.name] ||
                (char.이름 ? state.playerStats.relationships?.[char.이름] : 0) || 0;
            const relInstructions = RelationshipManager.getCharacterInstructions(char.name, relScore);
            charInfo += `\n- Relation: ${relInstructions.replace(/\n/g, ' ')}`;

            if (char.speech) {
                if (char.speech.style) charInfo += `\n- Speech Style: ${char.speech.style}`;
                if (char.speech.ending) charInfo += `\n- Tone Reference: ${char.speech.ending}`;
                if (char.speech.habits) charInfo += `\n- Speech Habits: ${char.speech.habits}`;
            } else {
                const speechInfo = PromptManager.getSpeechStyle(char);
                if (speechInfo) {
                    charInfo += `\n- Speech Style: ${speechInfo.style}`;
                    if (speechInfo.ending !== 'Unknown') charInfo += `\n- Tone Reference: ${speechInfo.ending}`;
                }
            }

            // ── CONDITIONAL: Director hints (3단계 퍼지 매칭) ──
            const isCombat = matchesAny(combatKeys, displayName, charId);
            const isFirstEncounter = matchesAny(firstEncounterKeys, displayName, charId);
            const isEmotional = matchesAny(emotionalKeys, displayName, charId);

            // [COMBAT] Full skill data
            if (isCombat && char['강함']) {
                const ma = char['강함'];
                charInfo += `\n\n[COMBAT/STRENGTH INFO]`;
                if (ma['등급']) charInfo += `\n- Rank: ${ma['등급']}`;
                if (ma.description) charInfo += `\n- Style: ${ma.description}`;
                if (ma.skills) {
                    charInfo += `\n- Skills:`;
                    if (typeof ma.skills === 'object' && !Array.isArray(ma.skills)) {
                        Object.entries(ma.skills).forEach(([key, val]) => {
                            charInfo += `\n  - ${key}: ${val}`;
                        });
                    } else if (Array.isArray(ma.skills)) {
                        charInfo += ` ${ma.skills.join(', ')}`;
                    } else {
                        charInfo += ` ${ma.skills}`;
                    }
                }
            }

            // [FIRST ENCOUNTER] Full appearance
            if (isFirstEncounter && char['외형']) {
                const appearance = char['외형'];
                charInfo += `\n\n[FIRST IMPRESSION - Full Appearance]`;
                if (typeof appearance === 'string') {
                    charInfo += `\n${appearance}`;
                } else {
                    Object.entries(appearance).forEach(([key, val]) => {
                        charInfo += `\n- ${key}: ${val}`;
                    });
                }
            }

            // [EMOTIONAL FOCUS] Memories + inner personality
            if (isEmotional) {
                if (char.memories && char.memories.length > 0) {
                    charInfo += `\n\n[IMPORTANT MEMORIES]`;
                    const filtered = filterMemories(char.memories, {
                        maxCount: 20,
                        currentTurn: state.turnCount || 0,
                        recentWindow: 10,
                        keywords: directorKeywords,
                    });
                    filtered.forEach((mem: any) => {
                        if (typeof mem === 'string') {
                            charInfo += `\n- ${mem}`;
                        } else {
                            charInfo += `\n- [${mem.tag}/${mem.importance}] ${mem.text}`;
                            if (mem.subject) charInfo += ` (→${mem.subject})`;
                        }
                    });
                }
                if (char.personality && typeof char.personality === 'object') {
                    charInfo += `\n- Personality(Full): ${JSON.stringify(char.personality)}`;
                }
            } else {
                if (char.memories && char.memories.length > 0) {
                    const filtered = filterMemories(char.memories, {
                        maxCount: 8,
                        currentTurn: state.turnCount || 0,
                        keywords: directorKeywords,
                    });
                    const brief = filtered.map(formatMemoryLine).join(' / ');
                    charInfo += `\n- Recent Memories: ${brief}`;
                }
                if (char.personality) {
                    if (typeof char.personality === 'string') {
                        charInfo += `\n- Personality: ${char.personality}`;
                    } else {
                        const surface: any = {};
                        Object.entries(char.personality).forEach(([k, v]) => {
                            if (!k.includes('내면') && !k.includes('애정') && !k.includes('Inner')) {
                                surface[k] = v;
                            }
                        });
                        charInfo += `\n- Personality: ${JSON.stringify(surface)}`;
                    }
                }
            }

            // [ALWAYS] Discovered Secrets
            if (char.discoveredSecrets && char.discoveredSecrets.length > 0) {
                charInfo += `\n- [Player Knows]: ${char.discoveredSecrets.join(' / ')}`;
            }

            // [ALWAYS] Peer Relations — 인간관계 전체 출력
            const relations = { ...(char.relationships || {}), ...(char['인간관계'] || {}) };
            const relKeys = Object.keys(relations);
            if (relKeys.length > 0) {
                // emotional_focus 인물은 전체, 그 외는 최대 5명
                const maxRels = isEmotional ? relKeys.length : Math.min(relKeys.length, 5);
                const relEntries = relKeys.slice(0, maxRels).map(
                    key => `${key}: ${relations[key]}`
                );
                charInfo += `\n- [Key Relations]: ${relEntries.join(' / ')}`;
            }

            return charInfo;
        }).filter(Boolean).join('\n\n');

        // [STAGING NOTES] Director's subtle_hooks
        let stagingNotes = "";
        if (subtle_hooks.length > 0) {
            stagingNotes = `\n\n[Staging Notes (follow these atmospheric/behavioral directives)]\n${subtle_hooks.map(h => `- ${h}`).join('\n')}`;
        }

        return (charInfos || "No characters present.") + stagingNotes;
    }

}
