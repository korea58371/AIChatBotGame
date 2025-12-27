
import fs from 'fs';
import path from 'path';
import { PromptManager } from '../src/lib/prompt-manager';
import { LoreConverter } from '../src/lib/lore-converter';

// --- Configuration ---
const GBY_ROOT = path.join(__dirname, '../src/data/games/god_bless_you');
const PREVIEW_DIR = path.join(__dirname, 'previews');
const MOODS = ['daily', 'romance', 'tension', 'combat', 'sexual'];

// --- Helper: Ensure Directory Exists ---
if (!fs.existsSync(PREVIEW_DIR)) {
    fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

// --- Main Execution ---
async function main() {
    console.log("🔵 Starting God Bless You Prompt Preview Generation (Shared Cache Mode)...");

    try {
        // 1. Load Data (Simplified for Preview)
        const jsonDir = path.join(GBY_ROOT, 'jsons');

        const loadJson = (name: string) => JSON.parse(fs.readFileSync(path.join(jsonDir, name), 'utf-8'));

        let charactersData = loadJson('characters.json');

        // [Fix] Replicate DataManager hydration: Inject Name from Keys
        if (!Array.isArray(charactersData) && typeof charactersData === 'object') {
            const hydratedDict: any = {};
            Object.entries(charactersData).forEach(([key, val]: [string, any]) => {
                hydratedDict[key] = { name: key, ...val };
            });
            charactersData = hydratedDict;
        }

        const mockLoreData = {
            charactersDetail: {
                characters_main: {}, // Simplified
                characters_supporting: {},
                characters_extra: {}
            },
            martial_arts_levels: loadJson('modern_levels.json'),
            martial_arts_skills: loadJson('modern_skills.json'),
            weapons: loadJson('modern_weapons.json'),
            romance_guide: loadJson('modern_romance_guide.json'),
            wuxia_terminology: loadJson('modern_terminology.json'),
            modern_factions: loadJson('modern_factions.json'),
            modern_geography: loadJson('modern_world_geography.json'),
            elixirs: loadJson('modern_elixirs.json'),
            combat_guide: loadJson('modern_combat.json')
        };

        // 2. Generate SHARED STATIC CONTEXT (Run Once)
        console.log("⏳ Generating SHARED STATIC CONTEXT...");

        const mockStateBase: any = {
            activeGameId: 'god_bless_you',
            characterData: charactersData,
            worldData: { locations: { 'home': { description: 'A cozy home' } } },
            currentLocation: 'home',
            lore: mockLoreData,
            availableExtraImages: [],
            constants: { FAMOUS_CHARACTERS: "Famous NPC List Placeholder" },
            activeCharacters: [],
            // Mock function for dynamic prompt (simplified)
            getSystemPromptTemplate: () => "Dynamic Scenario Description...",
            playerStats: { str: 10, agi: 10, int: 10, vit: 10, luk: 10, skills: [] }
        };

        // We use 'daily' as a dummy mood for static generation, though it shouldn't matter anymore
        mockStateBase.currentMood = 'daily';

        const sharedStaticContext = await PromptManager.getSharedStaticContext(mockStateBase, undefined, undefined, true); // Force refresh

        fs.writeFileSync(path.join(PREVIEW_DIR, 'preview_gby_SHARED_STATIC.md'), sharedStaticContext, 'utf-8');
        console.log("   -> Saved: preview_gby_SHARED_STATIC.md");

        // 3. Generate DYNAMIC MOOD PREVIEWS
        for (const mood of MOODS) {
            console.log(`⏳ Generating dynamic preview for mood: [${mood}]...`);

            // Update State
            const mockState = { ...mockStateBase, currentMood: mood };

            // Generate System Prompt (Dynamic Part)
            // This now includes the MOOD GUIDELINE injection
            const dynamicPrompt = PromptManager.generateSystemPrompt(mockState, 'ko', "User Action Here");

            const finalOutput = `# God Bless You Dynamic Prompt Preview
- **Mood**: ${mood}
- **Generated At**: ${new Date().toISOString()}

---

## [INJECTED MOOD GUIDELINE & DYNAMIC CONTENT]
(This part is sent FRESH every turn)

${dynamicPrompt}
`;

            fs.writeFileSync(path.join(PREVIEW_DIR, `preview_gby_${mood}.md`), finalOutput, 'utf-8');
            console.log(`   -> Saved: preview_gby_${mood}.md`);
        }

        console.log("✅ All previews generated successfully!");

    } catch (e: any) {
        console.error("❌ Error generating previews:", e);
        if (e.code === 'MODULE_NOT_FOUND') {
            console.error("   (Hint: Ensure paths to JSONs and libs are correct relative to scripts/)");
        }
    }
}

main();
