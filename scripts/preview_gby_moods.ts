
import fs from 'fs';
import path from 'path';
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
    console.log("🔵 Starting God Bless You Prompt Preview Generation...");

    try {
        // 1. Load Character Data
        const charactersPath = path.join(GBY_ROOT, 'jsons/characters.json');
        const charactersData = JSON.parse(fs.readFileSync(charactersPath, 'utf-8'));

        // 1b. Load Wiki Data (for Factions/Geography) - Fallback or Reference
        const wikiPath = path.join(GBY_ROOT, 'wiki_data.json');

        // 1c. Load New JSON Files
        const jsonDir = path.join(GBY_ROOT, 'jsons');
        const modernFactions = JSON.parse(fs.readFileSync(path.join(jsonDir, 'modern_factions.json'), 'utf-8'));
        const modernGeography = JSON.parse(fs.readFileSync(path.join(jsonDir, 'modern_world_geography.json'), 'utf-8'));
        const modernElixirs = JSON.parse(fs.readFileSync(path.join(jsonDir, 'modern_elixirs.json'), 'utf-8'));
        const modernCombat = JSON.parse(fs.readFileSync(path.join(jsonDir, 'modern_combat.json'), 'utf-8'));
        const modernLevels = JSON.parse(fs.readFileSync(path.join(jsonDir, 'modern_levels.json'), 'utf-8'));
        const modernSkills = JSON.parse(fs.readFileSync(path.join(jsonDir, 'modern_skills.json'), 'utf-8'));
        const modernWeapons = JSON.parse(fs.readFileSync(path.join(jsonDir, 'modern_weapons.json'), 'utf-8'));
        const modernRomance = JSON.parse(fs.readFileSync(path.join(jsonDir, 'modern_romance_guide.json'), 'utf-8'));
        const modernTerminology = JSON.parse(fs.readFileSync(path.join(jsonDir, 'modern_terminology.json'), 'utf-8'));

        console.log(`✅ Loaded Modern JSONs.`);

        // 2. Categorize Characters (Main=S, Supp=A/B, Extra=Others)
        const charMain: any = {};
        const charSupp: any = {};
        const charExtra: any = {};

        Object.entries(charactersData).forEach(([key, char]: [string, any]) => {
            const rank = char?.강함?.등급 || "D급";
            if (rank.includes('S급')) {
                charMain[key] = char;
            } else if (rank.includes('A급') || rank.includes('B급')) {
                charSupp[key] = char;
            } else {
                charExtra[key] = char;
            }
        });

        console.log(`✅ Categorized: Main(${Object.keys(charMain).length}), Supp(${Object.keys(charSupp).length}), Extra(${Object.keys(charExtra).length})`);

        const mockLoreData = {
            charactersDetail: {
                characters_main: charMain,
                characters_supporting: charSupp,
                characters_extra: charExtra
            },
            // Inject Loaded Modern Data
            // Map to LoreConverter keys
            martial_arts_levels: modernLevels,
            martial_arts_skills: modernSkills,
            weapons: modernWeapons,
            romance_guide: modernRomance,
            wuxia_terminology: modernTerminology,

            // Explicit Modern Keys for Factions/Geography
            modern_factions: modernFactions,
            modern_geography: modernGeography,

            // Additional data
            elixirs: modernElixirs,
            combat_guide: modernCombat
        };

        // 3. Generate Previews for Each Mood
        for (const mood of MOODS) {
            console.log(`⏳ Generating preview for mood: [${mood}]...`);

            // Pass empty string for 'possessorText' (2nd arg) to ensure 'mood' (3rd arg) is received correctly
            const output = LoreConverter.convertToMarkdown(mockLoreData, "", mood);

            // Add Header
            const finalOutput = `# God Bless You Prompt Preview
- **Mood**: ${mood}
- **Context Mode**: ${['combat', 'tension'].includes(mood) ? 'COMBAT' : ['romance', 'sexual'].includes(mood) ? 'ROMANCE' : 'DEFAULT'}
- **Generated At**: ${new Date().toISOString()}

---

${output}`;

            // Save
            const outputPath = path.join(PREVIEW_DIR, `preview_gby_${mood}.md`);
            fs.writeFileSync(outputPath, finalOutput, 'utf-8');
            console.log(`   -> Saved: ${outputPath}`);
        }

        console.log("✅ All previews generated successfully!");

    } catch (error) {
        console.error("❌ Error generating previews:", error);
    }
}

main();
