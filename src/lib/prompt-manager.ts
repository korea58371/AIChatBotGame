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
    memories?: string[]; // Added: Character specific memories
    discoveredSecrets?: string[]; // Added: Secrets the player has learned
    default_expression?: string;
    description?: string;
    spawnRules?: SpawnRules;
    englishName?: string; // Added for image rule
    relationshipInfo?: {
        relation: string;
        callSign: string;
        speechStyle: string;
        endingStyle: string;
    };
    relationships?: Record<string, string>; // Added: Inter-character relationships
}

// Lightweight character structure for Logic Model to save tokens
interface LightweightCharacter {
    name: string;
    englishName?: string;
    role?: string;
    spawnRules?: SpawnRules;
    description?: string; // Short description
}

interface GameState {
    activeCharacters: string[]; // IDs of characters currently in the scene
    currentLocation: string;
    scenarioSummary: string;
    currentEvent: string;
    characterData?: Record<string, Character>; // Dynamic character data
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
    availableExtraImages?: string[]; // Added
    isDirectInput?: boolean;
    getSystemPromptTemplate?: (state: any, language: 'ko' | 'en' | 'ja' | null) => string;
    constants?: { FAMOUS_CHARACTERS: string; CORE_RULES: string;[key: string]: string };
    lore?: any;
    activeGameId?: string; // Added for game-specific logic
    backgroundMappings?: Record<string, string>; // Added for Wuxia Korean keys
}

export class PromptManager {
    static async getSharedStaticContext(
        state: GameState,
        activeChars?: string, // e.g. "Ju Ye-seo (Affection: 50), ..."
        spawnCandidates?: string
    ): Promise<string> {
        // [CONTEXT CACHING PREFIX]
        // This section is designed to be STATIC and IDENTICAL across multiple turns and models (Story & Logic).
        // It contains the heavy reference data (Characters, Backgrounds, World).
        // By placing this at the very top, we enable Gemini's Context Caching.

        // [FIXED] Use Game-Specific Constants
        // If state.constants is missing, we should NOT fallback to God Bless You data.
        const famousCharactersDB = state.constants?.FAMOUS_CHARACTERS || "No famous characters data loaded.";

        // const availableChars = PromptManager.getAvailableCharacters(state); // [REMOVED] Redundant with LoreConverter
        const availableExtra = PromptManager.getAvailableExtraCharacters(state) || "None";
        const availableBackgrounds = PromptManager.getAvailableBackgrounds(state); // Heavy list

        // [Dynamic Emotion List]
        let emotionListString = "자신감, 의기양양, 진지함, 짜증, 삐짐, 혐오, 고민, 박장대소, 안도, 놀람, 부끄러움, 결의, 거친호흡, 글썽거림, 고통, 공포, 오열, 수줍음, 지침, 폭발직전";
        if (state.activeGameId === 'wuxia') {
            emotionListString = `
    - **기본 감정 (단계별)**: 기쁨1, 기쁨2, 기쁨3, 화남1, 화남2, 화남3, 슬픔1, 슬픔2, 슬픔3, 부끄1, 부끄2, 부끄3
    - **특수 표정**: 고양이, 음침, 경멸, 어지러움, 멍함, 당황, 충격, 반짝
    - **기타**: 기본, 결의, 혐오, 취함, 기대, 하트, 고통, 유혹, 졸림, 놀람, 고민, 광기`;
        }

        // [WUXIA LORE INJECTION]
        let loreContext = "";
        if (state.lore) {
            // Filter or format logic?
            // For now, we inject the entire Knowledge Base as a Reference.
            // We use JSON stringify with indentation for readability (LLMs understand formatted JSON well).
            // [FIX] Use deterministic sort for Cache Stability
            try {
                // [Optimization] Convert JSON to Markdown to save 30-40% tokens
                loreContext = `
## [🌏 WORLD KNOWLEDGE BASE (LORE)]
Use this detailed information to maintain consistency in the world setting, martial arts, systems, and factions.
${LoreConverter.convertToMarkdown(state.lore)}
`;
            } catch (e) {
                console.error("Failed to convert lore to markdown, falling back to JSON", e);
                loreContext = `
## [🌏 WORLD KNOWLEDGE BASE (LORE)]
Use this detailed information to maintain consistency in the world setting, martial arts, systems, and factions.
${JSON.stringify(PromptManager.deepSort(state.lore), null, 2)}
`;
            }
        }

        return `
# [SHARED STATIC CONTEXT]
The following information is constant reference data.

## [👥 고정된 유명인 DB (변경 불가)]
아래 인물들은 세계관 내의 '상수'입니다. 이들의 이름이 언급되거나 등장할 경우, **반드시 아래 설정(등급/직업)을 유지**해야 합니다.
(주인공은 이들을 미디어로만 접해 알고 있으며, 개인적 친분은 없는 상태입니다.)
${famousCharactersDB}

${loreContext}

---

${state.constants?.WUXIA_SYSTEM_PROMPT_CONSTANTS || state.constants?.CORE_RULES || ""}

---

### [📚 Reference Data (Context Caching Optimized)]


**2. Available Extra Characters (엑스트라/단역)**
${availableExtra}

**3. Available Backgrounds (사용 가능 배경)**
# Background Output Rule
- When the location changes, output the \`<배경>\` tag with a **Korean Keyword** from the list below.
- **STRICT RULE**: You must SELECT from the provided list below. **Do NOT invent new background filenames.**
- If you cannot find an exact match, use the most similar existing background from the list.
- **Format**: \`<배경>Category_Location\` (e.g., \`<배경>객잔_1층\`)
- **Variant Handling**: Match the exact key provided.
- \`<배경>반지하\` (X) - DO NOT use invalid keys.
${availableBackgrounds}

**4. Character Emotions (사용 가능 감정)**
# Character Dialogue Rules
1. Format: \`<대사>CharacterName_Emotion: Dialogue Content\`
2. **Decoupled Name/Image**: To use a specific image asset (e.g. 'Drunk_Ronin') while displaying a valid name (e.g. 'Yeop Mun'), use: \`<대사>DisplayName(AssetKey)_Emotion: ...\`
   - Example: \`<대사>엽문(낭인무사(술좋아하는))_기쁨: 어이!\` (Image: 낭인무사(술좋아하는), Name: 엽문)
   - Note: The Asset Key must match exactly or partially match an available Extra Image.
3. Name must be Korean (e.g. 천서윤).
3. Emotion must be one of:
   - ${emotionListString}

---
`;
    }

