const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/games/god_bless_you/characters.json');

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const characters = JSON.parse(data);
    console.log(`Successfully parsed characters.json. Found ${characters.length} characters.`);

    // Optional: Check strictly for required fields if needed
    let errors = [];
    characters.forEach((char, index) => {
        if (!char.name) errors.push(`Character at index ${index} missing 'name'.`);
        if (!char.relationship) errors.push(`Character ${char.name || index} missing 'relationship'.`);
        if (!char.profile) errors.push(`Character ${char.name || index} missing 'profile'.`);
        // Add more checks as needed
    });

    if (errors.length > 0) {
        console.error("Validation errors found:");
        errors.forEach(e => console.error(e));
        process.exit(1);
    } else {
        console.log("All character entries have basic required fields.");
    }

} catch (err) {
    console.error("Error parsing characters.json:");
    console.error(err.message);
    process.exit(1);
}
