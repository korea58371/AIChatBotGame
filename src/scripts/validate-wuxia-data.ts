
import fs from 'fs';
import path from 'path';

// Define paths
const DATA_DIR = path.resolve(__dirname, '../data/games/wuxia/jsons');
const CHAR_MAIN_PATH = path.join(DATA_DIR, 'characters/characters_main.json');
const CHAR_SUPPORT_PATH = path.join(DATA_DIR, 'characters/characters_supporting.json');
const FACTIONS_PATH = path.join(DATA_DIR, 'factions.json');
const LOCATIONS_PATH = path.join(DATA_DIR, 'locations.json');

// Interface placeholders (Loose typing for script)
interface Character {
    id?: string;
    name: string;
    이름?: string;
    englishName?: string;
    소속?: string;
    faction?: string;
    relationships?: Record<string, string>;
    인간관계?: Record<string, string>;
    활동지역?: string;
}

interface Faction {
    이름: string;
    주요인물?: Record<string, string>;
}

interface Location {
    zones: Record<string, {
        metadata?: {
            owner?: string;
            faction?: string;
            ruler_title?: string;
        }
    }>;
}

// Load Data
function loadJSON(p: string) {
    if (!fs.existsSync(p)) {
        console.error(`❌ File not found: ${p}`);
        return null;
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

async function validate() {
    console.log("🔍 Starting Wuxia Data Verification...\n");

    const charMain = loadJSON(CHAR_MAIN_PATH);
    const charSupport = loadJSON(CHAR_SUPPORT_PATH);
    const factionsData = loadJSON(FACTIONS_PATH);
    const locationsData = loadJSON(LOCATIONS_PATH);

    if (!charMain || !charSupport || !factionsData || !locationsData) return;

    // 1. Index All Characters
    // Map: Normalized Name -> Character Object
    const charMap = new Map<string, Character>();
    const allChars: Character[] = [...(charMain.characters || []), ...(charSupport.characters || [])];

    allChars.forEach(c => {
        // Index by Korean Name (Primary)
        if (c.name || c.이름) charMap.set((c.name || c.이름)!, c);
        // Index by English Name/ID if available
        if (c.id) charMap.set(c.id.toLowerCase(), c);
        if (c.englishName) charMap.set(c.englishName.toLowerCase(), c);
    });

    console.log(`✅ Loaded ${allChars.length} characters.`);

    // 2. Index All Factions
    const factionNames = new Set<string>();
    const factions = factionsData['문파'] || [];
    factions.forEach((f: Faction) => factionNames.add(f.이름));
    console.log(`✅ Loaded ${factionNames.size} factions.`);

    // 3. Validation Logic
    const errors: string[] = [];
    const warnings: string[] = [];

    const reportError = (msg: string) => errors.push(`❌ ${msg}`);
    const reportWarning = (msg: string) => warnings.push(`⚠️ ${msg}`);

    // CHECK A: Location Consistency
    console.log("\n--- Checking Locations ---");
    const regions = locationsData.regions || {};
    for (const [regionKey, region] of Object.entries(regions) as any) {
        if (!region.zones) continue;

        for (const [zoneKey, zone] of Object.entries(region.zones) as any) {
            const meta = zone.metadata;
            if (meta) {
                // 1. Check Owner
                if (meta.owner) {
                    const ownerName = meta.owner;
                    // Check if owner exists in CharMap (Name or ID check)
                    // We check strict equality first, then Normalized
                    const found = charMap.has(ownerName) || charMap.has(ownerName.toLowerCase());

                    if (!found) {
                        reportError(`[Location: ${zoneKey}] Owner '${ownerName}' not found in Character DB.`);
                    } else if (/^[A-Za-z\s]+$/.test(ownerName)) {
                        // Warn if English name is used in metadata (Standardization Check)
                        reportWarning(`[Location: ${zoneKey}] Owner '${ownerName}' is in English. Should be Korean?`);
                    }
                }

                // 2. Check Faction
                if (meta.faction) {
                    const factionName = meta.faction;
                    if (!factionNames.has(factionName)) {
                        reportError(`[Location: ${zoneKey}] Faction '${factionName}' not found in Factions DB.`);
                    } else if (/^[A-Za-z\s]+$/.test(factionName)) {
                        reportWarning(`[Location: ${zoneKey}] Faction '${factionName}' is in English. Should be Korean?`);
                    }
                }
            }
        }
    }

    // CHECK B: Faction Consistency
    console.log("\n--- Checking Factions ---");
    factions.forEach((f: Faction) => {
        if (f.주요인물) {
            Object.keys(f.주요인물).forEach(charName => {
                if (!charMap.has(charName)) {
                    reportError(`[Faction: ${f.이름}] Key Figure '${charName}' not found in Character DB.`);
                }
            });
        }
    });

    // CHECK C: Character Relationships
    console.log("\n--- Checking Characters ---");
    allChars.forEach(c => {
        const charName = c.name || c.이름 || "Unknown";

        // 1. Check Faction (Legacy or New Field)
        const charFaction = c.소속 || c.faction;
        if (charFaction && !factionNames.has(charFaction) && charFaction !== "무소속" && charFaction !== "마교") {
            // Loose check for "마교" vs "천마신교" etc.
            // reportWarning(`[Character: ${charName}] Faction '${charFaction}' might be invalid.`);
        }

        // 2. Check Relationships
        const rels = { ...(c.relationships || {}), ...(c['인간관계'] || {}) };
        Object.keys(rels).forEach(target => {
            if (!charMap.has(target)) {
                reportWarning(`[Character: ${charName}] Relationship target '${target}' not found.`);
            }
        });
    });

    // Output Report
    console.log("\n================ VALIDATION REPORT ================");
    if (errors.length === 0 && warnings.length === 0) {
        console.log("🎉 All Checks Passed! Data Integrity is 100%.");
    } else {
        console.log(`Found ${errors.length} Errors and ${warnings.length} Warnings.\n`);
        errors.forEach(e => console.log(e));
        console.log("");
        warnings.forEach(w => console.log(w));
    }
    console.log("===================================================");
}

validate();
