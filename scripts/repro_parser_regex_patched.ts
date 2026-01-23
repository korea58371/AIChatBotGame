
// Mock Simulation with the FIXED logic
const streamChunks = [
    "<배경> 남만_객잔_마구간",
    "\n<BGM> CrisisDespair_0",
    "\n입안이 비릿하다.",
    "\n<대사> 야수왕_위압감: ",
    "\"크크크...\""
];

let accumulated = "";

console.log("--- Starting Stream Simulation (Patched Logic) ---");

// Helper to simulate parseInlineContent (simplified)
function parseInlineContent(text, opts) {
    return [{ type: opts.type, content: text }];
}

for (const chunk of streamChunks) {
    accumulated += chunk;
    console.log(`\n[Input] accumulated length: ${accumulated.length}`);

    let text = accumulated;
    text = text.replace(/([^\n])<(BGM|CG|배경|Sound|Effect|시간)>/gi, '$1\n<$2>');

    const blockTags = [
        '배경', 'BGM', 'CG', '시스템팝업', '시스템', '나레이션',
        '선택지.*?', '대사', '문자', '답장', '전화', 'TV뉴스', '기사', '떠남', '시간'
    ].join('|');
    const tagPattern = `(?:(?:${blockTags})(?:\\s+[^>]*)?|[^>]*:[^>]*)`;
    const regex = new RegExp(`<(${tagPattern})>([\\s\\S]*?)(?=$|<(?:${tagPattern})>)`, 'gi');

    let segmentsMsg = [];

    // Check leading
    const firstMatch = regex.exec(text);
    if (firstMatch && firstMatch.index > 0) {
        const leadingText = text.substring(0, firstMatch.index).trim();
        if (leadingText) segmentsMsg.push(`[Leading Narration] "${leadingText}"`);
    }

    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const tagName = match[1].trim().split(/\s+/)[0];
        const content = match[2].trim();

        // --- PATCHED LOGIC START ---
        if (['배경', 'BGM', 'CG'].includes(tagName) || tagName.toUpperCase() === 'BGM' || tagName.toUpperCase() === 'CG') {
            const lines = content.split('\n');
            segmentsMsg.push(`[${tagName}] "${lines[0].trim()}"`);

            if (lines.length > 1) {
                const remaining = lines.slice(1).join('\n').trim();
                if (remaining) {
                    segmentsMsg.push(`[Extracted Narration] "${remaining.substring(0, 20)}..."`);
                }
            }
        } else {
            segmentsMsg.push(`[${tagName}] "${content.substring(0, 20)}..."`);
        }
        // --- PATCHED LOGIC END ---
    }

    console.log("Segments Found:", segmentsMsg);
}
