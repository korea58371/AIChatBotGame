
const fs = require('fs');
const path = require('path');

const mainMapPath = 'j:/AI/Game/AIChatBotGame/src/data/games/wuxia/character_map.json';
const supportMapPath = 'j:/AI/Game/AIChatBotGame/src/data/games/wuxia/supporting_map.json';

const mainMap = JSON.parse(fs.readFileSync(mainMapPath, 'utf8'));
const supportMap = JSON.parse(fs.readFileSync(supportMapPath, 'utf8'));

// Merge support into main (Main takes precedence if we want to preserve IDs, but here we want to ADD)
// Actually, supportMap keys are Korean. MainMap has Korean keys too.
// If valid duplicate exists (YaYul), the value should be same.
const merged = { ...mainMap, ...supportMap };

// Write back with formatting
fs.writeFileSync(mainMapPath, JSON.stringify(merged, null, 4), 'utf8');

console.log("Merged entries: " + Object.keys(supportMap).length);
console.log("Total entries: " + Object.keys(merged).length);
