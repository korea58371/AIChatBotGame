
import fs from 'fs';
import path from 'path';
import { PromptManager } from '../src/lib/prompt-manager';

// --- Configuration ---
const WUXIA_ROOT = path.join(__dirname, '../src/data/games/wuxia');
const PREVIEW_DIR = path.join(__dirname, 'previews');
// Wuxia Moods: daily, romance, tension, combat, erotic, comic, event, growth, cruelty
const MOODS = ['daily', 'romance', 'tension', 'combat', 'erotic', 'comic', 'event', 'growth', 'cruelty'];

// --- Helper: Ensure Directory Exists ---
if (!fs.existsSync(PREVIEW_DIR)) {
    fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

// --- Main Execution ---
async function main() {
    console.log("🔵 Starting Wuxia Prompt Preview Generation (Shared Cache Mode)...");

    try {
        // 1. Load Data (Simplified)
        // For Wuxia, DataManager loads a lot. We'll try to mimic a basic state.
        // PromptManager access files via internal logic or finding them?
        // PromptManager helper 'getSharedStaticContext' relies on 'state.lore' and 'state.constants'.

        // We need to load minimal data to populate 'state.lore' so PromptManager doesn't crash.
        const jsonDir = path.join(WUXIA_ROOT, 'jsons');
        const loadJson = (name: string) => {
            try {
                return JSON.parse(fs.readFileSync(path.join(jsonDir, name), 'utf-8'));
            } catch (e) {
                return {};
            }
        };

        const loreData = {
            factions: loadJson('factions.json'),
            geography: loadJson('world_geography.json'),
            skills: loadJson('martial_arts_skills.json'),
            levels: loadJson('martial_arts_levels.json'),
            weapons: loadJson('weapons.json'),
            items: loadJson('items.json'),
            terminology: loadJson('wuxia_terminology.json'),
            romance: loadJson('wuxia_romance_guide.json'),
            combat: loadJson('martial_arts_combat.json')
        };

        // We need explicit constants for Wuxia (Identity, etc.)
        // These are typically loaded from 'src/data/games/wuxia/constants.ts'.
        // Since we are in a script, importing .ts might be tricky without full transpilation setup, 
        // but 'tsx' handles it.
        const { WUXIA_IDENTITY, WUXIA_BEHAVIOR_RULES, WUXIA_OUTPUT_FORMAT, WUXIA_PROTAGONIST_PERSONA, CORE_RULES, FAMOUS_CHARACTERS } = await import('../src/data/games/wuxia/constants');

        const mockStateBase: any = {
            activeGameId: 'wuxia',
            characterData: loadJson('characters/characters_main.json'), // Just load main for preview sanity
            currentLocation: '객잔_1층',
            lore: loreData,
            availableExtraImages: [],
            constants: {
                WUXIA_IDENTITY,
                WUXIA_BEHAVIOR_RULES,
                WUXIA_OUTPUT_FORMAT,
                WUXIA_PROTAGONIST_PERSONA,
                CORE_RULES,
                FAMOUS_CHARACTERS
            },
            activeCharacters: [],
            getSystemPromptTemplate: () => "Dynamic Scenario Description...",
            playerStats: { str: 20, agi: 20, int: 20, vit: 20, luk: 20, skills: ['삼재검법', '기본경공'] }
        };

        // 2. Generate SHARED STATIC CONTEXT (Run Once)
        console.log("⏳ Generating SHARED STATIC CONTEXT...");

        // Use 'daily' as dummy mood
        mockStateBase.currentMood = 'daily';

        const sharedStaticContext = await PromptManager.getSharedStaticContext(mockStateBase, undefined, undefined, true);

        fs.writeFileSync(path.join(PREVIEW_DIR, 'preview_wuxia_SHARED_STATIC.md'), sharedStaticContext, 'utf-8');
        console.log("   -> Saved: preview_wuxia_SHARED_STATIC.md");

        // 3. Generate DYNAMIC MOOD PREVIEWS
        for (const mood of MOODS) {
            console.log(`⏳ Generating dynamic preview for mood: [${mood}]...`);

            // Update State
            const mockState = { ...mockStateBase, currentMood: mood };

            // Generate System Prompt (Dynamic Part)
            const dynamicPrompt = PromptManager.generateSystemPrompt(mockState, 'ko', "User Action Here");

            const finalOutput = `# Wuxia Dynamic Prompt Preview
- **Mood**: ${mood}
- **Generated At**: ${new Date().toISOString()}

---

## [INJECTED MOOD GUIDELINE & DYNAMIC CONTENT]
(This part is sent FRESH every turn)

${dynamicPrompt}
`;

            fs.writeFileSync(path.join(PREVIEW_DIR, `preview_wuxia_${mood}.md`), finalOutput, 'utf-8');
            console.log(`   -> Saved: preview_wuxia_${mood}.md`);
        }

        console.log("✅ All Wuxia previews generated successfully!");

    } catch (e: any) {
        console.error("❌ Error generating Wuxia previews:", e);
    }
}

main();
