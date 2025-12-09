import charMapData from '../../public/assets/characters/character_map.json';

// 1. JSON 타입 명시 (Typescript)
const charMap: Record<string, string> = charMapData;

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
    "명랑": "BigLaugh", // or Confident? BigLaugh fits 'cheerful' better for expressions usually
    "당황": "Surprised",
    "기쁨": "BigLaugh",
    "행복": "BigLaugh",
    "슬픔": "Crying",
    "분노": "Annoyed",
    "사랑": "Blushing"
};

/**
 * AI의 출력(한글)을 받아 실제 이미지 경로를 반환합니다.
 * @param koreanName AI가 출력한 이름 (예: "천서윤")
 * @param koreanEmotion AI가 출력한 감정 (예: "기쁨")
 */
export function getCharacterImage(koreanName: string, koreanEmotion: string): string {
    // 1. 이름 매핑 확인
    const charId = charMap[koreanName];

    // 매핑된 ID가 없으면 기본값(Unknown) 또는 엑스트라 처리
    if (!charId) {
        // User request specifically asked to return this fallback
        // Note: Caller might need to check for ExtraCharacters if this returns Unknown.
        return '/assets/characters/Unknown_Default_Default.png'; // Fallback
    }

    // 2. 감정 매핑 확인 (없으면 Default)
    const emotion = emotionMap[koreanEmotion] || 'Default';

    // 3. 최종 경로 조합
    // 구조: {캐릭터ID}/{캐릭터ID}_{의상(Default)}_{감정}.png
    // 의상은 현재 "Default"로 고정
    return `/assets/characters/${charId}/${charId}_Default_${emotion}.png`;
}
