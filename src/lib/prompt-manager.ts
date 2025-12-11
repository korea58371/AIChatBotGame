import { getSystemPromptTemplate } from '../data/prompts/system';
import { MOOD_PROMPTS, MoodType } from '@/data/prompts/moods';
import { RelationshipManager } from './relationship-manager';

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
}

export class PromptManager {
    static generateSystemPrompt(state: GameState, language: 'ko' | 'en' | null, userMessage?: string): string {
        let prompt = getSystemPromptTemplate(state, language);

        // [Requirement] Prepend Summarized Memory (Long-term Memory) to System Prompt
        // This ensures the model prioritizes past context.
        const memorySection = state.scenarioSummary
            ? `\n[Previous Story Summary]\n${state.scenarioSummary}\n\n`
            : "";

        prompt = memorySection + prompt;

        // Inject Player Name
        const playerName = state.playerName || "주인공";
        prompt = prompt.replace(/{{PLAYER_NAME}}/g, playerName);

        // 0. Player Stats Injection
        const stats = state.playerStats;
        const personality = stats.personality || {};
        const inventoryList = state.inventory.map((i: any) => `${i.name} x${i.quantity}`).join(', ') || "None";

        const playerStatus = `
- Name: ${playerName}
- Level: ${stats.level} (EXP: ${stats.exp})
- Fame: ${stats.fame || 0}
- HP: ${stats.hp}/${stats.maxHp}, MP: ${stats.mp}/${stats.maxMp}
- Gold: ${stats.gold}
- Stats: STR ${stats.str}, AGI ${stats.agi}, INT ${stats.int}, VIT ${stats.vit}, LUK ${stats.luk}
- Personality: Selfishness ${personality.selfishness}, Heroism ${personality.heroism}, Morality ${personality.morality}
- Inventory: ${inventoryList}
        `.trim();



        // 1. World Info (Location)
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

            if (char.relationshipInfo) {
                charInfo += `\nRelationship: ${JSON.stringify(char.relationshipInfo)}`;
            }

            charInfo += `\nDefault Expression: ${char.default_expression}`;

            return charInfo;
        }).filter(Boolean).join('\n\n');

        prompt = prompt.replace('{{CHARACTER_INFO}}', charInfos || "No other characters are currently present.");

        // 6. Available Characters Summary (Context-Aware)
        const availableChars = PromptManager.getSpawnCandidates(state);

        prompt = prompt.replace('{{AVAILABLE_CHARACTERS}}', availableChars || "None");

        // 7. Context-Aware Background Injection (FULL LIST REQUESTED BY USER)
        // User requested to show ALL backgrounds to avoid missing Dungeon/Specific ones.
        const relevantBackgrounds = state.availableBackgrounds || [];

        // Group by Category to save tokens and improve AI understanding
        const groupedBgs: Record<string, string[]> = {};
        relevantBackgrounds.forEach(bg => {
            const parts = bg.replace(/\.(jpg|png)$/i, '').split('_');
            const category = parts[0];

            // [User Request] Simplify: Only use the 2nd classification (Name)
            // e.g., "City_Street_Day" -> "Street"
            // "School_Corridor" -> "Corridor"
            const name = parts[1] || 'Default';

            if (!groupedBgs[category]) groupedBgs[category] = [];
            if (!groupedBgs[category].includes(name)) { // Dedup
                groupedBgs[category].push(name);
            }
        });

        const formattedBgs = Object.entries(groupedBgs)
            .map(([cat, names]) => `- [${cat}] ${names.join(', ')}`)
            .join('\n');

        prompt = prompt.replace('{{AVAILABLE_BACKGROUNDS}}', formattedBgs);

        // 8. Available Character Images Injection (Optimized)
        // Instead of listing all files, we provide a rule.
        const availableNames = Object.values(charsData)
            .map(c => c.name)
            .filter(Boolean)
            .join(', ');

        const imageRule = `
**IMAGE RULE**:
- Character images follow the format: \`[Name]_[Emotion].png\`
- Standard emotions: \`기본\`, \`기쁨\`, \`슬픔\`, \`분노\`, \`애정당황\`.
- Example: If Name is '민소희', use '민소희_기쁨' for happy expression.
- Available Character Names: ${availableNames || "None"}
- For the protagonist '${playerName}', ALWAYS use '주인공_[Emotion]'.
`.trim();

        prompt = prompt.replace('{{AVAILABLE_CHARACTER_IMAGES}}', imageRule);

        // 10. Available Extra Character Images Injection
        // Load directly from the generated map to ensure availability on server-side
        let extraNamesStr = "None";
        try {
            const extraMap = require('../../public/assets/ExtraCharacters/extra_map.json');
            const extraNames = Object.keys(extraMap);
            if (extraNames.length > 0) {
                extraNamesStr = extraNames.join(', ');
            }
        } catch (e) {
            console.error("Failed to load extra_map.json", e);
        }

        const extraImages = state.availableExtraImages && state.availableExtraImages.length > 0
            ? state.availableExtraImages.join(', ')
            : extraNamesStr; // Fallback to loaded map if state is empty

        prompt = prompt.replace('{{AVAILABLE_EXTRA_CHARACTERS}}', extraImages);

        // 9. Mood Injection
        const currentMood = state.currentMood || 'daily';
        let moodPrompt = MOOD_PROMPTS[currentMood] || MOOD_PROMPTS['daily'];

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

        console.log("Generated System Prompt:", prompt); // Debug Log
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

    static getRelevantBackgrounds(currentLocation: string): string[] {
        // Simple heuristic: Keyword matching
        // We use require here to avoid top-level import cycles if any, though bgList is data.
        const bgFiles = require('../data/background_list.json');

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
}