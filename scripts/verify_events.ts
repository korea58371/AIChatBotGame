
// @ts-nocheck
import { GAME_EVENTS } from '../src/data/games/wuxia/events';
import { getLogicPrompt } from '../src/data/prompts/logic';

// Mock Logic to test filtering
function testEventFiltering() {
    console.log("=== Event Filtering Test ===");

    // Case 1: Early Game (Turn 0) -> Wuxia Intro
    const state1 = { activeGameId: 'wuxia', turnCount: 0, playerStats: { playerRank: '삼류' } };
    const events1 = GAME_EVENTS.filter(e => e.condition(state1));
    console.log(`[Turn 0] Triggerable Events: ${events1.map(e => e.id).join(', ')}`);
    console.assert(events1.some(e => e.id === 'wuxia_intro'), "Should likely trigger Intro");

    // Case 2: Turn 10, Third Rate -> Realization
    const state2 = { activeGameId: 'wuxia', turnCount: 10, playerStats: { playerRank: '삼류' } };
    const events2 = GAME_EVENTS.filter(e => e.condition(state2));
    console.log(`[Turn 10/Rank3] Triggerable Events: ${events2.map(e => e.id).join(', ')}`);
    console.assert(events2.some(e => e.id === 'realization_training'), "Should trigger Realization");

    // Case 3: Turn 50, Peak -> Blood Cult
    const state3 = { activeGameId: 'wuxia', turnCount: 55, playerStats: { playerRank: '절정' } };
    const events3 = GAME_EVENTS.filter(e => e.condition(state3));
    console.log(`[Turn 55/Peak] Triggerable Events: ${events3.map(e => e.id).join(', ')}`);
    console.assert(events3.some(e => e.id === 'blood_cult_appearance'), "Should trigger Blood Cult");

    // Case 4: Logic Prompt Injection Check
    console.log("\n=== Logic Prompt Injection Test ===");
    const mockStat = { playerStats: { gold: 100 } };
    const mockContext = "Logic Context";
    const prompt = getLogicPrompt(mockStat, "Action", "Response", mockContext, {}, 'wuxia', events2);

    if (prompt.includes("realization_training")) {
        console.log("[PASS] Event List injected into Logic Prompt.");
    } else {
        console.error("[FAIL] Event List NOT found in prompt.");
    }
}

testEventFiltering();
