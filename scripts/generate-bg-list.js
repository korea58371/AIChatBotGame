const fs = require('fs');
const path = require('path');

const bgDir = path.join(__dirname, '../public/assets/backgrounds');
const outputDir = path.join(__dirname, '../src/data');
const outputFile = path.join(outputDir, 'background_list.json');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Read directory
try {
    const files = fs.readdirSync(bgDir);
    // Filter for images (jpg, png, jpeg, webp)
    const bgFiles = files.filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));

    // Sort for consistency
    bgFiles.sort();

    // Write to JSON
    fs.writeFileSync(outputFile, JSON.stringify(bgFiles, null, 2));
    console.log(`Generated background_list.json with ${bgFiles.length} files.`);
} catch (err) {
    console.error('Error reading background directory:', err);
    process.exit(1);
}
