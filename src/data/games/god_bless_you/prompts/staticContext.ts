import { LoreConverter } from '@/lib/utils/lore-converter';
import { PromptManager } from '@/lib/engine/prompt-manager';
import {
    GBY_IDENTITY,
    GBY_BEHAVIOR_RULES,
    GBY_OUTPUT_FORMAT,
    GBY_SPECIAL_FORMATS,
    FAMOUS_CHARACTERS
} from '../constants';

export async function getGBYStaticContext(state: any): Promise<string> {
    // [BLOCK 1: IDENTITY]
    const systemIdentity = GBY_IDENTITY;

    // [BLOCK 2: KNOWLEDGE BASE]
    // 2.1 Famous Characters
    const famousCharactersDB = FAMOUS_CHARACTERS || "No famous characters data loaded.";

    // 2.2 Lore Injection (Markdown)
    let loreContext = "";
    if (state.lore) {
        try {
            // Reuse LoreConverter for GBY (It supports modern_* keys)
            loreContext = LoreConverter.convertToMarkdown(state.lore, "", 'daily');
        } catch (e: any) {
            console.error("[GBYContext] LoreConverter Failed!", e);
            loreContext = "<!-- Lore Injection Failed -->";
        }
    }

    // 2.3 Backgrounds
    const availableBackgrounds = PromptManager.getAvailableBackgrounds(state);

    // [BLOCK 3: BEHAVIOR GUIDELINES]
    const behaviorRules = GBY_BEHAVIOR_RULES;

    // [BLOCK 4: STRICT OUTPUT FORMAT]
    const outputFormat = GBY_OUTPUT_FORMAT + "\n" + GBY_SPECIAL_FORMATS;

    // Assemble Static Blocks
    return `
${systemIdentity}

## [NPC Database (Famous Figures)]
${famousCharactersDB}

${loreContext}

## [Available Backgrounds]
${availableBackgrounds}

${behaviorRules}

${outputFormat}
`;
}
