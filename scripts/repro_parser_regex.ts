
import { parseScript } from '../src/lib/utils/script-parser';

// Mock the formatting helper as it's not exported or needs to be mocked
// Actually we can just import the module if we run it with ts-node and path mapping
// But for simplicity, we can paste the logic or minimal version since we are testing regex.
// Wait, parseScript IS exported. We should try to run it.

const streamChunks = [
    "<배경> 남만_객잔_마구간",
    "\n<BGM> CrisisDespair_0",
    "\n입안이 비릿하다.",
    "\n<대사> 야수왕_위압감: ",
    "\"크크크...\""
];

let accumulated = "";

console.log("--- Starting Stream Simulation ---");

for (const chunk of streamChunks) {
    accumulated += chunk;
    console.log(`\n[Input] accumulated length: ${accumulated.length}`);
    console.log(`[Input Content] "${accumulated.replace(/\n/g, '\\n')}"`);

    // We can't easily run the real parseScript because of imports (useGameStore).
    // So we will simulate the Regex Logic here directly to debug it.

    // START OF SIMULATION LOGIC (Copied from script-parser.ts lines 38-71)
    let text = accumulated;
    text = text.replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, '')
        .replace(/<Output>/gi, '').replace(/<\/Output>/gi, '');

    text = text.replace(/([^\n])<(BGM|CG|배경|Sound|Effect|시간)>/gi, '$1\n<$2>');

    const blockTags = [
        '배경', 'BGM', 'CG', '시스템팝업', '시스템', '나레이션',
        '선택지.*?', '대사', '문자', '답장', '전화', 'TV뉴스', '기사', '떠남', '시간'
    ].join('|');
    const tagPattern = `(?:(?:${blockTags})(?:\\s+[^>]*)?|[^>]*:[^>]*)`;
    const regex = new RegExp(`<(${tagPattern})>([\\s\\S]*?)(?=$|<(?:${tagPattern})>)`, 'gi');

    let segmentsMsg = [];

    const firstMatch = regex.exec(text);
    if (firstMatch) {
        if (firstMatch.index > 0) {
            const leadingText = text.substring(0, firstMatch.index).trim();
            if (leadingText) segmentsMsg.push(`[Leading Narration] "${leadingText}"`);
        }

        // Reset regex
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const tagName = match[1].trim().split(/\s+/)[0];
            const content = match[2].trim();
            segmentsMsg.push(`[${tagName}] "${content.substring(0, 20)}..."`);
        }
    } else {
        // No tags found yet, maybe just text?
        if (text.trim()) segmentsMsg.push(`[Raw Text] "${text.trim()}"`);
    }

    console.log("Segments Found:", segmentsMsg);
}
