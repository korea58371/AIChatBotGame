import { useGameStore } from '@/lib/store';
// 1. Add 'event_cg' to ScriptType
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

    // Safety Check
    if (!text) text = "";

    // Unescape HTML entities if present
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // [Fix] Normalize ellipses to prevent unwanted sentence splitting
    text = text.replace(/\.\.\./g, '…');

    // [Fix] Enforce Newline before ALL block tags to prevent swallowing/attachment issues
    // If AI writes "Text.<Tag> Title", we convert it to "Text.\n<Tag> Title"
    // Also explicitly handle \r for Windows consistency
    text = text.replace(/([^\n\r])<(BGM|CG|배경|Sound|Effect|시간|나레이션|대사|선택지|시스템|떠남)>/gi, '$1\n<$2>');

    // Regex to match tags like <TagName>Content or <TagName>Content...
    // We split by newlines first to handle line-based parsing safely, 
    // but since the AI might output multiple tags, we should look for the tag pattern.

    // [Refactor] Differentiate Block Tags vs Inline Tags
    // Block Tags: Start a new segment type (e.g. Dialogue, Choice, BGM)
    const blockTags = [
        '배경', 'BGM', 'CG', '시스템팝업', '시스템', '나레이션',
        '선택지.*?', '대사', '문자', '답장', '전화', 'TV뉴스', '기사', '떠남', '시간'
    ].join('|');

    // Pattern: < ( (Keyword)(Spaces...)? | (Any:Any) ) >
    // We use a strict pattern for the tag name to ensure we don't pick up random <Text>.
    // [Fix] Robustness: Allow leading whitespace in tag name (e.g. < 나레이션>)
    const tagPattern = `(?:\\s*(?:${blockTags})(?:\\s+[^>]*)?|[^>]*:[^>]*)`;

    // Regex: <(TagPattern)> (Content) (?= End | <(TagPattern)>)
    const regex = new RegExp(`<(${tagPattern})>([\\s\\S]*?)(?=$|<(?:${tagPattern})>)`, 'gi');

    let match;
    let lastIndex = 0;

    // [Fix] Capture leading text (before the first tag)
    // If the logical text starts without a tag (e.g. just narration), we must capture it.
    // We do this by checking if the first match starts after index 0.
    const firstMatch = regex.exec(text);
    if (firstMatch && firstMatch.index > 0) {
        const leadingText = text.substring(0, firstMatch.index).trim();
        if (leadingText) {
            const segmentsFromInline = parseInlineContent(leadingText, { type: 'narration' });
            segments.push(...segmentsFromInline);
        }
    }

    // Reset regex for the loop
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
        const fullTagName = match[1].trim();
        // Remove attributes/extra text to get just the tag name
        const tagName = fullTagName.split(/\s+/)[0];
        const content = match[2].trim();

        // [Debug] Log parsed tags


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
                    const foundBg = available.find(k => k.endsWith(bgKey) || k.endsWith(` ${bgKey}`));
                    if (foundBg) {

                        bgKey = foundBg;
                    }
                }
            } catch (e) {
                console.warn("[ScriptParser] Failed to access store for fuzzy matching", e);
            }
            // [Fix] Background tag should be single-line. If content has newlines, the rest is narration.
            const lines = content.split('\n');
            bgKey = lines[0].trim();
            try {
                // [Feature] Fuzzy matching for Backgrounds
                // User might input "대장간" instead of "[마을] 대장간"
                const state = useGameStore.getState();
                const available = state.availableBackgrounds || [];

                // 1. Check exact match first
                if (!available.includes(bgKey)) {
                    // 2. Check suffix match (e.g. "대장간" matches "[마을] 대장간")
                    const foundBg = available.find(k => k.endsWith(bgKey) || k.endsWith(` ${bgKey}`));
                    if (foundBg) {

                        bgKey = foundBg;
                    }
                }
            } catch (e) {
                console.warn("[ScriptParser] Failed to access store for fuzzy matching", e);
            }
            segments.push({ type: 'background', content: bgKey });

            // Push remaining lines as separate segments (recursively parsed to handle embedded tags like <Name>)
            if (lines.length > 1) {
                const remaining = lines.slice(1).join('\n').trim();
                if (remaining) {
                    segments.push(...parseScript(remaining)); // [Fix] Use Recursion
                }
            }

        } else if (tagName.toUpperCase() === 'BGM') {
            // [New] BGM Tag
            // [New] BGM Tag
            // [Fix] Enforce single line
            const lines = content.split('\n');
            segments.push({ type: 'bgm', content: lines[0].trim() });

            if (lines.length > 1) {
                const remaining = lines.slice(1).join('\n').trim();
                if (remaining) {
                    segments.push(...parseScript(remaining)); // [Fix] Recursion
                }
            }

        } else if (tagName.toUpperCase() === 'CG') {
            // [New] Event CG Tag
            // [Fix] Remove closing tag if present in content (e.g. from regex capture)
            // The regex in parseScript captures ([\\s\\S]*?) which usually stops BEFORE the lookahead,
            // but if there's a malformed string or the regex state is weird, it might capture garbage.
            // However, the USER log shows "비연_전투</CG>". 
            // This means our regex <(TagPattern)>([\\s\\S]*?)(?=$|<(?:${tagPattern})>) 
            // MIGHT be failing to stop at </CG> if 'TagPattern' doesn't match /CG/ (Wait, TagPattern matches START tags).
            // A closing tag </CG> is NOT a Start Tag.

            // Fix: Explicitly remove </CG> or similar closing tags from the content
            // Fix: Explicitly remove </CG> or similar closing tags from the content
            const cleanContent = content.replace(/<\/[^>]+>/g, '').trim();

            // [Fix] Enforce single line for CG
            const lines = cleanContent.split('\n');
            segments.push({ type: 'event_cg', content: lines[0].trim() });

            if (lines.length > 1) {
                const remaining = lines.slice(1).join('\n').trim();
                if (remaining) {
                    segments.push(...parseScript(remaining)); // [Fix] Recursion
                }
            }

        } else if (tagName === '시간') {
            // [New] Time Update Command
            // format: <시간> 14:40 낮

            // [Fix] Handle Implicit Narration (Missing <나레이션> tag)
            // If the content has newlines, split it. First line is time, rest is narration.
            if (content.includes('\n')) {
                const parts = content.split(/\n([\s\S]+)/); // Split on first newline group (polyfilled dotAll)
                if (parts.length >= 2) {
                    const timeCmd = parts[0].trim();
                    const implicitNarration = parts[1].trim();

                    // Push Time Command first
                    segments.push({
                        type: 'command',
                        commandType: 'set_time',
                        content: timeCmd
                    });

                    // Push Implicit Narration next
                    if (implicitNarration) {

                        // [Fix] Match standard narration behavior: Split by newlines
                        const lines = implicitNarration.split('\n');
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (trimmed) {
                                const inlineSegments = parseInlineContent(trimmed, { type: 'narration' });
                                segments.push(...inlineSegments);
                            }
                        }
                    }
                    continue; // Skip the default push
                }
            }

            segments.push({
                type: 'command',
                commandType: 'set_time',
                content: content
            });

        } else if (tagName === '시스템팝업' || tagName === '시스템') {
            // [Refactor] Use parseInlineContent to handle inline tags like <Stat>
            const inlineSegments = parseInlineContent(content, { type: 'system_popup' });
            segments.push(...inlineSegments);

        } else if (tagName === '나레이션') {
            // Clean Markdown (Bold)
            const cleanedContent = content.replace(/\*\*/g, '');

            // Split by newlines first to preserve list structures
            const lines = cleanedContent.split('\n');

            let hasContent = false;
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                hasContent = true;
                // Parse inline tags within narration
                const inlineSegments = parseInlineContent(trimmedLine, { type: 'narration' });
                segments.push(...inlineSegments);
            }

            // [Fix] Removed Streaming Placeholder '...'
            // We do NOT want to push a placeholder segment if content is not yet available.
            // Pushing '...' causes the UI to render it, finish typewriting instantly, and Auto-Advance index.
            // This causes the *real* content (when it arrives) to be skipped because the index has moved to the next segment.
            // if (!hasContent) {
            //    segments.push({ type: 'narration', content: '...' });
            // }

        } else if (tagName.startsWith('선택지')) {
            const choiceId = parseInt(tagName.replace('선택지', ''));
            segments.push({
                type: 'choice',
                content: content.trim(),
                choiceId: isNaN(choiceId) ? 0 : choiceId
            });

        } else if (tagName === '대사') {
            // Format: Name_Expression: Content
            const colonIndex = content.indexOf(':');
            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                // [Fix] Explicitly strip quotes from the raw dialogue string immediately
                let dialogue = content.substring(colonIndex + 1).trim();
                if (dialogue.startsWith('"') && dialogue.endsWith('"')) {
                    dialogue = dialogue.substring(1, dialogue.length - 1);
                } else if (dialogue.startsWith('“') && dialogue.endsWith('”')) {
                    dialogue = dialogue.substring(1, dialogue.length - 1);
                }

                let name = '';
                let expression = '';
                let imageKey: string | undefined = undefined;

                // [Update] Robust Parsing for Name(ImageKey)_Expression
                // Handle cases where ImageKey contains underscores: "엽문(낭인무사_술좋아하는)_기쁨"
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
                    // Standard Fallback: Name_Expression (Greedy Name)
                    const parts = meta.split('_');
                    if (parts.length >= 2) {
                        expression = parts.pop() || '기본';
                        name = parts.join('_');
                    } else {
                        name = parts[0];
                        expression = '기본';
                    }
                }

                // Heuristic: Check if content has narration attached after the dialogue
                const splitMatch = dialogue.match(/^"([^"]+)"\s*\n+([\s\S]+)$/);

                let dialogueContent = dialogue;
                let narrationContent = null;

                if (splitMatch) {
                    dialogueContent = splitMatch[1]; // [Fix] Do not re-add quotes
                    narrationContent = splitMatch[2].trim();
                }

                // Process Dialogue Content with Inline Parsing support
                const inlineSegments = parseInlineContent(dialogueContent, {
                    type: 'dialogue',
                    character: name,
                    characterImageKey: imageKey,
                    expression: expression || '기본'
                });
                segments.push(...inlineSegments);

                if (narrationContent) {
                    const nSegments = parseInlineContent(narrationContent, { type: 'narration' });
                    segments.push(...nSegments);
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

            const inlineSegments = parseInlineContent(msgContent, {
                type: 'text_message',
                character: sender,
                expression: header
            });
            segments.push(...inlineSegments);

        } else if (tagName === '답장') {
            // <답장>Receiver_Header: Content
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

            const inlineSegments = parseInlineContent(msgContent, {
                type: 'text_reply',
                character: receiver,
                expression: header
            });
            segments.push(...inlineSegments);

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

            const inlineSegments = parseInlineContent(msgContent, {
                type: 'phone_call',
                character: caller,
                expression: status
            });
            segments.push(...inlineSegments);

        } else if (tagName === 'TV뉴스') {
            // <TV뉴스>Character_Background: Content
            const colonIndex = content.indexOf(':');
            let anchor = 'News';
            let background = '';
            let msgContent = content;

            if (colonIndex !== -1) {
                const meta = content.substring(0, colonIndex).trim();
                msgContent = content.substring(colonIndex + 1).trim();

                const parts = meta.split('_');
                if (parts.length >= 2) {
                    background = parts.pop() || '';
                    anchor = parts.join('_');
                } else {
                    anchor = parts[0];
                }
            }

            const inlineSegments = parseInlineContent(msgContent, {
                type: 'tv_news',
                character: anchor,
                expression: background
            });
            segments.push(...inlineSegments);

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

            const inlineSegments = parseInlineContent(body, {
                type: 'article',
                character: title,
                expression: source
            });
            segments.push(...inlineSegments);

        } else if (tagName === '떠남') {
            // Special Tag: Character Exit
            if (segments.length > 0) {
                segments[segments.length - 1].characterLeave = true;
            }

        } else {
            // Fallback for Colon-based tags that matched tagPattern but aren't explicitly handled block tags
            const colonIndex = tagName.indexOf(':');
            if (colonIndex !== -1) {
                const meta = tagName.substring(0, colonIndex).trim();
                const dialogue = tagName.substring(colonIndex + 1).trim() + (content ? " " + content : "");

                const [name, expression] = meta.split('_');

                const inlineSegments = parseInlineContent(dialogue, {
                    type: 'dialogue',
                    character: name,
                    characterImageKey: undefined,
                    expression: expression || '기본'
                });
                segments.push(...inlineSegments);

            } else {
                // Unknown tag matching pattern, treat as narration
                if (tagName.startsWith('/')) {
                    // ignore
                } else {
                    // It was a block tag pattern match, but not handled.
                    // Just add as narration
                    segments.push({ type: 'narration', content: `[${fullTagName}] ${content}` });
                }
            }
        }
    }

    // Post-processing to handle <떠남> tag in content
    for (const segment of segments) {
        if (segment.content && segment.content.includes('<떠남>')) {
            segment.characterLeave = true;
            segment.content = segment.content.replace(/<떠남>/g, '').trim();
        }
    }

    // If no tags found, treat entire text as narration (fallback for legacy/error)
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

