import stringSimilarity from 'string-similarity';
import { useGameStore } from './store';
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
export function resolveBackground(tag: string): string {
    const state = useGameStore.getState();
    const backgroundMappings = state.backgroundMappings || {};
    const backgroundFiles = state.availableBackgrounds || [];
    const activeGameId = state.activeGameId || 'god_bless_you';

    // 기준 경로 결정
    // [수정됨] 항상 게임별 폴더를 사용합니다. 에셋 마이그레이션으로 인해 레거시 체크가 제거되었습니다.
    const basePath = `/assets/${activeGameId}/backgrounds`;

    // [신규] 무협 배경 매핑 (한국어 키 -> 영어 파일명)
    if (activeGameId === 'wuxia') {
        const queryClean = tag.replace(/<배경>|<\/배경>/g, '').trim();
        // 강력한 매칭을 위해 입력에 확장자가 있다면 제거
        const key = queryClean.replace('.jpg', '');

        if (wuxiaBackgroundMap[key]) {
            console.log(`[BackgroundManager] 무협 맵 매치: "${key}" -> "${wuxiaBackgroundMap[key]}"`);
            return `${basePath}/${wuxiaBackgroundMap[key]}`;
        }

        // [신규] 키 자체가 맵의 유효한 값인지 확인 (역방향 조회 / 직접 영어 사용)
        const allValues = Object.values(wuxiaBackgroundMap);
        const potentialFile = key.endsWith('.jpg') ? key : key + '.jpg';
        if (allValues.includes(potentialFile)) {
            console.log(`[BackgroundManager] 무협 직접 영어 매치: "${key}" -> "${potentialFile}"`);
            return `${basePath}/${potentialFile}`;
        }
    }

    // 1. 태그 정리: <배경>, </배경>, 공백 제거
    const query = tag.replace(/<배경>|<\/배경>/g, '').trim();

    if (!query) return `${basePath}/Default_Fallback.jpg`; // 비어있으면 폴백

    // console.log(`[BackgroundManager] Resolving: "${query}"`);

    // ---------------------------------------------------------
    // 전략 1: 직접 매핑 (빠르고 정확함)
    // ---------------------------------------------------------
    if (backgroundMappings[query]) {
        console.log(`[BackgroundManager] 직접 매치: "${query}" -> "${backgroundMappings[query]}"`);
        return `${basePath}/${backgroundMappings[query]}`;
    }

    // ---------------------------------------------------------
    // 전략 1.5: [NEW] 범용 지역명 폴백 (사용자 요청)
    // ---------------------------------------------------------
    // "지역명_장소" (예: 안휘_산길)가 없을 경우, "강호_산길", "공용_산길" 등으로 대체 시도
    // 특정 지역에 얽매이지 않고 범용 배경을 사용하도록 함.
    if (query.includes('_')) {
        const parts = query.split('_');
        // 첫 번째 단어(지역명)를 제외한 나머지(장소)를 추출
        // 예: "안휘_산길" -> suffix="산길", "사천_성도_시장" -> suffix="성도_시장"
        const suffix = parts.slice(1).join('_');

        // 시도할 접두어 목록 (우선순위 순)
        const fallbackPrefixes = ['강호', '공용', '중원', '마을', '산'];

        for (const prefix of fallbackPrefixes) {
            const fallbackKey = `${prefix}_${suffix}`;

            // 1. 매핑에서 확인
            if (backgroundMappings[fallbackKey]) {
                console.log(`[BackgroundManager] 범용 지역 폴백 (매핑): "${query}" -> "${fallbackKey}" -> "${backgroundMappings[fallbackKey]}"`);
                return `${basePath}/${backgroundMappings[fallbackKey]}`;
            }

            // 2. 파일 목록에서 확인 (확장자 고려)
            const fallbackFile = fallbackKey + '.jpg';
            // availableBackgrounds에는 보통 파일명(확장자 포함)이 들어있음
            if (backgroundFiles.includes(fallbackFile)) {
                console.log(`[BackgroundManager] 범용 지역 폴백 (파일): "${query}" -> "${fallbackFile}"`);
                return `${basePath}/${fallbackFile}`;
            }
        }
    }

    // ---------------------------------------------------------
    // 전략 2: 퍼지 매핑 (매핑 키와 대조)
    // ---------------------------------------------------------
    // AI가 "반지하" 대신 "반지하방"이라고 할 때 유용함
    const mappingKeys = Object.keys(backgroundMappings);
    // [Fix] Ensure array is not empty before calling findBestMatch
    if (mappingKeys.length > 0) {
        const keyMatches = stringSimilarity.findBestMatch(query, mappingKeys);

        if (keyMatches.bestMatch.rating > 0.6) { // 별칭에 대한 높은 신뢰도
            const mappedFile = backgroundMappings[keyMatches.bestMatch.target];
            console.log(`[BackgroundManager] 퍼지 별칭 매치: "${query}" -> "${keyMatches.bestMatch.target}" -> "${mappedFile}"`);
            return `${basePath}/${mappedFile}`;
        }
    }

    // ---------------------------------------------------------
    // 전략 2.5: 카테고리 우선 퍼지 매칭 (계층적 검색)
    // ---------------------------------------------------------
    // 입력이 "City_Something"이면, "City_"로 시작하는 파일을 우선시함
    const parts = query.split('_');
    if (parts.length > 1) {
        const category = parts[0];
        // 이 카테고리로 시작하는 파일 필터링
        const categoryFiles = backgroundFiles.filter(f => f.toLowerCase().startsWith(category.toLowerCase() + '_'));

        if (categoryFiles.length > 0) {
            console.log(`[BackgroundManager] 카테고리 매치 발견: "${category}" (${categoryFiles.length} files)`);
            const subMatch = stringSimilarity.findBestMatch(query, categoryFiles);

            // [수정됨] 완화된 임계값 / 강제 매치 로직
            // 카테고리 매치는 있지만 특정 파일이 틀린 경우 (예: AI가 "Store_Restaurant"라고 했지만 "Store_Convenience"만 있는 경우),
            // 검은 화면보다는 *아무* 상점 배경이라도 보여주는 것이 낫습니다.
            // 원본: if (subMatch.bestMatch.rating > 0.55)

            if (subMatch.bestMatch.rating > 0.4) {
                console.log(`[BackgroundManager] 카테고리 제한 매치: "${query}" -> "${subMatch.bestMatch.target}"`);
                return `${basePath}/${subMatch.bestMatch.target}`;
            }

            // "안전 모드"를 원한다면 카테고리 내 강제 폴백
            // 지금은 카테고리가 맞다면 매우 느슨한 매치를 허용합니다.
            console.log(`[BackgroundManager] 약한 매치지만 카테고리는 유효함. 최적의 카테고리 매치 강제: "${subMatch.bestMatch.target}"`);
            return `${basePath}/${subMatch.bestMatch.target}`;
        }
    }

    // ---------------------------------------------------------
    // 전략 3: 전역 퍼지 파일명 (실제 파일과 대조)
    // ---------------------------------------------------------
    // [Fix] Ensure array is not empty before calling findBestMatch
    if (backgroundFiles.length > 0) {
        const fileMatches = stringSimilarity.findBestMatch(query, backgroundFiles);
        const bestFileMatch = fileMatches.bestMatch;

        // console.log(`[BackgroundManager] Fuzzy File Match: "${query}" -> "${bestFileMatch.target}" (Score: ${bestFileMatch.rating.toFixed(2)})`);

        // 임계값 증가 (0.5 -> 0.6): 일반적인 입력이 관련 없는 특정 파일과 매칭되는 것을 방지
        if (bestFileMatch.rating > 0.6) {
            return `${basePath}/${bestFileMatch.target}`;
        }
    }

    // ---------------------------------------------------------
    // 전략 3.5: [NEW] 부분 문자열 포함 매치 (사용자 요청: 던전_하수구_미로 -> 하수구)
    // ---------------------------------------------------------
    // AI가 없는 키를 조합해서 만들 때 (예: "던전_하수구_미로") 기존 키("하수구_입구")를 찾도록 함

    // 1. 매핑 키 중에서 검색어의 일부를 포함하는 키를 찾음
    const substringMatchKey = mappingKeys.find(key => query.includes(key) || key.includes(query));
    if (substringMatchKey) {
        console.warn(`[BackgroundManager] 부분 문자열 매치 보정: "${query}" -> "${substringMatchKey}" -> "${backgroundMappings[substringMatchKey]}"`);
        return `${basePath}/${backgroundMappings[substringMatchKey]}`;
    }

    // 2. 검색어를 분해하여 매핑 키와 대조 (예: "던전_하수구_미로" -> "하수구" 키 찾기)
    const queryParts = query.split('_');
    if (queryParts.length > 1) {
        // [MODIFIED] 우선순위 변경: 뒤쪽 단어(장소)부터 검색 (마을_시장 -> 시장 먼저 검색)
        // [User Request] 없는 이미지 매칭 시, 지역보다 장소로 검색을 우선시
        const reversedParts = [...queryParts].reverse();

        for (const part of reversedParts) {
            // 너무 짧은 단어는 제외 (오매칭 방지)
            if (part.length < 2) continue;

            const partMatchKey = mappingKeys.find(key => key.includes(part));
            if (partMatchKey) {
                console.warn(`[BackgroundManager] 키워드 분해 매치 보정: "${query}" -> ("${part}" 매치) -> "${partMatchKey}" -> "${backgroundMappings[partMatchKey]}"`);
                return `${basePath}/${backgroundMappings[partMatchKey]}`;
            }
        }
    }

    // ---------------------------------------------------------
    // 전략 4: 엄격한 폴백 (몰입감 보존)
    // ---------------------------------------------------------
    // 유저 선호: "틀린 배경보다는 차라리 배경이 없는 것이 낫다."
    console.warn(`[BackgroundManager] "${query}"에 대한 적절한 매치 없음. 빈 값 반환 (검은 화면).`);
    return '';
}
