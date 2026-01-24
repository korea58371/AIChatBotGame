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

    // 2.2 Locations (Structured Map)
    // [MODIFIED] Injecting hierarchical location data from locations.json
    const locationData = require('../jsons/locations.json'); // Importing JSON directly

    let locationContext = "## [World Map & Locations]\n(Format: Region > Zone > Spots)\n";

    // Format: Region (EngKey)
    //   - Zone: [Spot1, Spot2, ...]

    // Iterate Regions
    Object.entries(locationData.regions).forEach(([regionKey, regionVal]: [string, any]) => {
        locationContext += `- ${regionKey} (${regionVal.eng_code}):\n`;

        // Iterate Zones
        if (regionVal.zones) {
            Object.entries(regionVal.zones).forEach(([zoneKey, zoneVal]: [string, any]) => {
                const spots = zoneVal.spots ? zoneVal.spots.join(', ') : '';
                locationContext += `  - ${zoneKey}: [${spots}]\n`;
            });
        }
    });

    // [BLOCK 3: BEHAVIOR GUIDELINES]
    const behaviorRules = WUXIA_BEHAVIOR_RULES;

    // [BLOCK 4: STRICT OUTPUT FORMAT]
    const outputFormat = WUXIA_OUTPUT_FORMAT;

    // Assemble Static Blocks
    return `
${systemIdentity}

${loreContext}

${locationContext}

## [Available Extra Images]
${(state.availableExtraImages ? [...state.availableExtraImages].sort() : []).map((img: string) => img.replace(/\.(png|jpg|jpeg)$/i, '')).join(', ')}

${behaviorRules}

${outputFormat}
`;
}
