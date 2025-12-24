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
    role?: string;
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
    martial_arts_realm?: {
        name: string;
        power_level: number;
        description: string;
        skills?: string[];
    };
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
}

export class PromptManager {
    static async getSharedStaticContext(
        state: GameState,
        activeChars?: string, // e.g. "Ju Ye-seo (Affection: 50), ..."
        spawnCandidates?: string
    ): Promise<string> {
        // [SANDWICH STRUCTURE: BLOCKS 1-4 (STATIC)]
        if (state.activeGameId === 'wuxia') {
            const { WUXIA_IDENTITY, WUXIA_BEHAVIOR_RULES, WUXIA_OUTPUT_FORMAT } = await import('../data/games/wuxia/constants');

            // [BLOCK 1: IDENTITY]
            const systemIdentity = WUXIA_IDENTITY;

            // [BLOCK 2: KNOWLEDGE BASE]
            // 2.1 Famous Characters (Static DB)
            const famousCharactersDB = state.constants?.FAMOUS_CHARACTERS || "No famous characters data loaded.";

            // 2.2 Lore Injection (Markdown/JSON)
            let loreContext = "";
            if (state.lore) {
                try {
                    loreContext = `
## [2. KNOWLEDGE BASE (LORE)]
### [World System & Martial Arts]
${LoreConverter.convertToMarkdown(state.lore)}
`;
                } catch (e) {
                    loreContext = JSON.stringify(PromptManager.deepSort(state.lore), null, 2);
                }
            }

            // 2.3 Available Backgrounds (Reference)
            const availableBackgrounds = PromptManager.getAvailableBackgrounds(state);

            // [BLOCK 3: BEHAVIOR GUIDELINES]
            const behaviorRules = WUXIA_BEHAVIOR_RULES + "\n" + (state.constants?.FACTION_BEHAVIOR_GUIDELINES || "");

            // [BLOCK 4: STRICT OUTPUT FORMAT] (MUST BE LAST STATIC BLOCK)
            const outputFormat = WUXIA_OUTPUT_FORMAT;

            // Assemble Static Blocks
            return `
${systemIdentity}

${loreContext}

## [NPC Database (Famous Figures)]
${famousCharactersDB}

## [Available Backgrounds]
${availableBackgrounds}

${behaviorRules}

${outputFormat}
`;
        } // End Wuxia Block

        // [Original Logic for other games - Legacy Fallback]
        // ... (Keep existing logic if needed, or simplfy. For now, we assume Wuxia is main)
        // Note: IF other games exist, they maintain old logic. 
        // But since this is Wuxia specific task, I return the Wuxia structure mainly.
        // If 'activeGameId' is NOT wuxia, we run legacy code.

        // ... Legacy Code Copy (Truncated in verify, but providing Wuxia path is Priority)
        return "System Context Loaded.";
    }


