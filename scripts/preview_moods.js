const fs = require('fs');
const path = require('path');

// Paths
const CONSTANTS_PATH = path.join(__dirname, '../src/data/games/wuxia/constants.ts');
const MOODS_PATH = path.join(__dirname, '../src/data/prompts/moods.ts');
const OUTPUT_PATH = path.join(__dirname, 'mood_previews.md');

// Helper to extract constant value (Template Literals)
function extractConstant(content, name) {
    const regex = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm');
    const match = content.match(regex);
    return match ? match[1] : `[ERROR: Could not extract ${name}]`;
}

// Helper to extract MOOD_PROMPTS_WUXIA object
function extractMoodPrompts(content) {
    // Determine start of object
    const startRegex = /export const MOOD_PROMPTS_WUXIA = \{/;
    const startMatch = content.match(startRegex);
    if (!startMatch) return {};

    const startIndex = startMatch.index + startMatch[0].length;
    let braceCount = 1;
    let endIndex = startIndex;

    // Simple brace counting to find end of object
    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') braceCount--;
        if (braceCount === 0) {
            endIndex = i;
            break;
        }
    }

    const objStr = content.substring(startIndex, endIndex);

    // Parse keys (daily, combat, etc.) and values (template literals)
    const prompts = {};
    const keyRegex = /([a-z]+):\s*`([\s\S]*?)`,/g;
    let match;
    while ((match = keyRegex.exec(objStr)) !== null) {
        prompts[match[1]] = match[2];
    }
    return prompts;
}

// Main
try {
    console.log("Reading source files...");
    const constantsContent = fs.readFileSync(CONSTANTS_PATH, 'utf8');
    const moodsContent = fs.readFileSync(MOODS_PATH, 'utf8');

    // Extract Data
    const identity = extractConstant(constantsContent, 'WUXIA_IDENTITY');
    const rules = extractConstant(constantsContent, 'WUXIA_BEHAVIOR_RULES');
    const format = extractConstant(constantsContent, 'WUXIA_OUTPUT_FORMAT');
    const moodPrompts = extractMoodPrompts(moodsContent);

    // Mock Lore & DB (Placeholders for clarity)
    const lorePlaceholder = `
## [World Knowledge Base (Optimized)]
(Includes: World Rules, Geography, Power Levels, Factions, Characters, etc.)
[...Lore Content Omitted for Brevity...]
`;
    const npcDbPlaceholder = `
## [NPC Database (Famous Figures)]
(List of top 10 masters...)
`;
    const bgPlaceholder = `
## [Available Backgrounds]
(List of background keys...)
`;

    // Generate Preview
    let output = `# Mood Prompt Previews (Wuxia)\n\nGenerated: ${new Date().toISOString()}\n\n`;

    Object.entries(moodPrompts).forEach(([mood, moodText]) => {
        output += `---
# [MOOD: ${mood.toUpperCase()}]
### CACHE KEY: PROMPT_CACHE_wuxia_${mood}_v1.0

${identity}

${lorePlaceholder}

${npcDbPlaceholder}

${bgPlaceholder}

${rules}

${format}

${moodText}

`;
    });

    fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
    console.log(`Successfully generated preview at: ${OUTPUT_PATH}`);

} catch (e) {
    console.error("Error generating preview:", e);
}
