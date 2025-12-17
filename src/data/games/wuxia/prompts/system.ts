
export const getRankInfo = (fame: number) => {
    let playerRank = '삼류 무인';
    if (fame >= 500) playerRank = '천하제일인';
    else if (fame >= 100) playerRank = '절정 고수';
    else if (fame >= 10) playerRank = '일류 고수';

    let rankLogline = "";
    let rankKeywords = "";
    let rankGiftDesc = "";
    let rankConflict = "";

    switch (playerRank) {
        case '삼류 무인':
            rankLogline = "강호의 비정함을 맛보며 성장하는 삼류 무인의 이야기.";
            rankKeywords = "#성장물 #무협 #복수";
            rankGiftDesc = "특별한 내공심법이 없습니다.";
            rankConflict = ``;
            break;
        default:
            rankLogline = "강호의 전설이 될 자.";
            rankKeywords = "#무협";
            rankGiftDesc = "미지의 힘.";
            rankConflict = ``;
            break;
    }

    return { playerRank, rankLogline, rankKeywords, rankGiftDesc, rankConflict };
};

export const getSystemPromptTemplate = (state: any, language: 'ko' | 'en' | 'ja' | null = 'ko') => {
    const stats = state.playerStats || {};
    const { playerRank } = getRankInfo(stats.fame || 0);

    return `
### 1. 주인공 현재 상태
**신분**: ${playerRank}
**내공**: ${stats.mp} (MP)
**금전**: ${stats.gold}냥

### 2. 무협 세계관 규칙
1. **[강자존]**: 힘이 없는 자는 살아남기 힘들다.
2. **[의협심]**: 협의를 중시하나, 배신 또한 난무한다.
3. **[어투]**: 현대어가 아닌 무협체(하오체, 하게체 등)를 사용한다.

---

## [Current Context]
${state.worldInfo || "강호에 바람이 분다."}

## [Current Scenario]
${state.scenarioSummary || "이야기가 시작됩니다."}

## [Active Characters]
{{CHARACTER_INFO}}

---
Now, start the story.
`;
};
