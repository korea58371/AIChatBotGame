
import { GameData } from '@/lib/engine/data-manager';
import assetsManifest from '../../assets.json'; // [Fix] Static Import to ensure bundling

export async function loadWuxiaData(): Promise<GameData> {
    console.log(`[WuxiaLoader] Loading Wuxia data...`);

    let worldModule: any, charactersModule: any, bgListModule: any, eventsModule: any, scenarioModule: any, bgMappingsModule: any, systemPromptModule: any, wikiDataModule: any, charMapModule: any, extraMapModule: any, cgMapModule: any, constantsModule: any, loreModule: any;
    let characterImageList: string[] = [];
    let extraCharacterList: string[] = [];

    // [Common] Load Assets Lists
    // [Common] Load Assets Lists
    try {
        console.log(`[WuxiaLoader] Assets Manifest Loaded (Static). Keys: ${Object.keys(assetsManifest || {}).join(', ')}`);

        // @ts-ignore
        const gameAssets = assetsManifest?.['wuxia'];
        console.log(`[WuxiaLoader] GameAssets for 'wuxia':`, gameAssets ? `Found (Chars: ${gameAssets.characters?.length}, Extras: ${gameAssets.extraCharacters?.length})` : 'Missing');

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

        // [데이터 강화] Locations.json을 worldModule에 주입
        // (1) world.regions: casting의 resolveLocationHierarchy용 (계층 원본)
        // (2) world.locations: prompt-manager의 flat lookup용 (평탄화)
        if (loreModule?.WuxiaLore?.locations) {
            const { flattenMapData } = await import('@/lib/utils/loader-utils');

            const rawLocations = loreModule.WuxiaLore.locations as any;
            let flatLocations = {};

            if (rawLocations.regions) {
                worldModule.regions = rawLocations.regions; // ① Inject regions (for casting)
                flatLocations = flattenMapData(rawLocations.regions);
            }

            // Merge into worldModule.locations
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
 * [NEW] 무협 초기 위치 랜덤 생성 (안전 지역 & 정파/세가 위주)
 * locations.json에서 '안전한' Region과 '대표 세력'이 있는 Zone을 우선적으로 선택합니다.
 * 초반에 좋은 인연을 맺을 수 있도록 '악인곡', '마교', '남만' 등 위험 지역은 배제합니다.
 */
function getRandomInitialLocation(lore: any): string {
    const fallback = '하남_소림사';

    try {
        const locations = lore?.locations;
        if (!locations || !locations.regions) {
            console.warn('[WuxiaLoader] No locations data, using fallback.');
            return fallback;
        }

        // [Safe Start Filter]
        // 초반에 안전하고, 무공을 배울 수 있는 정파/세가/중립 지역만 허용
        const SAFE_REGIONS = [
            '하남', // 소림, 무림맹, 개방
            '섬서', // 화산
            '호북', // 무당, 제갈
            '안휘', // 남궁
            '사천', // 당가, 아미
            '하북', // 팽가
            '산동', // 약왕곡
            // '요녕', '청해', '남만', '북해', '강남' (장강수로채) 등은 제외
        ];

        const SAFE_ZONES_KEYWORDS = [
            '소림사', '무림맹', '개방',
            '화산파',
            '무당파', '제갈세가',
            '남궁세가',
            '사천당가', '아미파',
            '하북팽가',
            '약왕곡',
            '모용세가', '곤륜파' // 요녕/청해라도 이들은 정파이므로 허용 가능 (Region 필터가 우선이므로 아래 로직에서 추가 확인)
        ];

        const DANGEROUS_ZONES = [
            '악인곡', '천마신교', '혈교', '장강수로채', '하오문', '북해빙궁', '남만야수궁', '산', '마을', '객잔'
            // 마을/객잔도 '세력'과의 인연을 만들기 위해 배제 (세가/문파 본산 위주)
        ];

        const regionNames = Object.keys(locations.regions).filter(r => SAFE_REGIONS.includes(r));

        if (regionNames.length === 0) return fallback;

        // 1. 랜덤 Region 선택
        const randomRegion = regionNames[Math.floor(Math.random() * regionNames.length)];
        const regionData = locations.regions[randomRegion];

        if (!regionData || !regionData.zones) {
            return `${randomRegion}_객잔`; // Fallback
        }

        // 2. 랜덤 Zone 선택 (필터링 적용)
        const zoneNames = Object.keys(regionData.zones).filter(zone => {
            // 위험 지역 배제
            if (DANGEROUS_ZONES.some(d => zone.includes(d))) return false;
            // 대표 세력(본산) 위주 선택
            return SAFE_ZONES_KEYWORDS.some(safe => zone.includes(safe));
        });

        if (zoneNames.length === 0) {
            // 만약 필터링 후 남은게 없다면, 해당 지역의 가장 안전한 곳(보통 첫번째가 대표 구역) 선택
            const allZones = Object.keys(regionData.zones);
            if (allZones.length > 0) return `${randomRegion}_${allZones[0]}`;
            return `${randomRegion}_객잔`;
        }

        const randomZone = zoneNames[Math.floor(Math.random() * zoneNames.length)];

        const result = `${randomRegion}_${randomZone}`;
        console.log(`[WuxiaLoader] Safe Initial Location Selected: ${result}`);
        return result;
    } catch (e) {
        console.error('[WuxiaLoader] Error generating random location:', e);
        return fallback;
    }
}
