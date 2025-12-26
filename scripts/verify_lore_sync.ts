import { LoreConverter } from '../src/lib/lore-converter';
import * as fs from 'fs';
import * as path from 'path';

// Mock Data Loading similar to DataManager
const loadJson = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf-8'));

async function verify() {
    console.log("Loading Main Characters...");
    const charMain = loadJson('src/data/games/wuxia/jsons/characters/characters_main.json');

    // Construct the 'lore' object structure expected by convertCharacters
    // Note: DataManager sends { characters_main: ..., characters_supporting: ... }
    const loreData = {
        characters_main: charMain,
        characters_supporting: {},
        characters_extra: {}
    };

    console.log("Converting Characters...");
    const output = LoreConverter.convertCharacters(loreData);

    console.log("--- OUTPUT START ---");
    console.log(output.substring(0, 1000)); // Show header
    console.log("...");

    // Checks
    let passed = true;

    if (output.includes("연화린") && output.includes("북해빙궁")) {
        console.log("✅ Main Character '연화린' found.");
    } else {
        console.error("❌ '연화린' missing!");
        passed = false;
    }

    if (output.includes("**경지**:")) {
        console.log("✅ Rank info found.");
    } else {
        console.error("❌ Rank info missing!");
        passed = false;
    }

    if (output.includes("[object Object]")) {
        console.error("❌ '[object Object]' found in output (Bad formatting)!");
        passed = false;
    } else {
        console.log("✅ No '[object Object]' strings found.");
    }

    // New Fields Verification
    // 1. Social
    if (output.includes("**Social**:")) {
        console.log("✅ Social roles field found.");
    } else {
        console.warn("⚠️ Social roles missing from output (might be empty for test chars).");
    }

    // 2. Secret
    if (output.includes("**Secret**:")) {
        console.log("✅ Secret field found.");
    } else {
        console.warn("⚠️ Secret field missing (Check if test data has secrets).");
    }

    // 3. Skills -> 무공
    if (output.includes("**무공**:")) {
        console.log("✅ Skills (무공) field found.");
    } else {
        console.warn("⚠️ Skills (무공) field missing.");
    }

    // 4. Korean Labels Check
    if (output.includes("**정보**:") && output.includes("**경지**:") && output.includes("**외형**:") && output.includes("**취향**:")) {
        console.log("✅ All Korean labels (정보, 경지, 외형, 취향) found.");
    } else {
        console.error("❌ Some Korean labels missing!");
        passed = false;
    }

    // 4. Faction Extra Fields (Need to load Factions to test this properly, but checking code logic is primarily via characters for now)
    // We can quick-test Faction conversion if we load it. 
    console.log("\nLoading Factions...");
    const factions = loadJson('src/data/games/wuxia/jsons/factions.json');
    const facOutput = LoreConverter.convertFactions(factions);

    if (facOutput.includes("**Loc**:")) {
        console.log("✅ Faction Location found.");
    } else {
        console.error("❌ Faction Location missing!");
        passed = false;
    }

    if (facOutput.includes("**Key Figures**:")) {
        console.log("✅ Faction Key Figures found.");
    } else {
        console.error("❌ Faction Key Figures missing!");
        passed = false;
    }

    // Romance Check
    console.log("\nLoading Romance Guide...");
    const romance = loadJson('src/data/games/wuxia/jsons/wuxia_romance_guide.json');
    const romOutput = LoreConverter.convertRomance(romance);

    if (romOutput.includes("[object Object]")) {
        console.error("❌ Romance: '[object Object]' found!");
        passed = false;
    } else {
        console.log("✅ Romance: No '[object Object]' strings found.");
    }

    if (romOutput.includes("당과(사탕/과자)")) {
        console.log("✅ Romance: Detailed content found.");
    }

    if (passed) {
        console.log("\n✨ ALL CHECKS PASSED. LoreConverter is synced.");
    } else {
        console.log("\n⚠️ SOME CHECKS FAILED.");
        process.exit(1);
    }
}

verify();
