const fs = require('fs');
const path = require('path');

// Paths
const BASE_DIR = path.join(__dirname, '../src/data/games/wuxia');
const CHAR_JSON_PATH = path.join(BASE_DIR, 'characters.json');
const MAP_JSON_PATH = path.join(BASE_DIR, 'character_map.json');

const SOURCE_DIR = path.join(BASE_DIR, 'jsons/characters');
const MAIN_PATH = path.join(SOURCE_DIR, 'characters_main.json');
const SUPP_PATH = path.join(SOURCE_DIR, 'characters_supporting.json');
const EXTRA_PATH = path.join(SOURCE_DIR, 'characters_extra.json');

// Load Data
function loadJson(p) {
    if (!fs.existsSync(p)) return [];
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        console.error(`Failed to load ${p}:`, e);
        return [];
    }
}

const mapData = loadJson(MAP_JSON_PATH);
const existingRoster = loadJson(CHAR_JSON_PATH);
const mainChars = loadJson(MAIN_PATH);
const suppChars = loadJson(SUPP_PATH);
const extraChars = loadJson(EXTRA_PATH);

// Helper: Normalize ID/Name
function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Reverse Map for Lookup (Value -> Key is not unique, so we use Key -> Value)
// We need Name -> ID. In map.json: "KoreanName": "EnglishID"
// So we can use mapData directly.

function getCharacterId(koreanName) {
    // 1. Direct Lookup
    if (mapData[koreanName]) return mapData[koreanName];

    // 2. Clean Name Lookup (remove brackets e.g. "연화린 (xxxx)")
    const clean = koreanName.split('(')[0].trim();
    if (mapData[clean]) return mapData[clean];

    // 3. Fallback: Check existing roster for preserved ID
    const existing = existingRoster.find(c => c.name === clean);
    if (existing && existing.id) return existing.id;

    console.warn(`[Warning] No ID found for ${koreanName} (${clean}). Using placeholder.`);
    return null;
    // Returning null means we might need to Romanize it or skip it? 
    // For now, let's return null and log it.
}

function processCharacters(sourceList, defaultRole) {
    return sourceList.map(item => {
        const rawName = item.basic_profile?.이름 || "Unknown";
        const cleanName = rawName.split('(')[0].trim();

        let id = getCharacterId(rawName);
        if (!id) {
            // Manual Romanization Fallback needed? 
            // Or just mark as TODO
            id = "TODO_" + cleanName;
        }

        // Description Synthesis
        // Use existing description if available to preserve manual edits?
        // User asked to "Generate from these files", implying the detailed files are source of truth.
        // But the detailed files lack summary "description".
        // Let's use `header_title` or construct one from `basic_profile`.

        // Strategy: Use existing description if it exists (Preserve), else generate.
        const existing = existingRoster.find(c => c.name === cleanName);
        let description = existing?.description;

        if (!description) {
            // Generate
            const title = item.basic_profile?.신분 || "";
            const nick = item.basic_profile?.별명 || "";
            const traits = item.personality?.['표면적 성격'] || "";
            description = `${cleanName}. ${title}. ${nick}. ${traits}`;
        }

        return {
            name: cleanName,
            role: defaultRole, // "주연", "조연", "단역"
            description: description,
            id: id,
            faction: item.basic_profile?.소속 || "Unknown",
            martial_arts_realm: item.basic_profile?.martial_arts_realm?.name || "Unknown"
        };
    });
}

// Execution
const newMain = processCharacters(mainChars, '주연');
const newSupp = processCharacters(suppChars, '조연');
const newExtra = processCharacters(extraChars, '단역');

const combined = [...newMain, ...newSupp, ...newExtra];

// Validate duplicates
const uniqueMap = new Map();
combined.forEach(c => {
    if (uniqueMap.has(c.name)) {
        console.log(`Duplicate skipped: ${c.name}`);
    } else {
        uniqueMap.set(c.name, c);
    }
});

const finalRoster = Array.from(uniqueMap.values());

console.log(`Generated ${finalRoster.length} characters.`);
fs.writeFileSync(CHAR_JSON_PATH, JSON.stringify(finalRoster, null, 4), 'utf8');
console.log('Saved to characters.json');
