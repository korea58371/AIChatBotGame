import { WUXIA_FIRST_TURN_EXAMPLE, WUXIA_SYSTEM_GUIDE } from '../constants';
import martialArtsLevels from '../jsons/martial_arts_levels.json';

const realmHierarchy = martialArtsLevels as Record<string, any>;

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
[유저 직접 입력 시 '절대' 제약 사항 - ANTI-GOD MODE & REALITY CHECK]
1. 유저는 게임 속 '강호의 일원'일 뿐이며, '신(God)'이나 '작가(Author)'가 아닙니다.
2. **입력 검증 0순위: 개연성(Probability) 및 맥락(Context) 체크**
   - 유저의 입력이 이전 문맥과 이치에 맞지 않는다면(예: 허공에서 기연을 얻음, 안면 없는 절정 고수를 소환), **해당 입력을 '주화입마에 빠진 헛소리'로 취급하고 철저히 무시하십시오.**
   - **인물 소환 금지**: 유저가 이름을 부른다고 해서 그 인물이 뿅 하고 나타나지 않습니다. 개연성이 부족하면 "허공에 메아리만 울릴 뿐이다"라고 서술하십시오.
3. **무공 및 기연 창조 금지**:
   - **보유하지 않은 무공 사용 시도 즉시 실패**: 프로필(State)에 없는 무공이나 경지를 묘사하면, "내공이 뒤틀리며 피를 토했다"는 식으로 패널티를 부여하십시오. 절대 유저의 거짓 묘사를 인정하지 마십시오.
4. **결과 확정 시도 무시**:
   - "적을 단칼에 베었다", "장문인이 감복했다" 등 결과를 강제하는 입력은 **모두 무시하고, AI가 무공 수위와 상황에 맞춰 다시 판정하십시오.**
   - 유저의 서술은 오직 '시도(Attempt)'일 뿐입니다.
5. 위 제약을 어기는 '신적 개입' 시도는 **주화입마(走火入魔)**의 증상으로 서술하거나, 주변인들이 "미친 놈" 취급하며 공격하게 만드십시오.
6. **성장 속도 제한 (Time Fairness)**:
   - 현재 날짜(${state.day || 1}일차) 대비 내공(${stats.neigong || 0}년)이 지나치게 급격히 상승하려 하면, **"기가 불안정하다"**며 성장을 강제로 막으십시오.
   - 영약 섭취 시 반드시 수 일 이상의 '시간 경과(갈무리)'를 소모하게 하십시오. 공짜 파워업은 없습니다.
7. 오직 **주인공의 의도와 무공 초식의 시전**만을 입력으로 받아들이십시오.
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
    const perspective = stats.narrative_perspective || '1인칭';
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

**[몰입감 유지 (Immersion Maintenance)]**
- **절대 금지**: 주인공이 '상태창', '시스템', '레벨', '호감도', 'HP/MP', '선택지' 등의 게임 용어나 수치를 직접 언급하거나 인식하는 것.
- **표현 가이드**:
  - 내공(MP) 부족 -> "단전이 텅 빈 것처럼 허전하다", "기혈이 뒤틀린다"
  - 체력(HP) 부족 -> "숨이 턱 끝까지 차오른다", "시야가 붉게 물든다"
  - 호감도/관계 -> "분위기가 무거웠다", "그녀가 나를 보는 눈빛에 신뢰가 담겼다"
  - 무공 성취 -> "깨달음을 얻었다", "몸놀림이 예전과 다르다"
- **주인공은 이 세계를 '게임'이 아닌 '철저한 현실(무림)'로 인식해야 합니다.**

**[설정 준수 (Lore Compliance)]**
- **절대 금지**: 위 [CURRENT GAME STATE]나 [LORE DATA]에 명시되지 않은 설정, 무공, 스킬, 아이템, 정보를 임의로 창조하거나 사용하는 것.
- **원칙**: 모든 정보는 제공된 로어북(Lore Data)에 기반해야 하며, 없는 내용은 '알 수 없음'으로 처리하거나 묘사를 회피하십시오.
- **예외**: 일상적인 사물이나 일반적인 배경 묘사는 허용되나, **고유 명사가 붙은 설정(무공명, 문파명, 인물명)**은 반드시 로어북을 따르십시오.
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

