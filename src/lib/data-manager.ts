
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
    getRankInfo: (fame: number) => any;
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

                        console.log('- Importing characters.json...');
                        charactersModule = await import('@/data/games/god_bless_you/jsons/characters.json');

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
                            worldModule = await import('../data/games/wuxia/world.json');
                            // Handle ESM default export behavior for JSON
                            if ((worldModule as any).default) worldModule = (worldModule as any).default;
                        } catch (e) {
                            console.warn('[DataManager] world.json not found for wuxia, using empty default.');
                            worldModule = { locations: {}, items: {} };
                        }
                        try {
                            charactersModule = await import('../data/games/wuxia/characters.json');
                            if ((charactersModule as any).default) charactersModule = (charactersModule as any).default;
                        } catch (e) { console.error("[DataManager] Failed characters.json", e); }

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

                        // [데이터 강화] 상세 설정(Lore) 데이터를 캐릭터 상태에 병합
                        // 기본 'characters.json'에는 이름과 기본 정보만 있고, 외모 묘사나 성격, 관계도 등 자세한 정보가 부족할 수 있습니다.
                        // 이를 'loreModule.WuxiaLore.charactersDetail'에서 가져와서 채워 넣습니다.

                        if (charactersModule && loreModule?.WuxiaLore?.charactersDetail) {
                            const mainChars = Object.values(loreModule.WuxiaLore.charactersDetail.characters_main || {});
                            const suppChars = Object.values(loreModule.WuxiaLore.charactersDetail.characters_supporting || {});
                            const detailedList = [...mainChars, ...suppChars];

                            const detailedMap = new Map();
                            detailedList.forEach((d: any) => {
                                const rawName = d.profile?.이름 || d.basic_profile?.이름 || "";
                                // Extract "연화린" from "연화린 (延花凛)"
                                const cleanName = rawName.split('(')[0].trim();
                                if (cleanName) {
                                    detailedMap.set(cleanName, d);
                                }
                            });

                            // Helper to access default export if it exists
                            const simpleList = (charactersModule as any).default || charactersModule;

                            if (Array.isArray(simpleList)) {
                                const enriched = simpleList.map((simple: any) => {
                                    const detail = detailedMap.get(simple.name);
                                    if (detail) {
                                        return {
                                            ...simple,
                                            // Merge Key Fields for PromptManager
                                            // Merge Key Fields for PromptManager
                                            description: detail.profile?.['강함']?.description,
                                            // [상세 데이터 병합] 아래 필드들은 기본 데이터에 없던 상세 정보입니다.
                                            외형: detail['외형'],
                                            personality: detail.personality,
                                            인간관계: detail['인간관계'], // [중요] 관계도 데이터 병합
                                            profile: detail.profile,
                                            social: detail.social,
                                            preferences: detail.preferences,
                                            secret: detail.secret,
                                            // [NEW] Inject detailed Secret Data and MA Realm for PromptManager
                                            secret_data: detail.secret_data || detail.secret, // Legacy Support
                                            // Hoist '강함' (Strength/Combat) to root
                                            강함: detail.profile?.['강함'],
                                            job: detail.job
                                            // I will delete the 'social' line I added here.
                                        };
                                    }
                                    return simple;
                                });
                                // 캐릭터 모듈을 강화된 리스트로 교체합니다.
                                charactersModule = enriched;
                            }
                        }

                        // [데이터 강화] Locations.json을 worldModule.locations로 평탄화 (Flatten)
                        if (loreModule?.WuxiaLore?.locations) {
                            const locSource = loreModule.WuxiaLore.locations;
                            const flatLocations: Record<string, any> = {};

                            // Helper to add location
                            const addLoc = (key: string, data: any) => {
                                if (key) flatLocations[key] = data;
                            };

                            // 1. Faction Locations (e.g., "무림맹 정문")
                            locSource.faction_locations?.forEach((faction: any) => {
                                faction.locations?.forEach((loc: any) => {
                                    // Map by "Faction Name" (e.g., "무림맹 정문") - Preferred
                                    addLoc(`${faction.faction_name} ${loc.name}`, loc);
                                    // Map by "Name" (e.g., "정문") - Fallback, might collide
                                    if (!flatLocations[loc.name]) addLoc(loc.name, loc);
                                });
                            });

                            // 2. Regional Locations (e.g., "중원 번화가")
                            locSource.regional_locations?.forEach((region: any) => {
                                region.locations?.forEach((loc: any) => {
                                    addLoc(`${region.region_name} ${loc.name}`, loc);
                                    if (!flatLocations[loc.name]) addLoc(loc.name, loc);
                                });
                            });

                            // 3. Common Locations (e.g., "객잔 1층")
                            locSource.common_locations?.forEach((type: any) => {
                                type.locations?.forEach((loc: any) => {
                                    // Usually just Name is unique enough for common places like "객잔 1층"
                                    addLoc(loc.name, loc);
                                    addLoc(`${type.type_name} ${loc.name}`, loc);
                                });
                            });

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
            if (Array.isArray(finalCharacters)) {
                finalCharacters = finalCharacters.map((c: any) => {
                    // Hydrate Name from Profile if missing
                    if (!c.name && c.profile && c.profile['이름']) {
                        // e.g. "천서윤 (千瑞yoon)" -> "천서윤"
                        c.name = c.profile['이름'].split('(')[0].trim();
                    }
                    return c;
                });
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
                // Fix: Spread module into plain object to avoid serialization error
                constants: constantsModule ? { ...constantsModule } as any : undefined,
                // [중요] 상세 설정(Lore) 데이터 구조 분해
                // WuxiaLore 내부에는 factionsDetail, charactersDetail과 같은 중첩된 객체들이 있습니다.
                // 이를 클라이언트에서 바로 사용할 수 있도록 펼쳐서(spread) 전달합니다.
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
