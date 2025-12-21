
// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { LoreConverter } from '../src/lib/lore-converter';
import { getSystemPromptTemplate } from '../src/data/games/wuxia/prompts/system';

// Import Data directly
import hwasan from '../src/data/games/wuxia/jsons/factions/hwasan_sect.json';
import haomun from '../src/data/games/wuxia/jsons/factions/haomun.json';
import cheonsan from '../src/data/games/wuxia/jsons/factions/cheonsan_sect.json';
import hyeolgyo from '../src/data/games/wuxia/jsons/factions/hyeolgyo.json';
import gaebang from '../src/data/games/wuxia/jsons/factions/gaebang.json';

import internalCharsMain from '../src/data/games/wuxia/jsons/characters/characters_main.json';
import internalCharsSupp from '../src/data/games/wuxia/jsons/characters/characters_supporting.json';
import constants from '../src/data/games/wuxia/constants';


async function main() {
    console.log("=== Safe Preview Script Started ===");

    try {
        // 1. Prepare Data
        const factionsDetail = { hwasan, haomun, cheonsan, hyeolgyo, gaebang };
        const charactersDetail = {
            characters_main: (internalCharsMain as any).default || internalCharsMain,
            characters_supporting: (internalCharsSupp as any).default || internalCharsSupp
        };

        // 2. Generate Static Context Parts
        const factionsMd = LoreConverter.convertFactions(factionsDetail);
        const charactersMd = LoreConverter.convertCharacters(charactersDetail);

        // 3. Assemble Shared Context (Mimicking PromptManager)
        let staticContext = `
## [Game Metadata]
- **Genre**: Wuxia (Martial Arts)
- **Language**: Korean (한국어)
- **Setting**: Ancient China (Fantasy)

${factionsMd}

${charactersMd}

## [Core Rules & Mechanics]
(Pulled from constants)
- **Attributes**: STR, AGI, INT, VIT, LUK
- **Realms**: Third Rate -> Peak -> Transcendent
`;

        // 4. Generate Dynamic Prompt (Mock)
        // We Mock the getSystemPromptTemplate call or just use a simplified version
        // because getSystemPromptTemplate uses properties that might be missing in a mock state.

        // Let's try to call it with a minimal state if possible, or just skip it if it crashes.
        let dynamicPrompt = "(Dynamic prompt generation skipped in safe mode to avoid crash)";

        try {
            const mockState: any = {
                currentMood: 'daily',
                playerStats: {
                    playerRank: '이류',
                    faction: '무소속',
                    skills: [],
                    mp: 10,
                    str: 5, agi: 5, int: 5, vit: 5, luk: 5
                },
                availableBackgrounds: [],
                backgroundMappings: {},
                constants: constants
            };
            dynamicPrompt = getSystemPromptTemplate(mockState, {
                scenario: "Preview Scenario",
                location: "Preview Location",
                time: "Day",
                nearby_npcs: []
            });
        } catch (e) {
            console.log("Dynamic prompt gen failed, using placeholder.");
        }

        const fullOutput = `# System Prompt Preview (Safe Generated)
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
