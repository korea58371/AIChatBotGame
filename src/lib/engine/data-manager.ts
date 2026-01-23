
import { GameEvent } from './event-manager';
import { GameRegistry } from '@/lib/registry/GameRegistry';

export interface GameData {
    world: any;
    characters: any;
    characterImageList: string[];
    extraCharacterList: string[];
    backgroundList: any;
    events: GameEvent[];
    scenario: string;
    backgroundMappings: Record<string, string>;
    getSystemPromptTemplate: (state: any, language: 'ko' | 'en' | 'ja' | null) => string;
    getRankInfo: (input: string | number) => any;
    wikiData?: any;
    characterMap?: Record<string, string>;
    extraMap?: Record<string, string>;
    cgMap?: Record<string, string>; // [New]
    constants?: {
        FAMOUS_CHARACTERS: string;
        CORE_RULES: string;
        FACTION_BEHAVIOR_GUIDELINES?: string;
        WUXIA_ALLOWED_EMOTIONS?: string;
    };
    lore?: any;
    characterCreationQuestions?: any[];
    initialLocation?: string; // [New] Explicit Start Location
}

export class DataManager {
    /**
     * 게임 데이터를 로드하는 정적 메서드입니다.
     * @param gameId 로드할 게임의 ID (예: 'wuxia', 'god_bless_you')
     * @returns 로드된 게임 데이터 객체 (GameData)
     */
    static async loadGameData(gameId: string): Promise<GameData> {
        console.log(`[DataManager] 게임 데이터 로딩 시작: ${gameId}`);

        try {
            // Validate gameId to prevent directory traversal
            const validGames = ['god_bless_you', 'wuxia'];
            if (!validGames.includes(gameId)) {
                throw new Error(`Invalid game ID: ${gameId}`);
            }

            // [REFACTORED SCALABILITY]
            // Delegate loading to the GameRegistry configuration.
            const config = GameRegistry.get(gameId);
            if (!config || !config.loadGameData) {
                console.error(`[DataManager] No configuration or loadGameData found for ${gameId}`);
                // Return empty/safe structure to prevent crash
                return {
                    world: {}, characters: {}, characterImageList: [], extraCharacterList: [],
                    backgroundList: [], events: [], scenario: '', backgroundMappings: {},
                    getSystemPromptTemplate: () => '', getRankInfo: () => null
                } as any;
            }

            // Load raw data from game loader
            const gameData = await config.loadGameData();

            // [Post-Processing] Character Normalization & Hydration
            let finalCharacters = gameData.characters || {};

            // 1. Ensure Dictionary & Name Injection
            // If it's a plain object (Dictionary), ensure Key is injected as 'name' if missing.
            if (finalCharacters && typeof finalCharacters === 'object' && !Array.isArray(finalCharacters)) {
                const hydratedDict: Record<string, any> = {};
                Object.entries(finalCharacters).forEach(([key, val]: [string, any]) => {
                    // Ensure val is an object
                    const charObj = val && typeof val === 'object' ? val : { name: key };
                    hydratedDict[key] = {
                        name: key, // Inject Key as Name (Default)
                        ...charObj
                    };
                });
                finalCharacters = hydratedDict;
            } else if (Array.isArray(finalCharacters)) {
                // [Legacy Support] Array to Dict
                const charDict: Record<string, any> = {};
                finalCharacters.forEach((c: any) => {
                    const name = c.name || (c.profile && c.profile['이름']);
                    if (name) {
                        // Sanitize name
                        const cleanName = name.split('(')[0].trim();
                        charDict[cleanName] = { ...c, name: cleanName };
                    }
                });
                finalCharacters = charDict;
            }

            // 2. Wiki Hydration (If Wiki/Context Data exists)
            const wikiData = gameData.wikiData;

            if (wikiData && finalCharacters) {
                Object.values(finalCharacters).forEach((char: any) => {
                    // Wiki matching logic (Name or Korean Name in Profile)
                    const nameKey = char.name;
                    const profileName = char.profile ? char.profile['이름'] : null;

                    const wikiEntry = wikiData[nameKey] || (profileName && wikiData[profileName]);

                    if (wikiEntry) {
                        // Merge simple properties
                        if (wikiEntry.description && !char.description) char.description = wikiEntry.description;
                        // Merge Profile
                        if (wikiEntry.profile) {
                            char.profile = { ...char.profile, ...wikiEntry.profile };
                        }
                        // Extend as needed with other wiki props
                    }
                });
            }

            // Update characters in gameData
            gameData.characters = finalCharacters;

            return gameData;

        } catch (error) {
            console.error(`[DataManager] Failed to load game data for ${gameId}:`, error);
            throw error;
        }
    }
}
