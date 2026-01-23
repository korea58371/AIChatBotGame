
import { AgentCasting } from '../src/lib/agent/casting.ts';

// Mock GameState
const mockGameState = {
    currentLocation: "남만",
    activeCharacters: ["야율"], // User says "Yayul" is active
    characterData: {
        "야율": {
            name: "야율",
            id: "야율", // Logic assumes ID exists
            profile: { 소속: "남만 야수궁", 신분: "소궁주" },
            활동지역: "남만"
        },
        "야율 바르칸": {
            name: "야율 바르칸",
            id: "야율 바르칸",
            profile: {
                소속: "남만 야수궁",
                신분: "궁주"
            },
            활동지역: "남만",
            system_logic: {
                tags: ["남만", "야수왕"]
            }
        }
    },
    phase: 1,
    turnCount: 10,
    playerStats: { hp: 100, maxHp: 100, level: 1 }
};

async function testCasting() {
    console.log("--- Testing Background Casting for 'Yayul Barkan' ---");
    // @ts-ignore
    const result = await AgentCasting.analyze(mockGameState, "Summary", "", 10);

    console.log("Active List IDs:", result.active.map(c => c.id));

    const barkan = result.background.find(c => c.id === "야율 바르칸");

    if (barkan) {
        console.log("SUCCESS: Yayul Barkan found in BACKGROUND.");
        console.log("Score:", barkan.score);
        console.log("Reasons:", barkan.reasons);
    } else {
        console.log("FAILURE: Yayul Barkan NOT found in background.");
        const actBarkan = result.active.find(c => c.id === "야율 바르칸");
        if (actBarkan) {
            console.log("He is in ACTIVE list.", actBarkan.reasons);
        } else {
            console.log("He is missing entirely. Dumping all candidates:");
            // console.log(result.background.map(c => c.name));
        }
    }
}

testCasting();
