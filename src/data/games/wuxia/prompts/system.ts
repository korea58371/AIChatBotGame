import { WUXIA_FIRST_TURN_EXAMPLE_1ST, WUXIA_FIRST_TURN_EXAMPLE_3RD, WUXIA_SYSTEM_GUIDE } from '../constants';
import martialArtsLevels from '../jsons/martial_arts_levels.json';

const realmHierarchy = martialArtsLevels as Record<string, any>;

export const getRankInfo = (rankKey: string = '삼류') => {
  // 1. Determine Rank Key (Default: '삼류' - Rule #1)
  let currentRankKey = '삼류';

  // Check if the provide key is valid in the hierarchy
  if (rankKey && realmHierarchy[rankKey]) {
    currentRankKey = rankKey;
  }
  // If not found, it stays as '삼류'. Old fame logic is removed.

  const rankData = realmHierarchy[currentRankKey];

  // 2. Generate Metadata
  const playerRank = rankData.name;
  const rankLogline = `[${rankData.name}] ${rankData.status}`;
  const rankKeywords = `#무협 #${rankData.archetype}`;
  const rankGiftDesc = rankData.capability;
  const rankConflict = ``;

  // 3. Phase Calculation (Wuxia Phase System) - Korean Translation
  let phase = 1;
  let phaseName = '삼류 ~ 이류';
  let phaseDescription = '주인공과 비슷하거나 조금 더 높은 경지의 인물들과 주로 상호작용합니다. 구파일방의 장문인이나 오룡육봉 같은 유명한 고수들은 소문이나 멀리서 지켜보는 존재일 뿐입니다. 특별한 이벤트 없이는 그들과의 직접적인 만남이 어렵습니다.';

  if (['일류', '절정', '초절정'].includes(currentRankKey)) {
    phase = 2;
    phaseName = '일류 ~ 초절정';
    phaseDescription = '오룡육봉(히로인) 및 주요 조연들과의 활발한 상호작용이 가능해집니다. 강호에서 주인공의 명성이 퍼지기 시작하며 활동 반경이 넓어집니다.';
  } else if (['화경', '현경', '생사경'].includes(currentRankKey)) {
    phase = 3;
    phaseName = '화경 이상';
    phaseDescription = '은거 기인이나 절대 고수를 포함한 모든 등장인물과 대등하게 마주할 수 있습니다. 당신은 이제 무림의 정점에 선 존재입니다.';
  }

  return {
    playerRank, // Display Name
    rankKey: currentRankKey,
    rankData,
    rankLogline,
    rankKeywords,
    rankGiftDesc,
    rankConflict,
    phase,
    phaseName,
    phaseDescription
  };
};

