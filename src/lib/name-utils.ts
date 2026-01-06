export function normalizeName(name: string): string {
    // [Fix] Allow Korean/Unicode chars, strip ONLY spaces and special symbols that aren't letters
    return name.toLowerCase().replace(/[\s\-_]/g, '');
}

/**
 * Calculates Dice Coefficient (Sorensen-Dice index) for string similarity.
 * Good for short strings and names.
 * Range: 0.0 to 1.0
 */
function getDiceCoefficient(str1: string, str2: string): number {
    const s1 = str1.replace(/\s+/g, '').toLowerCase();
    const s2 = str2.replace(/\s+/g, '').toLowerCase();

    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0.0;

    const bigrams1 = new Map<string, number>();
    for (let i = 0; i < s1.length - 1; i++) {
        const bigram = s1.substring(i, i + 2);
        bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
    }

    let intersection = 0;
    for (let i = 0; i < s2.length - 1; i++) {
        const bigram = s2.substring(i, i + 2);
        if (bigrams1.has(bigram) && bigrams1.get(bigram)! > 0) {
            intersection++;
            bigrams1.set(bigram, bigrams1.get(bigram)! - 1);
        }
    }

    return (2.0 * intersection) / (s1.length - 1 + s2.length - 1);
}

export interface MatchResult {
    target: string;
    rating: number;
}

export function findBestMatchDetail(inputName: string, candidates: string[]): MatchResult | null {
    if (!inputName || !candidates || candidates.length === 0) return null;

    // Normalize input once
    // const normalizedInput = normalizeName(inputName); 
    // Dice algo handles whitespace/case, but let's stick to raw inputs for now or lightweight clean

    let bestMatch: MatchResult | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
        const score = getDiceCoefficient(inputName, candidate);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = { target: candidate, rating: score };
        }
    }

    return bestMatch;
}

export function findBestMatch(inputName: string, candidates: string[]): string | null {
    // Legacy support: strict normalized prefix match prioritized
    const normalizedInput = normalizeName(inputName);
    if (!normalizedInput || normalizedInput.length < 2) return null;

    // 1. Exact Match (Normalized)
    const exactMatch = candidates.find(c => normalizeName(c) === normalizedInput);
    if (exactMatch) return exactMatch;

    // 2. Substring Match (Start)
    const startMatch = candidates.find(c => normalizeName(c).startsWith(normalizedInput));
    if (startMatch) return startMatch;

    return null;
}

