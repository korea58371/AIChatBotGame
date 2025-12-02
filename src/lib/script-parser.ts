export type ScriptType = 'dialogue' | 'narration' | 'choice' | 'background' | 'unknown';

export interface ScriptSegment {
    type: ScriptType;
    content: string;
    character?: string;
    expression?: string;
    choiceId?: number;
}

export function parseScript(text: string): ScriptSegment[] {
    const segments: ScriptSegment[] = [];

    // Unescape HTML entities if present
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    // Regex to match tags like <TagName>Content or <TagName>Content...
    // We split by newlines first to handle line-based parsing safely, 
    // but since the AI might output multiple tags, we should look for the tag pattern.

    // Improved regex to capture tag and content
    // Matches <TagName>Content
    const regex = /<([^>]+)>([\s\S]*?)(?=$|<[^>]+>)/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        const tagName = match[1].trim();
        const content = match[2].trim();

        if (tagName === '배경') {
            segments.push({ type: 'background', content: content });
        } else if (tagName === '나레이션') {
            // Split long narration into chunks of max 2 sentences
            const sentences = content.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [content];
            let chunk = "";
            let count = 0;

            for (const sentence of sentences) {
                chunk += sentence;
                count++;
                if (count >= 2) {
                    segments.push({ type: 'narration', content: chunk.trim() });
                    chunk = "";
                    count = 0;
                }
            }
            if (chunk.trim()) {
                segments.push({ type: 'narration', content: chunk.trim() });
            }
        } else if (tagName.startsWith('선택지')) {
            const choiceId = parseInt(tagName.replace('선택지', ''));
            segments.push({ type: 'choice', content: content, choiceId: isNaN(choiceId) ? 0 : choiceId });
        } else if (tagName === '대사') {
            // Format: Name_Expression: Content
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                const dialogue = content.substring(colonIndex + 1).trim();

                const [name, expression] = meta.split('_');

                segments.push({
                    type: 'dialogue',
                    content: dialogue,
                    character: name,
                    expression: expression || '기본'
                });
            } else {
                // Fallback if format is wrong
                segments.push({ type: 'dialogue', content: content, character: 'Unknown', expression: '기본' });
            }
        } else {
            // Unknown tag, treat as narration or ignore? 
            // For now, treat as narration to be safe
            segments.push({ type: 'narration', content: `[${tagName}] ${content}` });
        }
    }

    // If no tags found, treat entire text as narration (fallback for legacy/error)
    if (segments.length === 0 && text.trim()) {
        segments.push({ type: 'narration', content: text.trim() });
    }

    return segments;
}
