
import { DataManager } from './src/lib/data-manager';

async function test() {
    console.log("Testing Wuxia Lore Loading...");
    try {
        const gameData = await DataManager.loadGameData('wuxia');
        if (gameData.lore) {
            console.log("Success! Lore Loaded.");
            console.log("Keys:", Object.keys(gameData.lore));
            console.log("Size:", JSON.stringify(gameData.lore).length);
        } else {
            console.error("FAILED. Lore is missing.");
        }
    } catch (e) {
        console.error("Error loading:", e);
    }
}

test();
