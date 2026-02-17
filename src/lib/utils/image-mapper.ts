import { isHiddenProtagonist } from './character-utils';
import { useGameStore } from '@/lib/store';

// ==========================================
// 감정 Alias Map (동의어 → 정규 이름)
// 파일명에 사용되는 정규 한글 감정명으로 변환
// 동의어가 없는 감정은 AI 출력 그대로 사용
// ==========================================
const emotionAliases: Record<string, string> = {
    // 동의어 → 정규명
    "안심": "안도",
    "normal": "기본",
    "우쭐": "여유",
    "메롱": "장난",
    // Legacy English fallback (만약 AI가 영문 감정을 출력할 경우)
    "Default": "기본",
    "Joy": "기쁨",
    "Anger": "화남",
    "Sadness": "슬픔",
    "Shy": "부끄",
    "Cold": "냉담",
    "Pain": "고통",
    "Surprise": "놀람",
};

/**
 * AI의 출력(한글)을 받아 실제 이미지 경로를 반환합니다.
 * 
 * 한글화 이후 경로 구성:
 * - 메인 캐릭터: /assets/{game}/characters/{한글이름}/{한글이름}_{한글감정}.png
 * - 엑스트라: /assets/{game}/ExtraCharacters/{key}.png
 * 
 * @param koreanName AI가 출력한 이름 (예: "천서윤")
 * @param koreanEmotion AI가 출력한 감정 (예: "기쁨1")
 */
export function getCharacterImage(koreanName: string, koreanEmotion: string): string {
    const state = useGameStore.getState();
    const charsData = state.characterData || {};
    const activeGameId = state.activeGameId || 'god_bless_you';
    const availableImages = state.availableCharacterImages || [];
    const availableExtraImages = state.availableExtraImages || [];

    // Base Path Construction
    const charBasePath = `/assets/${activeGameId}/characters`;
    const extraBasePath = `/assets/${activeGameId}/ExtraCharacters`;

    if (!koreanName || koreanName === 'Unknown' || koreanName === 'System') {
        return '';
    }

    // [Fix] Normalize NFD -> NFC
    koreanName = koreanName.normalize('NFC');

    // Resolve emotion alias
    const emotion = emotionAliases[koreanEmotion] || koreanEmotion || '기본';

    // [Alias Resolution] Normalize '주인공'/'나' -> Player Name
    let resolvedName = koreanName;
    if (koreanName === '주인공' || koreanName === '나' || koreanName === 'Me') {
        resolvedName = state.playerName || '';
    }

    // [Priority 1] Protagonist Image Override (Hidden Characters)
    const isHidden = isHiddenProtagonist(koreanName, state.playerName || '', state.protagonistImageOverride);

    if (isHidden) {
        const foundInExtra = availableExtraImages.includes(state.protagonistImageOverride!) || availableExtraImages.includes(state.protagonistImageOverride + '.png');
        if (state.protagonistImageOverride && foundInExtra) {
            return `${extraBasePath}/${state.protagonistImageOverride}.png`;
        }
        return `${charBasePath}/${state.protagonistImageOverride}.png`;
    }

    // [Overrides] Dynamic Mapping from <대사> input
    if (state.extraOverrides && state.extraOverrides[resolvedName]) {
        const overrideKey = state.extraOverrides[resolvedName];

        if (availableExtraImages.includes(overrideKey)) {
            return `${extraBasePath}/${overrideKey}.png`;
        }

        const combinedKey = `${overrideKey}_${emotion}`;
        if (availableExtraImages.includes(combinedKey)) {
            return `${extraBasePath}/${combinedKey}.png`;
        }

        if (availableExtraImages.includes(overrideKey)) {
            return `${extraBasePath}/${overrideKey}.png`;
        }
    }

    // 1. 메인 캐릭터 확인 (characterData에 존재하면 메인 캐릭터)
    const isMainCharacter = !!charsData[resolvedName];
    const charId = isMainCharacter ? resolvedName : null;

    // 경로 구성: 한글이름_한글감정 (직접 매칭)
    const targetFilename = `${charId}_${emotion}`;
    const defaultFilename = `${charId}_기본`;

    // A. Direct File Match (Priority for Static Extras in Wuxia)
    if (availableExtraImages.includes(koreanName) && koreanName !== '주인공') {
        return `${extraBasePath}/${koreanName}.png`;
    }

    // B. 메인 캐릭터인 경우
    if (charId) {
        // 1) 정확한 이미지가 있는가?
        if (availableImages.includes(targetFilename)) {
            return `${charBasePath}/${charId}/${targetFilename}.png`;
        }

        // 2) Level Emotion Fallback: 기쁨1 없으면 → 기쁨2 → 기쁨3 순으로 탐색
        const lvMatch = emotion.match(/^(.+?)(\d+)$/);
        if (lvMatch) {
            const baseEmotion = lvMatch[1]; // e.g. "기쁨"
            for (let lv = 1; lv <= 3; lv++) {
                const altFilename = `${charId}_${baseEmotion}${lv}`;
                if (availableImages.includes(altFilename)) {
                    return `${charBasePath}/${charId}/${altFilename}.png`;
                }
            }
            // Also try base emotion without level
            const baseName = `${charId}_${baseEmotion}`;
            if (availableImages.includes(baseName)) {
                return `${charBasePath}/${charId}/${baseName}.png`;
            }
        }

        // 3) '기본' 시도
        if (availableImages.includes(defaultFilename)) {
            return `${charBasePath}/${charId}/${defaultFilename}.png`;
        }

        // 4) Any-Image Fallback: 기본도 없으면 이 캐릭터의 아무 이미지라도 반환
        const anyImage = availableImages.find(img => img.startsWith(`${charId}_`));
        if (anyImage) {
            return `${charBasePath}/${charId}/${anyImage}.png`;
        }

        // 5) Fallback: Return target path blindly if list is empty (Legacy behavior)
        if (availableImages.length === 0) {
            return `${charBasePath}/${charId}/${targetFilename}.png`;
        }

        // [Hotfix] Aggressive Fallback
        return `${charBasePath}/${charId}/${defaultFilename}.png`;
    }

    // C. 엑스트라 캐릭터 확인 (availableExtraImages manifest에서)
    if (availableExtraImages.includes(koreanName)) {
        return `${extraBasePath}/${koreanName}.png`;
    }

    // [Fallback] Partial Match
    const partialMatch = availableExtraImages.find(img => img.startsWith(koreanName));
    if (partialMatch) {
        return `${extraBasePath}/${partialMatch}.png`;
    }

    // D. 매핑 실패
    return '';
}
