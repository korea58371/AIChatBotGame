
import { parseScript } from '../src/lib/utils/script-parser.ts';

// Test Case 1: Simple Implicit Narration
const input1 = `
<배경> background_01
<시간> 08:00

눈을 떴다. 아침 햇살이 창가로 들어온다.
`;

console.log("--- Test 1: Simple Implicit Narration ---");
const result1 = parseScript(input1);
result1.forEach((seg, idx) => {
    console.log(`[${idx}] Type: ${seg.type}, Character: ${seg.character}, Content: "${seg.content}"`);
});

// Test Case 2: Streaming Chunk (Partial)
const input2 = `
<배경> street_night

어두운 골목길을 걸어가고 있었다.
갑자기
`;

console.log("\n--- Test 2: Streaming Chunk ---");
const result2 = parseScript(input2);
result2.forEach((seg, idx) => {
    console.log(`[${idx}] Type: ${seg.type}, Character: ${seg.character}, Content: "${seg.content}"`);
});
