
import { GameData } from '@/lib/engine/data-manager';

export async function loadWuxiaData(): Promise<GameData> {
    console.log(`[WuxiaLoader] Loading Wuxia data...`);

    let worldModule: any, charactersModule: any, bgListModule: any, eventsModule: any, scenarioModule: any, bgMappingsModule: any, systemPromptModule: any, wikiDataModule: any, charMapModule: any, extraMapModule: any, cgMapModule: any, constantsModule: any, loreModule: any;
    let characterImageList: string[] = [];
    let extraCharacterList: string[] = [];

    // [Common] Load Assets Lists
    try {
        // @ts-ignore
        const assetsManifest = (await import('../../assets.json')).default;
        const gameAssets = assetsManifest?.['wuxia'];
        bgListModule = gameAssets?.backgrounds || [];
        characterImageList = gameAssets?.characters || [];
        extraCharacterList = gameAssets?.extraCharacters || [];
    } catch (e) {
        console.warn("[WuxiaLoader] Failed to load assets.json:", e);
        bgListModule = [];
    }

    try {
        try {
            worldModule = await import('./world.json');
            if ((worldModule as any).default) worldModule = (worldModule as any).default;
        } catch (e) {
            console.warn('[WuxiaLoader] world.json not found, using empty default.');
            worldModule = { locations: {}, items: {} };
        }

        // [REFACTOR] Legacy characters.json import REMOVED
        // charactersModule is now derived solely from Lore Data below.
        charactersModule = null;

        try { eventsModule = await import('./events'); } catch (e) { console.error("[WuxiaLoader] Failed events", e); }
        try { scenarioModule = await import('./start_scenario'); } catch (e) { console.error("[WuxiaLoader] Failed scenario", e); }
        try { bgMappingsModule = await import('./backgroundMappings'); } catch (e) { console.error("[WuxiaLoader] Failed bgMappings", e); }
        try { systemPromptModule = await import('./prompts/system'); } catch (e) { console.error("[WuxiaLoader] Failed system prompt", e); }


        // Constants
        try { constantsModule = await import('./constants'); } catch (e) { console.error("[WuxiaLoader] Failed constants", e); }

        // Lore (Wuxia Only)
        try { loreModule = await import('./jsons'); } catch (e) { console.error("[WuxiaLoader] Failed lore", e); }

        // Maps
        try {
            // @ts-ignore
            const charMap = await import('./character_map.json');
            charMapModule = charMap.default || charMap;
        } catch (e) { console.error("[WuxiaLoader] Failed charMap", e); }

        try {
            // @ts-ignore
            const extraMap = await import('./extra_map.json');
            extraMapModule = extraMap.default || extraMap;
        } catch (e) { console.error("[WuxiaLoader] Failed extraMap", e); }

        try {
            // @ts-ignore
            const cgMap = await import('./cg_mappings');
            cgMapModule = (cgMap as any).WUXIA_CG_MAP || (cgMap as any).default || cgMap;
        } catch (e) { console.error("[WuxiaLoader] Failed cgMap", e); }

        // Wiki Data
        try {
            // @ts-ignore
            const wiki = await import('./wiki_data.json');
            // @ts-ignore
            const wikiDataLoaded = wiki.default || wiki;
            wikiDataModule = wikiDataLoaded;
        } catch (e) {
            console.warn('[WuxiaLoader] wiki_data.json not found');
            wikiDataModule = {};
        }

        // [Refactor] New Character Loading Logic using Utility
        // Load solely from loreModule.WuxiaLore.charactersDetail
        if (loreModule?.WuxiaLore?.charactersDetail) {
            const details = loreModule.WuxiaLore.charactersDetail;

            // Utilize shared utility for consistent merging and sanitization
            const { mergeCharacters } = await import('@/lib/utils/loader-utils');

            // [Fix] Inject 'is_main' flag for characters in characters_main source
            if (details.characters_main) {
                Object.values(details.characters_main).forEach((char: any) => {
                    if (char && typeof char === 'object') {
                        char.is_main = true;
                    }
                });
            }

            charactersModule = mergeCharacters(
                details.characters_extra,
                details.characters_supporting,
                details.characters_main
            );
        } else {
            console.error("[WuxiaLoader] CRITICAL: WuxiaLore.charactersDetail missing!");
            charactersModule = {};
        }

        // [데이터 강화] Locations.json을 worldModule.locations로 평탄화 (Flatten)
        if (loreModule?.WuxiaLore?.locations) {
            const { flattenMapData } = await import('@/lib/utils/loader-utils');

            // Flatten the hierarchical locations structure
            // We specifically look at 'regions' inside the locations JSON based on file structure
            const rawLocations = loreModule.WuxiaLore.locations as any;
            let flatLocations = {};

            if (rawLocations.regions) {
                flatLocations = flattenMapData(rawLocations.regions);
            }
            // If there are other top-level keys like '관외_지역', process them too if needed
            // For now, consistent with previous logic which focused on regions.

            // Merge into worldModule
            worldModule.locations = { ...flatLocations, ...worldModule.locations };
        }

    } catch (e) {
        console.error(`[WuxiaLoader] IMPORT ERROR:`, e);
        throw e;
    }

    return {
        world: worldModule || {},
        characters: charactersModule || {},
        characterImageList,
        extraCharacterList,
        backgroundList: bgListModule || [],
        events: (eventsModule as any)?.GAME_EVENTS || [],
        scenario: (scenarioModule as any)?.START_SCENARIO_TEXT || '',
        characterCreationQuestions: (scenarioModule as any)?.CHARACTER_CREATION_QUESTIONS || [],
        backgroundMappings: (bgMappingsModule as any)?.backgroundMappings || {},
        getSystemPromptTemplate: (systemPromptModule as any)?.getSystemPromptTemplate || (() => ''),
        getRankInfo: (input: string | number) => {
            const func = (systemPromptModule as any)?.getRankInfo;
            if (!func) return null;
            // Wuxia expects string usually
            const val = typeof input === 'string' ? input : String(input);
            return func(val);
        },
        wikiData: wikiDataModule || {},
        characterMap: charMapModule || {},
        extraMap: extraMapModule || {},
        cgMap: cgMapModule || {},
        constants: constantsModule || {},
        lore: loreModule?.WuxiaLore || {},
        initialLocation: getRandomInitialLocation(loreModule?.WuxiaLore)
    };
}

