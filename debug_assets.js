
const fs = require('fs');
const path = require('path');

const assetsJsonPath = path.join('j:\\AI\\Game\\AIChatBotGame', 'src', 'data', 'assets.json');
const assetsData = JSON.parse(fs.readFileSync(assetsJsonPath, 'utf8'));

console.log('Wuxia Keys:', Object.keys(assetsData.wuxia));
if (assetsData.wuxia.characters) {
    console.log('Characters Length:', assetsData.wuxia.characters.length);
    console.log('First 5 Characters:', assetsData.wuxia.characters.slice(0, 5));
} else {
    console.log('Characters: undefined');
}

if (assetsData.wuxia.extraCharacters) {
    console.log('ExtraCharacters Length:', assetsData.wuxia.extraCharacters.length);
    console.log('First 5 ExtraCharacters:', assetsData.wuxia.extraCharacters.slice(0, 5));
} else {
    console.log('ExtraCharacters: undefined');
}
