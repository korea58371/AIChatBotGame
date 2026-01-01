
const { parseScript } = require('./script-parser'); // Assuming we can run this locally or mocked

// Mocking useGameStore if script-parser imports it directly. 
// Since script-parser.ts likely imports from a module that uses React hooks or stores, running it in node might be tricky if it has hard dependencies.
// Let's check script-parser.ts imports again.
// It imports `useGameStore` from `store`. 
// We might need to mock that if we want to run this in isolation.

// However, I can just create a standalone test file that copies the logic OR simply rely on my analysis.
// But to be "Agentic", I should verify.
// Let's try to update debug_parser.js which seems to be a standalone copy/simplified version strictly for debugging regex.
// I will create a NEW debug_parser_v2.js that copies the ACTUAL logic from script-parser.ts I viewed, adapted for Node.

function parseScriptStandAlone(text) {
    const segments = [];
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    // Regex from current implementation
    const regex = /<([^>]+)>([\s\S]*?)(?=$|<[^>]+>)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // ERROR HERE: This includes attributes
        const tagNameRaw = match[1].trim();
        const content = match[2].trim();

        // PROPOSED FIX:
        // const tagName = tagNameRaw.split(/\s+/)[0];

        // CURRENT BROKEN LOGIC:
        const tagName = tagNameRaw;

        console.log(`[Parser] Tag: '${tagName}'`);

        if (tagName === '배경') {
            segments.push({ type: 'background', content: content });
        } else if (tagName.toLowerCase() === 'stat') {
            // Logic to parse attributes
            segments.push({ type: 'command', commandType: 'update_stat', content: content });
        } else if (tagName === '나레이션') {
            segments.push({ type: 'narration', content: content });
        } else {
            // Fallback
            segments.push({ type: 'narration', content: `[${tagName}] ${content}` });
        }
    }
    return segments;
}

const input = `거무죽죽한 가죽 갑옷... <Stat morality='3'> 아, 진짜.`;
console.log("--- Testing Broken Parser ---");
const result = parseScriptStandAlone(input);
console.log(JSON.stringify(result, null, 2));

function parseScriptFixed(text) {
    const segments = [];
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    const regex = /<([^>]+)>([\s\S]*?)(?=$|<[^>]+>)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const tagNameRaw = match[1].trim();
        const content = match[2].trim();

        // FIX APPLIED:
        const tagName = tagNameRaw.split(/\s+/)[0];

        console.log(`[ParserFixed] Tag: '${tagName}' (Raw: '${tagNameRaw}')`);

        if (tagName === '배경') {
            segments.push({ type: 'background', content: content });
        } else if (tagName.toLowerCase() === 'stat') {
            segments.push({ type: 'command', commandType: 'update_stat', content: content });
        } else if (tagName === '나레이션') {
            segments.push({ type: 'narration', content: content });
        } else {
            segments.push({ type: 'narration', content: `[${tagName}] ${content}` });
        }
    }
    return segments;
}

console.log("\n--- Testing Fixed Parser ---");
const resultFixed = parseScriptFixed(input);
console.log(JSON.stringify(resultFixed, null, 2));
