
import { DataManager } from './src/lib/data-manager';

async function verifyCharacterData() {
    try {
        console.log("Loading God Bless You data...");
        const data = await DataManager.loadGameData('god_bless_you');

        console.log("Characters loaded:", Object.keys(data.characters).length);

        const yoon = data.characters['윤아름'];
        if (yoon) {
            console.log("Yoon Areum found!");
            console.log("Profile:", JSON.stringify(yoon.profile, null, 2));
            console.log("Tags:", yoon.system_logic?.tags);
            console.log("Gender check:", yoon.profile?.성별);
        } else {
            console.error("Yoon Areum NOT found in loaded data!");
            // Check keys to see if she has a different key
            const keys = Object.keys(data.characters).filter(k => k.includes('윤') || k.includes('아름'));
            console.log("Possible matches:", keys);
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

verifyCharacterData();
