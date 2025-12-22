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

const wuxiaEmotionMap: Record<string, string> = {
    // Level-based Emotions
    "기쁨1": "Joy_Lv1", "기쁨2": "Joy_Lv2", "기쁨3": "Joy_Lv3", // Joy
    "화남1": "Anger_Lv1", "화남2": "Anger_Lv2", "화남3": "Anger_Lv3", // Anger
    "슬픔1": "Sadness_Lv1", "슬픔2": "Sadness_Lv2", "슬픔3": "Sadness_Lv3", // Sadness
    "부끄1": "Shy_Lv1", "부끄2": "Shy_Lv2", "부끄3": "Shy_Lv3", // Shy

    // Comic Variants
    "고양이": "CatFace_Comic",
    "음침": "DarkShadow_Comic",
    "경멸": "Disdain_Comic",
    "어지러움": "Dizzy_Comic",
    "멍함": "Dumbfounded_Comic",
    "당황": "Panic_Comic",
    "충격": "Shock_Comic",
    "반짝": "Sparkle_Comic",

    // Standard Emotions
    "기본": "Default",
    "결의": "Determined",
    "혐오": "Disgust",
    "취함": "Drunk",
    "기대": "Expectant",
    "여유": "Smug",
    "하트": "HeartEyes",
    "고통": "Pain",
    "유혹": "Seductive",
    "졸림": "Sleepy",
    "놀람": "Surprise",
    "고민": "Thinking",
    "광기": "Yandere",

    // Fallbacks / Aliases
    "행복": "Joy_Lv2",
    "분노": "Anger_Lv2",
    "우울": "Sadness_Lv2",
    "수줍음": "Shy_Lv1",
    "진지함": "Determined", // Map to Determined? Or Default.
    "사랑": "HeartEyes",

    // [New] AI Hallucination Fixes
    "흥미": "Expectant",
    "웃음": "Joy_Lv2",
    "미소": "Joy_Lv1",
    "비웃음": "Disgust",
    "냉소": "Disgust",
    "짜증": "Anger_Lv1"
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

    // [New] Check Overrides (Dynamic Mapping from <대사>)
    if (state.extraOverrides && state.extraOverrides[koreanName]) {
        const overrideKey = state.extraOverrides[koreanName];
        // 1. Check Extra Map for the override key
        if (extraMap[overrideKey]) {
            return `${extraBasePath}/${extraMap[overrideKey]}`;
        }
        // 2. Check Available Extra Images (Filename match)
        // Note: availableExtraImages usually stores keys (Name_Emotion) without extension? 
        // VisualNovelUI code suggests it stores "Name_Emotion".
        // We need to match overrideKey + Emotion.
        const combinedKey = `${overrideKey}_${koreanEmotion}`;
        if (availableExtraImages.includes(combinedKey)) {
            return `${extraBasePath}/${combinedKey}.png`;
        }
        // 2. Check Main Character Map? (Optional, if we want to map Extra -> Main)
        // Let it fall through to main logic by swapping koreanName?
        // Or just recurse? Recursing is safer but infinite loop risk?
        // Let's just swap the lookup target for the main Logic logic below.
        // But existing code structure is linear.
        // Let's just return if found in Extra, otherwise assume key MIGHT be a direct filename or main char key?
    }

    // 1. 메인 캐릭터 매핑 확인
    const charId = charMap[koreanName];

    // 2. 감정 매핑 확인 (없으면 Default)
    // Game-specific Mapping
    let emotionKeyword = 'Default';
    let targetFilename = '';
    let defaultFilename = '';

    if (activeGameId === 'wuxia') {
        emotionKeyword = wuxiaEmotionMap[koreanEmotion] || 'Default';
        // Wuxia Format: CharName_Emotion.png (No intermediate 'Default')
        targetFilename = `${charId}_${emotionKeyword}.png`;
        defaultFilename = `${charId}_Default.png`;
    } else {
        // Legacy (God Bless You) Format: CharName_Default_Emotion.png
        emotionKeyword = emotionMap[koreanEmotion] || 'Default';
        targetFilename = `${charId}_Default_${emotionKeyword}.png`;
        defaultFilename = `${charId}_Default_Default.png`;
    }

    // A. Direct File Match (Priority for Wuxia Static Extras)
    // If the input name (Key) matches a file exactly, use it.
    // This handles cases where Wuxia extras are static images without emotion suffixes
    // e.g. "마을의원_늙은" -> "마을의원_늙은.png"
    if (availableExtraImages.includes(koreanName)) {
        return `${extraBasePath}/${koreanName}.png`;
    }

    // A. 메인 캐릭터인 경우
    if (charId) {
        // 1) 정확한 이미지가 있는가?
        if (availableImages.includes(targetFilename)) {
            return `${charBasePath}/${charId}/${targetFilename}`;
        }

        // 2) 매핑된 감정이 없으면 'Default'를 시도
        if (availableImages.includes(defaultFilename)) {
            return `${charBasePath}/${charId}/${defaultFilename}`;
        }

        // 3) List check fallback (Legacy logic, maybe unsafe for wuxia)
        // If we really can't find it, returning empty string is safer than a bad path.
        // But the original code returned targetFilename blind if list empty.
        if (availableImages.length === 0) {
            return `${charBasePath}/${charId}/${targetFilename}`;
        }

        return '';
    }

    // B. 엑스트라 캐릭터 확인
    if (extraMap[koreanName]) {
        return `${extraBasePath}/${extraMap[koreanName]}`;
    }

    // [Fix] Fallback search for Extra Characters (e.g. AI says "낭인무사" but key is "낭인무사남")
    // Find first key that starts with "Name"
    const partialMatch = Object.keys(extraMap).find(key => key.startsWith(koreanName));
    if (partialMatch) {
        return `${extraBasePath}/${extraMap[partialMatch]}`;
    }


    // C. 매핑 실패 (Fallback)
    return '';
}
