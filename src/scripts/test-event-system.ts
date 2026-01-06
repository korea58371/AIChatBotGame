
import { EventManager } from '../lib/event-manager';
import { GAME_EVENTS } from '../data/games/wuxia/events';

console.log("=== Event System Verification ===");

// Mock State 1: Intro (Turn 1)
const stateIntro = {
    turnCount: 1,
    playerStats: { playerRank: '삼류' },
    triggeredEvents: []
};

console.log("\n[Test 1] Intro Condition (Turn 1)");
const resultIntro = EventManager.scan(GAME_EVENTS, stateIntro);
console.log("Mandatory:", resultIntro.mandatory.map(e => e.id));
console.log("Random:", resultIntro.randomCandidates.map(e => e.id));

if (resultIntro.mandatory.find(e => e.id === 'wuxia_intro')) {
    console.log("✅ Intro triggered correctly.");
} else {
    console.error("❌ Intro failed to trigger.");
}

// Mock State 2: Mid-game, Low Rank (Turn 10) -> Recruitment Test
const stateMidLow = {
    turnCount: 10,
    playerStats: { playerRank: '삼류' },
    triggeredEvents: ['wuxia_intro'],
    currentLocation: '객잔'
};

console.log("\n[Test 2] Mid-game Low Rank (Turn 10)");
const resultMidLow = EventManager.scan(GAME_EVENTS, stateMidLow);
console.log("Mandatory (Chain/Sub):", resultMidLow.mandatory.map(e => e.id)); // SUB might be random depending on classification?
console.log("Random Candidates:", resultMidLow.randomCandidates.map(e => e.id));

// Check functionality of Random Picks
const picks = EventManager.pickRandom(resultMidLow.randomCandidates, 2);
console.log("Random Picks:", picks.map(e => e.id));

if (resultMidLow.randomCandidates.find(e => e.id === 'golden_alley')) {
    console.log("✅ Golden Alley (Location: Inn) is a candidate.");
}

// Mock State 3: High Rank, Crisis (Turn 55, Master) -> Blood Cult
const stateHigh = {
    turnCount: 55,
    playerStats: { playerRank: '화경' },
    triggeredEvents: ['wuxia_intro', 'recruitment_test']
};

console.log("\n[Test 3] Late-game High Rank (Turn 55)");
const resultHigh = EventManager.scan(GAME_EVENTS, stateHigh);
console.log("Mandatory:", resultHigh.mandatory.map(e => e.id));

if (resultHigh.mandatory.find(e => e.id === 'blood_cult_appearance')) {
    console.log("✅ Blood Cult triggered correctly.");
}

