
import { parseScript } from './src/lib/script-parser';

const testCases = [
    { name: "Standard", input: "<나레이션>안녕하세요.</나레이션>" },
    { name: "Leading Space", input: " <나레이션>안녕하세요.</나레이션>" },
    { name: "Inner Space", input: "< 나레이션 >안녕하세요.</나레이션>" },
    { name: "Square Brackets", input: "[나레이션] 안녕하세요." },
    { name: "Missing Closing", input: "<나레이션>안녕하세요." },
    { name: "Multiple", input: "<나레이션>원.<대사>투." },
    { name: "Leading Text", input: "Here is text.\n<나레이션>Ignored?" },
    { name: "Leading Text No Newline", input: "Here is text.<나레이션>Ignored?" },
    { name: "Broken Tag Start", input: "<나레이션 안녕하세요." },
    { name: "Broken Tag End", input: "<나레이션> 안녕하세요" },
    { name: "Multi-Sentence Narration", input: "첫 번째 문장입니다. 두 번째 문장입니다." },
    { name: "Multi-Sentence Dialogue", input: "<대사>철수_기본: 안녕. 반가워. 잘 지내?" },
    { name: "Stat Update", input: "<Stat hp=\"-10\" gold=\"50\">" },
    { name: "Personality Update", input: "<Stat morality=\"5\" courage=\"-2\">" },
    { name: "Personality Update Mixed Case", input: "<Stat Morality=\"5\" Courage=\"-2\">" },
    { name: "Rel Update", input: "<Rel char=\"chilsung\" val=\"5\">" },
    { name: "Stat with Text", input: "<Stat mp=\"-5\"> 마력이 감소했습니다." }
];

console.log("=== Parsing Test Results ===");
testCases.forEach(tc => {
    const segments = parseScript(tc.input);
    const success = segments.length > 0 && segments[0].type !== 'narration' || (segments[0].type === 'narration' && !segments[0].content.includes('<'));
    // "Success" here means "Parsed meaningful tags OR Parsed narration without raw tags (if input had tags)"
    // Actually, if input had tags and we output them in content, it's a FAIL.

    const hasRawTags = segments.some(s => s.content.includes('<나레이션') || s.content.includes('[나레이션'));

    console.log(`[${tc.name}]`);
    console.log(`Input: "${tc.input}"`);
    console.log(`Segments:`, JSON.stringify(segments, null, 2));
    console.log(`Has Raw Tags in Content: ${hasRawTags ? 'YES (FAIL)' : 'NO'}`);
    console.log('---');
});