/**
 * [NEW] 무협 초기 위치 랜덤 생성
 * locations.json에서 임의의 Region과 Zone을 조합하여 반환합니다.
 * 포맷: "Region_Zone" (예: "하남_소림사", "호북_객잔")
 */
function getRandomInitialLocation(lore: any): string {
    const fallback = '하남_소림사';

    try {
        const locations = lore?.locations;
        if (!locations || !locations.regions) {
            console.warn('[WuxiaLoader] No locations data, using fallback.');
            return fallback;
        }

        const regionNames = Object.keys(locations.regions);
        if (regionNames.length === 0) return fallback;

        // 1. 랜덤 Region 선택
        const randomRegion = regionNames[Math.floor(Math.random() * regionNames.length)];
        const regionData = locations.regions[randomRegion];

        if (!regionData || !regionData.zones) {
            return `${randomRegion}_마을`; // Fallback Zone
        }

        // 2. 랜덤 Zone 선택
        const zoneNames = Object.keys(regionData.zones);
        if (zoneNames.length === 0) return `${randomRegion}_마을`;

        const randomZone = zoneNames[Math.floor(Math.random() * zoneNames.length)];

        const result = `${randomRegion}_${randomZone}`;
        console.log(`[WuxiaLoader] Random Initial Location: ${result}`);
        return result;
    } catch (e) {
        console.error('[WuxiaLoader] Error generating random location:', e);
        return fallback;
    }
}
