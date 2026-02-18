import stringSimilarity from 'string-similarity';
import { useGameStore } from '@/lib/store';

/**
 * AI가 생성한 배경 태그를 assets 폴더의 가장 유사한 파일명으로 해석합니다.
 * [Refactored] backgroundMappings 의존 제거 — availableBackgrounds(파일 리스트) 직접 매칭
 * 
 * ⚠️ assets.json 매니페스트는 확장자 없이 저장 (예: "강남_번화가")
 *    실제 파일은 "강남_번화가.jpg" → 반환 시 .jpg 붙여야 함
 * 
 * 전략:
 * 1. 정확한 파일명 매칭
 * 2. 계층적 스코어링 (Suffix/Overlap 기반 최적 매칭)
 * 3. 퍼지 매칭 (string-similarity 폴백)
 * 4. 폴백 (Default_Fallback.jpg)
 */

/** Helper: 매니페스트 이름 → 완전한 URL 경로 */
function buildBgUrl(basePath: string, manifestName: string): string {
    // manifestName = "강남_번화가" (확장자 없음)
    // 이미 확장자가 있으면 그대로, 없으면 .jpg 추가
    const filename = /\.(jpg|jpeg|png|webp|gif)$/i.test(manifestName)
        ? manifestName
        : `${manifestName}.jpg`;
    return `${basePath}/${filename}`;
}

export function resolveBackground(tag: string): string {
    const state = useGameStore.getState();
    const backgroundFiles: string[] = state.availableBackgrounds || [];
    const activeGameId = state.activeGameId || 'god_bless_you';
    const basePath = `/assets/${activeGameId}/backgrounds`;

    // 0. Passthrough (already resolved paths or URLs)
    if (tag.startsWith('/assets/') || tag.startsWith('http')) return tag;

    // 1. Clean Input
    const query = tag
        .replace(/<배경>|<\/배경>/g, '')
        .replace(/['"]/g, '')
        .replace(/\s*>\s*/g, '_')   // "서울 > 아카데미 > 강의실" → "서울_아카데미_강의실"
        .replace(/\s+/g, '_')       // Spaces to underscores
        .trim()
        .normalize('NFC');          // [Fix] NFC normalization for Korean
    if (!query) return `${basePath}/Default_Fallback.jpg`;

    if (backgroundFiles.length === 0) {
        console.warn(`[BackgroundManager] ⚠️ availableBackgrounds is EMPTY! Falling back to direct path for "${query}".`);
        return `${basePath}/${query}.jpg`;
    }

    // Manifest stores extensionless names → normalize for comparison
    const filesNFC = backgroundFiles.map(f => f.normalize('NFC'));

    // --- Strategy 1: Exact Match ---
    const exactIdx = filesNFC.findIndex(f => f === query);
    if (exactIdx >= 0) {
        return buildBgUrl(basePath, backgroundFiles[exactIdx]);
    }

    // --- Strategy 2: Hierarchical Scoring (Suffix + Overlap) ---
    const queryParts = query.split('_').filter(Boolean);

    let bestFile = '';
    let maxScore = 0;

    for (let i = 0; i < filesNFC.length; i++) {
        const fileParts = filesNFC[i].split('_').filter(Boolean);
        let score = 0;

        // Rule 1: Suffix Match
        if (queryParts.length > 0 && fileParts.length > 0) {
            const lastQuery = queryParts[queryParts.length - 1];
            const lastFile = fileParts[fileParts.length - 1];

            if (lastQuery === lastFile) {
                score += 50;
            } else if (lastQuery.replace(/\s/g, '') === lastFile.replace(/\s/g, '')) {
                score += 50;
            }
        }

        // Rule 2: Component Overlap
        for (const qp of queryParts) {
            if (fileParts.includes(qp)) {
                score += 10;
            }
        }

        if (score > maxScore) {
            maxScore = score;
            bestFile = backgroundFiles[i];
        }
    }

    if (bestFile && maxScore >= 40) {
        console.log(`[BackgroundManager] Score Match: "${query}" → "${bestFile}.jpg" (Score: ${maxScore})`);
        return buildBgUrl(basePath, bestFile);
    }

    // --- Strategy 3: Fuzzy File Match ---
    if (backgroundFiles.length > 0) {
        const fileMatches = stringSimilarity.findBestMatch(query, filesNFC);
        if (fileMatches.bestMatch.rating > 0.5) {
            const matchedFile = backgroundFiles[fileMatches.bestMatchIndex];
            console.log(`[BackgroundManager] Fuzzy Match: "${query}" → "${matchedFile}.jpg" (Rating: ${fileMatches.bestMatch.rating.toFixed(2)})`);
            return buildBgUrl(basePath, matchedFile);
        }
    }

    console.warn(`[BackgroundManager] No match for "${query}". Returning fallback.`);
    return `${basePath}/Default_Fallback.jpg`;
}
