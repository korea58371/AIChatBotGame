import { getMoodPrompts, MoodType } from '../data/prompts/moods';
import { RelationshipManager } from './relationship-manager';
import { LoreConverter } from './lore-converter';

interface SpawnRules {
    locations?: string[];
    relatedCharacters?: string[];
    minFame?: number;
    condition?: string;
}

interface Character {
    name: string;
    이름?: string; // Legacy support
    role?: string;
    id?: string; // Explicit ID
    faction?: string; // Wuxia Faction
    title?: string;
    quote?: string;
    profile?: any;
    appearance?: any;
    job?: any;
    personality?: any;
    preferences?: any;
    secret?: any;
    memories?: string[]; // 추가됨: 캐릭터별 기억
    discoveredSecrets?: string[]; // 추가됨: 플레이어가 알아낸 비밀들
    default_expression?: string;
    description?: string;
    spawnRules?: SpawnRules;
    englishName?: string; // 이미지 규칙을 위해 추가됨
    relationshipInfo?: {
        relation: string;
        callSign: string;
        speechStyle: string;
        endingStyle: string;
    };
    relationships?: Record<string, string>; // 추가됨: 캐릭터 간 관계
    martial_arts_realm?: string | {
        name: string;
        power_level: number;
        description: string;
        skills?: string[];
    };
    강함?: {
        등급?: string;
        power_level?: number;
        description?: string;
        skills?: Record<string, string> | string[];
        내공심법?: Record<string, string>;
        경공술?: Record<string, string>;
    };
    외형?: any;
    활동지역?: string;
    인간관계?: Record<string, string>;
    secret_data?: any; // [신규] 친밀한 상황을 위한 상세 비밀 데이터
}

// 토큰 절약을 위한 로직 모델용 경량 캐릭터 구조체
interface LightweightCharacter {
    name: string;
    englishName?: string;
    role?: string;
    spawnRules?: SpawnRules;
    description?: string; // 짧은 설명
}

interface GameState {
    activeCharacters: string[]; // 현재 씬에 있는 캐릭터들의 ID
    currentLocation: string;
    scenarioSummary: string;
    currentEvent: string;
    characterData?: Record<string, Character>; // 동적 캐릭터 데이터
    worldData?: {
        locations: Record<string, string | { description: string, secrets: string[] }>;
        items: Record<string, string>;
    };
    playerStats: any;
    inventory: any[];
    currentMood: MoodType;
    playerName: string;
    availableBackgrounds?: string[];
    availableCharacterImages?: string[];
    availableExtraImages?: string[]; // 추가됨
    isDirectInput?: boolean;
    getSystemPromptTemplate?: (state: any, language: 'ko' | 'en' | 'ja' | null) => string;
    constants?: { FAMOUS_CHARACTERS: string; CORE_RULES: string;[key: string]: string };
    lore?: any;
    activeGameId?: string; // 게임별 로직을 위해 추가됨
    backgroundMappings?: Record<string, string>; // 무협 한국어 키를 위해 추가됨
    extraMap?: Record<string, string>; // 인터페이스에 추가됨
    characterMap?: Record<string, string>; // [수정] ID 해결을 위해 추가됨
    isGodMode?: boolean; // God Mode Flag

    // [Narrative Systems]
    goals?: any[]; // { id, description, type, status }
    tensionLevel?: number; // 0-100
}

export class PromptManager {
    // [CACHE CONFIG]
    private static readonly CACHE_PREFIX = 'PROMPT_CACHE_';
    private static readonly CACHE_VERSION = 'v1.2'; // Increment this to invalidate all caches

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

