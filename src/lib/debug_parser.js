
function parseScript(text) {
    const segments = [];
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    console.log("Input Text:", JSON.stringify(text));

    const regex = /<([^>]+)>([\s\S]*?)(?=$|<[^>]+>)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const tagName = match[1].trim();
        const content = match[2].trim();
        console.log(`Found Tag: [${tagName}] Content: [${content.substring(0, 20)}...]`);

        if (tagName === '배경') {
            segments.push({ type: 'background', content: content });
        } else if (tagName.toUpperCase() === 'BGM') {
            segments.push({ type: 'bgm', content: content });
        } else if (tagName === '나레이션') {
            segments.push({ type: 'narration', content: content });
        } else {
            if (tagName.startsWith('/')) continue;
            segments.push({ type: 'narration', content: `[${tagName}] ${content}` });
        }
    }

    if (segments.length === 0 && text.trim()) {
        segments.push({ type: 'narration', content: text.trim() });
    }

    return segments;
}

const input = `<BGM> 활기찬 객잔
<배경>객잔_객실

<나레이션>
"으음... 머리가 깨질 것 같군."`;

const result = parseScript(input);
console.log("Result:", JSON.stringify(result, null, 2));