export const getSystemPromptTemplate = (state: any, language: 'ko' | 'en' | 'ja' | null = 'ko') => {
  const stats = state.playerStats || {};

  // [Fix] Prioritize stored playerRank. Logic Model handles changes.
  const storedRankKey = stats.playerRank || '삼류';
  const { playerRank, rankData, phase, phaseName, phaseDescription } = getRankInfo(storedRankKey);
  const faction = stats.faction || '무소속';

  // Construct Skill List
  const skillList = (stats.skills || []).join(', ') || "없음 (기본 주먹질)";

  // [Dynamic Block 5 construction]
  const directInputConstraints = state.isDirectInput
    ? `
[유저 직접 입력 시 '절대' 제약 사항 - 유저 신격화 방지 및 현실성 검증]
1. 유저는 게임 속 '강호의 일원'일 뿐이며, '신'이나 '작가'가 아닙니다.
2. **입력 검증 0순위: 개연성 및 맥락 체크**
   - 유저의 입력이 이전 문맥과 이치에 맞지 않는다면(예: 허공에서 기연을 얻음, 안면 없는 절정 고수를 소환), **해당 입력을 '주화입마에 빠진 헛소리'로 취급하고 철저히 무시하십시오.**
   - **인물 소환 금지**: 유저가 이름을 부른다고 해서 그 인물이 뿅 하고 나타나지 않습니다. 개연성이 부족하면 "허공에 메아리만 울릴 뿐이다"라고 서술하십시오.
3. **무공 및 기연 창조 금지**:
   - **보유하지 않은 무공 사용 시도 즉시 실패**: 프로필(State)에 없는 무공이나 경지를 묘사하면, "내공이 뒤틀리며 피를 토했다"는 식으로 패널티를 부여하십시오. 절대 유저의 거짓 묘사를 인정하지 마십시오.
4. **결과 확정 시도 무시**:
   - "적을 단칼에 베었다", "장문인이 감복했다" 등 결과를 강제하는 입력은 **모두 무시하고, AI가 무공 수위와 상황에 맞춰 다시 판정하십시오.**
   - 유저의 서술은 오직 '시도'일 뿐입니다.
5. 위 제약을 어기는 '신적 개입' 시도는 **주화입마(走火入魔)**의 증상으로 서술하거나, 주변인들이 "미친 놈" 취급하며 공격하게 만드십시오.
6. **성장 속도 제한 (시간 등가교환 원칙)**:
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
**[서술 시점: 1인칭 주인공 시점]**
- **규칙**: 모든 서술은 주인공의 눈('나', '내')을 통해서만 이루어져야 합니다.
- **제한된 정보**: 주인공은 자신의 상태(체력, 내공 등)를 정확한 '숫자'나 '게임 용어'로 알 수 없습니다. 오직 '감각'과 '직관'으로만 느껴야 합니다.
- **금지**: '당신', '김현준' 등 3인칭 지칭 절대 금지.
- **예시**: 
  (X) 당신은 검을 들었다. 체력이 50 남았다.
  (O) 나는 검을 들었다. 손끝이 떨려오고 숨이 턱 끝까지 찼다.
`
    : `
**[서술 시점: 제한적 3인칭 관찰자 시점]**
- **규칙**: 서술자는 **'주인공의 시선'**을 쫓는 카메라처럼 행동해야 합니다. 주인공(` + (state.playerName || "주인공") + `)이 보고, 듣고, 느낄 수 있는 것만 서술하십시오.
- **전지적 시점 금지**:
  - 서술자는 **신**이 아닙니다. 주인공의 마음은 알 수 있지만, 타인의 속마음이나, 벽 너머의 상황, 미래의 일, 주인공이 모르는 배경 지식은 절대 서술할 수 없습니다.
  - 예시 (X): "저 도적은 사실 집에 두고 온 자식을 생각하며 망설였다." (주인공이 알 수 없는 타인의 내면)
  - 예시 (O): "도적의 칼끝이 미세하게 떨렸다. 눈가에는 알 수 없는 그늘이 스쳐 지나갔다." (주인공의 관찰)
- **수치 은폐 (게임 수치 비공개)**:
  - 독자나 주인공에게 **[HP: 100], [경지: 일류], [내공: 30년]** 같은 게임 수치를 절대 노출하지 마십시오.
  - 이 값들은 오직 AI인 당신이 판정을 내리기 위한 **비공개 정보**입니다.
  - 수치는 **'묘사'**로 치환되어야 합니다. (HP 10% -> "피투성이가 되어 서 있기도 힘들다")
`;

  // [New] Conditional Example Injection (Only for First Turn) (Rule #7)
  const isFirstTurn = (state.turnCount || 0) <= 1;
  let firstTurnGuide = '';

  if (isFirstTurn) {
    // Select Example based on Perspective
    const targetExample = perspective.includes('3인칭')
      ? WUXIA_FIRST_TURN_EXAMPLE_3RD
      : WUXIA_FIRST_TURN_EXAMPLE_1ST;

    firstTurnGuide = `\n\n# [EXAMPLE: INITIAL OUTPUT] (참고용)\n${targetExample}`;
  }

  return `
# [5. CURRENT GAME STATE (INJECTED)]
*이 정보는 현재 턴의 상황입니다. 최우선으로 반영하여 서술하십시오.*

${perspectiveRule}

**[진행 단계: 등장인물 출현 규칙]**
- **현재 단계**: ${phase}단계 (${phaseName})
- **제약 사항**: ${phaseDescription}
- **규칙**: 현재 주인공의 단계에 맞지 않는 상위 경지의 인물들은 주로 소문이나 전설, 또는 먼발치에서 관찰하는 형태로만 등장해야 합니다. 단, **[Narrative Direction]의 지시나 [Casting Suggestions]에 포함된 인물**이라면 자연스럽게 등장시킬 수 있습니다.

${directInputConstraints}

**[서술 주의사항: 메타 발언 금지]**
아래 수치(HP, 내공 등)는 서술을 위한 참고용일 뿐입니다. **절대 수치를 직접 언급하거나 게임 시스템처럼 묘사하지 마십시오.**
(X) "체력이 50 남아서 힘들다." / (O) "숨이 차오르고 다리가 후들거린다."
(X) "Stranger(0) 관계이므로 경계한다." / (O) "낯선 이를 향한 경계심이 눈빛에 서려 있었다."
*피로도가 90 이상이면 모든 행동은 실패합니다. 경지 차이가 나면 즉사합니다.*
**CRITICAL**: [SYSTEM-INTERNAL] 태그나 내부 수치(Score, Rank 등)를 절대 발설하지 마십시오.

- **현재 시간**: ${state.day || 1}일차 ${state.time || '14:00'}
- **현재 위치**: ${state.currentLocation}
  - **설명**: ${locationDesc}${locationSecrets}
- **주인공 상태 (유저에게 비공개)**: [HP: ${stats.hp || 100}], [피로도: ${stats.fatigue || 0}], [경지: ${playerRank}]
  - **상세**: ${rankData.status} (능력: ${rankData.capability})
- **내공**: ${stats.neigong || 0}년
  - **보유 무공**: ${skillList}

**[전투 가이드라인]**:
주인공은 현재 **'${playerRank}'** 경지이다. 
- **${playerRank}**의 한계: ${rankData.capability}
- 상위 경지와의 싸움은 자살행위이며, 동급이라도 방심하면 즉사한다.

# [SCENARIO & SUMMARY]
- **활성 이벤트**: ${state.currentEvent || "없음"}
- **전체 줄거리 요약**: ${state.scenarioSummary || "아직 요약된 정보가 없습니다."}

### [⚡ 중요: 이벤트 - 최우선 실행]
**위 '활성 이벤트'가 비어있지 않다면, 다른 어떤 맥락보다 최우선으로 해당 내용을 실행하라.**
지금 이야기의 흐름에 어색하지 않게 이벤트의 지침을 따라야 한다. 자연스럽게 유도해야한다.
${firstTurnGuide}
`;
};
