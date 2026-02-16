import wuxiaMap from '@/data/games/wuxia/character_map.json';
import gbyMap from '@/data/games/god_bless_you/character_map.json';

// Merge all character maps for global normalization
const NAME_TO_ID_MAP: Record<string, string> = {
    ...wuxiaMap,
    ...gbyMap
};

// Memoize the reverse map (English ID -> Korean Name)
const ID_TO_NAME_MAP: Record<string, string> = Object.entries(NAME_TO_ID_MAP).reduce((acc, [koreanName, englishId]) => {
    // Check for collisions or self-mapping
    if (!acc[englishId]) {
        acc[englishId] = koreanName;
    }
    return acc;
}, {} as Record<string, string>);

/**
 * Normalizes a character ID based on the current language setting.
 * - 'ko': Returns Korean Name (e.g. "ChoRyeon" -> "초련")
 * - 'en': Returns English ID (e.g. "초련" -> "ChoRyeon")
 * 
 * [Improved Logic]
 * 1. Checks exact match.
 * 2. If exact match fail, tries to strip known image suffixes (e.g. "GoHaNeul_Anger_Lv1" -> "GoHaNeul").
 * 3. Returns normalized ID/Name based on language.
 * 
 * @param input The character ID or Name (e.g. "ChoRyeon" or "초련" or "GoHaNeul_Anger_Lv1")
 * @param language Language setting ('ko' | 'en' | 'ja'). Defaults to 'ko' if omitted.
 * @returns The normalized ID string
 */
export function normalizeCharacterId(input: string, language: 'ko' | 'en' | 'ja' = 'ko'): string {
    if (!input) return input;

    // Helper to check valid ID/Name in our maps
    const isValidId = (id: string) => !!ID_TO_NAME_MAP[id];
    const isValidName = (name: string) => !!NAME_TO_ID_MAP[name];

    // [NEW] Fuzzy match helper — strips underscores & lowercases for comparison
    const fuzzyNormalize = (s: string) => s.replace(/_/g, '').toLowerCase();
    const fuzzyMatchId = (raw: string): string | null => {
        const target = fuzzyNormalize(raw);
        if (!target) return null;
        // Check against all known English IDs
        for (const knownId of Object.keys(ID_TO_NAME_MAP)) {
            if (fuzzyNormalize(knownId) === target) return knownId;
        }
        // Check against all known English IDs as prefix match (e.g. "han" matches "HanSeolHee" only if unique)
        const prefixMatches = Object.keys(ID_TO_NAME_MAP).filter(k => fuzzyNormalize(k).startsWith(target));
        if (prefixMatches.length === 1) return prefixMatches[0];
        return null;
    };

    // [New] Suffix Stripping / Normalization Logic
    // We assume the input could be a messy Image Key (e.g. "GoHaNeul_Anger_Lv1")
    // Strategy: Longest Prefix Match by splitting `_`

    let baseId = input;

    // 0. Quick Check: Is the input ITSELF strictly valid?
    if (isValidId(input) || isValidName(input)) {
        baseId = input;
    } else {
        // [Enhanced] Generic Suffix Stripping for AI Extras (Unknown IDs)
        // Matches patterns like "_Joy_Lv1", "_Anger", "_Default"
        // Regex: Underscore + (Word) + Optional(_Lv1~9) at end of string
        // [CRITICAL] This regex prevents "Duplicated Characters" in the Database.
        // AI often outputs IDs like "CheolSu_Happy_Lv1" for image expression.
        // If we don't strip this suffix, "CheolSu_Happy_Lv1" becomes a NEW character, distinct from "CheolSu".
        // This logic ensures "CheolSu_Happy_Lv1" -> "CheolSu", keeping the character data unified.
        // -- 2026.01.14 Logic Update --
        const suffixRegex = /_([a-zA-Z]+)(_Lv\d+)?$/;

        if (suffixRegex.test(input)) {
            const stripped = input.replace(suffixRegex, '');
            // If the stripped version is valid (or just cleaner), use it.
            baseId = stripped;
        } else if (input.includes('_')) {
            // Fallback: Legacy split logic (Longest Prefix Match)
            const parts = input.split('_');
            for (let i = parts.length; i > 0; i--) {
                const candidate = parts.slice(0, i).join('_');
                if (isValidId(candidate) || isValidName(candidate)) {
                    baseId = candidate;
                    break;
                }
            }
        }

        // [NEW] If still not found, try fuzzy match (case-insensitive, underscore-insensitive)
        if (!isValidId(baseId) && !isValidName(baseId)) {
            const fuzzyResult = fuzzyMatchId(baseId);
            if (fuzzyResult) baseId = fuzzyResult;
        }
    }

    // Now normalize `baseId` to the target language

    // 1. Korean Mode ('ko') -> Prefer Korean Name
    if (language === 'ko') {
        // If baseId is English ID, return Korean Name
        if (ID_TO_NAME_MAP[baseId]) return ID_TO_NAME_MAP[baseId];
        // If baseId is Korean Name, return as is
        if (NAME_TO_ID_MAP[baseId]) return baseId;

        return baseId; // Fallback
    }

    // 2. English/Japanese Mode ('en' | 'ja') -> Prefer English ID
    if (language === 'en' || language === 'ja') {
        // If baseId is Korean Name, return English ID
        if (NAME_TO_ID_MAP[baseId]) return NAME_TO_ID_MAP[baseId];
        // If baseId is English ID, return as is
        if (ID_TO_NAME_MAP[baseId]) return baseId;

        return baseId; // Fallback
    }

    return baseId;
}

/**
 * Returns the Canonical English ID regardless of language.
 * Useful for asset lookups or strict logic that requires English keys.
 * Handles suffix stripping as well.
 */
export function getCanonicalEnglishId(input: string): string {
    // 1. Normalize first to handle suffixes
    const normalized = normalizeCharacterId(input, 'en');

    // 2. Ensure it's English (normalizeCharacterId('en') does this, but double check)
    if (NAME_TO_ID_MAP[normalized]) return NAME_TO_ID_MAP[normalized];

    return normalized;
}