    static async getSharedStaticContext(
        state: GameState,
        activeChars?: string,
        spawnCandidates?: string,
        forceRefresh: boolean = false // [New] Option to force regeneration
    ): Promise<string> {
        // [브라우저 캐시 로직 & 컨텍스트 스위칭]
        // [수정] 사용자의 요청대로 Mood별 프롬프트 자체가 정적이므로, 캐시 키를 Mood 자체로 설정합니다.
        // [SHARED CACHE KEY]
        // Remove 'mood' dependency. This key is now unified for the game.
        const cacheKey = `${PromptManager.CACHE_PREFIX}${state.activeGameId}_SHARED_${PromptManager.CACHE_VERSION}`;
        console.log(`[PromptManager] Generated Shared Cache Key: ${cacheKey}`);

        // 브라우저 환경이라면, 로컬 스토리지에서 먼저 로드 시도 (새로고침 옵션이 꺼져있을 때)
        if (typeof window !== 'undefined' && !forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                console.log(`[PromptManager] Shared Cache Hit: ${state.activeGameId} - Loaded from Browser Storage`);
                return cached;
            }
        }

        let context = "";

        // [SANDWICH STRUCTURE: BLOCKS 1-4 (SHARED STATIC)]
        if (state.activeGameId === 'wuxia') {
            const { WUXIA_IDENTITY, WUXIA_BEHAVIOR_RULES, WUXIA_OUTPUT_FORMAT, WUXIA_PROTAGONIST_PERSONA } = await import('../data/games/wuxia/constants');

            // [BLOCK 1: IDENTITY]
            const systemIdentity = WUXIA_IDENTITY;

            // [BLOCK 2: KNOWLEDGE BASE]
            // 2.1 Famous Characters (Static DB)
            // Note: We include full DB in shared cache. Mood filtering is removed from static context.
            const famousCharactersDB = `## [NPC Database (Famous Figures)]\n${state.constants?.FAMOUS_CHARACTERS || "No famous characters data loaded."}`;

            // 2.2 Lore Injection (Markdown/JSON)
            let loreContext = "";
            if (state.lore) {
                try {
                    // LoreConverter now handles the header and Possessor Persona injection
                    // Use 'daily' as default context for shared lore, or pass empty to be neutral
                    loreContext = LoreConverter.convertToMarkdown(state.lore, WUXIA_PROTAGONIST_PERSONA, 'daily');
                } catch (e: any) {
                    console.error("[PromptManager] LoreConverter Failed! Falling back to JSON.");
                    loreContext = JSON.stringify(PromptManager.deepSort(state.lore), null, 2);
                }
            }

            // 2.3 Available Backgrounds (Reference)
            const availableBackgrounds = PromptManager.getAvailableBackgrounds(state);

            // [BLOCK 3: BEHAVIOR GUIDELINES]
            let behaviorRules = WUXIA_BEHAVIOR_RULES + "\n" + (state.constants?.FACTION_BEHAVIOR_GUIDELINES || "");

            // [BLOCK 4: STRICT OUTPUT FORMAT]
            const outputFormat = WUXIA_OUTPUT_FORMAT;

            // Assemble Static Blocks (NO MOOD)
            context = `
${systemIdentity}

${loreContext}

${famousCharactersDB}

## [Available Backgrounds]
${availableBackgrounds}

## [Available Extra Images]
// [FIX] Sort extra images for deterministic caching
            ${(state.availableExtraImages ? [...state.availableExtraImages].sort() : []).map((img: string) => img.replace(/\.(png|jpg|jpeg)$/i, '')).join(', ')}

${behaviorRules}

${outputFormat}
`;
        }

