
import { GameEvent } from './event-manager';

export interface GameData {
    world: any;
    characters: any;
    backgroundList: any;
    events: GameEvent[];
    scenario: string;
    backgroundMappings: Record<string, string>;
    getSystemPromptTemplate: (state: any, language: 'ko' | 'en' | 'ja' | null) => string;
    getRankInfo: (fame: number) => any;
    wikiData?: any;
    characterMap?: Record<string, string>;
    extraMap?: Record<string, string>;
    constants?: { FAMOUS_CHARACTERS: string; CORE_RULES: string };
    lore?: any;
    characterCreationQuestions?: any[];
}

export class DataManager {
    static async loadGameData(gameId: string): Promise<GameData> {
        console.log(`[DataManager] Loading data for game: ${gameId}`);

        try {
            // Validate gameId to prevent directory traversal
            const validGames = ['god_bless_you', 'wuxia'];
            if (!validGames.includes(gameId)) {
                throw new Error(`Invalid game ID: ${gameId}`);
            }

            // Standard Paths for a Game Module
            // Note: We use template literals in import() - Webpack/Next.js supports this partial dynamic import
            // ensuring we only import from known data structure.

            // 1. JSON Data & Scripts
            // Explicitly handling imports to ensure bundler (Turbopack/Webpack) can trace them statically.
            let worldModule, charactersModule, bgListModule, eventsModule, scenarioModule, bgMappingsModule, systemPromptModule, wikiDataModule, charMapModule, extraMapModule, constantsModule, loreModule;

            console.log(`[DataManager] Starting explicit import for ${gameId}...`);

            switch (gameId) {
                case 'god_bless_you':
                    try {
                        try {
                            console.log('- Importing world.json...');
                            worldModule = await import('@/data/games/god_bless_you/world.json');
                        } catch (e) {
                            console.warn('[DataManager] world.json not found, using empty default.');
                            worldModule = { default: { locations: {}, items: {} } };
                        }

                        console.log('- Importing characters.json...');
                        charactersModule = await import('@/data/games/god_bless_you/characters.json');

                        console.log('- Importing background_list.json...');
                        bgListModule = await import('@/data/games/god_bless_you/background_list.json');

                        console.log('- Importing events.ts...');
                        eventsModule = await import('@/data/games/god_bless_you/events');

                        console.log('- Importing start_scenario.ts...');
                        scenarioModule = await import('@/data/games/god_bless_you/start_scenario');

                        console.log('- Importing backgroundMappings.ts...');
                        bgMappingsModule = await import('@/data/games/god_bless_you/backgroundMappings');

                        console.log('- Importing prompts/system.ts...');
                        systemPromptModule = await import('@/data/games/god_bless_you/prompts/system');

                        // Constants
                        console.log('- Importing constants.ts...');
                        constantsModule = await import('@/data/games/god_bless_you/constants');

                        // Maps
                        // @ts-ignore
                        const charMap = await import('@/data/games/god_bless_you/character_map.json');
                        charMapModule = charMap.default || charMap;

                        // @ts-ignore
                        const extraMap = await import('@/data/games/god_bless_you/extra_map.json');
                        extraMapModule = extraMap.default || extraMap;

                        // Wiki Data (Optional, specific to God Bless You)
                        try {
                            // @ts-ignore
                            const wiki = await import('@/data/games/god_bless_you/wiki_data.json');
                            // [Fix] Don't mutate import result. Store in local variable.
                            // @ts-ignore
                            const wikiDataLoaded = wiki.default || wiki;
                            // Attach to worldModule temporarily or just return it? 
                            // Better to just return it in the return statement.
                            // We need to pass it out of the switch.
                            // Let's attach it to 'systemPromptModule' or just use a scope variable?
                            // We defined 'let ...' at the top. Let's add 'wikiDataModule' there.
                            wikiDataModule = wikiDataLoaded;
                        } catch (e) {
                            console.warn('Wiki data not found for god_bless_you');
                            wikiDataModule = {};
                        }

                    } catch (e) {
                        console.error(`[DataManager] IMPORT ERROR in 'god_bless_you':`, e);
                        throw e;
                    }
                    break;
                case 'wuxia':
                    try {
                        try {
                            worldModule = await import('@/data/games/wuxia/world.json');
                        } catch (e) {
                            console.warn('[DataManager] world.json not found for wuxia, using empty default.');
                            worldModule = { default: { locations: {}, items: {} } };
                        }
                        charactersModule = await import('@/data/games/wuxia/characters.json');
                        // Use Server Action for Dynamic Backgrounds
                        const { getBackgroundList } = await import('@/app/actions/game');
                        bgListModule = await getBackgroundList('wuxia');

                        eventsModule = await import('@/data/games/wuxia/events');
                        scenarioModule = await import('@/data/games/wuxia/start_scenario');
                        bgMappingsModule = await import('@/data/games/wuxia/backgroundMappings');
                        systemPromptModule = await import('@/data/games/wuxia/prompts/system');

                        // Constants
                        constantsModule = await import('@/data/games/wuxia/constants');

                        // Lore (Wuxia Only)
                        loreModule = await import('@/data/games/wuxia/jsons');

                        // Maps
                        // @ts-ignore
                        const charMap = await import('@/data/games/wuxia/character_map.json');
                        charMapModule = charMap.default || charMap;

                        // @ts-ignore
                        const extraMap = await import('@/data/games/wuxia/extra_map.json');
                        extraMapModule = extraMap.default || extraMap;
                    } catch (e) {
                        console.error(`[DataManager] IMPORT ERROR in 'wuxia':`, e);
                        throw e;
                    }
                    break;
                default:
                    throw new Error(`Unknown game ID: ${gameId}`);
            }

            console.log('[DataManager] All imports successful.');

            return {
                world: worldModule.default || worldModule,
                characters: charactersModule.default || charactersModule,
                backgroundList: bgListModule.default || bgListModule,
                scenario: scenarioModule.START_SCENARIO_TEXT || "",
                characterCreationQuestions: (scenarioModule as any).CHARACTER_CREATION_QUESTIONS || null,
                backgroundMappings: bgMappingsModule.backgroundMappings || {},
                getSystemPromptTemplate: systemPromptModule.getSystemPromptTemplate,
                getRankInfo: systemPromptModule.getRankInfo,
                wikiData: wikiDataModule || {},
                characterMap: charMapModule || {},
                extraMap: extraMapModule || {},
                // Fix: Spread module into plain object to avoid serialization error
                // Fix: Spread module into plain object to avoid serialization error
                constants: constantsModule ? { ...constantsModule } as any : undefined,
                // Fix: WuxiaLore contains nested modules (factionsDetail, charactersDetail) which need unwrapping
                lore: loreModule?.WuxiaLore ? {
                    ...loreModule.WuxiaLore,
                    factionsDetail: { ...loreModule.WuxiaLore.factionsDetail },
                    charactersDetail: { ...loreModule.WuxiaLore.charactersDetail }
                } : {}
            };

        } catch (error) {
            console.error(`[DataManager] Failed to load game data for ${gameId}:`, error);
            throw error;
        }
    }
}
