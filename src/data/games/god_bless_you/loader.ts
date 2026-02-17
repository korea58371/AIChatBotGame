
import { GameData } from '@/lib/engine/data-manager';

export async function loadGodBlessYouData(): Promise<GameData> {
    console.log(`[GBYLoader] Loading God Bless You data...`);

    let worldModule: any, charactersModule: any, bgListModule: any, eventsModule: any, scenarioModule: any, bgMappingsModule: any, systemPromptModule: any, wikiDataModule: any, charMapModule: any, extraMapModule: any, constantsModule: any, loreModule: any;
    let characterImageList: string[] = [];
    let extraCharacterList: string[] = [];

    // [Common] Load Assets Lists
    try {
        // @ts-ignore
        const assetsManifest = (await import('../../assets.json')).default;
        const gameAssets = assetsManifest?.['god_bless_you'];
        bgListModule = gameAssets?.backgrounds || [];
        // [Fix] assets.json structure for GBY only has 'characters'
        const chars = gameAssets?.characters || [];
        characterImageList = [...new Set([...chars])];
        extraCharacterList = gameAssets?.extraCharacters || [];
    } catch (e) {
        console.warn("[GBYLoader] Failed to load assets.json:", e);
        bgListModule = [];
    }

    try {
        // world.json removed — locations.json provides all region data
        worldModule = { default: { locations: {}, items: {} } };

        console.log('- Importing characters/characters_main.json & supporting...');
        const charsMain = await import('./jsons/characters/characters_main.json');
        let charsSupporting = {};
        try {
            const charsSuppModule = await import('./jsons/characters/characters_supporting.json');
            charsSupporting = charsSuppModule.default || charsSuppModule;
        } catch (e) {
            console.warn('[GBYLoader] characters_supporting.json not found for GBY');
        }

        // Merge supporting into main (Main overrides if collision)
        // [Refactor] Use shared mergeCharacters utility
        const { mergeCharacters, flattenMapData } = await import('@/lib/utils/loader-utils');

        // [Fix] Inject 'is_main' flag for characters in characters_main source
        const mainSource = charsMain.default || charsMain;
        if (mainSource) {
            Object.values(mainSource).forEach((char: any) => {
                if (char && typeof char === 'object') {
                    char.is_main = true;
                }
            });
        }

        charactersModule = mergeCharacters(
            charsSupporting as object,
            mainSource
        );

        // bgListModule loaded above via action

        console.log('- Importing events.ts...');
        eventsModule = await import('./events');

        console.log('- Importing start_scenario.ts...');
        scenarioModule = await import('./start_scenario');

        console.log('- Importing backgroundMappings.ts...');
        bgMappingsModule = await import('./backgroundMappings');

        console.log('- Importing prompts/system.ts...');
        systemPromptModule = await import('./prompts/system');

        // Constants
        console.log('- Importing constants.ts...');
        constantsModule = await import('./constants');

        // Maps
        // character_map.json removed - main character detection uses characterData directly

        // extra_map.json removed - using availableExtraImages from manifest directly

        // Wiki Data (Optional, specific to God Bless You)
        try {
            // @ts-ignore
            const wiki = await import('./wiki_data.json');
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
            loreModule = await import('./jsons/index');
        } catch (e) {
            console.error("[GBYLoader] Failed GBY lore", e);
        }

        // [Fix] Apply Flattening: MUST run AFTER loreModule is loaded above
        // Injects locations.json regions into world for casting & prompt-manager
        const wm = (worldModule as any).default || worldModule;
        if (wm) {
            const loreLocations = loreModule?.GodBlessYouLore?.locations;
            const regionsSource = wm.regions || loreLocations?.regions;

            if (regionsSource) {
                wm.regions = regionsSource;
                const flat = flattenMapData(regionsSource);
                wm.locations = { ...flat, ...(wm.locations || {}) };
                console.log(`[GBYLoader] Regions injected: ${Object.keys(regionsSource).length} regions, ${Object.keys(flat).length} flat locations`);
            } else {
                console.warn(`[GBYLoader] No regions found in world.json or lore.locations`);
            }
        }

    } catch (e) {
        console.error(`[GBYLoader] IMPORT ERROR:`, e);
        throw e;
    }

    return {
        world: (worldModule as any).default || worldModule || {},
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
            // GBY expects number usually
            const val = typeof input === 'number' ? input : Number(input);
            return func(val);
        },
        wikiData: wikiDataModule || {},
        // characterMap removed
        // extraMap removed
        constants: constantsModule || {},
        lore: loreModule?.GodBlessYouLore || {}
    };
}
