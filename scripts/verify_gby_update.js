const fs = require('fs');
const path = require('path');

const CHARACTERS_PATH = path.join(__dirname, '../src/data/games/god_bless_you/jsons/characters.json');

try {
    const data = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf8'));
    const target = data['오지민'];
    if (target) {
        console.log("Found 오지민:");
        console.log(JSON.stringify(target.secret, null, 2));
    } else {
        console.log("오지민 NOT FOUND");
    }

    const target2 = data['성시아'];
    if (target2) {
        console.log("Found 성시아:");
        console.log(JSON.stringify(target2.secret, null, 2));
    }
} catch (e) {
    console.error(e);
}
