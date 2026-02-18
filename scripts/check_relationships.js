const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '..', 'src', 'data', 'games', 'god_bless_you', 'jsons', 'characters', 'characters_main.json');
const supportPath = path.join(__dirname, '..', 'src', 'data', 'games', 'god_bless_you', 'jsons', 'characters', 'characters_supporting.json');

const main = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
const supporting = JSON.parse(fs.readFileSync(supportPath, 'utf8'));

const allChars = { ...main, ...supporting };

// Track which file each character belongs to
const charFile = {};
for (const name of Object.keys(main)) charFile[name] = 'main';
for (const name of Object.keys(supporting)) charFile[name] = 'supporting';

const bidirMissing = [];
const targetNotFound = [];

for (const [name, data] of Object.entries(allChars)) {
    const relations = data['인간관계'] || {};
    for (const target of Object.keys(relations)) {
        const desc = relations[target];
        if (!allChars[target]) {
            targetNotFound.push({ from: name, to: target, desc: desc });
            continue;
        }
        const targetRelations = allChars[target]['인간관계'] || {};
        if (!targetRelations[name]) {
            bidirMissing.push({
                from: name,
                to: target,
                fromDesc: desc,
                fromFile: charFile[name],
                toFile: charFile[target]
            });
        }
    }
}

// Output as JSON for clean parsing
const result = {
    totalChars: Object.keys(allChars).length,
    mainChars: Object.keys(main),
    supportingChars: Object.keys(supporting),
    bidirectionalMissing: bidirMissing,
    targetNotFound: targetNotFound
};

fs.writeFileSync(path.join(__dirname, 'relationship_audit.json'), JSON.stringify(result, null, 2), 'utf8');
console.log('Audit complete. Results written to scripts/relationship_audit.json');
console.log('Bidirectional missing: ' + bidirMissing.length);
console.log('Target not found: ' + targetNotFound.length);