    static generateSystemPrompt(state: GameState, language: 'ko' | 'en' | null, userMessage?: string): string {

        // ... (rest of the prompt construction)
        // I need to verify where to insert `emotionListString`.
        // The original code has the prompt inside `getPromptTemplate`?
        // Wait, the previous view_file showed `generateSystemPrompt` starts at 160.
        // And the static property or method `getPromptTemplate` wasn't fully visible or I missed it.
        // The user pointed to LINES 149-154 which seemed to be inside a template literal, possibly returned by a helper method?
        // Let's look at the file content again. `view_file` showed lines 140-160.
        // It seems `generateSystemPrompt` calls something or constructs the string.
        // Ah, `generateSystemPrompt` likely USES the string defined earlier?
        // Or the lines 140-158 were part of a CONSTANT or a private method?
        // Let's assume it is inside `getBasePrompt` or similar.
        // I should view the file `src/lib/prompt-manager.ts` around line 160 to see HOW the system prompt is assembled.

        // [NOW DYNAMIC ONLY]
        // The static part is handled separately by getSharedStaticContext
        let prompt = "";

        if (state.getSystemPromptTemplate) {
            prompt = state.getSystemPromptTemplate(state, language);
        } else {
            prompt = "System prompt template not loaded.";
        }


        const worldData = state.worldData || { locations: {}, items: {} };
        const locData = worldData.locations[state.currentLocation];

        let locationDesc = "Unknown location";
        let locationSecrets = "";

        if (typeof locData === 'string') {
            locationDesc = locData;
        } else if (locData) {
            locationDesc = locData.description;
            if (locData.secrets && locData.secrets.length > 0) {
                locationSecrets = `\nSecrets/Clues: ${locData.secrets.join(', ')}`;
            }
        }

        prompt = prompt.replace('{{WORLD_INFO}}', `Current Location: ${state.currentLocation} - ${locationDesc}${locationSecrets}`);

        // 2. Scenario Summary
        prompt = prompt.replace('{{SCENARIO_SUMMARY}}', state.scenarioSummary || "The story has just begun.");

        // 3. Event Guide
        prompt = prompt.replace('{{EVENT_GUIDE}}', state.currentEvent || "Introduce the world and the main character.");

        // 4. Character Info
        // Use dynamic data from state, fallback to empty object if missing
        const charsData = state.characterData || {};

        // Start with active characters (Normalize to lowercase)
        const activeCharIds = new Set(state.activeCharacters.map(id => id.toLowerCase()));

        // Check user input AND location context for mentions of other characters
        const locationContext = (state.currentLocation + (locationDesc || "")).toLowerCase();
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

        const charInfos = Array.from(activeCharIds).map(charId => {
            const char = charsData[charId];
            if (!char) return null;

            let charInfo = `Name: ${char.name} (${char.role || 'Unknown'})`;
            if (char.title) charInfo += `\nTitle: ${char.title}`;
            if (char.quote) charInfo += `\nQuote: "${char.quote}"`;

            // [New] Relationship Pacing (Affinity Tier)
            const relScore = state.playerStats.relationships?.[charId] || 0;
            const relationshipInstructions = RelationshipManager.getCharacterInstructions(char.name, relScore);
            charInfo += `\n\n${relationshipInstructions}\n`;

            if (char.profile) {
                charInfo += `\nProfile: ${JSON.stringify(char.profile)}`;
            }
            if (char.appearance) {
                charInfo += `\nAppearance: ${JSON.stringify(char.appearance)}`;
            }
            if (char.job) {
                charInfo += `\nJob/Abilities: ${JSON.stringify(char.job)}`;
            }

            const desc = char.description || (char.appearance && char.appearance['전체적 인상']) || char.title || "No description available.";
            charInfo += `\nDescription: ${desc}`;

            if (char.personality) {
                if (typeof char.personality === 'string') {
                    charInfo += `\nPersonality: ${char.personality}`;
                } else {
                    charInfo += `\nPersonality: ${JSON.stringify(char.personality)}`;
                }
            }

            if (char.preferences) {
                charInfo += `\nPreferences: ${JSON.stringify(char.preferences)}`;
            }

            // [FIX] Inject Character Memories
            if (char.memories && char.memories.length > 0) {
                charInfo += `\n[Memories (Events/Facts this character remembers)]:\n- ${char.memories.join('\n- ')}`;
            }

            // CRITICAL: SEPARATE SECRETS
            // 1. Discovered Secrets (Known to Player)
            if (char.discoveredSecrets && char.discoveredSecrets.length > 0) {
                charInfo += `\n\n[KNOWN FACTS (The Player KNOWS this)]:\n- ${char.discoveredSecrets.join('\n- ')}`;
            }

            // 2. Hidden Secrets (Unknown to Player)
            if (char.secret) {
                const secretStr = typeof char.secret === 'string' ? char.secret : JSON.stringify(char.secret, null, 2);
                charInfo += `\n\n[HIDDEN SECRETS (The Player DOES NOT KNOW this)]:\n${secretStr}`;
                charInfo += `\n\n**WARNING**: The player is UNAWARE of the [HIDDEN SECRETS] above. You MUST NOT reference them as common knowledge. Only use them to guide the character's internal motives or reactions. Reveal them ONLY if the narrative naturally leads to a discovery event.`;
            }

            // [New] Static Relationships (Inter-Character Dynamics)
            if (char.relationships) {
                charInfo += `\n\n[Human Relationships (How this character views others)]:\n${JSON.stringify(char.relationships, null, 2)}`;
            }

            if (char.relationshipInfo) {
                charInfo += `\nRelationship: ${JSON.stringify(char.relationshipInfo)}`;
            }

            charInfo += `\nDefault Expression: ${char.default_expression}`;

            return charInfo;
        }).filter(Boolean).join('\n\n');

        prompt = prompt.replace('{{CHARACTER_INFO}}', charInfos || "No other characters are currently present.");

        // 6. Active Character Info
        const activeCharInfo = PromptManager.getActiveCharacterProps(state);
        prompt = prompt.replace('{{CHARACTER_INFO}}', activeCharInfo);

        // 7. Images / Extra / Backgrounds -> Already in Static Context
        // We just need to ensure placeholders are handled if they still exist in the template
        // But we removed them from system.ts template, so we don't need to replace them here.

        // However, we added {{AVAILABLE_CHARACTER_IMAGES}} for rule?
        // Let's check system.ts. We REMOVED Reference Data.
        // So we don't need to inject them here.

        /* [MOVED TO STATIC CONTEXT]
        - Available Characters
        - Available Backgrounds
        - Available Extra Characters
        - Character Image Rules
        */

        // 9. Mood Injection
        const currentMood = state.currentMood || 'daily';
        const moodPrompts = getMoodPrompts(state.activeGameId);
        let moodPrompt = moodPrompts[currentMood] || moodPrompts['daily'];

        // Special handling for Combat: Inject detailed stats for comparison
        if (currentMood === 'combat') {
            const stats = state.playerStats; // Re-declare for local scope if needed
            moodPrompt += `\n\n[Combat Stats Analysis]\nPlayer Stats: STR ${stats.str}, AGI ${stats.agi}, INT ${stats.int}, VIT ${stats.vit}, LUK ${stats.luk}\nSkills: ${stats.skills.join(', ') || "None"}\n\nCompare these stats with the opponent's estimated stats to determine the outcome of the exchange.`;
        }

        prompt += `\n\n${moodPrompt}`;

        // 5. Language Instruction
        if (language === 'ko') {
            prompt += `\n\n**IMPORTANT: ALL OUTPUT MUST BE IN KOREAN (한국어).**`;
        } else if (language === 'en') {
            prompt += `\n\n**IMPORTANT: ALL OUTPUT MUST BE IN ENGLISH.**`;
        }

        // console.log("Generated System Prompt:", prompt); // Debug Log
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

                return `- ${c.name} (${age}/${gender}) | Role: ${c.role || 'Unknown'} | Job: ${jobStr} | Personality: ${personaStr}${appearanceStr} | (Score: ${item.score.toFixed(1)}) ${tagStr}`;
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

            let info = `- ${c.name} (${c.role}): Active in scene.`;

            // Pass existing Memories for consolidation
            if (c.memories && c.memories.length > 0) {
                info += `\n  - Current Memories: ${JSON.stringify(c.memories)}`;
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
                info += `\n- [HIDDEN TRUTH]: ${secretStr} (Player Unknown)`;
            }

            return info;
        }).join('\n\n');
    }

    static getAvailableExtraCharacters(state: GameState & { extraMap?: Record<string, string> }): string {
        // Load directly from the state (Loaded by DataManager)
        let extraNamesStr = "None";

        if (state.extraMap) {
            const extraNames = Object.keys(state.extraMap).sort(); // [FIX] Sort keys
            if (extraNames.length > 0) {
                extraNamesStr = extraNames.join(', ');
            }
        } else {
            // Legacy Fallback (Hardcoded - likely to fail for new games but kept for safety)
            try {
                // Determine path based on active game? We don't have gameId here easily unless we add it to state.
                // But state.extraMap SHOULD be present.
                // If not, we skip the require to avoid error spam or wrong file.
            } catch (e) {
                console.warn("Failed to read extra map from state or fallback");
            }
        }

        const extraImages = state.availableExtraImages && state.availableExtraImages.length > 0
            ? [...state.availableExtraImages].sort().join(', ') // [FIX] Sort array
            : extraNamesStr; // Fallback to loaded map if state is empty

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

    static getActiveCharacterProps(state: GameState): string {
        const charsData = state.characterData || {};
        // Normalization
        const activeCharIds = new Set(state.activeCharacters.map(id => id.toLowerCase()));

        // Helper to find Active Chars from State (already logic in generateSystemPrompt, moving here for reuse)
        // Actually, let's keep it simple. `state.activeCharacters` should be the source of truth from Logic Model.
        // But generateSystemPrompt had extra logic to "detect" characters from context.
        // We will move that detection logic to here if we want `activeCharInfo` to be robust.
        // For now, let's just format the IDs currently in `state.activeCharacters`.

        const charInfos = Array.from(activeCharIds).map(charId => {
            const char = charsData[charId];
            if (!char) return null;

            // [OPTIMIZED DYNAMIC CONTEXT]
            // Static info (Profile, Appearance, Job) is already in the Shared Static Context.
            // Here we only provide "Who is here" and "Active State".

            let charInfo = `### [ACTIVE] ${char.name} (${char.role || 'Unknown'})`;

            // 1. Current Context / Status
            if (char.default_expression) charInfo += `\n- Status: ${char.default_expression}`;

            // 2. Relationship Pacing (Dynamic)
            const relScore = state.playerStats.relationships?.[charId] || 0;
            const relationshipInstructions = RelationshipManager.getCharacterInstructions(char.name, relScore);
            charInfo += `\n- Relation: ${relationshipInstructions.replace(/\n/g, ' ')}`; // Inline for compactness

            // 3. Memories (Dynamic)
            if (char.memories && char.memories.length > 0) {
                charInfo += `\n- Recent Memories: ${char.memories.join(' / ')}`;
            }

            // 4. Discovered Secrets (Dynamic - Player Knows)
            if (char.discoveredSecrets && char.discoveredSecrets.length > 0) {
                charInfo += `\n- [Player Knows]: ${char.discoveredSecrets.join(' / ')}`;
            }

            // 5. Hidden Secrets (Dynamic Context - Player DOES NOT Know)
            // We usually don't need to repeat this if it's in Static, BUT if secrets unlock dynamically, we might need logic.
            // For now, assume Static holds the "Truth". If a secret is *revealed*, it moves to discoveredSecrets.
            // So we can omit the hidden block here to save space, relying on Static Context for the "Truth" reference.

            return charInfo;
        }).filter(Boolean).join('\n\n');

        return charInfos || "No other characters are currently present.";
    }
}