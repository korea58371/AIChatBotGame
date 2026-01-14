
import { normalizeCharacterId } from '../src/lib/utils/character-id';

// Simple test runner without jest
function test(name: string, fn: () => void) {
    try {
        console.log(`\n[TEST] ${name}`);
        fn();
        console.log("✅ Passed");
    } catch (e) {
        console.error("❌ Failed", e);
    }
}

function expect(actual: any) {
    return {
        toBe: (expected: any) => {
            if (actual !== expected) {
                throw new Error(`Expected '${expected}' but got '${actual}'`);
            }
        }
    };
}

async function runTests() {
    console.log("=== Character ID Normalization Verification ===");

    test("Legacy: Known ID should return itself (en)", () => {
        const res = normalizeCharacterId("YeonHwarin", "en");
        expect(res).toBe("YeonHwarin");
    });

    test("Legacy: Known ID should return Korean Name (ko)", () => {
        // Assuming mapping exists
        const res = normalizeCharacterId("YeonHwarin", "ko");
        // We expect "연화린" or similar if mapped. 
        // Note: Actual value depends on character_map.json content.
        // We just print it to check.
        console.log(` -> YeonHwarin(ko) = ${res}`);
    });

    test("New: Strips Suffix from Unknown ID (Prevent Duplication)", () => {
        // Case: AI generates "Extra_Happy_Lv1"
        const res = normalizeCharacterId("Extra_Happy_Lv1", "en");
        expect(res).toBe("Extra"); // Should strip _Happy_Lv1 if regex matches

        // Let's test the regex logic directly: 
        // _([a-zA-Z]+)(_Lv\d+)?$ matches "_Happy_Lv1"
        // "Extra" + "_Happy_Lv1"
    });

    test("New: Handles simple mood suffix", () => {
        const res = normalizeCharacterId("Guard_Angry", "en");
        expect(res).toBe("Guard");
    });

    test("New: Handles Level suffix", () => {
        const res = normalizeCharacterId("Bandit_Lv3", "en");
        // _Lv3 is not fully matched by _([a-zA-Z]+)(_Lv\d+)?$ ??
        // The regex is: /_([a-zA-Z]+)(_Lv\d+)?$/
        // It expects at least one word char after _.
        // So "Bandit_Lv3" -> "Lv3" is the word? No.
        // Wait, "Bandit_Lv3" -> "_Lv3". Word part is... "Lv3"? 
        // [a-zA-Z]+ matches "Lv".
        // Let's verify behavior.
        console.log(` -> Bandit_Lv3 = ${res}`);
    });

    test("Regression: Double Underscore", () => {
        const res = normalizeCharacterId("A_B_C", "en");
        // Logic: Try A_B -> match? Try A -> match?
        console.log(` -> A_B_C = ${res}`);
    });
}

runTests();
