const fs = require('fs');
const path = 'src/data/games/wuxia/jsons/characters/characters_supporting.json';

try {
    const raw = fs.readFileSync(path, 'utf8');
    const data = JSON.parse(raw);

    if (data['왕일도']) {
        console.log('--- FOUND WANG IL-DO ---');
        console.log(JSON.stringify(data['왕일도'], null, 2));

        // Also try to find the line number by raw search
        const lines = raw.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('"왕일도":')) {
                console.log('Line Number: ' + (i + 1));
                break;
            }
        }
    } else {
        console.log('Character not found in key lookup.');
        // Try fuzzy search keys
        Object.keys(data).forEach(k => {
            if (k.includes('왕일도')) console.log('Found similar key:', k);
        });
    }
} catch (e) {
    console.error(e);
}
