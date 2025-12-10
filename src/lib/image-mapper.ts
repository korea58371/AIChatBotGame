import charMapData from '../../public/assets/characters/character_map.json';
import extraMapData from '../../public/assets/ExtraCharacters/extra_map.json';

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
    // 1. 메인 캐릭터 매핑 확인
    const charId = charMap[koreanName];

    // 2. 감정 매핑 확인 (없으면 Default)
    const emotion = emotionMap[koreanEmotion] || 'Default';

    // A. 메인 캐릭터인 경우
    if (charId) {
        return `/assets/characters/${charId}/${charId}_Default_${emotion}.png`;
    }

    // B. 엑스트라 캐릭터 확인
    // 엑스트라는 감정 표현이 (보통) 없으므로 단일 이미지 반환
    if (extraMap[koreanName]) {
        return `/assets/ExtraCharacters/${extraMap[koreanName]}`;
    }

    // C. 매핑 실패 (Fallback)
    return '/assets/characters/Unknown_Default_Default.png';
}
