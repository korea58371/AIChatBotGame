const fs = require('fs');
const d = JSON.parse(fs.readFileSync('src/data/games/god_bless_you/jsons/characters/characters_main.json', 'utf-8'));
const s = JSON.parse(fs.readFileSync('src/data/games/god_bless_you/jsons/characters/characters_supporting.json', 'utf-8'));

console.log('=== MAIN (52) ===');
let mainSingleTag = 0;
let mainSingleLoc = 0;
for (const [n, c] of Object.entries(d)) {
    const t = c.system_logic?.tags || [];
    const a = c['활동지역'];
    const locCount = Array.isArray(a) ? a.length : 1;
    if (t.length <= 1) mainSingleTag++;
    if (locCount <= 1) mainSingleLoc++;
    console.log(`${n.padEnd(20)} Tags:${String(t.length).padStart(2)} | Locs:${locCount} | ${(Array.isArray(a) ? a[0] : a || '').substring(0, 35)}`);
}
console.log(`\nSummary: ${mainSingleTag} chars with <=1 tag, ${mainSingleLoc} chars with 1 location`);

console.log('\n=== SUPPORTING (7) ===');
for (const [n, c] of Object.entries(s)) {
    const t = c.system_logic?.tags || [];
    const a = c['활동지역'];
    const locCount = Array.isArray(a) ? a.length : 1;
    console.log(`${n.padEnd(20)} Tags:${String(t.length).padStart(2)} | Locs:${locCount} | ${(Array.isArray(a) ? a[0] : a || '').substring(0, 35)}`);
}
