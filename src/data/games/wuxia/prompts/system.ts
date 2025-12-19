import { CORE_RULES, WUXIA_SYSTEM_PROMPT_CONSTANTS } from '../constants';
import martialArtsLevels from '../jsons/martial_arts_levels.json';
import factionsData from '../jsons/factions.json';

const realmHierarchy = martialArtsLevels.realm_hierarchy as Record<string, any>;

export const getRankInfo = (fame: number) => {
    // 1. Calculate Rank based on Fame
    let currentRankKey = '01_third_rate'; // Default
    const ranks = Object.keys(realmHierarchy).sort(); // Ensure sorted order

    for (const rankKey of ranks) {
        const rankData = realmHierarchy[rankKey];
        if (rankData.condition && fame >= rankData.condition.min_fame) {
            currentRankKey = rankKey;
        }
    }

    const rankData = realmHierarchy[currentRankKey];

    // 2. Generate Metadata
    const playerRank = rankData.name;
    const rankLogline = `[${rankData.name}] ${rankData.status}`;
    const rankKeywords = `#무협 #${rankData.archetype}`;
    const rankGiftDesc = rankData.capability;
    const rankConflict = ``;

    return {
        playerRank, // Display Name (e.g., "삼류 (Third Rate)")
        rankKey: currentRankKey,
        rankData,
        rankLogline,
        rankKeywords,
        rankGiftDesc,
        rankConflict
    };
};

export const getSystemPromptTemplate = (state: any, language: 'ko' | 'en' | 'ja' | null = 'ko') => {
    const stats = state.playerStats || {};
    const { playerRank, rankData } = getRankInfo(stats.fame || 0);
    const faction = stats.faction || '무소속';

    // Construct Skill List
    const skillList = (stats.skills || []).join(', ') || "없음 (기본 주먹질)";

    // Construct Realm Hierarchy Description for Context
    const hierarchyDesc = Object.values(realmHierarchy).map((r: any) =>
        `- **${r.name}**: ${r.capability} (Gap: ${r.power_gap || 'Significant'})`
    ).join('\n');

    return `
${WUXIA_SYSTEM_PROMPT_CONSTANTS}

### [무협 세계관: 무공 경지]
${hierarchyDesc}

---

### 1. 주인공 현재 상태
**소속**: ${faction}
**경지**: ${playerRank}
   - **단계**: ${rankData.status}
   - **능력**: ${rankData.capability}
**내공**: ${stats.mp} (MP)
**보유 무공**:
- **무공**: ${skillList}
- **내공심법**: ${stats.internalArt || '기본 토납법'}
- **경공**: ${stats.footwork || '기본 보법'}

**[전투 가이드라인]**:
주인공은 현재 **'${playerRank}'** 경지이다. 
- **${rankData.name}**의 한계: ${rankData.capability}
- 상위 경지와의 싸움은 자살행위이며, 동급이라도 방심하면 즉사한다.

---

## [현재 상황]
${state.worldInfo || "주인공은 강호의 냉혹함을 배우며 성장해 나간다."}

## [현재 시나리오]
${state.scenarioSummary || "이야기가 시작됩니다."}

## [등장 인물]
{{CHARACTER_INFO}}

---
이제 위 샘플 스타일을 따라 이야기를 시작하라.
`;
};
