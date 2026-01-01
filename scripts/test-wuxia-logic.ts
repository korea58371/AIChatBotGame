
import { AgentPreLogic } from '../src/lib/agent/pre-logic';
import { AgentMartialArts } from '../src/lib/agent/martial-arts';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testWuxiaLogic() {
    console.log("=== Testing Wuxia Logic Agents ===");

    // Mock Context
    const mockRouterOut = { type: 'combat', target: 'Bandit', confidence: 0.9 };
    const mockState = {
        playerStats: {
            realm: '삼류', // 3rd Rate
            growthStagnation: 0
        },
        tensionLevel: 50,
        goals: []
    };

    // Test 1: Pre-Logic Reality Check (Anti-God Mode)
    console.log("\n[Test 1] Pre-Logic: 3rd Rate Player attempts 'Sword Aura' (1st Rate Move)");
    const inputOverreach = "I channel my internal energy to release a massive Sword Aura!";

    // Note: We need to mock 'AgentPreLogic.analyze' dependencies if possible, or just run it via API if key exists.
    // Assuming .env.local has the key.

    if (!process.env.GEMINI_API_KEY) {
        console.error("No API Key found. Skipping live inference.");
        return;
    }

    try {
        const preLogicResult = await AgentPreLogic.analyze(
            mockRouterOut as any,
            "Context: Combat with bandit.",
            inputOverreach,
            mockState
        );
        console.log("Pre-Logic Result:", JSON.stringify(preLogicResult, null, 2));
    } catch (e) {
        console.error("Pre-Logic Error:", e);
    }

    // Test 2: Martial Arts Agent Audit
    console.log("\n[Test 2] Martial Arts Agent: Auditing a successful strike");
    const storyText = "The protagonist swings his sword. A faint, unstable glimmer of energy appears on the blade, shocking the bandit before fading.";

    try {
        const martialResult = await AgentMartialArts.analyze(
            inputOverreach,
            storyText,
            '삼류',
            mockState.playerStats,
            10
        );
        console.log("Martial Arts Agent Result:", JSON.stringify(martialResult, null, 2));
    } catch (e) {
        console.error("Martial Arts Error:", e);
    }
}

testWuxiaLogic();
