
import { AgentCasting } from './src/lib/agent/casting';

// Mock GameState
const mockCharacter = {
    id: 'yoon_areum',
    name: '윤아름',
    title: '편의점 퀸카',
    profile: {
        "소속": "편의점 (알바생)",
        "신분": "일반인 / 취준생",
        "나이": "21세",
        "신체": "163cm / 48kg",
        "별명": "편순이, 만년 유망주(자칭)",
        "성별": "여성",
        "거주지": "Korea"
    },
    system_logic: {
        "tags": [
            "일반인",
            "알바",
            "까칠",
            "소망",
            "속물"
        ]
    },
    // Add extra matches to ensure she gets base points
    "활동지역": "Korea"
};

const mockGameState = {
    turnCount: 0,
    playerStats: {
        gender: 'male',
        hp: 100,
        maxHp: 100
    },
    currentLocation: 'home',
    // Mock gameData to include Yoon Areum
    gameData: {
        characters: {
            'yoon_areum': mockCharacter
        }
    },
    // Also support characterData fallback
    characterData: {
        'yoon_areum': mockCharacter
    },
    worldData: {
        locations: {
            'home': { region: 'Korea' } // Simulating region match
        }
    }
};

async function testCasting() {
    try {
        console.log("Running Casting Test for Yoon Areum...");

        // Mock args
        const lastTurnSummary = "";
        const userInput = ""; // Empty input to test purely static bonuses
        const playerLevel = 1;

        const result = await AgentCasting.analyze(mockGameState as any, lastTurnSummary, userInput, playerLevel);

        // Check Yoon Areum in result.active or result.background
        const all = [...result.active, ...result.background];
        const yoon = all.find(c => c.id === 'yoon_areum');

        if (yoon) {
            console.log("Yoon Areum Score:", yoon.score);
            console.log("Reasons:", yoon.reasons);

            // Check specifically for Early Game Companion
            const hasCompanion = yoon.reasons.some(r => r.includes("Early Game Companion"));
            console.log("Has Early Game Companion Bonus?", hasCompanion);
        } else {
            console.error("Yoon Areum NOT found in candidates!");
        }

    } catch (e) {
        console.error("Test Error:", e);
    }
}

testCasting();
