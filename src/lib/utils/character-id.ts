import { useGameStore } from '@/lib/store';

/**
 * Normalizes a character ID by stripping image suffixes.
 * 
 * 한글화 이후 단순화:
 * - character_map.json 의존성 제거
 * - 영문↔한글 변환 불필요 (모두 한글)
 * - 핵심 기능: suffix stripping (e.g. "철수_기쁨1" → "철수")
 * 
 * @param input 캐릭터 ID 또는 이름 (e.g. "초련" 또는 "초련_기쁨1")
 * @param language Language setting ('ko' | 'en' | 'ja'). Defaults to 'ko'.
 * @returns The normalized ID string
 */
export function normalizeCharacterId(input: string, language: 'ko' | 'en' | 'ja' = 'ko'): string {
    if (!input) return input;

    // Get known character names from runtime characterData
    const charsData = useGameStore.getState().characterData || {};
    const isValidName = (name: string) => !!charsData[name];

    // 0. Quick Check: Is the input ITSELF valid?
    if (isValidName(input)) return input;

    // [New] Suffix Stripping / Normalization Logic
    // AI may output IDs with emotion suffixes (e.g. "철수_기쁨1", "GoHaNeul_Anger_Lv1")
    // Strategy: Strip known suffixes, then longest prefix match
    let baseId = input;

    // [Enhanced] Generic Suffix Stripping for AI Extras (Unknown IDs)
    // Matches patterns like "_기쁨1", "_Joy_Lv1", "_Anger", "_Default"
    // Regex: Underscore + (Word/한글) + Optional(_Lv1~9) at end of string
    // [CRITICAL] This regex prevents "Duplicated Characters" in the Database.
    // AI often outputs IDs like "철수_기쁨1" for image expression.
    // If we don't strip this suffix, it becomes a NEW character, distinct from "철수".
    const suffixRegex = /_([a-zA-Z가-힣]+\d?)(_Lv\d+)?$/;

    if (suffixRegex.test(input)) {
        const stripped = input.replace(suffixRegex, '');
        if (isValidName(stripped)) return stripped;
        baseId = stripped;
    } else if (input.includes('_')) {
        // Fallback: Legacy split logic (Longest Prefix Match)
        const parts = input.split('_');
        for (let i = parts.length; i > 0; i--) {
            const candidate = parts.slice(0, i).join('_');
            if (isValidName(candidate)) return candidate;
        }
    }

    // Case-insensitive fallback
    if (!isValidName(baseId)) {
        const matchedKey = Object.keys(charsData).find(k => k.toLowerCase() === baseId.toLowerCase());
        if (matchedKey) return matchedKey;
    }

    return baseId;
}

/**
 * Returns the canonical character name.
 * 한글화 이후: 한글 이름을 그대로 반환 (영문 변환 불필요)
 */
export function getCanonicalEnglishId(input: string): string {
    return normalizeCharacterId(input, 'ko');
}
