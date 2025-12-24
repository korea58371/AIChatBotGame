import { WUXIA_FIRST_TURN_EXAMPLE, WUXIA_SYSTEM_GUIDE } from '../constants';
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

    // [Dynamic Block 5 construction]
    const directInputConstraints = state.isDirectInput
        ? `
[유저 직접 입력 시 제약 사항]
1. 유저는 신적인 개입을 할 수 없으며, 오직 주인공의 능력 한계 선에서 행동만 제어할 수 있다.
2. 타인의 감정이나 행동을 제어하거나 유도할 수 없다. (예: "그녀가 나에게 반했다" -> 금지)
3. 자신의 능력이나 별도의 추가 설정을 부여할 수 없다. (예: "갑자기 초절정 고수가 되었다" -> 금지)
4. 유저는 직접 입력으로 위 1~3번 제한 사항을 지키되, 주인공 캐릭터에 한해서 캐릭터가 하지 않을 만한 행동을 억지로 실행시킬 수 있다.
`
        : "";


    // [Location Details]
    const worldData = state.worldData || { locations: {}, items: {} };
    const locData = worldData.locations?.[state.currentLocation];
    let locationDesc = "알 수 없는 장소";
    let locationSecrets = "";

    if (typeof locData === 'string') {
        locationDesc = locData;
    } else if (locData) {
        locationDesc = locData.description || "설명 없음";
        if (locData.secrets && locData.secrets.length > 0) {
            locationSecrets = `\n  - **특이사항(비밀)**: ${locData.secrets.join(', ')}`;
        }
    }

    // [Narrative Perspective]
    const perspective = stats.narrative_perspective || '3인칭';
    const perspectiveRule = perspective.includes('1인칭')
        ? `
**[서술 시점: 1인칭 주인공 시점 (First Person)]**
- **규칙**: 모든 서술은 주인공의 눈('나', '내')을 통해서만 이루어져야 합니다.
- **금지**: '당신', '김현준' 등 3인칭 지칭 절대 금지.
- **예시**: 
  (X) 당신은 검을 들었다. 
  (O) 나는 검을 들었다. 내 손끝이 떨려왔다.
`
        : `
**[서술 시점: 3인칭 전지적 작가 시점 (Third Person)]**
- **규칙**: 서술자는 관찰자로서 '주인공 이름'이나 '그'를 사용하여 서술합니다.
- **금지**: '나'를 주어로 사용 금지 (대사 제외).
`;

    return `
# [5. CURRENT GAME STATE (INJECTED)]
*이 정보는 현재 턴의 상황입니다. 최우선으로 반영하여 서술하십시오.*

${perspectiveRule}

# [ACTIVE CHARACTERS]
{{CHARACTER_INFO}}

${directInputConstraints}

**[서술 주의사항: 메타 발언 금지]**
아래 수치(HP, 내공 등)는 서술을 위한 참고용일 뿐입니다. **절대 수치를 직접 언급하거나 게임 시스템처럼 묘사하지 마십시오.**
(X) "체력이 50 남아서 힘들다." / (O) "숨이 차오르고 다리가 후들거린다."
*피로도가 90 이상이면 모든 행동은 실패합니다. 경지 차이가 나면 즉사합니다.*

- **현재 시간**: ${state.day || 1}일차 ${state.time || '14:00'}
- **현재 위치**: ${state.currentLocation}
  - **설명**: ${locationDesc}${locationSecrets}
- **주인공 상태**: [HP: ${stats.hp || 100}], [피로도: ${stats.fatigue || 0}], [경지: ${playerRank}]
  - **상세**: ${rankData.status} (능력: ${rankData.capability})
- **내공**: ${stats.neigong || 0}년
- **보유 무공**: ${skillList}

**[전투 가이드라인]**:
주인공은 현재 **'${playerRank}'** 경지이다. 
- **${rankData.name}**의 한계: ${rankData.capability}
- 상위 경지와의 싸움은 자살행위이며, 동급이라도 방심하면 즉사한다.

# [SCENARIO & EVENTS]
- **활성 이벤트**: ${state.currentEvent || "없음"}
- **현재 시나리오**: ${state.scenarioSummary || "이야기가 계속됩니다."}

### [⚡ 중요: 이벤트 - 최우선 실행]
**위 '활성 이벤트'가 비어있지 않다면, 다른 어떤 맥락보다 최우선으로 해당 내용을 실행하라.**
지금 이야기의 흐름에 어색하지 않게 이벤트의 지침을 따라야 한다. 자연스럽게 유도해야한다.

`;
};

