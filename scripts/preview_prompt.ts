
// @ts-nocheck
import fs from 'fs';
import path from 'path';
// DIRECTLY IMPORT NEEDED MODULES, BYPASSING DataManager
import { PromptManager } from '../src/lib/prompt-manager';
import { getSystemPromptTemplate } from '../src/data/games/wuxia/prompts/system';
import { LoreConverter } from '../src/lib/lore-converter';

// Import JSONs directly
import worldData from '../src/data/games/wuxia/world.json';
import internalCharsMain from '../src/data/games/wuxia/jsons/characters/characters_main.json';
import internalCharsSupp from '../src/data/games/wuxia/jsons/characters/characters_supporting.json';
import internalCharsExtra from '../src/data/games/wuxia/jsons/characters/characters_extra.json'; // optional
// Mock background list since it's dynamic
const bgList = ["객잔_1층", "객잔_2층", "거리_낮", "거리_밤"];
import bgMappings from '../src/data/games/wuxia/backgroundMappings';
import constants from '../src/data/games/wuxia/constants';
// Import Factions directly to avoid index export issues
import hwasan from '../src/data/games/wuxia/jsons/factions/hwasan_sect.json';
import haomun from '../src/data/games/wuxia/jsons/factions/haomun.json';
import cheonsan from '../src/data/games/wuxia/jsons/factions/cheonsan_sect.json';
import hyeolgyo from '../src/data/games/wuxia/jsons/factions/hyeolgyo.json';
import gaebang from '../src/data/games/wuxia/jsons/factions/gaebang.json';

async function main() {
    console.log("=== Standalone Script Started ===");

    try {
        // 1. Construct Mock Lore Object
        const mockLore = {
            factionsDetail: {
                hwasan, haomun, cheonsan, hyeolgyo, gaebang
            },
            charactersDetail: {
                characters_main: internalCharsMain,
                characters_supporting: internalCharsSupp,
                characters_extra: internalCharsExtra || []
            },
            // Add other lore parts if needed by LoreConverter, e.g.
            world_geography: null,
            martial_arts_levels: null,
            weapons: null
        };

        // 2. Construct Mock State
        const mockState: any = {
            activeGameId: 'wuxia',
            getSystemPromptTemplate: getSystemPromptTemplate,
            currentMood: 'daily',
            playerStats: {
                playerRank: '이류',
                faction: '무소속',
                skills: ['기본 검술'],
                mp: 10,
                internalArt: '토납법',
                footwork: '보법',
                str: 5, agi: 5, int: 5, vit: 5, luk: 5
            },
            worldInfo: "테스트 월드 정보",
            scenarioSummary: "테스트 시나리오 요약",
            currentLocation: "객잔_1층",
            characterData: {}, // Not really used if we rely on static context
            availableBackgrounds: bgList || [],
            backgroundMappings: bgMappings.backgroundMappings || {},
            constants: constants || {},
            lore: { WuxiaLore: mockLore } // DataManager structure
        };

        // Flatten Lore for PromptManager input if it expects it directly
        // PromptManager.getSharedStaticContext uses "state.lore" directly.
        // DataManager usually returns: lore: { ...loreModule.WuxiaLore, ...expanded }
        // So we should match that structure.
        mockState.lore = { ...mockLore };


        console.log("Generating Static Context...");
        const staticContext = await PromptManager.getSharedStaticContext(mockState);
        console.log("Static Context Generated (Length: " + staticContext.length + ")");

        console.log("Generating Dynamic Prompt...");
        const dynamicPrompt = PromptManager.generateSystemPrompt(mockState, 'ko');
        console.log("Dynamic Prompt Generated (Length: " + dynamicPrompt.length + ")");

        const fullOutput = `# System Prompt Preview
Generated: ${new Date().toISOString()}

## 1. SHARED STATIC CONTEXT (Cached Layer)
*This section is cached by Gemini to save tokens.*

${staticContext}


## 2. DYNAMIC SYSTEM PROMPT (Per-Turn Layer)
*This section changes every turn.*

${dynamicPrompt}
`;

        const outPath = path.join(process.cwd(), '_PROMPT_PREVIEW.md');
        console.log("Writing to:", outPath);
        fs.writeFileSync(outPath, fullOutput, 'utf8');
        console.log("WRITE SUCCESSFUL.");

    } catch (e) {
        console.error("ERROR:", e);
        process.exit(1);
    }
}

main();