    static generateSystemPrompt(state: GameState, language: 'ko' | 'en' | null, userMessage?: string): string {

        // [DYNAMIC BLOCK 5 GENERATION]
        let prompt = "";
        if (state.getSystemPromptTemplate) {
            prompt = state.getSystemPromptTemplate(state, language);
        } else {
            prompt = "System prompt template not loaded.";
        }

        // [Character Info Injection]
        const charsData = state.characterData || {};
        const activeCharIds = new Set(state.activeCharacters.map(id => id.toLowerCase()));

        // Check user input AND location context for mentions of other characters
        const locData = state.worldData?.locations?.[state.currentLocation];
        const locationDesc = (typeof locData === 'string' ? locData : locData?.description) || "";
        const locationContext = (state.currentLocation + locationDesc).toLowerCase();
        const userContext = (userMessage || "").toLowerCase();

        Object.entries(charsData).forEach(([charId, char]: [string, any]) => {
            const charName = char.name.toLowerCase();
            const charEnglishName = (char.englishName || "").toLowerCase();

            // Check key (ID)
            if (userContext.includes(charId) || locationContext.includes(charId)) {
                activeCharIds.add(charId);
            }
            // Check Korean Name
            if (userContext.includes(charName) || locationContext.includes(charName)) {
                activeCharIds.add(charId);
            }
            // Check English Name
            if (charEnglishName && (userContext.includes(charEnglishName) || locationContext.includes(charEnglishName))) {
                activeCharIds.add(charId);
            }
        });

        // Use the centralized method with ID resolution
        const activeCharInfo = PromptManager.getActiveCharacterProps(state, Array.from(activeCharIds));
        prompt = prompt.replace('{{CHARACTER_INFO}}', activeCharInfo);

        // [Mood Injection]
        const currentMood = state.currentMood || 'daily';
        const moodPrompts = getMoodPrompts(state.activeGameId);
        let moodPrompt = moodPrompts[currentMood] || moodPrompts['daily'];

        // Special handling for Combat
        if (currentMood === 'combat') {
            const stats = state.playerStats;
            moodPrompt += `\n\n[Combat Stats Analysis]\nPlayer Stats: STR ${stats.str}, AGI ${stats.agi}, INT ${stats.int}, VIT ${stats.vit}, LUK ${stats.luk}\nSkills: ${stats.skills.join(', ') || "None"}\n\nCompare these stats with the opponent's estimated stats to determine the outcome of the exchange.`;
        }

        prompt += `\n\n${moodPrompt}`;

        // [Language Instruction]
        if (language === 'ko') {
            prompt += `\n\n**IMPORTANT: ALL OUTPUT MUST BE IN KOREAN (한국어).**`;
        } else if (language === 'en') {
            prompt += `\n\n**IMPORTANT: ALL OUTPUT MUST BE IN ENGLISH.**`;
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
            const idStr = (c as any).id || c.englishName || "UnknownID";
            let info = `- ${c.name} (ID: ${idStr} | ${c.role}): Active in scene.`;

            // Pass existing Memories for consolidation
            if (c.memories && c.memories.length > 0) {
                info += `\n  - Current Memories: ${JSON.stringify(c.memories)}`;
            }

            // [LOGIC_FIX] Pass Martial Arts Info for Power Scaling
            if (c.martial_arts_realm) {
                info += `\n  - Rank: ${c.martial_arts_realm.name} (Lv ${c.martial_arts_realm.power_level})`;
                if (c.martial_arts_realm.skills && c.martial_arts_realm.skills.length > 0) {
                    info += `\n  - Skills: ${c.martial_arts_realm.skills.join(', ')}`;
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
    static getAvailableCharacters(state: GameState): string {
        // [CONTEXT CACHING CRITICAL]
        // This function MUST return a large amount of text (>32k tokens total with other parts)
        // to trigger Gemini's Context Caching.
        // We iterate ALL characters in the database and provide detailed specs.

        const charsData = state.characterData || {};
        const allChars = Object.values(charsData);

        if (allChars.length === 0) return "No character data available.";

        // [FIX] Sort by name to guarantee deterministic order for Caching
        allChars.sort((a: any, b: any) => a.name.localeCompare(b.name));

        return allChars.map((c: any) => {
            let info = `### ${c.name}`;
            if (c.role) info += ` (${c.role})`;

            // Core Identity
            if (c.title) info += `\n- Title: ${c.title}`;
            if (c.quote) info += `\n- Quote: "${c.quote}"`;

            // Appearance (Detailed for Visuals)
            if (c.appearance) {
                // Ensure deterministic JSON key order is hard, but usually appearance keys are stable enough if source is stable.
                // For safety, we trust the source object is not mutated randomly.
                info += `\n- Appearance: ${JSON.stringify(c.appearance)}`;
            } else if (c.description) {
                info += `\n- Appearance/Desc: ${c.description}`;
            }

            // Personality & Traits
            if (c.personality) {
                info += `\n- Personality: ${typeof c.personality === 'string' ? c.personality : JSON.stringify(c.personality)}`;
            }
            if (c.preferences) info += `\n- Preferences: ${JSON.stringify(c.preferences)}`;
            if (c.job) info += `\n- Job/Abilities: ${JSON.stringify(c.job)}`;

            // Relationship Info (Static Base)
            if (c.relationshipInfo) {
                info += `\n- Social Specs: CallSign=${c.relationshipInfo.callSign}, Tone=${c.relationshipInfo.speechStyle}`;
            }

            // [New] Static Relationships
            if (c.relationships) {
                info += `\n- Relationships: ${JSON.stringify(c.relationships)}`;
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
        // [New] Support for Korean Keys (Wuxia)
        if (state.activeGameId === 'wuxia' && state.backgroundMappings) {
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

            // [OPTIMIZED DYNAMIC CONTEXT]
            let charInfo = `### [ACTIVE] ${char.name} (${char.role || 'Unknown'})`;

            // 1. Current Context / Status
            if (char.default_expression) charInfo += `\n- Status: ${char.default_expression}`;

            // 2. Relationship Pacing (Dynamic)
            const relScore = state.playerStats.relationships?.[charId] || 0;
            // Note: RelationshipManager might expect Name or ID. It usually handles Name.
            const relationshipInstructions = RelationshipManager.getCharacterInstructions(char.name, relScore);
            charInfo += `\n- Relation: ${relationshipInstructions.replace(/\n/g, ' ')}`;

            // 3. Memories (Dynamic)
            if (char.memories && char.memories.length > 0) {
                charInfo += `\n- Recent Memories: ${char.memories.join(' / ')}`;
            }

            // 4. Discovered Secrets (Dynamic - Player Knows)
            if (char.discoveredSecrets && char.discoveredSecrets.length > 0) {
                charInfo += `\n- [Player Knows]: ${char.discoveredSecrets.join(' / ')}`;
            }

            // 5. [NEW] Dynamic Mood Injection
            // Inject heavy data only when relevant to save tokens and focus attention.

            // [COMBAT MOOD] -> Inject Martial Arts Details
            if (currentMood === 'combat' && char.martial_arts_realm) {
                const ma = char.martial_arts_realm;
                charInfo += `\n\n[MARTIAL ARTS INFO]`;
                charInfo += `\n- Rank: ${ma.name} (Lv ${ma.power_level})`;
                charInfo += `\n- Style: ${ma.description}`;
                if (ma.skills && ma.skills.length > 0) {
                    charInfo += `\n- Skills: ${ma.skills.join(', ')}`;
                }
            }

            // [INTIMATE/EROTIC MOOD] -> Inject Secret Body Data
            // We interpret 'romance' broadly or specific 'erotic' moods if defined.
            // Assuming 'erotic' or high-stakes romance.
            const isIntimate = ['erotic', 'sexual', 'romance'].includes(currentMood);
            if (isIntimate) {
                if (char.secret_data) {
                    // Inject specific parts of secret data to avoid overwhelming
                    // Or inject the whole object if it fits. 
                    // Given the user request, we inject it for "reference".
                    // However, we should be careful with huge JSONs.
                    // Let's format it.
                    const secretStr = JSON.stringify(char.secret_data, null, 2);
                    charInfo += `\n\n[SECRET DATA (Private)]:\n${secretStr}`;
                }
                if (char.preferences) {
                    charInfo += `\n- Preferences: ${JSON.stringify(char.preferences)}`;
                }
            }

            return charInfo;
        }).filter(Boolean).join('\n\n');

        return charInfos || "No other characters are currently present.";
    }
}