        if (state.activeGameId === 'god_bless_you') {
            const { GBY_IDENTITY, GBY_BEHAVIOR_RULES, GBY_OUTPUT_FORMAT, GBY_SPECIAL_FORMATS } = await import('../data/games/god_bless_you/constants');

            // [BLOCK 1: IDENTITY]
            const systemIdentity = GBY_IDENTITY;

            // [BLOCK 2: KNOWLEDGE BASE]
            // 2.1 Famous Characters
            const famousCharactersDB = state.constants?.FAMOUS_CHARACTERS || "No famous characters data loaded.";

            // 2.2 Lore Injection (Markdown)
            let loreContext = "";
            if (state.lore) {
                try {
                    // Reuse LoreConverter for GBY (It supports modern_* keys)
                    loreContext = LoreConverter.convertToMarkdown(state.lore, "", 'daily');
                } catch (e: any) {
                    console.error("[PromptManager] GBY LoreConverter Failed!", e);
                    loreContext = "<!-- Lore Injection Failed -->";
                }
            }

            // 2.3 Backgrounds
            const availableBackgrounds = PromptManager.getAvailableBackgrounds(state);

            // [BLOCK 3: BEHAVIOR GUIDELINES]
            const behaviorRules = GBY_BEHAVIOR_RULES;

            // [BLOCK 4: STRICT OUTPUT FORMAT]
            // Merge OUTPUT_FORMAT and SPECIAL_FORMATS
            const outputFormat = GBY_OUTPUT_FORMAT + "\n" + GBY_SPECIAL_FORMATS;

            // Assemble Static Blocks (NO MOOD)
            // [OPTIMIZATION] Removed Agent-dump of all characters.
            context = `
${systemIdentity}

## [NPC Database (Famous Figures)]
${famousCharactersDB}

${loreContext}

## [Available Backgrounds]
${availableBackgrounds}

${behaviorRules}

${outputFormat}
`;
        } // End GBY Block

        // [Original Logic for other games - Legacy Fallback]
        // ... (Keep existing logic if needed, or simplfy. For now, we assume Wuxia is main)
        // Note: IF other games exist, they maintain old logic. 
        // But since this is Wuxia specific task, I return the Wuxia structure mainly.
        // If 'activeGameId' is NOT wuxia, we run legacy code.

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


