
// @ts-nocheck
import { LoreConverter } from '../src/lib/lore-converter';

const mockFactions = {
    hwasan: {
        sub_domain: "문파 (구파일방 / 정파)",
        faction_profile: { name: "화산파", status: { alignment: "정파" } }
    },
    haomun: {
        sub_domain: "문파 (사파 / 하오문)",
        faction_profile: { name: "하오문", status: { alignment: "혼돈 중립" } }
    },
    cheonsan: {
        sub_domain: "문파 (새외무림)",
        faction_profile: { name: "천산파", status: { alignment: "중립" } }
    },
    magyo: {
        sub_domain: "문파 (마교)",
        faction_profile: { name: "천마신교", status: { alignment: "마교" } }
    }
};

console.log("Testing LoreConverter Faction Categorization:");
const output = LoreConverter.convertFactions(mockFactions);
console.log(output);

const checks = [
    "🏳️ 정파 (Orthodox Sects)",
    "🏴 사파 (Unorthodox Sects)",
    "🏔️ 세외무림 (Outer Realms)",
    "👿 마교/혈교 (Demonic Cults)"
];

let allPass = true;
checks.forEach(check => {
    if (output.includes(check)) {
        console.log(`[PASS] Found Category: ${check}`);
    } else {
        console.log(`[FAIL] Missing Category: ${check}`);
        allPass = false;
    }
});

// Check if factions are under correct headers is harder with regex in basic script, 
// strictly checking order in output manually via log.
if (output.indexOf("화산파") > output.indexOf("정파") &&
    output.indexOf("하오문") > output.indexOf("사파") &&
    output.indexOf("천산파") > output.indexOf("세외무림") &&
    output.indexOf("천마신교") > output.indexOf("마교")) {
    console.log("[PASS] Factions appear to be under correct headers based on order.");
} else {
    console.log("[FAIL] Faction ordering mismatch.");
    allPass = false;
}
