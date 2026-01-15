
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/data/games/wuxia/jsons/characters/characters_supporting.json');

try {
    const data = fs.readFileSync(filePath, 'utf8');
    // Check for BOM
    if (data.charCodeAt(0) === 0xFEFF) {
        console.log("BOM detected!");
    }
    JSON.parse(data);
    console.log("JSON is valid.");
} catch (e) {
    console.error("JSON Error:", e.message);
    // Print around the error if possible (standard JSON.parse doesn't give line numbers easily without lib, 
    // but SyntaxError often contains position).
    if (e.message.match(/at position (\d+)/)) {
        const pos = parseInt(e.message.match(/at position (\d+)/)[1]);
        console.log("Error at position:", pos);
        // Show context
        const start = Math.max(0, pos - 50);
        const end = Math.min(data.length, pos + 50);
        console.log("Context:", data.substring(start, end));
    }
}