    static generateSystemPrompt(state: GameState, language: 'ko' | 'en' | null, userMessage?: string): string {

        // [DYNAMIC BLOCK 5 GENERATION]
        let prompt = "";

        // [FIX] Server-Side Template Selection (No Function Passing)
        if (state.activeGameId === 'god_bless_you') {
            // [GBY Template Stub - Replace with actual import if needed or simple logic]
            prompt = `
You are the AI Game Master for the 'God Bless You'(Modern Fantasy) universe.
Core Identity: Semi - Dystopian Modern Korea with Hunters and Gates.
                Tone: Cynical, Realistic, Urban Noir.
                    Mechanics:
            - Hunters have Ranks(E ~S).
- Gates appear randomly.
- Use explicit visual descriptions.
`;
        } else {
            // [Default/Wuxia Template]
            prompt = `
You are the AI Game Master for the 'Cheonha Jeil'(Wuxia) universe.
Core Identity: Authentic Martial Arts World(Murim).
                Tone: Archaic, Serious, Weighty(Korean Martial Arts Novel Style).
Linguistic Style: Use 'Hao-che'(하오체) or 'Hage-che'(하게체) for elders, politeness levels matter.
                Mechanics:
                - Qi(Neigong) determines power.
- Use authentic martial arts terminology.
- CRITICAL: You must STRICTLY follow the [Narrative Direction] provided by the Pre-Logic module for the outcome of actions. 
- ** PRIORITY RULE **: If the [User Input] contradicts the [Narrative Direction] (e.g., User says "I win", Guide says "You die"), you must ** IGNORE ** the User Input's outcome and **FOLLOW** the Narrative Direction. The Narrative Direction is the absolute truth of the world.
                - Do not invent your own success / failure logic.
`;
        }

        // [Character Info Injection]
        // [Optimized] Rely on state.activeCharacters only. 
        // AgentRetriever provides the "Context" for new/nearby characters.
        // This section defines WHO IS PHYSICALLY PRESENT in the scene right now.

        const activeCharIds = new Set((state.activeCharacters || []).filter((id: any) => typeof id === 'string').map((id: string) => id.toLowerCase()));

        // Use the centralized method with ID resolution
        const activeCharInfo = PromptManager.getActiveCharacterProps(state, Array.from(activeCharIds).sort());
        prompt = prompt.replace('{{CHARACTER_INFO}}', activeCharInfo);

        // [LOCATION CONTEXT INJECTION] - Antigravity Update (Phase 83)
        // Prevent generic hallucinations for significant locations (e.g. Medicine King Valley Owner)
        if (state.worldData?.locations && state.currentLocation) {
            const currentLocData = state.worldData.locations[state.currentLocation];
            // Check if it's an object with metadata
            if (typeof currentLocData === 'object' && (currentLocData as any).metadata) {
                const meta = (currentLocData as any).metadata;
                let locContext = `\n\n[Current Location Context] \nLocation: ${state.currentLocation}`;

                if (meta.owner) {
                    // Try to resolve owner name from character data if available
                    // We reuse the resolveChar logic inside getActiveCharacterProps, but duplicated here for simplicity or refactor
                    // For now, simpler fallback:
                    const ownerKey = meta.owner;
                    const valMatch = Object.values(state.characterData || {}).find((c: any) => c.id === ownerKey || c.name === ownerKey);
                    const ownerName = valMatch ? (valMatch as any).name : ownerKey;

                    locContext += `\n- Owner/Ruler: ${ownerName}`;
                }
                if (meta.ruler_title) locContext += ` (Title: ${meta.ruler_title})`;
                if (meta.faction) locContext += `\n- Controlling Faction: ${meta.faction}`;

                // Add explicit instruction
                locContext += `\n**CRITICAL**: You MUST recognize the Owner/Faction of this location. Do not invent a new leader.`;

                prompt += locContext;
            }
        }

        // [Mood Injection - DYNAMIC PART ONLY]
        // Static Mood Guidelines are now in SharedStaticContext (Cached) - MOVED TO HERE
        // We inject the Mood Guideline DYNAMICALLY here to allow cheap switching.
        const currentMood = state.currentMood || 'daily';

        // [BLOCK 5: DYNAMIC MOOD GUIDELINES]
        const moodPrompts = getMoodPrompts(state.activeGameId);
        const moodGuideline = moodPrompts[currentMood] || moodPrompts['daily'];

        // Insert Mood Guideline into the prompt (Replacing placeholder or appending)
        // Since we removed it from static context, we prepend it to the dynamic part or specific section.
        // Strategy: We'll prepend it to the [Dynamic Context] section for high visibility.

        // [Goals Injection]
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
            prompt += `\n\n ** IMPORTANT: ALL OUTPUT MUST BE IN KOREAN(한국어).** `;
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

        return Object.values(charsData).map((c: any) => {
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

            // 5. Country Filter (CRITICAL FIX)
            // If character is from a specific country (not Korea/Unknown), and current location doesn't support it, disqualify them.
            const charCountryRaw = (c.country || "").toLowerCase();
            const isKorea = charCountryRaw.includes("korea") || charCountryRaw.includes("한국") || charCountryRaw === "";

            if (!isKorea) {
                // Determine implicit location country context
                const loc = state.currentLocation.toLowerCase();
                // Simple keyword check for country presence in location name
                // e.g. "Japan_Street", "Tokyo", "China_Town", "Paris"
                const countryKeywords = ["japan", "일본", "china", "중국", "usa", "미국", "france", "프랑스", "uk", "영국", "germany", "독일", "italy", "이탈리아", "brazil", "브라질", "russia", "러시아"];
                const globalKeywords = ["airport", "공항", "international", "국제", "global", "olympus", "hotel", "호텔"]; // Allow spawning in international hubs

                // Extract pure country name from character data (e.g. "Japan (Tokyo)" -> "japan")
                let targetCountry = "";
                for (const k of countryKeywords) {
                    if (charCountryRaw.includes(k)) {
                        targetCountry = k;
                        break;
                    }
                }

                // Check matches
                const isLocationMatch = targetCountry && loc.includes(targetCountry);
                const isGlobalZone = globalKeywords.some(k => loc.includes(k));

                if (!isLocationMatch && !isGlobalZone) {
                    // Start Penalty: If not in their country and not in a global zone -> Massive Penalty
                    // UNLESS they are specifically "visiting" (handled by explicit location match in rule 2?)
                    // Current Rule 2 (Location Match) might still trigger for generic "Store".
                    // So we must Override score.
                    score = -20;
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
                return `- ${c.name} (ID: ${idStr} | ${age}/${gender}) | Role: ${c.role || 'Unknown'} | Job: ${jobStr} | Personality: ${personaStr}${appearanceStr} | (Score: ${item.score.toFixed(1)}) ${tagStr}`;
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
        // Simple heuristic: Keyword matching
        // Use state instead of static require
        const bgFiles = state.availableBackgrounds || [];

        const refinedLocation = (currentLocation || '').toLowerCase().trim();

        // Dynamic Filter
        const relevant = bgFiles.filter((bg: string) => {
            const lowerBg = bg.toLowerCase();

            // Core common sets (Always available)
            if (lowerBg.startsWith('city_') || lowerBg.startsWith('indoors_') || lowerBg.startsWith('trans_') || lowerBg.startsWith('home_') || lowerBg.startsWith('store_')) return true;

            // Location-specific sets
            if (refinedLocation.includes('school') || refinedLocation.includes('academy') || refinedLocation.includes('학교')) {
                return lowerBg.startsWith('school_') || lowerBg.startsWith('academy_');
            }
            if (refinedLocation.includes('dungeon') || refinedLocation.includes('던전')) {
                return lowerBg.startsWith('dungeon_');
            }
            if (refinedLocation.includes('luxury') || refinedLocation.includes('hotel') || refinedLocation.includes('호텔')) {
                return lowerBg.startsWith('luxury_');
            }
            if (refinedLocation.includes('facility') || refinedLocation.includes('lab') || refinedLocation.includes('연구소')) {
                return lowerBg.startsWith('facility_');
            }
            if (refinedLocation.includes('store') || refinedLocation.includes('shop') || refinedLocation.includes('상점')) {
                return lowerBg.startsWith('store_');
            }
            if (refinedLocation.includes('media') || refinedLocation.includes('broadcast') || refinedLocation.includes('방송')) {
                return lowerBg.startsWith('media_');
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

        const isGBY = state.activeGameId === 'god_bless_you';

        if (isGBY) {
            return allChars.map(c => PromptManager.formatGBYCharacter(c, contextMode)).join('\n\n');
        }

        return allChars.map((c: any) => {
            let info = `### ${c.name}`;
            // Role removed from JSON schema, use Job/Identity
            if (c.title) info += ` (${c.title})`;

            // [MODE: COMBAT] - Focus on Power, Skills, Job
            if (contextMode === 'COMBAT') {
                if (c.job) info += `\n- Job/Abilities: ${JSON.stringify(c.job)}`;
                if (c.skill) info += `\n- Skill: ${c.skill}`;

                // Martial Arts (Critical)
                // [Standardized] 'martial_arts_realm' -> '강함'
                if (c['강함']) {
                    const ma = c['강함'];
                    // Wuxia & GBY Standardized Format
                    if (ma['등급']) {
                        info += `\n- Rank: ${ma['등급']}`;
                        if (ma.description) info += `\n- Style: ${ma.description}`;
                        if (ma.skills) {
                            const skillVal = Array.isArray(ma.skills) ? ma.skills.join(', ') : ma.skills;
                            info += `\n- Skills: ${skillVal}`;
                        }
                    }
                    // Fallback (GBY Legacy or partial data)
                    else if (ma.skills) {
                        const skillVal = Array.isArray(ma.skills) ? ma.skills.join(', ') : ma.skills;
                        info += `\n- Skills: ${skillVal}`;
                    }
                } else if (c.skill) {
                    // Legacy GBY Fallback
                    info += `\n- Skill: ${c.skill}`;
                } else if (c.profile && c.profile['신분']) {
                    info += `\n- Identity: ${c.profile['신분']}`;
                }

                // Minimal appearance/traits for identification only
                if (c['외형']) {
                    const simpleApp = typeof c['외형'] === 'string' ? c['외형'] : (c['외형']['외관'] || c['외형']['머리색'] || c['외형']['전체적 인상'] || Object.values(c['외형'])[0]);
                    info += `\n- Appearance (Brief): ${simpleApp}`;
                }

                // Skip personality details, preferences, secrets in combat
                return info;
            }

            // [MODE: ROMANCE] - Focus on Outer/Inner, Body, Relationship
            if (contextMode === 'ROMANCE') {
                // Identity
                if (c.title) info += `\n- Title: ${c.title}`;
                if (c.quote) info += `\n- Quote: "${c.quote}"`;

                // Appearance (Full)
                if (c['외형']) {
                    info += `\n- Appearance: ${JSON.stringify(c['외형'])}`;
                } else if (c.description) {
                    info += `\n- Appearance/Desc: ${c.description}`;
                }

                // Personality (Deep)
                if (c.personality) {
                    info += `\n- Personality: ${typeof c.personality === 'string' ? c.personality : JSON.stringify(c.personality)}`;
                }

                // Preferences (Critical for romance)
                if (c.preferences) info += `\n- Preferences: ${JSON.stringify(c.preferences)}`;

                // Secret Data (Detailed Body/Private Info)
                // [Standardized] Both games now use 'secret' for this object.
                if (c.secret) {
                    // Check if it's an object (Body Data) or string (Legacy Traits)
                    const secretVal = typeof c.secret === 'string' ? c.secret : JSON.stringify(c.secret);
                    info += `\n- [SECRET DATA (Only visible in Romance/Intimate)]: ${secretVal}`;
                }

                return info;
            }

            // [MODE: DEFAULT] - Balanced
            // Core Identity
            if (c.title) info += `\n- Title: ${c.title}`;
            if (c['활동지역']) info += `\n- Activity Region: ${c['활동지역']}`;
            if (c.quote) info += `\n- Quote: "${c.quote}"`;

            // Appearance (Detailed for Visuals)
            if (c['외형']) {
                // Ensure deterministic JSON key order is hard, but usually appearance keys are stable enough if source is stable.
                // For safety, we trust the source object is not mutated randomly.
                info += `\n- Appearance: ${JSON.stringify(c['외형'])}`;
            } else if (c.description) {
                info += `\n- Appearance/Desc: ${c.description}`;
            }

            // Personality & Traits
            if (c.personality) {
                info += `\n- Personality: ${typeof c.personality === 'string' ? c.personality : JSON.stringify(c.personality)}`;
            }
            if (c.preferences) info += `\n- Preferences: ${JSON.stringify(c.preferences)}`;
            if (c.job) info += `\n- Job/Abilities: ${JSON.stringify(c.job)}`;

            // [GBY Specific]
            if (c.skill) info += `\n- Skill: ${c.skill}`;
            if (c.profile) {
                // Convert profile object to string summary
                const profileStr = Object.entries(c.profile).map(([k, v]) => `${k}: ${v}`).join(', ');
                info += `\n- Profile: ${profileStr}`;
            }

            // Relationship Info (Static Base)
            if (c.relationshipInfo) {
                info += `\n- Social Specs: CallSign=${c.relationshipInfo.callSign}, Tone=${c.relationshipInfo.speechStyle}`;
            }

            // [New] Static Relationships
            if (c['인간관계']) {
                info += `\n- Relationships: ${JSON.stringify(c['인간관계'])}`;
            }

            // Secrets (Marked as Hidden)
            // We include them in the cache so the model "knows" the world's truth, 
            // but we instruct it to keep them hidden from the player until discovered.
            if (c.secret) {
                const secretStr = typeof c.secret === 'string' ? c.secret : JSON.stringify(c.secret);
                info += `\n- [HIDDEN TRUTH (GM ONLY)]: ${secretStr}`;
                info += `\n  - **CRITICAL RULE**: The Narrator MUST NOT reveal this. The Player sees only the outer appearance. Describe ONLY what is visible.`;
            }

            return info;
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

    private static deepSort(obj: any): any {
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
            const keys = Object.keys(state.backgroundMappings).sort();

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

    static getActiveCharacterProps(state: GameState, activeIdsOverride?: string[]): string {
        const charsData = state.characterData || {};
        // [FIX] Smart ID Resolution
        // Logic Model might return English IDs (e.g. 'hwayeong'), but Store uses Korean Keys (e.g. '화영').
        // We use characterMap to bridge this gap.
        const charMap = state.characterMap || {};

        const resolveChar = (id: string) => {
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
            let charInfo = `### [ACTIVE] ${displayName} (${char.role || char.title || 'Unknown'})`;

            // [FIX] Inject Critical Standard Specs (Faction, Rank, etc.) to prevent hallucinations
            if (char.faction) charInfo += `\n- Faction: ${char.faction}`;

            // Martial Arts / Power Level
            if (char.martial_arts_realm) {
                const maVal = typeof char.martial_arts_realm === 'object'
                    ? `${char.martial_arts_realm.name} (Lv ${char.martial_arts_realm.power_level || '?'})`
                    : char.martial_arts_realm;
                charInfo += `\n- Martial Arts Rank: ${maVal}`;
            } else if (char['강함']?.['등급']) {
                charInfo += `\n- Rank: ${char['강함']['등급']}`;
            }

            // Appearance (Legacy + Standard)
            if (char.appearance) {
                const appVal = typeof char.appearance === 'string' ? char.appearance : JSON.stringify(char.appearance);
                // Only show brief appearance if description is present, to save tokens? 
                // No, active characters need visual descriptions.
                charInfo += `\n- Appearance: ${appVal}`;
            } else if (char['외형']) {
                const appVal = typeof char['외형'] === 'string' ? char['외형'] : JSON.stringify(char['외형']);
                charInfo += `\n- Appearance: ${appVal}`;
            }

            // 1. Current Context / Status
            if (char.default_expression) charInfo += `\n- Status: ${char.default_expression}`;
            if (char.description) charInfo += `\n- Current State: ${char.description}`;

            // 2. Relationship Pacing (Dynamic)
            const relScore = state.playerStats.relationships?.[charId] || 0;
            // Note: RelationshipManager might expect Name or ID. It usually handles Name.
            const relationshipInstructions = RelationshipManager.getCharacterInstructions(char.name, relScore);
            charInfo += `\n- Relation: ${relationshipInstructions.replace(/\n/g, ' ')}`;

            // [Logic Model Injection] Tone & Speech Style
            if (char.relationshipInfo) {
                const { callSign, speechStyle, endingStyle } = char.relationshipInfo;
                if (callSign) charInfo += `\n- Call Sign: "${callSign}"`;
                if (speechStyle) charInfo += `\n- Speech Style: ${speechStyle}`;
                if (endingStyle) charInfo += `\n- Ending Style: ${endingStyle}`;
            }

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

            // 5. [NEW] Dynamic Mood Injection
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
            }

            return charInfo;
        }).filter(Boolean).join('\n\n');

        return charInfos || "No other characters are currently present.";
    }

    // [Helper] YAML-style formatter for God Bless You characters
    private static formatGBYCharacter(c: any, contextMode: string): string {
        const lines: string[] = [`### ${c.name || c.이름 || 'Unknown'}`];

        // 0. Phase & Condition (Critical for Narrative Pacing)
        if (c.appearancePhase !== undefined) lines.push(`- Phase: ${c.appearancePhase}`);
        if (c.spawnRules?.condition) lines.push(`- Condition: ${c.spawnRules.condition}`);

        // 0.1 Explicit Rank Display
        const charRank = c['강함']?.['등급'] || c.profile?.['등급'];
        if (charRank) lines.push(`- Rank: ${charRank}`);

        // 1. Basic Info
        if (c.title) lines.push(`- Title: ${c.title}`);
        if (c['활동지역']) lines.push(`- Activity Region: ${c['활동지역']}`);

        // [MODE: COMBAT]
        if (contextMode === 'COMBAT') {
            if (c['강함'] && c['강함'].skills) {
                lines.push(`- Skill: ${c['강함'].skills}`);
            } else if (c.skill) {
                lines.push(`- Skill: ${c.skill}`);
            }

            // Combat Stats from Ranks
            // If c.rank exists or similar
            if (c.profile && c.profile['등급']) lines.push(`- Rank: ${c.profile['등급']}`);

            // Job/Class
            // Social / Job Info
            const socialData = c.social || c.job;
            if (socialData) {
                if (typeof socialData === 'string') lines.push(`- Job/Social: ${socialData}`);
                else {
                    Object.entries(socialData).forEach(([k, v]) => {
                        // Filter out huge objects if any, mostly flat strings expected.
                        if (typeof v === 'string') lines.push(`- ${k}: ${v}`);
                    });
                }
            }
            return lines.join('\n');
        }

        // [MODE: ROMANCE]
        if (contextMode === 'ROMANCE') {
            // Appearance (Full)
            if (c['외형']) {
                lines.push(`- Appearance:`);
                Object.entries(c['외형']).forEach(([k, v]) => {
                    lines.push(`  - ${k}: ${v}`);
                });
            } else if (c.description) {
                lines.push(`- Appearance: ${c.description}`);
            }

            // Secret Data (Detailed)
            // [Standardized] Both games now use 'secret' for this object.
            if (c.secret) {
                const sData = typeof c.secret === 'string' ? c.secret : JSON.stringify(c.secret, null, 2);
                lines.push(`- [SECRET DATA]:\n${sData}`);
            } else if (c.secret_data) {
                lines.push(`- [SECRET DATA]:`);
                Object.entries(c.secret_data).forEach(([k, v]) => {
                    lines.push(`  - ${k}: ${JSON.stringify(v)}`);
                });
            }

            // Personality (Full + Inner)
            if (c.personality) {
                if (typeof c.personality === 'string') {
                    lines.push(`- Personality: ${c.personality}`);
                } else {
                    lines.push(`- Personality:`);
                    Object.entries(c.personality).forEach(([k, v]) => {
                        lines.push(`  - ${k}: ${v}`);
                    });
                }
            }

            if (c.preferences) lines.push(`- Preferences: ${JSON.stringify(c.preferences)}`);

            return lines.join('\n');
        }

        // [MODE: DEFAULT]
        if (c['강함'] && c['강함'].skills) {
            lines.push(`- Skill: ${c['강함'].skills}`);
        } else if (c.skill) {
            lines.push(`- Skill: ${c.skill}`);
        }

        // 2. Profile (KV List)
        if (c.profile) {
            lines.push(`- Profile:`);
            Object.entries(c.profile).forEach(([k, v]) => {
                lines.push(`  - ${k}: ${v}`);
            });
        }

        // 3. Appearance (KV List)
        // 3. Appearance (KV List)
        const app = c.appearance || c['외형'];
        if (app) {
            lines.push(`- Appearance:`);
            Object.entries(app).forEach(([k, v]) => {
                lines.push(`  - ${k}: ${v}`);
            });
        } else if (c.description) {
            lines.push(`- Appearance: ${c.description}`);
        }

        // 4. Job/Social (KV List)
        const jobData = c.job || c.social;
        if (jobData) {
            lines.push(`- Job/Social:`);
            Object.entries(jobData).forEach(([k, v]) => {
                lines.push(`  - ${k}: ${v}`);
            });
        }

        // 5. Personality (KV List)
        if (c.personality) {
            if (typeof c.personality === 'string') {
                lines.push(`- Personality: ${c.personality}`);
            } else {
                lines.push(`- Personality:`);
                Object.entries(c.personality).forEach(([k, v]) => {
                    lines.push(`  - ${k}: ${v}`);
                });
            }
        }

        // 6. Preferences (KV List)
        if (c.preferences) {
            lines.push(`- Preferences:`);
            Object.entries(c.preferences).forEach(([k, v]) => {
                lines.push(`  - ${k}: ${v}`);
            });
        }

        // 7. Secret (KV List - Hidden)
        if (c.secret) {
            lines.push(`- [HIDDEN TRUTH (GM ONLY)]:`);
            if (typeof c.secret === 'string') {
                lines.push(`  ${c.secret}`);
            } else {
                Object.entries(c.secret).forEach(([k, v]) => {
                    lines.push(`  - ${k}: ${v}`);
                });
            }
            lines.push(`  - **CRITICAL**: Do NOT reveal hidden truths.`);
        }

        // 8. Relations
        if (c.relationship) {
            lines.push(`- Relationships: ${c.relationship}`);
        }

        return lines.join('\n');
    }
}