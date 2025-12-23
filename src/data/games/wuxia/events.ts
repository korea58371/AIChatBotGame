
export interface GameEvent {
    id: string;
    condition: (state: any) => boolean;
    // Lower number = Higher priority (1 is highest)
    priority: number;
    prompt: string;
    type: 'narrative' | 'system';
    once: boolean;
    name?: string; // For UI or Debug
}

export const GAME_EVENTS: GameEvent[] = [
    {
        id: 'wuxia_intro',
        priority: 1, // Highest Priority (Intro)
        type: 'narrative',
        once: true,
        name: '강호출두',
        condition: (state) => (!state.turnCount || state.turnCount <= 3),
        prompt: `
        ## [EVENT: 강호출두 (Introduction)]
        주인공은 이제 막 강호에 발을 디딘 강호초출이다.
        현재 자신이 처한 상황(객잔 안이든 밖이든)에서 주위를 둘러보며, 앞으로의 여정을 기대하거나 걱정하는 장면으로 자연스럽게 시작하라.
        주변의 소란스러운 분위기와 주인공의 초라한 행색을 대조적으로 묘사하라.
        `
    },
    {
        id: 'realization_training',
        priority: 10,
        type: 'narrative',
        once: true,
        name: '깨달음과 수련',
        // Condition: 10+ turns AND Rank is still 'Third Rate' (삼류) or 'Second Rate' (이류)
        // Assumption: playerRank keys are '삼류', '이류', '일류', '절정', etc.
        condition: (state) => {
            const turn = state.turnCount || 0;
            const rank = state.playerStats?.playerRank || '삼류';
            return turn >= 10 && (rank === '삼류' || rank === '이류');
        },
        prompt: `
        ## [EVENT: 무학의 깨달음 (Martial Realization)]
        [Trigger]: 10턴이 지났음에도 주인공은 아직 경지의 벽을 넘지 못했다.
        불현듯 일상의 사소한 순간(떨어지는 낙엽, 흐르는 물, 혹은 타인의 대련)에서 무학의 이치를 깨닫는다.
        주인공이 깊은 생각에 잠기며 수련에 정진하고자 하는 의지를 다지는 장면을 묘사하라.
        `
    },
    {
        id: 'tournament_news',
        priority: 10,
        type: 'narrative',
        once: true,
        name: '비무대회 소식',
        // Condition: 20+ turns AND Rank is 'First Rate' (일류) or higher
        condition: (state) => {
            const turn = state.turnCount || 0;
            const rank = state.playerStats?.playerRank || '삼류';
            // Simple check: Not Third or Second rate implies First rate or higher
            const isHighRank = rank !== '삼류' && rank !== '이류';
            return turn >= 20 && isHighRank;
        },
        prompt: `
        ## [EVENT: 무림맹 비무대회 (Tournament Announcement)]
        [Trigger]: 주인공은 이제 강호에서 제법 이름을 알린 고수가 되었다.
        무림맹에서 후기지수(젊은 고수)들을 위한 비무대회를 개최한다는 소문이 들려온다.
        주변 인물들이 이 대회에 대해 흥분하며 떠드는 모습을 묘사하고, 주인공에게도 참가 권유가 들어오거나 관심이 생기는 상황을 연출하라.
        `
    },
    {
        id: 'blood_cult_appearance',
        priority: 5, // High Priority (Major Crisis)
        type: 'narrative',
        once: true,
        name: '혈교의 태동',
        // Condition: 50+ turns AND Rank is 'Peak' (절정) or higher
        // We need to check exact rank keys or standard comparison. 
        // For simplicity, let's assume if turn >= 50, strictly.
        // Or if user wants rank check:
        condition: (state) => {
            const turn = state.turnCount || 0;
            const rank = state.playerStats?.playerRank || '삼류';
            // Peak check: Usually '절정', '화경', '현경'
            const isPeakOrHigher = ['절정', '화경', '현경', '생사경'].includes(rank);
            return turn >= 50 && isPeakOrHigher;
        },
        prompt: `
        ## [EVENT: 혈교의 등장 (Rise of the Blood Cult)]
        [Trigger]: 강호의 균형이 무너지고 있다.
        오랫동안 자취를 감췄던 '혈교(Blood Cult)'의 무리들이 활동을 시작했다는 흉흉한 소문이 퍼진다.
        마을이나 객잔에서 의문의 실종 사건이나 기이한 죽음에 대한 이야기를 듣게 되며, 심상치 않은 전조를 묘사하라.
        평화롭던 일상에 드리우는 어두운 그림자를 강조하라.
        `
    }
];
