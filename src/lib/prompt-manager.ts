import { SYSTEM_PROMPT_TEMPLATE } from '../data/prompts/system';

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
}

export class PromptManager {
    static generateSystemPrompt(state: GameState, language: 'ko' | 'en' | null, userMessage?: string): string {
        let prompt = SYSTEM_PROMPT_TEMPLATE;

        // 0. Player Stats Injection
        const stats = state.playerStats;
        const personality = stats.personality || {};
        const inventoryList = state.inventory.map((i: any) => `${i.name} x${i.quantity}`).join(', ') || "None";

        const playerStatus = `
- Name: ${state.playerStats.playerName || "Player"}
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

            let charInfo = `Name: ${char.name}\nDescription: ${char.description}\nPersonality: ${char.personality}\nTrauma: ${char.trauma}\nDefault Expression: ${char.default_expression}`;

            if (char.memories && char.memories.length > 0) {
                charInfo += `\nMemories/Secrets: ${char.memories.join(', ')}`;
            }

            return charInfo;
        }).filter(Boolean).join('\n\n');

        prompt = prompt.replace('{{CHARACTER_INFO}}', charInfos || "No other characters are currently present.");

        // 6. Available Characters Summary (for AI to pick from)
        const availableCharsSummary = Object.values(charsData).map((c: any) => {
            return `- ${c.name} (${c.role || 'Unknown'}): ${c.description.substring(0, 50)}...`;
        }).join('\n');

        prompt = prompt.replace('{{AVAILABLE_CHARACTERS}}', availableCharsSummary || "None");

        // 7. Available Backgrounds Injection
        const AVAILABLE_BACKGROUNDS = [
            "마을_거리", "집_거실", "집_누나방", "집_주인공방", "집_화장실",
            "학교_계단", "학교_교실_수업중", "학교_교실_쉬는시간", "학교_교실_한적",
            "학교_도서실", "학교_매점", "학교_미술실", "학교_보건실",
            "학교_복도_쉬는시간", "학교_복도_조용", "학교_옥상", "학교_잔디밭",
            "학교_정문", "학교_체육창고", "학교_탈의실", "학교_학생식당"
        ];
        prompt = prompt.replace('{{AVAILABLE_BACKGROUNDS}}', AVAILABLE_BACKGROUNDS.join(', '));

        // 8. Available Character Images Injection
        const AVAILABLE_CHARACTER_IMAGES = [
            "강시아_기본", "김다인_기본", "김현준_기본", "박진수_기본", "원정민_기본",
            "유민우_기본", "윤서영_기본", "이하은_기본", "최선우_기본", "한별_기본"
        ];
        prompt = prompt.replace('{{AVAILABLE_CHARACTER_IMAGES}}', AVAILABLE_CHARACTER_IMAGES.join(', '));

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
