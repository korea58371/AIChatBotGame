const fs = require('fs');
const path = require('path');

const dir = 'j:/AI/Game/AIChatBotGame/public/assets/wuxia/ExtraCharacters';
const targetFile = 'j:/AI/Game/AIChatBotGame/src/data/games/wuxia/extra_map.json';

const files = fs.readdirSync(dir);
const map = {};

files.forEach(file => {
    if (!file.endsWith('.png')) return;
    const name = file.replace('.png', '');
    let key = name;
    if (name.includes('_')) {
        const parts = name.split('_');
        key = `${parts[0]}(${parts.slice(1).join('_')})`;
    }
    map[key] = file;
});

fs.writeFileSync(targetFile, JSON.stringify(map, null, 4));
console.log('Successfully wrote to ' + targetFile);
