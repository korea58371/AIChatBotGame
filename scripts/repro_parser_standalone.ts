
// Mock Store
const mockStore = {
    getState: () => ({
        availableBackgrounds: [],
        language: 'ko'
    })
};

type ScriptType = 'dialogue' | 'narration' | 'choice' | 'background' | 'bgm' | 'event_cg' | 'system_popup' | 'text_message' | 'text_reply' | 'phone_call' | 'tv_news' | 'article' | 'command' | 'unknown';

interface ScriptSegment {
    type: ScriptType;
    content: string;
    character?: string;
    expression?: string;
    choiceId?: number;
    characterLeave?: boolean;
    characterImageKey?: string;
    commandType?: string;
}

function formatForReadability(text: string): string {
    if (!text) return text;
    return text.replace(/(.{20,}?[.?!])\s+/g, "$1\n");
}

function parseScript(text: string): ScriptSegment[] {
    const segments: ScriptSegment[] = [];
    if (!text) text = "";
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\.\.\./g, '…');
    text = text.replace(/([^\n\r])<(BGM|CG|배경|Sound|Effect|시간|나레이션|대사|선택지|시스템|떠남)>/gi, '$1\n<$2>');

    const blockTags = [
        '배경', 'BGM', 'CG', '시스템팝업', '시스템', '나레이션',
        '선택지.*?', '대사', '문자', '답장', '전화', 'TV뉴스', '기사', '떠남', '시간'
    ].join('|');
    const tagPattern = `(?:\\s*(?:${blockTags})(?:\\s+[^>]*)?|[^>]*:[^>]*)`;
    const regex = new RegExp(`<(${tagPattern})>([\\s\\S]*?)(?=$|<(?:${tagPattern})>)`, 'gi');

    let match;
    const firstMatch = regex.exec(text);
    if (firstMatch && firstMatch.index > 0) {
        const leadingText = text.substring(0, firstMatch.index).trim();
        if (leadingText) {
            const segmentsFromInline = parseInlineContent(leadingText, { type: 'narration' });
            segments.push(...segmentsFromInline);
        }
    }
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
        const fullTagName = match[1].trim();
        const tagName = fullTagName.split(/\s+/)[0];
        const content = match[2].trim();

        if (tagName === '배경') {
            segments.push({ type: 'background', content });
        } else if (tagName === '나레이션') {
            const inlineSegments = parseInlineContent(content, { type: 'narration' });
            segments.push(...inlineSegments);
        } else if (tagName === '대사') {
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                const dialogue = content.substring(colonIndex + 1).trim();
                segments.push({ type: 'dialogue', character: meta, content: dialogue });
            } else {
                segments.push({ type: 'dialogue', character: 'Unknown', content });
            }
        } else {
            // Fallback for Colon-based tags
            const colonIndex = tagName.indexOf(':');
            if (colonIndex !== -1) {
                const meta = tagName.substring(0, colonIndex).trim();
                const dialogue = tagName.substring(colonIndex + 1).trim() + (content ? " " + content : "");
                segments.push({ type: 'dialogue', character: meta, content: dialogue });
            } else {
                segments.push({ type: 'narration', content: `[${fullTagName}] ${content}` });
            }
        }
    }

    if (segments.length === 0 && text.trim()) {
        const lines = text.split(/\n+/);
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                const inlineSegments = parseInlineContent(trimmedLine, { type: 'narration' });
                segments.push(...inlineSegments);
            }
        }
    }
    return segments;
}

function parseInlineContent(text: string, context: Partial<ScriptSegment>): ScriptSegment[] {
    const segments: ScriptSegment[] = [];
    const inlineTagPattern = /<(Stat|State|Rel|Relationship|Tension|Time|시간|Command|NewInjury|Injury|Quest|Goal|NewGoal|GoalUpdate|Memory|Mem)(?:\s+[^>]*)?>/gi;
    let lastIndex = 0;
    let match;
    const regex = new RegExp(inlineTagPattern);

    while ((match = regex.exec(text)) !== null) {
        const precedingText = text.substring(lastIndex, match.index);
        if (precedingText.trim()) pushTextSegments(segments, precedingText, context);
        lastIndex = regex.lastIndex;
    }
    const remainingText = text.substring(lastIndex);
    if (remainingText.trim()) pushTextSegments(segments, remainingText, context);
    return segments;
}

function pushTextSegments(segments: ScriptSegment[], text: string, context: Partial<ScriptSegment>) {
    segments.push({
        ...context,
        type: context.type as ScriptType || 'narration',
        content: text.trim().replace(/^"([\s\S]*)"$/, '$1')
    });
}


// --- TEST CASES ---
const inputNarration = `어두운 골목길을 걸어가고 있었다.`;
console.log("Input:", inputNarration);
console.log("Parsed:", parseScript(inputNarration));

const inputWeird = `Character: Hello`;
console.log("Input:", inputWeird);
console.log("Parsed:", parseScript(inputWeird));

const inputTag = `<대사> Name: text`;
console.log("Input:", inputTag);
console.log("Parsed:", parseScript(inputTag));
