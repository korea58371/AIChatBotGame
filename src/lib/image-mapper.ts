import { useGameStore } from './store';

// [Unified Emotion Map]
// Shared across 'wuxia' and 'god_bless_you' after standardization (Dec 2025).
// Final Standard Version - Contains only the canonical keys expected from the AI.
const unifiedEmotionMap: Record<string, string> = {
    // 1. Level-based Emotions (Intensity 1-3)
    "기쁨1": "Joy_Lv1", "기쁨2": "Joy_Lv2", "기쁨3": "Joy_Lv3",
    "화남1": "Anger_Lv1", "화남2": "Anger_Lv2", "화남3": "Anger_Lv3",
    "슬픔1": "Sadness_Lv1", "슬픔2": "Sadness_Lv2", "슬픔3": "Sadness_Lv3",
    "부끄1": "Shy_Lv1", "부끄2": "Shy_Lv2", "부끄3": "Shy_Lv3",
    "앙탈1": "CuteAngry_Lv1", "앙탈2": "CuteAngry_Lv2", "앙탈3": "CuteAngry_Lv3", // Cute/Affectionate Anger

    // 2. Independent Emotions (Special States)
    "안도": "Relieved", "안심": "Relieved",
    "삐짐": "Pouting",

    // 3. Comic Variants (Manhwa Style)
    "고양이": "CatFace",            // Cat-face Joy
    "음침": "DarkShadow",           // Gloomy/Depressed with vertical lines
    "어지러움": "Dizzy",            // Swirly eyes
    "멍함": "Dumbfounded",          // Blank stare / Dot eyes
    "당황": "Panic",                // Sweating/Panicking
    "충격": "Shock",                // Shocked blue face
    "반짝": "Sparkle",              // Sparkly eyes

    // 4. Standard Emotions (Attitude & Narrative States)
    "기본": "Default",
    "결의": "Determined",
    "경멸": "Disdain",
    "혐오": "Disgust",
    "냉담": "Cold",
    "취함": "Drunk",
    "기대": "Expectant",
    "여유": "Smug",
    "우쭐": "Smug",
    "지침": "Exhausted",
    "장난": "Prank", "메롱": "Prank", // Prank/Teasing
    "하트": "HeartEyes",
    "고통": "Pain",
    "유혹": "Seductive",
    "졸림": "Sleepy",
    "놀람": "Surprise",
    "고민": "Thinking",
    "광기": "Yandere"
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
    const availableExtraImages = state.availableExtraImages || [];

    // Base Path Construction
    const charBasePath = `/assets/${activeGameId}/characters`;
    const extraBasePath = `/assets/${activeGameId}/ExtraCharacters`;

    if (!koreanName || koreanName === 'Unknown' || koreanName === 'System') {
        return ''; // 빈 문자열 반환 (시스템이 처리하도록)
    }

    // [Overrides] Dynamic Mapping from <대사> input
    if (state.extraOverrides && state.extraOverrides[koreanName]) {
        const overrideKey = state.extraOverrides[koreanName];

        // 1. Check Extra Map for the override key
        if (extraMap[overrideKey]) {
            return `${extraBasePath}/${extraMap[overrideKey]}`;
        }

        // 2. Check Available Extra Images (Filename match with Emotion)
        const combinedKey = `${overrideKey}_${koreanEmotion}`;
        if (availableExtraImages.includes(combinedKey)) {
            return `${extraBasePath}/${combinedKey}.png`;
        }
    }

    // 1. 메인 캐릭터 매핑 확인
    const charId = charMap[koreanName];

    // 2. 감정 매핑 확인 (Unified Map)
    const emotionKeyword = unifiedEmotionMap[koreanEmotion] || 'Default';

    // Unified File Path Logic (No more _Default_ infix)
    const targetFilename = `${charId}_${emotionKeyword}`;
    const defaultFilename = `${charId}_Default`;

    // A. Direct File Match (Priority for Static Extras in Wuxia)
    // If input name is "마을의원_늙은" and it exists as a file, use it.
    if (availableExtraImages.includes(koreanName)) {
        return `${extraBasePath}/${koreanName}.png`;
    }

    // B. 메인 캐릭터인 경우
    if (charId) {
        // 1) 정확한 이미지가 있는가?
        if (availableImages.includes(targetFilename)) {
            return `${charBasePath}/${charId}/${targetFilename}.png`;
        }

        // 2) 매핑된 감정이 없으면 'Default'를 시도
        if (availableImages.includes(defaultFilename)) {
            return `${charBasePath}/${charId}/${defaultFilename}.png`;
        }

        // 3) Fallback: Return target path blindly if list is empty (Legacy behavior precaution)
        if (availableImages.length === 0) {
            return `${charBasePath}/${charId}/${targetFilename}.png`;
        }

        return '';
    }

    // C. 엑스트라 캐릭터 확인
    if (extraMap[koreanName]) {
        return `${extraBasePath}/${extraMap[koreanName]}`;
    }

    // [Fallback] Partial Match for Extra Characters (e.g., "낭인무사" -> "낭인무사남")
    const partialMatch = Object.keys(extraMap).find(key => key.startsWith(koreanName));
    if (partialMatch) {
        return `${extraBasePath}/${extraMap[partialMatch]}`;
    }

    // D. 매핑 실패
    return '';
}
