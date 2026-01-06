
const fs = require('fs');
const path = require('path');

const projectRoot = 'j:\\AI\\Game\\AIChatBotGame';
const assetsJsonPath = path.join(projectRoot, 'src', 'data', 'assets.json');
const charDir = path.join(projectRoot, 'public', 'assets', 'wuxia', 'characters');

// 1. Get List of Main Characters from Filesystem
const mainCharNames = fs.readdirSync(charDir).filter(file => {
    return fs.statSync(path.join(charDir, file)).isDirectory();
});

console.log(`Found ${mainCharNames.length} main character directories.`);

// 2. Load assets.json
if (fs.existsSync(assetsJsonPath)) {
    let assetsData = JSON.parse(fs.readFileSync(assetsJsonPath, 'utf8'));

    if (!assetsData.wuxia) assetsData.wuxia = { characters: [], extraCharacters: [] };
    if (!assetsData.wuxia.characters) assetsData.wuxia.characters = [];
    if (!assetsData.wuxia.extraCharacters) assetsData.wuxia.extraCharacters = [];

    const extraChars = assetsData.wuxia.extraCharacters;
    const mainChars = assetsData.wuxia.characters;

    const newExtraChars = [];
    let movedCount = 0;

    extraChars.forEach(key => {
        let isMain = false;

        // Check if key starts with any Main Character Name followed by _ or is exact match (unlikely)
        for (const name of mainCharNames) {
            if (key === name || key.startsWith(name + '_')) {
                isMain = true;
                break;
            }
        }

        if (isMain) {
            if (!mainChars.includes(key)) {
                mainChars.push(key);
                movedCount++;
            }
        } else {
            newExtraChars.push(key);
        }
    });

    assetsData.wuxia.extraCharacters = newExtraChars;
    assetsData.wuxia.characters.sort();
    assetsData.wuxia.extraCharacters.sort();

    console.log(`Moved ${movedCount} keys from extraCharacters to characters.`);

    fs.writeFileSync(assetsJsonPath, JSON.stringify(assetsData, null, 2), 'utf8');
    console.log(`Updated assets.json`);

} else {
    console.error('assets.json not found');
}
