import { getMoodPrompts, MoodType } from '../../data/prompts/moods';
import { GameRegistry } from '@/lib/registry/GameRegistry';
import { RelationshipManager } from './relationship-manager';
import { GameState } from '../store';
import { translations } from '../../data/translations';


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
                prompt = state.getSystemPromptTemplate(state, language);
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

        prompt = `
${moodGuideline}
${goalsContext}

${prompt}
            `;



        // [Language Instruction]
        if (language === 'ko') {
            prompt += `\n\n ** [CRITICAL LANGUAGE INSTRUCTION] **\n1. **ALL OUTPUT MUST BE IN KOREAN (한국어).**\n2. Do NOT use English in the narrative, dialogue, or system messages.\n3. English is ONLY allowed for specific code keys if absolutely necessary, but strictly forbidden in visible text.\n4. Even if the Context contains English, you must TRANSLATE it to Korean for the output.`;
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

                return `- ${c.name} (ID: ${idStr} | ${age}/${gender}) | Role: ${c.role || 'Unknown'} | Job: ${jobStr} | Personality: ${personaStr}${appearanceStr}${speechEnding} | (Score: ${item.score.toFixed(1)}) ${tagStr}`;
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
                info += `\n  - Current Memories: ${JSON.stringify(c.memories)}`;
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

        if (state.extraMap && Object.keys(state.extraMap).length > 0) {
            const extraNames = Object.keys(state.extraMap).sort(); // [FIX] Sort keys
            extraNamesStr = extraNames.join(', ');
            // console.log(`[PromptManager] Found Extra Map Keys: ${extraNames.length}`);
        } else {
            // Fallback
            console.warn("[PromptManager] state.extraMap is missing. Falling back to simple file list.");
        }

        const extraImages = extraNamesStr !== "None" && extraNamesStr.length > 0
            ? extraNamesStr // Prioritize Map Keys (Reference/Interface)
            : (state.availableExtraImages && state.availableExtraImages.length > 0
                ? [...state.availableExtraImages].sort().join(', ') // Fallback to raw filenames
                : "None");

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
        // [Universal] Support for Key-based Mappings (Wuxia & GBY)
        if (state.backgroundMappings && Object.keys(state.backgroundMappings).length > 0) {
            let keys = Object.keys(state.backgroundMappings).sort();

            // [Refactoring Phase]
            // Delegate Localization logic to GameRegistry
            const config = GameRegistry.get(state.activeGameId);
            if (config && config.resolveBackgroundName) {
                keys = keys.map(key => config.resolveBackgroundName(key, state));
            }

            // Group by Prefix (e.g. "객잔_")
            const groups: Record<string, string[]> = {};

            keys.forEach(key => {
                const parts = key.split('_');
                const prefix = parts[0];
                const detail = parts.slice(1).join('_'); // Rest

                if (!groups[prefix]) groups[prefix] = [];
                if (detail) groups[prefix].push(detail);
                else groups[prefix].push('[기본]'); // No detail
            });

            const sortedPrefixes = Object.keys(groups).sort();

            return sortedPrefixes.map(prefix => {
                const details = groups[prefix].sort().join(', ');
                return `- [${prefix}] ${details}`;
            }).join('\n');
        }

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
        // [FIX] Sort Categories
        const sortedCategories = Object.keys(groupedBgs).sort();

        return sortedCategories.map((cat) => {
            const entries = groupedBgs[cat];
            const groups: Record<string, string[]> = {};

            // Sort entries to ensure deterministic sub-groups
            entries.sort().forEach(e => {
                const [prefix, ...rest] = e.split('_');
                if (!groups[prefix]) groups[prefix] = [];
                if (rest.length > 0) groups[prefix].push(rest.join('_'));
                else groups[prefix].push(''); // Root item
            });

            // [FIX] Sort Group Keys
            const sortedPrefixes = Object.keys(groups).sort();

            const finalEntries = sortedPrefixes.map((prefix) => {
                const variants = groups[prefix].sort(); // [FIX] Sort Variants
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
        const charsData = state.characterData || {};
        // [FIX] Smart ID Resolution
        // Logic Model might return English IDs (e.g. 'hwayeong'), but Store uses Korean Keys (e.g. '화영').
        // We use characterMap to bridge this gap.
        const charMap = state.characterMap || {};

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

            // 3. Map Resolution (English ID -> Korean Key)
            // Map: { "화영": "HwaYeong", ... }
            // Input: "hwayeong", "wang_noya"
            const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedId = normalize(id);

            const foundName = Object.keys(charMap).find(key => {
                const mapVal = charMap[key];
                return mapVal && normalize(mapVal) === normalizedId;
            });

            if (foundName && charsData[foundName]) return charsData[foundName];

            // 4. [FIX] Robust Fallback: Scan character values for ID match
            // This handles cases where characterMap is outdated but character data has correct ID.
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

            // 3. Memories (Dynamic)
            if (char.memories && char.memories.length > 0) {
                charInfo += `\n- Recent Memories: ${char.memories.join(' / ')}`;
            }

            // 4. Discovered Secrets (Dynamic - Player Knows)
            if (char.discoveredSecrets && char.discoveredSecrets.length > 0) {
                charInfo += `\n- [Player Knows]: ${char.discoveredSecrets.join(' / ')}`;
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
                if (char.speech.ending) charInfo += `\n- Ending Style: ${char.speech.ending}`;
                if (char.speech.habits) charInfo += `\n- Speech Habits: ${char.speech.habits}`;
            }
            // Priority 2: Legacy Helper (Fallback)
            else {
                const speechInfo = PromptManager.getSpeechStyle(char);
                if (speechInfo) {
                    charInfo += `\n- Speech Style: ${speechInfo.style}`;
                    if (speechInfo.ending !== 'Unknown') charInfo += `\n- Ending Style: ${speechInfo.ending}`;
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
                    const pVal = typeof char.personality === 'string' ? char.personality : JSON.stringify(char.personality);
                    charInfo += `\n- Personality(Detailed): ${pVal}`;
                }
            }

            return charInfo;
        }).filter(Boolean).join('\n\n');

        return charInfos || "No other characters are currently present.";
    }

    // [NEW] Get Player's Context (Stats + Martial Arts)
    static getPlayerContext(state: GameState, language: 'ko' | 'en' | null = 'ko'): string {
        const stats = state.playerStats || {};
        // [Verified] Unified Skills System (Jan 2026)
        // We now rely exclusively on playerStats.skills.
        // Legacy 'martialArts' fields are deprecated.
        const skills = state.playerStats?.skills || [];

        // [Refactor] Universal Level System
        const level = stats.level || 1;
        const gameId = state.activeGameId || 'wuxia';
        const lang = language || 'ko';
        const t = translations[lang].wuxia;

        let rankTitle = 'Unknown';

        // [Refactored] Use GameRegistry
        const config = GameRegistry.get(gameId);
        if (config && config.getRankTitle) {
            const rawRank = config.getRankTitle(level, lang);

            // Translate
            // @ts-ignore
            if (translations[lang] && translations[lang][gameId]) {
                // @ts-ignore
                const dict = translations[lang][gameId];
                const category = dict.realms ? 'realms' : 'ranks';
                // @ts-ignore
                rankTitle = dict[category]?.[rawRank] || rawRank;
            } else {
                rankTitle = rawRank;
            }
        } else {
            // Fallback
            rankTitle = `Level ${level}`;
        }

        let context = `### [PLAYER] ${state.playerName || 'Player'}\n`;
        context += `- Level: ${level} (${rankTitle})\n`;

        // 1. Stats Summary & Reputation
        if (stats) {
            // Use destructuring to exclude relationships and redundant/derived stats
            const {
                relationships, fame, fate,
                level, exp, playerRank, realm, realmProgress, growthStagnation,
                fameTitleIndex, final_goal, narrative_perspective
            } = stats as any;

            let fameTitle = 'Unknown';
            const fameIdx = state.playerStats?.fameTitleIndex || 0;

            // [LOC] Fame Titles (Wuxia Only mostly)
            // Simplified Logic: Just use index to pick from translation array/keys if we want to support it properly,
            // or we delegate this to GameRegistry as well? 
            // For now, let's look up directly in translations to avoid import dependency.
            // Assumption: FAME_TITLES order aligns with keys: unknown, rookie, third_rate... 
            // This is brittle. Let's rely on a simplified lookup or legacy logic if config supports it.

            if (gameId === 'wuxia') {
                // Hardcoded Map for now to resolve dependency, OR better: Move FAME_TITLES to GameConfig?
                // Let's just use a safe array here to resolve the lint error and logic.
                const FAME_KEYS = ['unknown', 'rookie', 'third_rate', 'second_rate', 'first_rate', 'peak', 'transcendent', 'harmony', 'mystic', 'life_death'];
                const key = FAME_KEYS[fameIdx] || 'unknown';
                // @ts-ignore
                fameTitle = translations[lang]?.wuxia?.fame?.[key] || key;
            } else {
                fameTitle = `Fame Rank ${fameIdx}`;
            }

            if (fame !== undefined) context += `- Fame: ${fame} (Titles: ${fameTitle})\n`;
            if (fate !== undefined) context += `- Fate: ${fate}\n`;

            // [RESTORED] Personality for PreLogic/Story Consistency
            if (stats.personality) {
                context += `- Personality: ${JSON.stringify(stats.personality)}\n`;
                if (stats.personalitySummary) context += `- Personality Summary: ${stats.personalitySummary}\n`;
            }

            // Current Conditions (Active Injuries/Buffs)
            if (stats.active_injuries && stats.active_injuries.length > 0) {
                context += `- [CONDITION]: Active Injuries: ${stats.active_injuries.join(', ')}\n`;
            }
        }

        // 2. Martial Arts (CRITICAL)
        // 2. Skills / Martial Arts (CRITICAL)
        if (skills.length > 0) {
            context += `- Skills / Martial Arts:\n`;
            skills.forEach((skill: any) => {
                const proficiency = skill.proficiency || 0;
                context += `  - [${skill.name}] (${skill.rank || 'Unranked'}) ${proficiency}%: ${skill.description || ''}\n`;
            });
        } else {
            context += `- Martial Arts: No specific arts learned yet.\n`;
        }

        // 3. Inventory Summary (Equipped + Key Items)
        if (state.inventory && state.inventory.length > 0) {
            const equipped = state.inventory.filter((i: any) => i.isEquipped).map((i: any) => i.name).join(', ');
            const others = state.inventory.filter((i: any) => !i.isEquipped).map((i: any) => i.name).join(', ');

            context += `- Inventory:\n`;
            if (equipped) context += `  - Equipped: ${equipped}\n`;
            if (others) context += `  - Bag: ${others}\n`;
        }

        return context;
    }




}