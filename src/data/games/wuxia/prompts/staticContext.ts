import { LoreConverter } from '@/lib/utils/lore-converter';
import { PromptManager } from '@/lib/engine/prompt-manager';
import {
    WUXIA_IDENTITY,
    WUXIA_BEHAVIOR_RULES,
    WUXIA_OUTPUT_FORMAT,
    WUXIA_PROTAGONIST_PERSONA,
    WUXIA_IM_SEONG_JUN_PERSONA,
    WUXIA_NAM_GANG_HYEOK_PERSONA
} from '../constants';

export async function getWuxiaStaticContext(state: any): Promise<string> {
    // [BLOCK 1: IDENTITY]
    const systemIdentity = WUXIA_IDENTITY;

    // [BLOCK 2: KNOWLEDGE BASE]
    // 2.1 Lore Injection (Markdown/JSON)
    let loreContext = "";

    // Determine Persona (Default vs Override)
    let selectedPersona = WUXIA_PROTAGONIST_PERSONA;
    if (state.personaOverride) {
        if (state.personaOverride === 'WUXIA_IM_SEONG_JUN_PERSONA') {
            selectedPersona = WUXIA_IM_SEONG_JUN_PERSONA || WUXIA_PROTAGONIST_PERSONA;
        } else if (state.personaOverride === 'WUXIA_NAM_GANG_HYEOK_PERSONA') {
            selectedPersona = WUXIA_NAM_GANG_HYEOK_PERSONA || WUXIA_PROTAGONIST_PERSONA;
        }
        console.log(`[WuxiaContext] Injecting Persona Override: ${state.personaOverride}`);
    }

    if (state.lore) {
        try {
            loreContext = LoreConverter.convertToMarkdown(state.lore, selectedPersona, 'daily');
        } catch (e: any) {
            console.error("[WuxiaContext] LoreConverter Failed! Falling back to JSON.");
            loreContext = JSON.stringify(PromptManager.deepSort(state.lore), null, 2);
        }
    }

    // 2.2 Available Backgrounds (Reference)
    const availableBackgrounds = PromptManager.getAvailableBackgrounds(state);

    // [BLOCK 3: BEHAVIOR GUIDELINES]
    const behaviorRules = WUXIA_BEHAVIOR_RULES;

    // [BLOCK 4: STRICT OUTPUT FORMAT]
    const outputFormat = WUXIA_OUTPUT_FORMAT;

    // Assemble Static Blocks
    return `
${systemIdentity}

${loreContext}

## [Available Backgrounds]
${availableBackgrounds}

## [Available Extra Images]
${(state.availableExtraImages ? [...state.availableExtraImages].sort() : []).map((img: string) => img.replace(/\.(png|jpg|jpeg)$/i, '')).join(', ')}

${behaviorRules}

${outputFormat}
`;
}
