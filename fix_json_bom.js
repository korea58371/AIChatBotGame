
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/data/games/wuxia/jsons/characters/characters_supporting.json');

try {
    let data = fs.readFileSync(filePath, 'utf8');

    // Check for BOM and remove it
    if (data.charCodeAt(0) === 0xFEFF) {
        console.log("BOM detected. Removing...");
        data = data.slice(1);
        fs.writeFileSync(filePath, data, 'utf8');
        console.log("BOM removed and file saved.");
    } else {
        console.log("No BOM found.");
    }
} catch (e) {
    console.error("Error:", e.message);
}
