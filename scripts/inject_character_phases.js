
const fs = require('fs');
const path = require('path');

const CHAR_PATH = path.join(__dirname, '../src/data/games/god_bless_you/jsons/characters.json');

// Phase Definition
// Phase 0: Non-Awakened / Civilians (None currently in main DB mostly)
// Phase 1: F~E Rank (Slum, Low Tier)
// Phase 2: D~B Rank (Mid Tier, Guilds)
// Phase 3: A~S Rank (High Tier, National Power)

const PHASE_MAP = {
    // Phase 0 (Civilian / Family)
    "한가을": 0,

    // Phase 1 (F~E Rank / Helpers)
    "고하늘": 1,
    "마세영": 1,
    "민소희": 1,  // Landlord (Civilian/Low) - Phase 1 active
    "편의점사장": 1,
    "불량배": 1,

    // Phase 2 (D~B Rank / Mid-tier / Professionals)
    "이아라": 2, // B-Rank Idol (Special visibility)
    "오지민": 2, // Association Manager (Contactable early-mid)
    "한수진": 2, // Healer (maybe low rank? let's assume mid)
    "유화영": 3, // Guild Leader usually High? Maybe 2. Let's Set to 2 for now.
    "차도희": 2,
    "주아인": 2, // A-Rank but User said "Phase 2 late". So 2 is safer start.

    // Phase 3 (A~S Rank / Legends / Restricted)
    "천서윤": 3,
    "성시아": 3,
    "한여름": 3,
    "앨리스": 3,
    "신세아": 3,
    "백련화": 1, // Retired S-Rank (Academy Instructor). User said "Phase 1 Active" if Academy. Let's set to 1.
    "사이온지 미유키": 3,
    "리메이링": 3,
    "아나스타샤": 3,
    "데스피나": 3,
    "비올라": 3,
    "권세나": 2, // Maybe?
    "김민지": 2,
    "도예린": 2,
    "류소연": 2,
    "링링": 3,
    "사토 아야": 2,
    "서유나": 2,
    "서이수": 2,
    "설아": 2
};

// Default Rule: Infer from Rank if possible, else 2.
function inferPhase(char) {
    if (PHASE_MAP[char.name]) return PHASE_MAP[char.name];

    // Check Rank String
    const rankData = char['강함']?.['등급'] || char.rank || "";
    if (rankData.includes('S급') || rankData.includes('SS급') || rankData.includes('L급')) return 3;
    if (rankData.includes('A급')) return 3; // Strict lock for A too?
    if (rankData.includes('B급') || rankData.includes('C급') || rankData.includes('D급')) return 2;
    if (rankData.includes('E급') || rankData.includes('F급')) return 1;

    return 2; // Middle ground default
}

function run() {
    if (!fs.existsSync(CHAR_PATH)) {
        console.error("Characters JSON not found!");
        return;
    }

    const raw = fs.readFileSync(CHAR_PATH, 'utf-8');
    const chars = JSON.parse(raw);

    let count = 0;
    for (const name in chars) {
        const char = chars[name];
        const newPhase = inferPhase(char);

        // Update field
        char.appearancePhase = newPhase;

        // Add Condition Tag to Profile/Secret if Phase 3
        if (newPhase >= 3) {
            if (!char.spawnRules) char.spawnRules = {};
            char.spawnRules.condition = `Phase ${newPhase} 해금 필요 (뉴스/이벤트로만 등장)`;
        }

        console.log(`Updated ${name} -> Phase ${newPhase}`);
        count++;
    }

    fs.writeFileSync(CHAR_PATH, JSON.stringify(chars, null, 2), 'utf-8');
    console.log(`Successfully updated ${count} characters with Phase data.`);
}

run();
