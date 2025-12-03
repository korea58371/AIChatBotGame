import { SYSTEM_PROMPT_TEMPLATE } from '../data/prompts/system';
import { MOOD_PROMPTS, MoodType } from '@/data/prompts/moods';

interface GameState {
    activeCharacters: string[]; // IDs of characters currently in the scene
    currentLocation: string;
    scenarioSummary: string;
    currentEvent: string;
    characterData?: Record<string, any>; // Dynamic character data
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
}

export class PromptManager {
    static generateSystemPrompt(state: GameState, language: 'ko' | 'en' | null, userMessage?: string): string {
        let prompt = SYSTEM_PROMPT_TEMPLATE;

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
- HP: ${stats.hp}/${stats.maxHp}, MP: ${stats.mp}/${stats.maxMp}
- Gold: ${stats.gold}
- Stats: STR ${stats.str}, AGI ${stats.agi}, INT ${stats.int}, VIT ${stats.vit}, LUK ${stats.luk}
- Personality: Selfishness ${personality.selfishness}, Heroism ${personality.heroism}, Morality ${personality.morality}
- Inventory: ${inventoryList}
        `.trim();

        prompt = prompt.replace('{{PLAYER_STATS}}', playerStatus);

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

        // Start with active characters
        const activeCharIds = new Set(state.activeCharacters);

        // Check user input AND location context for mentions of other characters
        const locationContext = (state.currentLocation + (locationDesc || "")).toLowerCase();
        const userContext = (userMessage || "").toLowerCase();

        Object.values(charsData).forEach((char: any) => {
            // Check if name (Korean or English key) appears in user message or location context
            const key = Object.keys(charsData).find(k => charsData[k] === char);
            const charName = char.name.toLowerCase();

            if (key) {
                // Check key (e.g. "alicia")
                if (userContext.includes(key) || locationContext.includes(key)) {
                    activeCharIds.add(key);
                }
            }
            // Check name (e.g. "엘리시아")
            if (userContext.includes(charName) || locationContext.includes(charName)) {
                if (key) activeCharIds.add(key);
            }
        });

        const charInfos = Array.from(activeCharIds).map(charId => {
            const char = charsData[charId];
            if (!char) return null;

            let charInfo = `Name: ${char.name} (${char.role || 'Unknown'})`;
            if (char.title) charInfo += `\nTitle: ${char.title}`;
            if (char.quote) charInfo += `\nQuote: "${char.quote}"`;

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

            // Secret is only shown if explicitly unlocked or for AI context
            if (char.secret) {
                if (typeof char.secret === 'string') {
                    charInfo += `\nSecret: ${char.secret}`;
                } else {
                    charInfo += `\nSecret (NSFW/Private): ${JSON.stringify(char.secret)}`;
                }
            }

            charInfo += `\nDefault Expression: ${char.default_expression}`;

            return charInfo;
        }).filter(Boolean).join('\n\n');

        prompt = prompt.replace('{{CHARACTER_INFO}}', charInfos || "No other characters are currently present.");

        // 6. Available Characters Summary (for AI to pick from)
        const availableCharsSummary = Object.values(charsData).map((c: any) => {
            const desc = c.description || c.title || (c.appearance && c.appearance['전체적 인상']) || "Unknown";
            return `- ${c.name} (${c.role || 'Unknown'}): ${desc.substring(0, 50)}...`;
        }).join('\n');

        prompt = prompt.replace('{{AVAILABLE_CHARACTERS}}', availableCharsSummary || "None");

        // 7. Available Backgrounds Injection
        const AVAILABLE_BACKGROUNDS = state.availableBackgrounds && state.availableBackgrounds.length > 0
            ? state.availableBackgrounds
            : ["마을_거리", "집_거실", "집_누나방", "집_주인공방", "집_화장실", "학교_교실_수업중", "학교_복도_쉬는시간", "학교_정문"]; // Fallback

        prompt = prompt.replace('{{AVAILABLE_BACKGROUNDS}}', AVAILABLE_BACKGROUNDS.join(', '));

        // 8. Available Character Images Injection
        const AVAILABLE_CHARACTER_IMAGES = state.availableCharacterImages && state.availableCharacterImages.length > 0
            ? state.availableCharacterImages
            : ["강시아_기본", "김다인_기본", "주인공_기본"]; // Fallback

        prompt = prompt.replace('{{AVAILABLE_CHARACTER_IMAGES}}', AVAILABLE_CHARACTER_IMAGES.join(', '));

        // CRITICAL: Instruct AI to use '주인공' tag for the player
        prompt += `\n\n**IMPORTANT IMAGE RULE**: For the protagonist '${playerName}', ALWAYS use the image tag starting with '주인공_' (e.g., '주인공_기본', '주인공_happy'). Do NOT use '${playerName}' as the image tag prefix.`;

        // 9. Mood Injection
        const currentMood = state.currentMood || 'daily';
        let moodPrompt = MOOD_PROMPTS[currentMood] || MOOD_PROMPTS['daily'];

        // Special handling for Combat: Inject detailed stats for comparison
        if (currentMood === 'combat') {
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
}