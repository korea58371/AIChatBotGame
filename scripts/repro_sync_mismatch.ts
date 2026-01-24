
// Mock ParseScript logic manually to avoid imports if possible, OR use relative import but mock store.
// Better: Copy the essential parsing logic or mock the store properly for ts-node.
// Since parseScript imports store, we need to mock it.

const mockState = {
    availableBackgrounds: [],
    language: 'ko'
};

// We can't easily mock module imports in ts-node without a setup file.
// So we will import the file, but we need to ensure useGameStore doesn't crash.
// Use a brute-force mock if necessary, OR just copy the parser logic here for isolation testing.
// Given strict TS environment, copying the parser logic is safest for a quick repro script 
// IF the parser logic is complex.
// Actually, let's try to mock it by defining the global object if used? No, it's an import.

// Strategy: Create a new file 'scripts/parser_mock.ts' that has the parser logic but MOCKS the store import?
// No, that's too much.
// Let's just Read the file 'src/lib/utils/script-parser.ts' and eval it with mocked dependnecies? No.

// Simplest: Just use the real file, but mock the Global Store State via the store's API if it allows?
// useGameStore is a hook/store.
// If we can't run it, let's just inspect the code logic or try to run it with a minimal environment.

// Alternative: I will modify the script to define the mocks BEFORE importing.
// But imports are hoisted.

// OK, let's try to copy the RELEVANT parsing logic (Tag Splitting) into this script.
// It's the only way to be sure without fighting ts-node.

// --- COPIED & SIMPLIFIED PARSER LOGIC ---



// WAIT, I should just fix the imports. 
// The error was "Cannot find name 'jest'".
// I will just REMOVE jest.mock and see if it runs.
// useGameStore usage in script-parser is inside a try-catch for fuzzy matching.
// So it might just warn and continue.
import { parseScript } from '../src/lib/utils/script-parser';

async function runSimulation() {
    console.log("--- Sync Mismatch Simulation ---");

    const sampleText = `<시간>1일차 15:15(오후)
<배경>제갈세가_정원
<BGM> 평온한 아침
<나레이션>
내 코끝까지 다가온 그녀의 숨결에서 은은한 서향(書香)과 함께 달콤한 우유 냄새가 섞여 났다. 일류 고수의 기운이 전신을 훑고 지나가는 감각은 마치 수천 개의 미세한 바늘이 피부를 스치는 듯한 소름을 동반했다. 하지만 나는 당황하지 않았다. 아니, 당황해서는 안 됐다. 이곳은 호북 제갈세가이고, 내 앞에 있는 여인은 천하에서 가장 게으르지만 가장 영민한 머리를 가진 제갈연주니까.

나는 뒤로 반 걸음 물러나며 정중하게 포권을 취했다. 예법을 차리는 척하면서도 눈빛만은 그녀의 맑은 눈동자를 피하지 않고 정면으로 마주했다.`;

    try {
        const segments = parseScript(sampleText);
        console.log(`Total Segments: ${segments.length}`);
        segments.forEach((s, i) => console.log(`[${i}] ${s.type}`));
    } catch (e) {
        console.error("Parser crashed:", e);
    }
}

runSimulation();
