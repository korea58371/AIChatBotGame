
const { parseScript } = require('./script-parser'); // Mock import not needed, I'll copy logic again or run standalone

function parseScriptStandAlone(text) {
    const segments = [];
    // Simulating the fix I already made for tag splitting
    const regex = /<([^>]+)>([\s\S]*?)(?=$|<[^>]+>)/g;
    let match;
    const textSafe = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    while ((match = regex.exec(textSafe)) !== null) {
        const fullTagName = match[1].trim();
        const tagName = fullTagName.split(/\s+/)[0];
        const content = match[2].trim();
        const fullTag = match[0];

        if (tagName.toLowerCase() === 'stat') {
            const attributes = {};
            // BROKEN REGEX
            const attrRegex = /(\w+)="([^"]*)"/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(fullTag)) !== null) {
                attributes[attrMatch[1]] = parseFloat(attrMatch[2]);
            }
            segments.push({ type: 'command', commandType: 'update_stat', content: JSON.stringify(attributes) });
        }
    }
    return segments;
}

const input = `<Stat morality='3'> <Stat hp="-5">`;
console.log("--- Testing Single Quote Parsing ---");
const result = parseScriptStandAlone(input);
console.log(JSON.stringify(result, null, 2));
// Expected: First stat empty due to regex mismatch, Second stat works.
