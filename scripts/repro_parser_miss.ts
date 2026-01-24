
// Mock Store for testing
const useGameStore = {
    getState: () => ({
        availableBackgrounds: [] as string[]
    })
};

// --- Inlined Parser Code (from script-parser.ts) ---

export type ScriptType = 'dialogue' | 'narration' | 'choice' | 'background' | 'bgm' | 'event_cg' | 'system_popup' | 'text_message' | 'text_reply' | 'phone_call' | 'tv_news' | 'article' | 'command' | 'unknown';

export interface ScriptSegment {
    type: ScriptType;
    content: string;
    character?: string;
    expression?: string;
    choiceId?: number;
    characterLeave?: boolean;
    characterImageKey?: string;
    commandType?: string; // [New] For generic commands like 'set_time'
}

function formatForReadability(text: string): string {
    if (!text) return text;
    return text.replace(/(.{20,}?[.?!])\s+/g, "$1\n");
}

export function parseScript(text: string): ScriptSegment[] {
    const segments: ScriptSegment[] = [];

    if (!text) text = "";
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    text = text.replace(/\.\.\./g, '…');

    // Original line being tested
    text = text.replace(/([^\n])<(BGM|CG|배경|Sound|Effect|시간)>/gi, '$1\n<$2>');

    const blockTags = [
        '배경', 'BGM', 'CG', '시스템팝업', '시스템', '나레이션',
        '선택지.*?', '대사', '문자', '답장', '전화', 'TV뉴스', '기사', '떠남', '시간'
    ].join('|');

    // Pattern: < ( (Keyword)(Spaces...)? | (Any:Any) ) >
    const tagPattern = `(?:\\s*(?:${blockTags})(?:\\s+[^>]*)?|[^>]*:[^>]*)`;
    // Regex: <(TagPattern)> (Content) (?= End | <(TagPattern)>)
    const regex = new RegExp(`<(${tagPattern})>([\\s\\S]*?)(?=$|<(?:${tagPattern})>)`, 'gi');

    let match;
    let lastIndex = 0;

    const firstMatch = regex.exec(text);
    if (firstMatch && firstMatch.index > 0) {
        const leadingText = text.substring(0, firstMatch.index).trim();
        if (leadingText) {
            segments.push({ type: 'narration', content: leadingText } as ScriptSegment);
        }
    }

    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
        const fullTagName = match[1].trim();
        const tagName = fullTagName.split(/\s+/)[0];
        const content = match[2].trim();

        // Simplified mapping for reproduction
        if (tagName === '시간') {
            // [Fix] Handle Implicit Narration (Missing <나레이션> tag)
            if (content.includes('\n')) {
                const parts = content.split(/\n([\s\S]+)/); // Split upon first newline
                if (parts.length >= 2) {
                    const timeCmd = parts[0].trim();
                    const implicitNarration = parts[1].trim();

                    segments.push({ type: 'command', commandType: 'set_time', content: timeCmd });
                    if (implicitNarration) {
                        segments.push({ type: 'narration', content: implicitNarration });
                    }
                    continue;
                }
            }
            segments.push({ type: 'command', commandType: 'set_time', content });
        }
        else if (tagName === '나레이션') segments.push({ type: 'narration', content });
        else segments.push({ type: 'other', content: tagName } as any);
    }
    return segments;
}
// --- End Inlined Code ---

// --- New Test Case: Implicit Narration (Missing Tag) ---
const implicitNarrationText = `<시간> 1일차 07:00(아침)

코끝을 찌르는 시큼하고도 달큰한 향기. 그것이 내가 이 낯선 세...`;

console.log("\n--- Testing Edge Case: Implicit Narration ---");
const resImplicit = parseScript(implicitNarrationText);
console.log("C_Implicit:", resImplicit.map(s => `${s.type}(${JSON.stringify(s.content)})`));

// Check if we got 1 or 2 segments
if (resImplicit.length === 1 && resImplicit[0].type === 'command') {
    console.log("RESULT: Swallowing CONFIRMED. (1 segment found)");
} else if (resImplicit.length === 2) {
    console.log("RESULT: Correctly parsed as 2 segments.");
} else {
    console.log("RESULT: Unexpected parsing result.");
}
