const fs = require('fs');
const path = require('path');

const extraDir = path.join(__dirname, 'public/assets/ExtraCharacters');
const outputFile = path.join(extraDir, 'extra_map.json');

const files = fs.readdirSync(extraDir);
const map = {};

files.forEach(file => {
    // Skip the json file itself and hidden files
    if (file.endsWith('.json') || file.startsWith('.')) return;

    // Remove extension for the key
    const name = path.parse(file).name;
    map[name] = file;
});

fs.writeFileSync(outputFile, JSON.stringify(map, null, 4));
console.log(`Generated extra_map.json with ${Object.keys(map).length} entries.`);
