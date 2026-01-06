
const fs = require('fs');
const path = require('path');

const projectRoot = 'j:\\AI\\Game\\AIChatBotGame';
const assetsJsonPath = path.join(projectRoot, 'src', 'data', 'assets.json');
const mapJsonPath = path.join(projectRoot, 'src', 'data', 'games', 'wuxia', 'character_map.json');
const srcImage = path.join(projectRoot, 'public', 'assets', 'wuxia', 'ExtraCharacters', '활달한여무사여.png');
const destDir = path.join(projectRoot, 'public', 'assets', 'wuxia', 'characters', 'JinSoMin');
const destImage = path.join(destDir, 'Default.png');

// 1. Ensure Directory Exists
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log(`Created directory: ${destDir}`);
}

// 2. Copy Image
if (fs.existsSync(srcImage)) {
    fs.copyFileSync(srcImage, destImage);
    console.log(`Copied image to: ${destImage}`);
} else {
    console.error(`Source image not found: ${srcImage}`);
}

// 3. Update character_map.json
if (fs.existsSync(mapJsonPath)) {
    let mapData = JSON.parse(fs.readFileSync(mapJsonPath, 'utf8'));
    if (!mapData['진소민']) {
        mapData['진소민'] = 'JinSoMin';

        // Sort keys
        const sortedMap = {};
        Object.keys(mapData).sort().forEach(key => {
            sortedMap[key] = mapData[key];
        });

        fs.writeFileSync(mapJsonPath, JSON.stringify(sortedMap, null, 4), 'utf8');
        console.log(`Updated character_map.json with JinSoMin`);
    } else {
        console.log('JinSoMin already in character_map.json');
    }
} else {
    console.error('character_map.json not found');
}

// 4. Update assets.json
if (fs.existsSync(assetsJsonPath)) {
    let assetsData = JSON.parse(fs.readFileSync(assetsJsonPath, 'utf8'));

    if (!assetsData.wuxia) {
        assetsData.wuxia = { characters: [], extraCharacters: [] };
    }

    // Ensure wuxia.characters exists
    if (!assetsData.wuxia.characters) {
        assetsData.wuxia.characters = [];
        console.log('Created wuxia.characters array');
    }

    // Add JinSoMin_Default if missing
    if (!assetsData.wuxia.characters.includes('JinSoMin_Default')) {
        assetsData.wuxia.characters.push('JinSoMin_Default');
        assetsData.wuxia.characters.sort();
        console.log('Added JinSoMin_Default to assets.json');
    }

    // Check if there are other misplaces "Main Characters" in extraCharacters and move them
    // (Optional enhancement, but let's stick to the immediate fix first to avoid breaking things)

    fs.writeFileSync(assetsJsonPath, JSON.stringify(assetsData, null, 2), 'utf8');
    console.log(`Updated assets.json`);
} else {
    console.error('assets.json not found');
}
