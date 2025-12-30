export function normalizeName(name: string): string {
    // [Fix] Allow Korean/Unicode chars, strip ONLY spaces and special symbols that aren't letters
    return name.toLowerCase().replace(/[\s\-_]/g, '');
}

export function findBestMatch(inputName: string, candidates: string[]): string | null {
    const normalizedInput = normalizeName(inputName);
    // [Safety] Don't match irrelevant short/empty strings
    if (!normalizedInput || normalizedInput.length < 2) return null;

    // [Debug] Log matching attempt for Korean names or weird cases
    // console.log(`[NameMatch] Input: "${inputName}" -> Norm: "${normalizedInput}"`);

    // 1. Exact Match (Normalized)
    const exactMatch = candidates.find(c => normalizeName(c) === normalizedInput);
    if (exactMatch) return exactMatch;

    // 2. Substring Match (Input is part of Candidate, e.g., "jun" -> "jun_seo_yeon")
    const startMatch = candidates.find(c => normalizeName(c).startsWith(normalizedInput));
    if (startMatch) return startMatch;

    // 3. Reverse Substring (Candidate is part of Input) - Removed due to false positives
    // const includedMatch = candidates.find(c => normalizeName(c).includes(normalizedInput));
    // if (includedMatch) return includedMatch;

    return null;
}
