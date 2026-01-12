
import { GameEvent } from './event-manager';

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
    constants?: {
        FAMOUS_CHARACTERS: string;
        CORE_RULES: string;
        FACTION_BEHAVIOR_GUIDELINES?: string;
        WUXIA_ALLOWED_EMOTIONS?: string;
    };
    lore?: any;
    characterCreationQuestions?: any[];
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

            // Standard Paths for a Game Module
            // Note: We use template literals in import() - Webpack/Next.js supports this partial dynamic import
            // ensuring we only import from known data structure.

            // 1. JSON 데이터 & 스크립트 명시적 import
            // Turbopack/Webpack 번들러가 정적으로 경로를 추적할 수 있도록, 동적 import() 내부에 리터럴 경로를 사용해야 합니다.
            // 변수로 경로를 조합하면 번들러가 파일을 찾지 못할 수 있습니다.
            let worldModule, charactersModule, bgListModule, eventsModule, scenarioModule, bgMappingsModule, systemPromptModule, wikiDataModule, charMapModule, extraMapModule, constantsModule, loreModule;
            let characterImageList = [], extraCharacterList = [];

            console.log(`[DataManager] Starting explicit import for ${gameId}...`);

            // [Common] Load Assets Lists
            let assetsManifest: any;
            try {
                // @ts-ignore
                assetsManifest = (await import('../data/assets.json')).default;
            } catch (e) {
                console.warn("[DataManager] Failed to load assets.json:", e);
                assetsManifest = {};
            }

            try {
                const gameAssets = assetsManifest?.[gameId];
                bgListModule = gameAssets?.backgrounds || [];
                characterImageList = gameAssets?.characters || [];
                extraCharacterList = gameAssets?.extraCharacters || [];
            } catch (e) {
                console.warn("[DataManager] Failed to parse asset lists:", e);
                bgListModule = [];
            }

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

                        console.log('- Importing characters/characters_main.json & supporting...');
                        const charsMain = await import('@/data/games/god_bless_you/jsons/characters/characters_main.json');
                        let charsSupporting = {};
                        try {
                            const charsSuppModule = await import('@/data/games/god_bless_you/jsons/characters/characters_supporting.json');
                            charsSupporting = charsSuppModule.default || charsSuppModule;
                        } catch (e) {
                            console.warn('[DataManager] characters_supporting.json not found for GBY');
                        }

                        // Merge supporting into main (Main overrides if collision)
                        charactersModule = {
                            ...(charsSupporting as object),
                            ...(charsMain.default || charsMain)
                        };

                        // bgListModule loaded above via action

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
                            wikiDataModule = wikiDataLoaded;
                        } catch (e) {
                            console.warn('Wiki data not found for god_bless_you');
                            wikiDataModule = {};
                        }

                        // Lore (God Bless You)
                        try {
                            loreModule = await import('@/data/games/god_bless_you/jsons/index');
                        } catch (e) {
                            console.error("[DataManager] Failed GBY lore", e);
                        }

                    } catch (e) {
                        console.error(`[DataManager] IMPORT ERROR in 'god_bless_you':`, e);
                        throw e;
                    }
                    break;
                case 'wuxia':
                    try {
                        try {
                            worldModule = await import('../data/games/wuxia/world.json');
                            if ((worldModule as any).default) worldModule = (worldModule as any).default;
                        } catch (e) {
                            console.warn('[DataManager] world.json not found for wuxia, using empty default.');
                            worldModule = { locations: {}, items: {} };
                        }

                        // [REFACTOR] Legacy characters.json import REMOVED
                        // charactersModule is now derived solely from Lore Data below.
                        charactersModule = null;

                        // bgListModule loaded above

                        try { eventsModule = await import('../data/games/wuxia/events'); } catch (e) { console.error("[DataManager] Failed events", e); }
                        try { scenarioModule = await import('../data/games/wuxia/start_scenario'); } catch (e) { console.error("[DataManager] Failed scenario", e); }
                        try { bgMappingsModule = await import('../data/games/wuxia/backgroundMappings'); } catch (e) { console.error("[DataManager] Failed bgMappings", e); }
                        try { systemPromptModule = await import('../data/games/wuxia/prompts/system'); } catch (e) { console.error("[DataManager] Failed system prompt", e); }


                        // Constants
                        try { constantsModule = await import('../data/games/wuxia/constants'); } catch (e) { console.error("[DataManager] Failed constants", e); }

                        // Lore (Wuxia Only)
                        try { loreModule = await import('../data/games/wuxia/jsons'); } catch (e) { console.error("[DataManager] Failed lore", e); }

                        // Maps
                        try {
                            // @ts-ignore
                            const charMap = await import('../data/games/wuxia/character_map.json');
                            charMapModule = charMap.default || charMap;
                        } catch (e) { console.error("[DataManager] Failed charMap", e); }

                        try {
                            // @ts-ignore
                            const extraMap = await import('../data/games/wuxia/extra_map.json');
                            extraMapModule = extraMap.default || extraMap;
                        } catch (e) { console.error("[DataManager] Failed extraMap", e); }

                        // Wiki Data
                        try {
                            // @ts-ignore
                            const wiki = await import('../data/games/wuxia/wiki_data.json');
                            // @ts-ignore
                            const wikiDataLoaded = wiki.default || wiki;
                            wikiDataModule = wikiDataLoaded;
                        } catch (e) {
                            console.warn('[DataManager] wiki_data.json not found for wuxia');
                            wikiDataModule = {};
                        }

                        // [REFACTOR] New Character Loading Logic
                        // Load solely from loreModule.WuxiaLore.charactersDetail
                        if (loreModule?.WuxiaLore?.charactersDetail) {
                            const details = loreModule.WuxiaLore.charactersDetail;
                            const charDict: Record<string, any> = {};

                            // Helper to merge dicts
                            const mergeChars = (source: any) => {
                                if (!source) return;
                                Object.entries(source).forEach(([key, val]: [string, any]) => {
                                    // Inject Key as Name if missing
                                    const charData = { ...val };
                                    if (!charData.name) charData.name = key;

                                    // Handle "Name (Chinese)" format if present in key or name
                                    if (charData.name.includes('(')) {
                                        charData.name = charData.name.split('(')[0].trim();
                                    }

                                    charDict[charData.name] = charData;
                                });
                            };

                            // Merge Order: Extra -> Supporting -> Main (Main overrides)
                            mergeChars(details.characters_extra); // Dictionary
                            mergeChars(details.characters_supporting); // Dictionary (via index export)
                            mergeChars(details.characters_main); // Dictionary (via index export)

                            charactersModule = charDict;
                        } else {
                            console.error("[DataManager] CRITICAL: WuxiaLore.charactersDetail missing!");
                            charactersModule = {};
                        }

                        // [데이터 강화] Locations.json을 worldModule.locations로 평탄화 (Flatten)
                        if (loreModule?.WuxiaLore?.locations) {
                            const locSource = loreModule.WuxiaLore.locations as any;
                            const flatLocations: Record<string, any> = {};

                            // Helper to add location
                            const addLoc = (key: string, data: any) => {
                                if (key) flatLocations[key] = data;
                            };

                            // [New] 3-Tier Hierarchy: Region > Zone > Spot
                            if (locSource.regions) {
                                Object.entries(locSource.regions).forEach(([regionName, regionData]: [string, any]) => {
                                    if (regionData.zones) {
                                        Object.entries(regionData.zones).forEach(([zoneName, zoneData]: [string, any]) => {
                                            // 1. Map Zone (e.g. "사천당가")
                                            flatLocations[zoneName] = {
                                                ...zoneData,
                                                type: 'zone',
                                                region: regionName
                                            };

                                            // 2. Map Spots (e.g. "사천당가 가주 집무실")
                                            if (zoneData.spots && Array.isArray(zoneData.spots)) {
                                                zoneData.spots.forEach((spotName: string) => {
                                                    // Full Name: "Zone Spot"
                                                    const fullName = `${zoneName} ${spotName}`;
                                                    const spotData = {
                                                        name: spotName,
                                                        type: 'spot',
                                                        parent: zoneName,
                                                        region: regionName,
                                                        description: `[${regionName} > ${zoneName}] ${spotName}` // Auto-desc
                                                    };

                                                    flatLocations[fullName] = spotData;

                                                    // Short Name: "Spot" (Fallback, e.g. "정문")
                                                    // Only set if not exists, to prevent collision overriding
                                                    if (!flatLocations[spotName]) {
                                                        flatLocations[spotName] = spotData;
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                            // [Legacy Support]
                            else {
                                // 1. Faction Locations
                                locSource.faction_locations?.forEach((faction: any) => {
                                    faction.locations?.forEach((loc: any) => {
                                        addLoc(`${faction.faction_name} ${loc.name}`, loc);
                                        if (!flatLocations[loc.name]) addLoc(loc.name, loc);
                                    });
                                });
                                // 2. Regional Locations
                                locSource.regional_locations?.forEach((region: any) => {
                                    region.locations?.forEach((loc: any) => {
                                        addLoc(`${region.region_name} ${loc.name}`, loc);
                                        if (!flatLocations[loc.name]) addLoc(loc.name, loc);
                                    });
                                });
                                // 3. Common Locations
                                locSource.common_locations?.forEach((type: any) => {
                                    type.locations?.forEach((loc: any) => {
                                        addLoc(loc.name, loc);
                                        addLoc(`${type.type_name} ${loc.name}`, loc);
                                    });
                                });
                            }

                            // Assign to worldModule
                            if (!worldModule) worldModule = { locations: {}, items: {} };
                            worldModule.locations = { ...worldModule.locations, ...flatLocations };
                        }
                    } catch (e) {
                        console.error(`[DataManager] IMPORT ERROR in 'wuxia':`, e);
                        throw e;
                    }
                    break;
                default:
                    throw new Error(`Unknown game ID: ${gameId}`);
            }

            console.log('[DataManager] All imports successful.');

            // [Shared Hydration] Ensure all characters have a valid 'name' property
            let finalCharacters = (charactersModule as any).default || charactersModule;

            // [Fix] Handle Dictionary-based Character Data (GBY & Wuxia Refactored)
            // If it's a plain object (Dictionary), we must inject the Key as 'name' 
            // because Object.values() in PromptManager strips the keys.
            if (!Array.isArray(finalCharacters) && typeof finalCharacters === 'object') {
                const hydratedDict: Record<string, any> = {};
                Object.entries(finalCharacters).forEach(([key, val]: [string, any]) => {
                    const charObj = val as any;
                    hydratedDict[key] = {
                        name: key, // Inject Key as Name
                        ...charObj
                    };
                });
                finalCharacters = hydratedDict;
            }
            // [Legacy] Handle Array-based Character Data (Old Wuxia path - Should not trigger for Wuxia anymore)
            else if (Array.isArray(finalCharacters)) {
                // [Standardization] Convert Array to Dictionary for consistent Key lookup
                const charDict: Record<string, any> = {};
                finalCharacters.forEach((c: any) => {
                    // Hydrate Name from Profile if missing
                    if (!c.name && c.profile && c.profile['이름']) {
                        // e.g. "천서윤 (千瑞yoon)" -> "천서윤"
                        c.name = c.profile['이름'].split('(')[0].trim();
                    }
                    if (c.name) {
                        charDict[c.name] = c;
                    }
                });
                finalCharacters = charDict;
            }

            return {
                world: worldModule.default || worldModule,
                characters: finalCharacters,

                backgroundList: (bgListModule as any).default || bgListModule,
                characterImageList: characterImageList,
                extraCharacterList: extraCharacterList,
                events: (eventsModule as any).default || (eventsModule as any).events || [],
                scenario: scenarioModule?.START_SCENARIO_TEXT || "",
                characterCreationQuestions: (scenarioModule as any)?.CHARACTER_CREATION_QUESTIONS || null,
                backgroundMappings: bgMappingsModule?.backgroundMappings || {},
                getSystemPromptTemplate: systemPromptModule?.getSystemPromptTemplate || (() => ""),
                getRankInfo: (systemPromptModule?.getRankInfo as any) || (() => ({ playerRank: 'Unknown', rankKey: 'unknown', rankData: {}, rankLogline: '', rankKeywords: '', rankGiftDesc: '', rankConflict: '' })),
                wikiData: wikiDataModule || {},
                characterMap: charMapModule || {},
                extraMap: extraMapModule || {},
                // Fix: Spread module into plain object to avoid serialization error
                constants: constantsModule ? { ...constantsModule } as any : undefined,
                // [중요] 상세 설정(Lore) 데이터 구조 분해
                lore: (loreModule as any)?.WuxiaLore ? {
                    ...(loreModule as any).WuxiaLore,
                    factionsDetail: { ...(loreModule as any).WuxiaLore.factionsDetail },
                    charactersDetail: { ...(loreModule as any).WuxiaLore.charactersDetail }
                } : (loreModule as any)?.GodBlessYouLore ? {
                    ...(loreModule as any).GodBlessYouLore
                } : {}
            };

        } catch (error) {
            console.error(`[DataManager] Failed to load game data for ${gameId}:`, error);
            throw error;
        }
    }
}
