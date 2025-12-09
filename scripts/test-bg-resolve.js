const stringSimilarity = require('string-similarity');
const bgList = require('../src/data/background_list.json'); // Adjust path if needed
// const mappings = require('../src/data/backgroundMappings.ts'); // TS file, hard to require in JS. 
// I'll mock mappings or read simple logic.
// The user issue is likely about fuzzy matching.

const backgroundFiles = bgList;

function resolveBackgroundTest(tag) {
    const query = tag.replace(/<배경>|<\/배경>/g, '').trim();
    console.log(`Query: ${query}`);

    // Mock Strategies from TS file

    // 3. Fuzzy Filename
    const fileMatches = stringSimilarity.findBestMatch(query, backgroundFiles);
    const bestFileMatch = fileMatches.bestMatch;

    console.log(`Best Usage Match: ${bestFileMatch.target} (Score: ${bestFileMatch.rating})`);

    if (bestFileMatch.rating > 0.4) {
        return `/assets/backgrounds/${bestFileMatch.target}`;
    }

    return 'FALLBACK';
}

console.log("Result:", resolveBackgroundTest("<배경>City_Cafe"));
