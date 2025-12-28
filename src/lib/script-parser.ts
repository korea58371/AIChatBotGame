import { useGameStore } from './store';
export type ScriptType = 'dialogue' | 'narration' | 'choice' | 'background' | 'system_popup' | 'text_message' | 'text_reply' | 'phone_call' | 'tv_news' | 'article' | 'command' | 'unknown';

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

// [Helper] Auto-format text for readability (User Request)
// Breaks lines if a sentence exceeds 20 characters and ends with punctuation.
function formatForReadability(text: string): string {
    if (!text) return text;
    // Regex: Find a chunk of at least 20 chars that ends in . ? ! followed by whitespace
    // Replace the whitespace with a newline
    return text.replace(/(.{20,}?[.?!])\s+/g, "$1\n");
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
            let bgKey = content;
            try {
                // [Feature] Fuzzy matching for Backgrounds
                // User might input "대장간" instead of "[마을] 대장간"
                const state = useGameStore.getState();
                const available = state.availableBackgrounds || [];

                // 1. Check exact match first
                if (!available.includes(bgKey)) {
                    // 2. Check suffix match (e.g. "대장간" matches "[마을] 대장간")
                    const match = available.find(k => k.endsWith(bgKey) || k.endsWith(` ${bgKey}`));
                    if (match) {
                        console.log(`[ScriptParser] Fuzzy matched background: '${bgKey}' -> '${match}'`);
                        bgKey = match;
                    }
                }
            } catch (e) {
                console.warn("[ScriptParser] Failed to access store for fuzzy matching", e);
            }
            segments.push({ type: 'background', content: bgKey });
        } else if (tagName === '시간') {
            // [New] Time Update Command
            // format: <시간> 14:40 낮
            segments.push({
                type: 'command',
                commandType: 'set_time',
                content: content
            });
        } else if (tagName === '시스템팝업' || tagName === '시스템') {
            segments.push({ type: 'system_popup', content: content });
        } else if (tagName === '나레이션') {
            // Clean Markdown (Bold)
            const cleanedContent = content.replace(/\*\*/g, '');

            // Split by newlines first to preserve list structures
            const lines = cleanedContent.split('\n');

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                // Simple Line-Based Parsing (User Request: Don't split sentences if structure is good)
                // [Update] Apply Auto-Formatting for readability
                const formatted = formatForReadability(trimmedLine);

                // [User Request] Split into multiple segments instead of just line breaks
                const parts = formatted.split('\n');
                for (const part of parts) {
                    if (part.trim()) {
                        segments.push({ type: 'narration', content: part.trim() });
                    }
                }
            }
        } else if (tagName.startsWith('선택지')) {
            const choiceId = parseInt(tagName.replace('선택지', ''));
            segments.push({
                type: 'choice',
                content: content.replace(/\([^)]*\)/g, '').trim(),
                choiceId: isNaN(choiceId) ? 0 : choiceId
            });
        } else if (tagName === '대사') {
            // Format: Name_Expression: Content
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                const dialogue = content.substring(colonIndex + 1).trim();

                let name = '';
                let expression = '';
                let imageKey: string | undefined = undefined;

                // [Update] Robust Parsing for Name(ImageKey)_Expression
                // Handle cases where ImageKey contains underscores: "엽문(낭인무사_술좋아하는)_기쁨"

                // 1. Check for explicit ImageKey pattern: Name(Key) or Name[Key]
                // Prioritize Square Brackets [] for robust handling if AI uses them
                const bracketMatch = meta.match(/^(.+?)\[(.+)\](.*)$/);
                const parenMatch = meta.match(/^(.+?)\((.+)\)(.*)$/); // Non-greedy match for Name

                if (bracketMatch) {
                    name = bracketMatch[1].trim();
                    imageKey = bracketMatch[2].trim();
                    const remainder = bracketMatch[3].trim();
                    expression = remainder.startsWith('_') ? remainder.substring(1) : (remainder || '기본');
                } else if (parenMatch) {
                    name = parenMatch[1].trim();
                    imageKey = parenMatch[2].trim();
                    const remainder = parenMatch[3].trim();
                    expression = remainder.startsWith('_') ? remainder.substring(1) : (remainder || '기본');
                } else {
                    // 2. Standard Fallback: Name_Expression (Greedy Name)
                    // For "God Bless You", names often contain underscores (e.g., 전사_남성).
                    // We assume the LAST part is the expression, and everything before is the Name.
                    const parts = meta.split('_');

                    if (parts.length >= 2) {
                        expression = parts.pop() || '기본';
                        name = parts.join('_');
                    } else {
                        name = parts[0];
                        expression = '기본';
                    }
                    // imageKey remains undefined, allowing VisualNovelUI to fallback to Name lookup
                }

                // Heuristic: Check if content has narration attached after the dialogue
                const splitMatch = dialogue.match(/^"([^"]+)"\s*\n+([\s\S]+)$/);

                let dialogueContent = dialogue;
                let narrationContent = null;

                if (splitMatch) {
                    dialogueContent = `"${splitMatch[1]}"`;
                    narrationContent = splitMatch[2].trim();
                }

                // [Update] Apply Auto-Formatting
                dialogueContent = formatForReadability(dialogueContent);
                if (narrationContent) narrationContent = formatForReadability(narrationContent);

                // Split dialogue content by separate lines for sequential display
                const speechLines = dialogueContent.split('\n');
                for (const line of speechLines) {
                    if (line.trim()) {
                        segments.push({
                            type: 'dialogue',
                            content: line.trim().replace(/^"(.*)"$/, '$1').replace(/^“(.*)”$/, '$1'), // [Fix] Strip quotes
                            character: name,
                            characterImageKey: imageKey, // Pass if parsed
                            expression: expression || '기본'
                        });
                    }
                }

                if (narrationContent) {
                    // Also split narration content by line
                    const nLines = narrationContent.split('\n');
                    for (const nl of nLines) {
                        if (nl.trim()) segments.push({ type: 'narration', content: nl.trim() });
                    }
                }
            } else {
                segments.push({ type: 'dialogue', content: formatForReadability(content), character: 'Unknown', expression: '기본' });
            }
        } else if (tagName === '문자') {
            // <문자>Sender_Header: Content
            const colonIndex = content.indexOf(':');
            let sender = 'Unknown';
            let header = '지금';
            let msgContent = content;

            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                msgContent = content.substring(colonIndex + 1).trim();
                const [s, h] = meta.split('_');
                sender = s;
                if (h) header = h;
            }

            segments.push({
                type: 'text_message',
                character: sender,
                expression: header,
                content: msgContent
            });
        } else if (tagName === '답장') {
            // <답장>Receiver_Header: Content
            // Means: Player sends message TO Receiver
            const colonIndex = content.indexOf(':');
            let receiver = 'Unknown';
            let header = '지금';
            let msgContent = content;

            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                msgContent = content.substring(colonIndex + 1).trim();
                const [r, h] = meta.split('_');
                receiver = r;
                if (h) header = h;
            }

            segments.push({
                type: 'text_reply', // New Type
                character: receiver, // Store Receiver here
                expression: header,
                content: msgContent
            });
        } else if (tagName === '전화') {
            // <전화>Caller_Status: Content
            const colonIndex = content.indexOf(':');
            let caller = 'Unknown';
            let status = '통화중';
            let msgContent = content;

            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                msgContent = content.substring(colonIndex + 1).trim();
                const [c, s] = meta.split('_');
                caller = c;
                if (s) status = s;
            }

            segments.push({
                type: 'phone_call',
                character: caller,
                expression: status,
                content: msgContent
            });
        } else if (tagName === 'TV뉴스') {
            // <TV뉴스>Character_Background: Content
            // Example: <TV뉴스>천서윤_DungeonEntrance: 보도 내용
            const colonIndex = content.indexOf(':');
            let anchor = 'News';
            let background = ''; // Store background key in expression
            let msgContent = content;

            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                msgContent = content.substring(colonIndex + 1).trim();

                const parts = meta.split('_');

                if (parts.length >= 2) {
                    // Last part is always Background (e.g. "NewsStudio")
                    background = parts.pop() || '';
                    // Join user parts back together for the character name (e.g. "뉴스앵커_여" or "천서윤")
                    anchor = parts.join('_');
                } else {
                    anchor = parts[0];
                }
            }

            segments.push({
                type: 'tv_news',
                character: anchor,
                expression: background, // We use 'expression' field to store the extra metadata (background)
                content: msgContent
            });
        } else if (tagName === '기사') {
            // <기사>Title_Source: Content
            const colonIndex = content.indexOf(':');
            let title = 'News';
            let source = 'Internet';
            let body = content;

            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                body = content.substring(colonIndex + 1).trim();
                const [t, s] = meta.split('_');
                title = t;
                if (s) source = s;
            }

            segments.push({
                type: 'article',
                character: title,   // Store Title in character field
                expression: source, // Store Source in expression field
                content: body
            });
        } else if (tagName === '떠남') {
            // Special Tag: Character Exit
            // If the previous segment exists, mark it as exit
            if (segments.length > 0) {
                segments[segments.length - 1].characterLeave = true;
            }
        } else if (tagName.toLowerCase() === 'think' || tagName.toLowerCase() === '/think') {
            // [Feature] Chain of Thought Hiding
            // The system prompt generates <Think>...</Think> blocks for internal reasoning.
            // We consciously ignore this content so it doesn't appear in the game UI.
            continue;
        } else {
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
                // [Fix] Ignore closing tags (starting with /) to prevent "INVALID TAG" display
                if (tagName.startsWith('/')) {
                    continue;
                }
                segments.push({ type: 'narration', content: `[${tagName}] ${content}` });
            }
        }
    }

    // Post-processing to handle <떠남> tag in content
    for (const segment of segments) {
        if (segment.content.includes('<떠남>')) {
            segment.characterLeave = true;
            segment.content = segment.content.replace(/<떠남>/g, '').trim();
        }
    }

    // If no tags found, treat entire text as narration (fallback for legacy/error)
    if (segments.length === 0 && text.trim()) {
        segments.push({ type: 'narration', content: text.trim() });
    }

    return segments;
}

