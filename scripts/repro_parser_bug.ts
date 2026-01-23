
// Reproduction Script for Output Parsing Bug
// Run with: npx ts-node scripts/repro_parser_bug.ts

const mockAIResponse_Buggy = `
여기 이전에 생성된 텍스트가 있습니다. (환각)
<Output>
[이전 턴의 대사]
철수: 안녕?
</Output>

그리고나서 AI가 정신을 차리고 이번 턴을 생성합니다.
<Output>
[이번 턴의 진짜 대사]
영희: 반가워!
</Output>
`;

function parseBuggy(text: string) {
    console.log("--- Buggy Parser ---");
    const outputMatch = text.match(/<Output>([\s\S]*?)<\/Output>/i);
    if (outputMatch && outputMatch[1]) {
        console.log("Result:", outputMatch[1].trim());
    } else {
        console.log("No match");
    }
}

function parseFixed(text: string) {
    console.log("\n--- Fixed Parser (Last Match) ---");
    // Use matchAll to find all occurrences
    const matches = [...text.matchAll(/<Output>([\s\S]*?)<\/Output>/gi)];

    if (matches.length > 0) {
        // Take the LAST one
        const lastMatch = matches[matches.length - 1];
        console.log("Result:", lastMatch[1].trim());
    } else {
        // Fallback or Buggy original check
        console.log("No match");
    }
}

// UI Streaming Logic Simulation
function simulateUIStream(text: string) {
    console.log("\n--- UI Stream Simulation ---");
    // The stream arrives chunk by chunk.
    // If we receive the first block, we show it. 
    // If we receive the second block later, we should switch to it.

    // UI Logic:
    // If <Output> tag exists, discard everything BEFORE the LAST <Output> tag.

    const lastOpenIndex = text.lastIndexOf('<Output>');
    let meaningfulText = text;

    if (lastOpenIndex !== -1) {
        console.log(`[UI] Detected Output tag at index ${lastOpenIndex}. Truncating previous context.`);
        meaningfulText = text.substring(lastOpenIndex);
    }

    // Clean tags
    const cleanText = meaningfulText
        .replace(/<Output[^>]*>/gi, '')
        .replace(/<\/Output>/gi, '')
        .trim();

    console.log("UI Display Text:", cleanText);
}

parseBuggy(mockAIResponse_Buggy);
parseFixed(mockAIResponse_Buggy);
simulateUIStream(mockAIResponse_Buggy);
