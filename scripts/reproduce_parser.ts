
import { parseScript } from '../src/lib/utils/script-parser';

const input = `배경>하남_소림사_산문
<BGM> 평온한 아침
<시간>1일차 08:30(아침)
<나레이션>
코끝을 간지럽히는 새벽의 서늘한 공기와 은은한 향나무 냄새. 눈을 뜨자마자 보인 것은 끝도 없이 이어진 돌계단이었다. 
꿈이라고 생각했다. 하지만 등 뒤로 느껴지는 차가운 바위의 질감과, 폐부 깊숙이 들어오는 맑은 공기는 이것이 지독하리만큼 생생한 현실임을 증명하고 있었다.`;

// Test 1: Standard Input
console.log("--- Test 1: Standard Input ---");
const segments1 = parseScript(input);
segments1.forEach((s, i) => {
    console.log(`[${i}] ${s.type} | Content: "${s.content.substring(0, 30)}..." | Cmd: ${s.commandType || 'N/A'}`);
});


// Test 2: Input with Missing Newline (Potential Swallowing)
console.log("\n--- Test 2: Missing Newline ---");
const input2 = `<시간>1일차 08:30(아침)<나레이션>
코끝을 간지럽히는 새벽의 서늘한 공기와 은은한 향나무 냄새. 눈을 뜨자마자 보인 것은 끝도 없이 이어진 돌계단이었다.`;
const segments2 = parseScript(input2);
segments2.forEach((s, i) => {
    console.log(`[${i}] ${s.type} | Content: "${s.content.substring(0, 30)}..." | Cmd: ${s.commandType || 'N/A'}`);
});

// Test 3: Input with Malformed Tag (User Example '배경>')
console.log("\n--- Test 3: Malformed Tag ---");
const input3 = `배경>하남_소림사_산문
<BGM> 평온한 아침
<시간>1일차 08:30(아침)
<나레이션>
코끝을 간지럽히는 새벽의 서늘한 공기와 은은한 향나무 냄새. 눈을 뜨자마자 보인 것은 끝도 없이 이어진 돌계단이었다.`;
const segments3 = parseScript(input3);
segments3.forEach((s, i) => {
    console.log(`[${i}] ${s.type} | Content: "${s.content.substring(0, 30)}..." | Cmd: ${s.commandType || 'N/A'}`);
});
