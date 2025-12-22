import { WUXIA_FIRST_TURN_EXAMPLE } from '../constants';
import martialArtsLevels from '../jsons/martial_arts_levels.json';

const realmHierarchy = martialArtsLevels.realm_hierarchy as Record<string, any>;

export const getRankInfo = (rankKey: string = '삼류') => {
    // 1. Determine Rank Key (Default: '이류' - Rule #1)
    let currentRankKey = '삼류';

    // Check if the provide key is valid in the hierarchy
    if (rankKey && realmHierarchy[rankKey]) {
        currentRankKey = rankKey;
    }
    // If not found, it stays as '이류'. Old fame logic is removed.

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

    // [Fix] Prioritize stored playerRank. Logic Model handles changes.
    const storedRankKey = stats.playerRank;
    const { playerRank, rankData } = getRankInfo(storedRankKey);
    const faction = stats.faction || '무소속';

    // Construct Skill List
    const skillList = (stats.skills || []).join(', ') || "없음 (기본 주먹질)";

    return `


${(!state.turnCount || state.turnCount <= 1) ? WUXIA_FIRST_TURN_EXAMPLE : ""}

---

### 1. 주인공 현재 상태
**소속**: ${faction}
**경지**: ${playerRank}
   - **단계**: ${rankData.status}
   - **능력**: ${rankData.capability}
**기력(MP)**: ${stats.mp}
**내공(갑자)**: ${stats.neigong || 0}년 
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

## [이벤트 가이드]
{{EVENT_GUIDE}}

- **<선택지N>Content**
- Choices for the user at the end.
- **STRICT RULE**: Do NOT include hints, stats, or effects in parentheses (e.g., "(Relationship + 1)" or "(Requires STR)").
- Just describe the action simply. Example: \`<선택지1>그녀에게 말을 건다.\` (O) / \`<선택지1>그녀에게 말을 건다(호감도 상승)\` (X)

---
이제 위 샘플 스타일을 따라 이야기를 시작하라.
`;
};
