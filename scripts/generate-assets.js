const fs = require('fs');
const path = require('path');

const publicDir = path.join(process.cwd(), 'public');
const charDir = path.join(publicDir, 'assets', 'characters');
const bgDir = path.join(publicDir, 'assets', 'backgrounds');
const outputDir = path.join(process.cwd(), 'src', 'data');
const outputFile = path.join(outputDir, 'assets.json');

function getFiles(dir) {
    try {
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
            .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
            .map(file => path.parse(file).name);
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
        return [];
    }
}

console.log('Generating assets.json...');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const assets = {
    characters: getFiles(charDir),
    backgrounds: getFiles(bgDir)
};

fs.writeFileSync(outputFile, JSON.stringify(assets, null, 2));
console.log(`Assets manifest written to ${outputFile}`);
console.log(`Found ${assets.characters.length} characters and ${assets.backgrounds.length} backgrounds.`);
