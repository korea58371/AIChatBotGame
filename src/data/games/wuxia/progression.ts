
/**
 * Wuxia Progression Logic
 * Deterministic rank-up system replacing AI judgment.
 * 
 * Criteria: Both Level AND Neigong must meet the threshold.
 */

export interface WuxiaRankCriteria {
    id: string;
    title: string;
    minLevel: number;
    minNeigong: number; // Years
    message: string;
}

export const RANK_REQUIREMENTS: WuxiaRankCriteria[] = [
    { id: 'intro', title: '입문', minLevel: 1, minNeigong: 0, message: "무학의 기초에 발을 들였습니다." },
    { id: 'third_rate', title: '삼류', minLevel: 10, minNeigong: 0, message: "미약하지만 내공의 흐름을 느끼기 시작했습니다." },
    { id: 'second_rate', title: '이류', minLevel: 30, minNeigong: 10, message: "내공이 단전에 쌓이며 진정한 무인으로 거듭났습니다." },
    { id: 'first_rate', title: '일류', minLevel: 50, minNeigong: 20, message: "검 끝에 기를 실을 수 있는 경지에 올랐습니다." },
    { id: 'peak', title: '절정', minLevel: 70, minNeigong: 40, message: "검기를 자유자재로 다루며 강호의 고수로 인정받습니다." },
    { id: 'transcendent', title: '초절정', minLevel: 90, minNeigong: 60, message: "검강을 휘두르며 인간의 한계를 초월하기 시작했습니다." },
    { id: 'harmony', title: '화경', minLevel: 110, minNeigong: 120, message: "환골탈태. 육체의 한계를 벗어나 자연과 하나가 됩니다." },
    { id: 'mystic', title: '현경', minLevel: 130, minNeigong: 200, message: "반로환동. 이기에 도달하여 생사를 초월한 전설이 되었습니다." },
    { id: 'life_death', title: '생사경', minLevel: 160, minNeigong: 500, message: "신의 영역. 등선하여 무의 극치에 도달했습니다." }
];

export function checkRankProgression(stats: any, currentRankId: string | null): { newRankId: string, title: string, message: string } | null {
    if (!stats) return null;

    const currentLevel = stats.level || 1;
    const currentNeigong = stats.neigong || 0; // Years

    // Find the highest rank met
    // Iterate backwards to find the highest match instantly? 
    // Or iterate forward and keep the last valid one.
    let bestRank: WuxiaRankCriteria | null = null;

    for (const rank of RANK_REQUIREMENTS) {
        if (currentLevel >= rank.minLevel && currentNeigong >= rank.minNeigong) {
            bestRank = rank;
        }
    }

    if (!bestRank) return null; // Should not happen if 'intro' is 1/0

    // Check if better than current
    // Determine current index
    const currentIndex = RANK_REQUIREMENTS.findIndex(r => r.id === (currentRankId || 'intro'));
    const newIndex = RANK_REQUIREMENTS.findIndex(r => r.id === bestRank?.id);

    if (newIndex > currentIndex) {
        return {
            newRankId: bestRank.id,
            title: bestRank.title,
            message: bestRank.message
        };
    }

    return null;
}
