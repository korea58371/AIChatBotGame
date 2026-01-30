/**
 * Utility for standardizing Wuxia injuries.
 * Groups diverse descriptive terms into canonical injury categories to prevent debuff overload.
 */

export const normalizeWuxiaInjury = (injury: string): string => {
    // 1. Remove Content in Parentheses (English OR Korean)
    // "Internal Injury (Minor)", "내상 (경미)", "내상(안정)" -> "Internal Injury", "내상"
    // Regex: \( [^)]* \) -> remove
    let clean = injury.replace(/\s*\([^)]*\)/g, "").trim();

    // 2. Bilingual Tag Removal (Legacy)
    // Sometimes English tag is separate? e.g. "내상 Internal Injury"
    // Just in case, try to match known patterns.

    // 3. Wuxia Clustering Logic
    // Mapped to Canonical Korean Name + English Tag for clarity

    // [Qi Deviation Group]
    if (clean.match(/(기혈.*역류|기혈.*뒤틀림|폭주|심마|마기.*침식|내력.*충돌|내력.*역류)/))
        return "주화입마 (Qi Deviation)";

    // [Severe Internal Injury Group]
    if (clean.match(/(심각한.*내상|단전.*손상|장기.*파열|혈관.*파열|치명상)/))
        return "심각한 내상 (Severe Internal Injury)";

    // [Internal Injury Group]
    // Matches "내상" which covers "내상(경미)" after step 1
    if (clean.match(/(^내상$|각혈|토혈|기혈.*진탕|충격)/))
        return "내상 (Internal Injury)";

    // [Body Collapse Group]
    if (clean.match(/(공능.*제약|근육.*과부하|근육.*파열|신체.*붕괴|전신.*마비)/))
        return "신체 붕괴 (Body Collapse)";

    // [Exhaustion Group]
    if (clean.match(/(탈진|기력.*고갈|내력.*고갈|정신.*고갈)/))
        return "탈진 (Exhaustion)";

    // Default: Return cleaned string if no cluster match
    return clean;
};
