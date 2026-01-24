
import { parseScript } from '../src/lib/utils/script-parser';

const sampleText = `<배경>남만_천마신교_만마전
<BGM> 거대한 압박감
<시간>1일차 08:00(아침)
<나레이션>
차디찬 대리석 바닥의 감촉이 뺨을 타고 전해졌다.

<대사>무명(주인공)_당황2: ...윽, 여긴 또 어디야.`;

console.log("--- Testing Parser with Newline after Narration tag ---");
const segments = parseScript(sampleText);
console.log(`Parsed ${segments.length} segments`);
segments.forEach((s, i) => {
    console.log(`[${i}] ${s.type}: ${JSON.stringify(s.content)}`);
});
