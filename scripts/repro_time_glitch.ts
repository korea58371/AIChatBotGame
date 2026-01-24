
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

        console.log(`[Parser] Found Tag: "[${tagName}]", Full: "${fullTagName}", Content: "${content.replace(/\n/g, '\\n')}"`);

        if (tagName === '배경') {
            segments.push({ type: 'background', content });
        } else if (tagName === '나레이션') {
            const inlineSegments = parseInlineContent(content, { type: 'narration' });
            segments.push(...inlineSegments);
        } else if (tagName === '시간') {
            if (content.includes('\n')) {
                const parts = content.split(/\n([\s\S]+)/);
                if (parts.length >= 2) {
                    const timeCmd = parts[0].trim();
                    const implicitNarration = parts[1].trim();

                    segments.push({
                        type: 'command',
                        commandType: 'set_time',
                        content: timeCmd
                    });

                    if (implicitNarration) {
                        const lines = implicitNarration.split('\n');
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (trimmed) {
                                const inlineSegments = parseInlineContent(trimmed, { type: 'narration' });
                                segments.push(...inlineSegments);
                            }
                        }
                    }
                    continue;
                }
            }
            segments.push({ type: 'command', commandType: 'set_time', content });
        } else if (tagName === '대사') {
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                const dialogue = content.substring(colonIndex + 1).trim();
                segments.push({ type: 'dialogue', character: meta, content: dialogue });
            } else {
                segments.push({ type: 'dialogue', character: 'Unknown', content });
            }
        }
    }
    return segments;
}

function parseInlineContent(text: string, context: Partial<ScriptSegment>): ScriptSegment[] {
    const segments: ScriptSegment[] = [];
    pushTextSegments(segments, text, context);
    return segments;
}

function pushTextSegments(segments: ScriptSegment[], text: string, context: Partial<ScriptSegment>) {
    segments.push({
        ...context,
        type: context.type as ScriptType || 'narration',
        content: text.trim()
    });
}


// --- TEST CASE ---
const inputTimeBug = `<시간> 1일차 13:00 (낮)


"으윽…"

입안에 흙먼지...`;

console.log("Input:", inputTimeBug);
console.log("Parsed:", JSON.stringify(parseScript(inputTimeBug), null, 2));
