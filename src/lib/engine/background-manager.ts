import stringSimilarity from 'string-similarity';
import { useGameStore } from '@/lib/store';
import { backgroundMappings as wuxiaBackgroundMap } from '@/data/games/wuxia/backgroundMappings';

/**
 * AI가 생성한 배경 태그를 assets 폴더의 가장 유사한 파일명으로 해석합니다.
 * 전략:
 * 1. 직접 매핑 (한국어 / 별칭 -> 파일명)
 * 2. 퍼지 매핑 (유사한 별칭 -> 파일명)
 * 3. 퍼지 파일명 (유사한 키워드 -> 실제 파일명)
 * 4. 폴백 (Default_Fallback.png)
 * 
 * @param tag AI가 생성한 태그, 예: "<배경>City_Street"
 * @returns 해결된 절대 경로, 예: "/assets/backgrounds/City_Street.jpg"
 */
// [Refactor] Hierarchical Scoring Systems (User Request: Region > Zone > Spot priority)
export function resolveBackground(tag: string): string {
    const state = useGameStore.getState();
    const backgroundMappings = state.backgroundMappings || {};
    const backgroundFiles = state.availableBackgrounds || [];
    const activeGameId = state.activeGameId || 'god_bless_you';

    const basePath = `/assets/${activeGameId}/backgrounds`;

    // 1. Clean Input
    if (tag.startsWith('/assets/') || tag.startsWith('http')) return tag;
    const query = tag.replace(/<배경>|<\/배경>/g, '').replace(/['"]/g, '').trim();
    if (!query) return `${basePath}/Default_Fallback.jpg`;

    // --- Strategy 1: Direct Match (Highest Priority) ---
    // [Debug] Streaming Trace
    if (tag.includes('남만')) {
        console.log(`[BackgroundManager] Resolving: "${tag}" -> Query: "${query}"`);
    }

    if (backgroundMappings[query]) {
        console.log(`[BackgroundManager] Direct Match: "${query}" -> "${backgroundMappings[query]}"`);
        return `${basePath}/${backgroundMappings[query]}`;
    }

    // --- Strategy 2: Hierarchical Scoring (Score-based Resolution) ---
    // Goal: Resolve "Region_Zone_Spot" -> Find best existing key "Zone_Spot" or "Spot" or "AltRegion_Spot"
    // Heuristic:
    // - Exact Spot Name Match: High Score
    // - Zone Match: Medium Score
    // - Region Match: Low Score

    // Decompose Query: "안휘_시장" -> ["안휘", "시장"]
    const queryParts = query.split('_');
    const mappingKeys = Object.keys(backgroundMappings);

    let bestKey = '';
    let maxScore = 0;

    // We scan ALL mapping keys to find the best match
    for (const key of mappingKeys) {
        let score = 0;
        const keyParts = key.split('_'); // e.g., "중원_시장" -> ["중원", "시장"]

        // Scoring Rules
        // 1. Suffix Match (The "Spot" is usually the last part)
        // If Query ends with '시장' and Key ends with '시장' -> +50 points
        if (keyParts.length > 0 && queryParts.length > 0) {
            const lastPartQuery = queryParts[queryParts.length - 1];
            const lastPartKey = keyParts[keyParts.length - 1];
            if (lastPartQuery === lastPartKey) {
                score += 50;
            }
        }

        // 2. Component Overlap (How many words match?)
        // "안휘_시장" vs "중원_시장" -> Overlap "시장" (1 part)
        let matchCount = 0;
        for (const qp of queryParts) {
            if (keyParts.includes(qp)) {
                matchCount++;
                score += 10; // Base score for any word match
            }
        }

        // 3. Length Penalty (Prefer closer matches)
        // "시장" (less junk) > "중원_시장" (some junk) if query is just "시장"
        // But if query is "안휘_시장", and we have "중원_시장" (score 60) vs "시장" (score 50)?
        // We want specifically broadly matching files?
        // Actually, "안휘_시장" vs "중원_시장":
        // "시장" matches (+50). "안휘" != "중원". Total 60.
        // "안휘_시장" vs "공용_시장": Total 60.
        // Tie-breaking?


        if (score > maxScore) {
            maxScore = score;
            bestKey = key;
        }
    }

    if (bestKey && maxScore > 0) {
        // Tie-breaker or Logic verification
        console.log(`[BackgroundManager] Scoring Match: "${query}" -> "${bestKey}" (Score: ${maxScore})`);
        return `${basePath}/${backgroundMappings[bestKey]}`;
    }


    // --- Strategy 3: Category / Prefix Fallback (Legacy) ---
    const parts = query.split('_');
    if (parts.length > 1) {
        const category = parts[0];
        const categoryFiles = backgroundFiles.filter(f => f.toLowerCase().startsWith(category.toLowerCase() + '_'));
        if (categoryFiles.length > 0) {
            // Find best string match within category
            const subMatch = stringSimilarity.findBestMatch(query, categoryFiles);
            if (subMatch.bestMatch.rating > 0.4) {
                return `${basePath}/${subMatch.bestMatch.target}`;
            }
        }
    }

    // --- Strategy 4: Fuzzy File Match ---
    if (backgroundFiles.length > 0) {
        const fileMatches = stringSimilarity.findBestMatch(query, backgroundFiles);
        if (fileMatches.bestMatch.rating > 0.6) {
            return `${basePath}/${fileMatches.bestMatch.target}`;
        }
    }

    console.warn(`[BackgroundManager] No match for "${query}". Returning fallback.`);
    return `${basePath}/Default_Fallback.jpg`;
}