/**
 * [New] recursively parses content extracting Inline Tags
 * Returns an array of ScriptSegments (Dialogue chunks interleaved with Commands)
 */
function parseInlineContent(text: string, context: Partial<ScriptSegment>): ScriptSegment[] {
    const segments: ScriptSegment[] = [];

    // Inline Tag Pattern
    // Matches <TagName attr='val'> or <TagName>
    const inlineTagPattern = /<(Stat|State|Rel|Relationship|Tension|Time|시간|Command|NewInjury|Injury|Quest|Goal|NewGoal|GoalUpdate|Memory|Mem)(?:\s+[^>]*)?>/gi;

    let lastIndex = 0;
    let match;

    // Regex must be global
    const regex = new RegExp(inlineTagPattern);

    while ((match = regex.exec(text)) !== null) {
        // 1. Push preceding text
        const precedingText = text.substring(lastIndex, match.index);
        if (precedingText.trim()) {
            pushTextSegments(segments, precedingText, context);
        }

        // 2. Process the Tag
        const fullTag = match[0]; // <Stat hp='10'>
        const tagName = match[1]; // Stat

        const commandSegment = parseInlineTag(fullTag, tagName);
        if (commandSegment) {
            segments.push(commandSegment);
        }

        lastIndex = regex.lastIndex;
    }

    // 3. Push remaining text
    const remainingText = text.substring(lastIndex);
    if (remainingText.trim()) {
        pushTextSegments(segments, remainingText, context);
    }

    return segments;
}

