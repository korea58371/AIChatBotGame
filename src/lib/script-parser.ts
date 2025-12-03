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
            // Split long narration into individual sentences for better readability
            const sentences = content.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [content];

            for (const sentence of sentences) {
                if (sentence.trim()) {
                    segments.push({ type: 'narration', content: sentence.trim() });
                }
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

                // Heuristic: Check if content has narration attached after the dialogue
                // Look for: "Dialogue" followed by newlines and then text
                const splitMatch = dialogue.match(/^"([^"]+)"\s*\n+([\s\S]+)$/);

                let dialogueContent = dialogue;
                let narrationContent = null;

                if (splitMatch) {
                    dialogueContent = `"${splitMatch[1]}"`;
                    narrationContent = splitMatch[2].trim();
                }

                // Split dialogue into chunks of max 3 sentences
                const sentences = dialogueContent.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [dialogueContent];
                let chunk = "";
                let count = 0;

                for (const sentence of sentences) {
                    chunk += sentence;
                    count++;
                    if (count >= 3) {
                        segments.push({
                            type: 'dialogue',
                            content: chunk.trim(),
                            character: name,
                            expression: expression || '기본'
                        });
                        chunk = "";
                        count = 0;
                    }
                }
                if (chunk.trim()) {
                    segments.push({
                        type: 'dialogue',
                        content: chunk.trim(),
                        character: name,
                        expression: expression || '기본'
                    });
                }

                if (narrationContent) {
                    segments.push({
                        type: 'narration',
                        content: narrationContent
                    });
                }
            } else {
                // Fallback if format is wrong
                segments.push({ type: 'dialogue', content: content, character: 'Unknown', expression: '기본' });
            }
        } else {
            // Check if the tag itself looks like "Name_Expression: Content" (AI Error Fallback)
            // Example: <주인공_기본: 냄새, 좋아.> -> tagName="주인공_기본: 냄새, 좋아."
            // We need to parse the tagName itself if it contains a colon
            const colonIndex = tagName.indexOf(':');
            if (colonIndex !== -1) {
                const meta = tagName.substring(0, colonIndex).trim();
                const dialogue = tagName.substring(colonIndex + 1).trim() + (content ? " " + content : ""); // Content might be empty if everything is in the tag

                const [name, expression] = meta.split('_');
                segments.push({
                    type: 'dialogue',
                    content: dialogue,
                    character: name,
                    expression: expression || '기본'
                });
            } else {
                // Unknown tag, treat as narration
                segments.push({ type: 'narration', content: `[${tagName}] ${content}` });
            }
        }
    }

    // If no tags found, treat entire text as narration (fallback for legacy/error)
    if (segments.length === 0 && text.trim()) {
        segments.push({ type: 'narration', content: text.trim() });
    }

    return segments;
}
