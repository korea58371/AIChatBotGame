const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, '..', 'src', 'data', 'games', 'wuxia', 'jsons', 'characters');
const mainPath = path.join(basePath, 'characters_main.json');
const supportPath = path.join(basePath, 'characters_supporting.json');
const enemyPath = path.join(basePath, 'characters_enemy.json');

const main = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
const supporting = JSON.parse(fs.readFileSync(supportPath, 'utf8'));
const enemy = JSON.parse(fs.readFileSync(enemyPath, 'utf8'));

const allChars = { ...main, ...supporting, ...enemy };

const charFile = {};
for (const name of Object.keys(main)) charFile[name] = 'main';
for (const name of Object.keys(supporting)) charFile[name] = 'supporting';
for (const name of Object.keys(enemy)) charFile[name] = 'enemy';

const bidirMissing = [];
const targetNotFound = [];
const structuralErrors = [];

for (const [name, data] of Object.entries(allChars)) {
    const relations = data['인간관계'] || {};

    // Check for structural issues
    for (const [target, desc] of Object.entries(relations)) {
        if (target.length > 20) {
            structuralErrors.push({ char: name, key: target, desc: desc, issue: 'long_key' });
        }
        if (target.includes('(') || target.includes('/')) {
            structuralErrors.push({ char: name, key: target, desc: desc, issue: 'special_char' });
        }
    }

    for (const target of Object.keys(relations)) {
        const desc = relations[target];
        if (!allChars[target]) {
            targetNotFound.push({ from: name, to: target, desc: desc, fromFile: charFile[name] });
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

const result = {
    totalChars: Object.keys(allChars).length,
    mainChars: Object.keys(main),
    supportingChars: Object.keys(supporting),
    enemyChars: Object.keys(enemy),
    structuralErrors: structuralErrors,
    bidirectionalMissing: bidirMissing,
    targetNotFound: targetNotFound
};

fs.writeFileSync(path.join(__dirname, 'wuxia_relationship_audit.json'), JSON.stringify(result, null, 2), 'utf8');
console.log('=== Wuxia Audit Complete ===');
console.log('Total chars:', Object.keys(allChars).length);
console.log('Main:', Object.keys(main).length, '/ Supporting:', Object.keys(supporting).length, '/ Enemy:', Object.keys(enemy).length);
console.log('Structural errors:', structuralErrors.length);
console.log('Bidirectional missing:', bidirMissing.length);
console.log('Target not found:', targetNotFound.length);