// Helper to push text segments with context
function pushTextSegments(segments: ScriptSegment[], text: string, context: Partial<ScriptSegment>) {
    const lines = text.split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;

        const sentences = splitSentences(line.trim());
        for (const s of sentences) {
            // Remove wrapping quotes if present (AI sometimes adds them)
            // [Fix] Use [\s\S] to match newlines in multiline sentences
            const cleanS = s.trim().replace(/^"([\s\S]*)"$/, '$1').replace(/^“([\s\S]*)”$/, '$1');
            if (cleanS) {
                segments.push({
                    ...context,
                    type: context.type as ScriptType || 'narration',
                    content: cleanS
                });
            }
        }
    }
}

// Helper to parse specific inline tags into Command Segments
function parseInlineTag(fullTag: string, tagName: string): ScriptSegment | null {
    const lowerName = tagName.toLowerCase();

    if (lowerName === 'stat' || lowerName === 'state') {
        const attributes: Record<string, number> = {};
        const attrRegex = /(\w+)=["']([^"']*)["']/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(fullTag)) !== null) {
            const key = attrMatch[1];
            const val = parseFloat(attrMatch[2]);
            if (!isNaN(val)) attributes[key] = val;
        }
        return { type: 'command', commandType: 'update_stat', content: JSON.stringify(attributes) };
    }

    if (lowerName === 'rel' || lowerName === 'relationship') {
        const attrRegex = /(\w+)=["']([^"']*)["']/g;
        let charId = '';
        let value = 0;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(fullTag)) !== null) {
            const key = attrMatch[1].toLowerCase();
            const valStr = attrMatch[2];
            if (['char', 'id', 'character'].includes(key)) charId = valStr;
            else if (['val', 'value', 'amount'].includes(key)) value = parseFloat(valStr);
        }
        if (charId && !isNaN(value)) {
            return { type: 'command', commandType: 'update_relationship', content: JSON.stringify({ charId, value }) };
        }
    }



    if (lowerName === 'time' || lowerName === '시간') {
        const attrRegex = /(?:val|value)=["']([^"']*)["']/i;
        const m = attrRegex.exec(fullTag);
        let timeVal = m ? m[1] : '';

        // If no attribute, try to parse content inside tag? No, inline tags usually self-closing or attribute based.
        // If <Time>10분</Time> format, parseInlineContent doesn't handle children easily. 
        // We assume <Time val='10m'> or <시간 val='10분'>

        if (timeVal) {
            return { type: 'command', commandType: 'update_time', content: timeVal };
        }
    }

    if (lowerName === 'injury' || lowerName === 'newinjury') {
        const attrRegex = /(?:name|val|value)=["']([^"']*)["']/i;
        const m = attrRegex.exec(fullTag);
        let injuryName = m ? m[1] : '';
        if (injuryName) {
            return { type: 'command', commandType: 'add_injury', content: JSON.stringify({ name: injuryName }) };
        }
    }

    return null;
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
            // If next char is NOT whitespace (Space, Tab, Newline, NBSP) and NOT EOF, it's likely not a split (e.g. 1.5, 3.14)
            // But if it is End of String, we validly split (and push).
            if (j < text.length && !/\s/.test(text[j])) {
                continue;
            }

            // 3. Short Sentence / Merging Rule (15 chars)
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
