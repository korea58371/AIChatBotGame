const fs = require('fs');
const path = require('path');

const CHARACTERS_PATH = path.join(__dirname, '../src/data/games/god_bless_you/jsons/characters.json');
const BATCH_1_PATH = path.join(__dirname, 'gby_char_update_data_1.json');
const BATCH_2_PATH = path.join(__dirname, 'gby_char_update_data_2.json');
const BATCH_3_PATH = path.join(__dirname, 'gby_char_update_data_3.json');

function mergeData() {
    console.log("Loading original characters.json...");
    let originalData = {};
    if (fs.existsSync(CHARACTERS_PATH)) {
        originalData = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf8'));
    } else {
        console.warn("Original characters.json not found! Creating new.");
    }

    const batches = [BATCH_1_PATH, BATCH_2_PATH, BATCH_3_PATH];

    batches.forEach((batchPath, index) => {
        if (fs.existsSync(batchPath)) {
            console.log(`Processing Batch ${index + 1}...`);
            const updateData = JSON.parse(fs.readFileSync(batchPath, 'utf8'));

            for (const [charName, updates] of Object.entries(updateData)) {
                if (!originalData[charName]) {
                    console.log(`[NEW] Adding character: ${charName}`);
                    originalData[charName] = {};
                } else {
                    // console.log(`[UPDATE] Updating character: ${charName}`);
                }

                const charToUpdate = originalData[charName];

                // Update Title
                if (updates.title) charToUpdate.title = updates.title;

                // Update Profile (Merge)
                if (updates.profile) {
                    charToUpdate.profile = { ...charToUpdate.profile, ...updates.profile };
                }

                // Update Personality (Merge)
                if (updates.personality) {
                    charToUpdate.personality = { ...charToUpdate.personality, ...updates.personality };
                }

                // Update Preferences (Merge)
                if (updates.preferences) {
                    charToUpdate.preferences = { ...charToUpdate.preferences, ...updates.preferences };
                }

                // Update Secret (Merge)
                if (updates.secret) {
                    charToUpdate.secret = { ...charToUpdate.secret, ...updates.secret };
                }

                // Update Activity Region
                if (updates.활동지역) {
                    charToUpdate['활동지역'] = updates.활동지역;
                }

                // Update Skills (Nested under 강함)
                if (updates.강함) {
                    if (!charToUpdate['강함']) charToUpdate['강함'] = {};
                    // If updates.강함.skills is present, update it
                    if (updates.강함.skills) {
                        charToUpdate['강함'].skills = updates.강함.skills;
                    }
                    // If updates.강함.등급 is present (not in current batch but generic safety)
                    if (updates.강함.등급) {
                        charToUpdate['강함'].등급 = updates.강함.등급;
                    }
                }
            }
        } else {
            console.error(`Batch file not found: ${batchPath}`);
        }
    });

    console.log(`Writing updated data to ${CHARACTERS_PATH}...`);
    fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(originalData, null, 4), 'utf8');
    console.log("Success! Character data updated.");
}

mergeData();
