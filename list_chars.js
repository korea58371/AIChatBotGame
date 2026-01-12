
const fs = require('fs');

const filePaths = [
    'j:/AI/Game/AIChatBotGame/src/data/games/wuxia/jsons/characters/characters_supporting.json',
    'j:/AI/Game/AIChatBotGame/src/data/games/wuxia/jsons/characters/characters_main.json'
];

filePaths.forEach(path => {
    try {
        if (fs.existsSync(path)) {
            const data = JSON.parse(fs.readFileSync(path, 'utf8'));
            console.log(`\n--- Characters in ${path.split('/').pop()} ---`);
            Object.keys(data).forEach(name => {
                console.log(name);
            });
        }
    } catch (e) {
        console.error(e);
    }
});
