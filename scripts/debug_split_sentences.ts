
// Logic extracted from script-parser.ts

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
            let j = i + 1;
            while (j < text.length && ["'", '"', "”", "’", "]", ")"].includes(text[j])) {
                buffer += text[j];
                j++;
                i++; // Advance main loop index as we consumed these chars
            }

            // 2. Check overlap logic (Next Char)
            // If next char is NOT whitespace (Space, Tab, Newline, NBSP) and NOT EOF, it's likely not a split (e.g. 1.5, 3.14)
            if (j < text.length && !/\s/.test(text[j])) {
                continue;
            }

            // 3. Short Sentence / Merging Rule (15 chars)
            if (buffer.trim().length < 15 && j < text.length) {
                // Heuristic: If it's short, keep accumulating to avoid choppy text
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

// Test Case 1: User's reported text
const fullText = `"작가 이 양반아, 이게 정말 최선이었어...?"

모니터 너머로 비치는 [천하제일]의 마지막 화를 보며 나는 허탈하게 웃었다. 3년 동안 매일 같이 쿠키를 굽고, 댓글을 달며 응원했던 내 인생 소설이 이토록 처참한 몰살 엔딩으로 끝날 줄이야. 주인공은 독독(毒)에 중독되어 비참하게 죽고, 히로인들은 뿔뿔이 흩어지거나 행방묘연.`;

// Test splitting behavior
console.log("--- Full Text Split ---");
// Note: In the real parser, this is split by NEWLINE first.
// Narration tag content -> split('\n') -> for each line -> splitSentences.
// User text has \n\n.
// Line 1: "작가..."
// Line 2: ""
// Line 3: "모니터..."

const line1 = `"작가 이 양반아, 이게 정말 최선이었어...?"`;
console.log(`Line 1: "${line1}"`);
console.log("Split:", splitSentences(line1));

const line3 = `모니터 너머로 비치는 [천하제일]의 마지막 화를 보며 나는 허탈하게 웃었다. 3년 동안 매일 같이 쿠키를 굽고, 댓글을 달며 응원했던 내 인생 소설이 이토록 처참한 몰살 엔딩으로 끝날 줄이야. 주인공은 독독(毒)에 중독되어 비참하게 죽고, 히로인들은 뿔뿔이 흩어지거나 행방묘연.`;
console.log(`Line 3: "${line3}"`);
console.log("Split:", splitSentences(line3));

// Verify "Short Sentence Rule"
// "3년 동안 매일 같이 쿠키를 굽고, 댓글을 달며 응원했던 내 인생 소설이 이토록 처참한 몰살 엔딩으로 끝날 줄이야." -> Long.
// "주인공은 독독(毒)에 중독되어 비참하게 죽고, 히로인들은 뿔뿔이 흩어지거나 행방묘연."

// Simulate Stream Partial
console.log("\n--- Partial Stream Test ---");
const partial = `모니터 너머로 비치는 [천하제일]의 마지막 화를 보며 나는 허탈하게 웃었다.`; // Just the first sentence
console.log(`Partial: "${partial}"`);
console.log("Split:", splitSentences(partial));

// Simulate Stream Partial (mid-sentence)
const partial2 = `모니터 너머로 비치는 [천하제일]의 마지막 화를 보며 나는 허탈하게 웃었다. 3년 동`;
console.log(`Partial2: "${partial2}"`);
console.log("Split:", splitSentences(partial2));
