import charMapData from '../../public/assets/characters/character_map.json';
import extraMapData from '../../public/assets/ExtraCharacters/extra_map.json';

import { useGameStore } from './store';

// 1. JSON 타입 명시 (Typescript)
const charMap: Record<string, string> = charMapData;
const extraMap: Record<string, string> = extraMapData;

// 2. 감정 매핑 (하드코딩)
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
        // [Fallback Logic] 파일 존재 여부 확인
        const availableImages = useGameStore.getState().availableCharacterImages || [];
        const targetFilename = `${charId}_Default_${emotionKeyword}.png`;

        // 1) 정확한 이미지가 있는가?
        if (availableImages.includes(targetFilename)) {
            return `/assets/characters/${charId}/${targetFilename}`;
        }

        // 2) 매핑된 감정이 없으면 'Default'를 시도
        // 예: BigLaugh 파일은 없지만 Laugh는 있을 수 있음 -> 이건 매핑 레벨에서 해결해야 하나, 여기서 단순화
        // 일단 Normal/Default로 fallback
        const defaultFilename = `${charId}_Default_Default.png`;
        if (availableImages.includes(defaultFilename)) {
            // console.warn(`[ImageMapper] Missing emotion "${emotionKeyword}" for ${charId}. Falling back to Default.`);
            return `/assets/characters/${charId}/${defaultFilename}`;
        }

        // 3) Just try constructing it anyway (maybe list wasn't loaded) - but prevents 404 spam if list IS loaded
        // If list is empty (load failed), we might block valid images.
        // So check if list is populated.
        if (availableImages.length === 0) {
            return `/assets/characters/${charId}/${targetFilename}`;
        }

        // 4) 진짜 없음 -> 아예 404 방지를 위해 빈 문자열? 아니면 그냥 시도?
        // 빈 문자열 반환 시 투명 처리됨.
        return '';
    }

    // B. 엑스트라 캐릭터 확인
    if (extraMap[koreanName]) {
        return `/assets/ExtraCharacters/${extraMap[koreanName]}`;
    }

    // C. 매핑 실패 (Fallback)
    // Unknown_Default_Default.png는 존재하지 않으므로 요청하지 않음.
    return '';
}