// Helper to split text into sentences with sophisticated rules
function splitSentences(text: string): string[] {
    const results: string[] = [];
    let buffer = "";
    let depth = 0; // Track parentheses/bracket depth

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        buffer += char;

        if (char === '(' || char === '[') depth++;
        else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);

        // Check for split chars
        if ((char === '.' || char === '!' || char === '?') && depth === 0) {
            // 1. Lookahead for quotes/brackets that belong to this sentence
            // e.g. "Run!" or (End). -> split after the closing mark
            let j = i + 1;
            while (j < text.length && ["'", '"', "”", "’", "]", ")"].includes(text[j])) {
                buffer += text[j];
                j++;
                i++; // Advance main loop index as we consumed these chars
            }

            // 2. Check overlap logic (Next Char)
            // If next char is NOT space and NOT EOF, it's likely not a split (e.g. 1.5, 3.14, www.google.com)
            // But if it is End of String, we validly split (and push).
            if (j < text.length && text[j] !== ' ' && text[j] !== '\n') {
                continue;
            }

            // 3. Short Sentence / Merging Rule
            // "주머니가 묵직하다. (기분 탓이다...)" -> "주머니가 묵직하다." is 10 chars.
            // User wants: "Too short front sentence -> Don't line break".
            // Heuristic: If buffer is very short (< 15 chars?), DO NOT commit it yet.
            // But we need to keep the punctuation.
            // Wait, if we 'continue' here, we just keep accumulating.
            // "Short. Next." -> becomes one chunk "Short. Next."
            // Exception: If this is the VERY END of the text, we must push it.
            if (buffer.trim().length < 15 && j < text.length) {
                continue;
            }

            // 4. Push and reset
            results.push(buffer.trim());
            buffer = "";
        }
    }

    if (buffer.trim()) {
        results.push(buffer.trim());
    }

    return results;
}
