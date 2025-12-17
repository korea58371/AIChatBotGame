import { useGameStore } from './store';

// 2. 감정 매핑 (하드코딩 - Shared across games for now, or move to data?)
// For now, keep it shared.
const emotionMap: Record<string, string> = {
    "자신감": "Confident",
    "의기양양": "Smug",
    "진지함": "Serious",
    "짜증": "Annoyed",
    "삐짐": "Pouting",
    "혐오": "Disgust",
    "고민": "Thinking",
    "박장대소": "BigLaugh",
    "안도": "Relieved",
    "놀람": "Surprised",
    "부끄러움": "Blushing",
    "결의": "Determined",
    "거친호흡": "Panting",
    "글썽거림": "TearingUp",
    "고통": "Pain",
    "공포": "Fear",
    "오열": "Crying",
    "수줍음": "Shy",
    "지침": "Exhausted",
    "폭발직전": "IntenseBlushing",
    // Fallback Mappings for common hallucinations
    "명랑": "BigLaugh",
    "당황": "Surprised",
    "기쁨": "BigLaugh",
    "행복": "BigLaugh",
    "슬픔": "Crying",
    "분노": "Annoyed",
    "사랑": "Blushing",
    "기본": "Default" // Explicit default mapping
};

/**
 * AI의 출력(한글)을 받아 실제 이미지 경로를 반환합니다.
 * @param koreanName AI가 출력한 이름 (예: "천서윤")
 * @param koreanEmotion AI가 출력한 감정 (예: "기쁨")
 */
export function getCharacterImage(koreanName: string, koreanEmotion: string): string {
    const state = useGameStore.getState();
    const charMap = state.characterMap || {};
    const extraMap = state.extraMap || {};
    const activeGameId = state.activeGameId || 'god_bless_you';
    const availableImages = state.availableCharacterImages || [];

    // Base Path Construction
    // Legacy mapping support: if we move files, we just use the new path.
    // We are moving files to /assets/<gameId>/...
    const charBasePath = `/assets/${activeGameId}/characters`;
    const extraBasePath = `/assets/${activeGameId}/ExtraCharacters`;

    // 0. 예외 처리: 이름이 없거나 'Unknown'인 경우
    if (!koreanName || koreanName === 'Unknown' || koreanName === 'System') {
        return ''; // 빈 문자열 반환 (시스템이 처리하도록)
    }

    // 1. 메인 캐릭터 매핑 확인
    const charId = charMap[koreanName];

    // 2. 감정 매핑 확인 (없으면 Default)
    const emotionKeyword = emotionMap[koreanEmotion] || 'Default';

    // A. 메인 캐릭터인 경우
    if (charId) {
        const targetFilename = `${charId}_Default_${emotionKeyword}.png`;

        // 1) 정확한 이미지가 있는가?
        if (availableImages.includes(targetFilename)) {
            return `${charBasePath}/${charId}/${targetFilename}`;
        }

        // 2) 매핑된 감정이 없으면 'Default'를 시도
        const defaultFilename = `${charId}_Default_Default.png`;
        if (availableImages.includes(defaultFilename)) {
            return `${charBasePath}/${charId}/${defaultFilename}`;
        }

        // 3) List check fallback
        if (availableImages.length === 0) {
            return `${charBasePath}/${charId}/${targetFilename}`;
        }

        return '';
    }

    // B. 엑스트라 캐릭터 확인
    if (extraMap[koreanName]) {
        return `${extraBasePath}/${extraMap[koreanName]}`;
    }

    // C. 매핑 실패 (Fallback)
    return '';
}
