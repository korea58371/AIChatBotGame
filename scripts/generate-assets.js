const fs = require('fs');
const path = require('path');

const publicDir = path.join(process.cwd(), 'public');
const assetsDir = path.join(publicDir, 'assets');
const outputDir = path.join(process.cwd(), 'src', 'data');
const outputFile = path.join(outputDir, 'assets.json');

// Helper to get files from a directory
function getFiles(dir) {
    try {
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
            .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
            .map(file => path.parse(file).name.normalize('NFC')); // [Fix] Normalize to NFC
    } catch (error) {
        // console.error(`Directory not found or empty: ${dir}`);
        return [];
    }
}

console.log('Generating assets.json...');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Support Multi-Game Structure: public/assets/[gameId]/[category]
const assets = {};

try {
    if (fs.existsSync(assetsDir)) {
        const games = fs.readdirSync(assetsDir).filter(f => fs.statSync(path.join(assetsDir, f)).isDirectory());

        games.forEach(gameId => {
            const gameDir = path.join(assetsDir, gameId);

            // Define Standard Categories with Case-Insensitive Lookup capability
            // We want to find folders that match these names regardless of case
            const targetCategories = ['ExtraCharacters', 'backgrounds', 'characters'];

            assets[gameId] = {};

            // Get all actual folders in gameDir for case-insensitive matching
            const actualFolders = fs.readdirSync(gameDir).filter(f => fs.statSync(path.join(gameDir, f)).isDirectory());

            targetCategories.forEach(cat => {
                // Find actual folder name that matches 'cat' case-insensitively
                const actualFolderName = actualFolders.find(f => f.toLowerCase() === cat.toLowerCase());

                if (!actualFolderName) {
                    // Category folder not found
                    if (cat === 'characters') {
                        assets[gameId]['characters'] = [];
                    } else {
                        const key = cat === 'ExtraCharacters' ? 'extraCharacters' : 'backgrounds';
                        assets[gameId][key] = [];
                    }
                    return;
                }

                const targetDir = path.join(gameDir, actualFolderName);

                if (cat === 'characters') {
                    // Recursive scan for characters (Subfolders)
                    const charFolders = fs.readdirSync(targetDir).filter(f => fs.statSync(path.join(targetDir, f)).isDirectory());
                    let allCharFiles = [];
                    charFolders.forEach(folder => {
                        const files = getFiles(path.join(targetDir, folder));
                        allCharFiles = [...allCharFiles, ...files];
                    });

                    // map to 'characters' key in JSON
                    assets[gameId]['characters'] = allCharFiles;
                    assets[gameId]['mainCharacters'] = allCharFiles; // [Restored] Required by GBY loader
                } else {
                    const key = cat === 'ExtraCharacters' ? 'extraCharacters' : 'backgrounds';
                    assets[gameId][key] = getFiles(targetDir);
                }
            });

            // Also support root level character folders if any (legacy)? 
            // Current structure seems to be strictly gameId based now for these dynamic assets.
        });
    }
} catch (e) {
    console.error("Error scanning assets directory:", e);
}

fs.writeFileSync(outputFile, JSON.stringify(assets, null, 2));
console.log(`Assets manifest written to ${outputFile}`);
Object.keys(assets).forEach(game => {
    console.log(`[${game}] Found ${assets[game].extraCharacters?.length || 0} ExtraCharacters and ${assets[game].backgrounds?.length || 0} Backgrounds.`);
});
