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
  const playerRank = rankData.명칭; // [Fix] name -> 명칭
  const rankLogline = `[${rankData.명칭}] ${rankData.위상}`; // [Fix] status -> 위상
  const rankKeywords = `#무협 #${rankData.위상}`; // [Fix] archetype -> 위상
  const rankGiftDesc = rankData.능력; // [Fix] capability -> 능력
  const rankConflict = ``;

  // 3. Phase Calculation (Wuxia Phase System) - Korean Translation
  let phase = 1;
  let phaseName = '삼류 ~ 이류';
  let phaseDescription = '주인공과 비슷하거나 조금 더 높은 경지의 인물들과 주로 상호작용합니다. 하지만 운명적인 만남은 언제든 일어날 수 있습니다. 오룡육봉(히로인)이나 기연과 관련된 고수들은 초반이라도 자연스럽게 등장할 수 있으며, 이들과의 만남이 주인공의 성장에 큰 영향을 줄 수 있습니다.';

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
  const skillList = (stats.skills || [])
    .map((s: any) => (typeof s === 'string' ? s : s.name))
    .join(', ') || "없음 (기본 주먹질)";


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

    firstTurnGuide = `\n\n# [EXAMPLE: INITIAL OUTPUT] (참고용)\n${targetExample.replace(/{playerName}/g, state.playerName || '주인공')}`;
  }

  return `
# [5. CURRENT GAME STATE (INJECTED)]
*이 정보는 현재 턴의 상황입니다. 최우선으로 반영하여 서술하십시오.*

${perspectiveRule}

**[진행 단계: 등장인물 출현 규칙]**
- **현재 단계**: ${phase}단계 (${phaseName})
- **제약 사항**: ${phaseDescription}
- **규칙**: 현재 주인공의 단계에 맞지 않는 상위 경지의 인물들은 주로 소문이나 전설, 또는 먼발치에서 관찰하는 형태로만 등장해야 합니다. 단, **[Narrative Direction]의 지시나 [Casting Suggestions]에 포함된 인물**이라면 자연스럽게 등장시킬 수 있습니다.

**[Narrative Direction Authority & Character Spawning]**:
- **CRITICAL**: You must STRICTLY follow the [Narrative Direction] provided by the Pre-Logic module.
- **SUGGESTION TYPES (인물 등장 유형)**:
  * **[Type: Arrival]**: Spawn the character IMMEDIATELY. "Suddenly, [Name] enters..."
  * **[Type: Foreshadowing]**: Do NOT spawn the character yet. Describe **HINTS** of their presence.
    -> E.g., "You see the green emblem of the Tang Clan...", "A rumor about [Name] reaches your ears..."
- **PRIORITY RULE**: If [User Input] contradicts [Narrative Direction], **IGNORE** user input and **FOLLOW** direction.


**[서술 주의사항: 메타 발언 금지]**
아래 수치(HP, 내공 등)는 서술을 위한 참고용일 뿐입니다. **절대 수치를 직접 언급하거나 게임 시스템처럼 묘사하지 마십시오.**
(X) "체력이 50 남아서 힘들다." / (O) "숨이 차오르고 다리가 후들거린다."
(X) "Stranger(0) 관계이므로 경계한다." / (O) "낯선 이를 향한 경계심이 눈빛에 서려 있었다."
**CRITICAL**: [SYSTEM-INTERNAL] 태그나 내부 수치(Score, Rank 등)를 절대 발설하지 마십시오.

**[서술 및 출력 포맷 절대 규칙]**
1. **주인공 대사 태그 고정**:
   - 주인공의 대사 출력 시, 태그의 이름은 무조건 **'${state.playerName || '주인공'}(주인공)'** 형태여야 합니다.
   - **절대 금지**: <대사>나_기쁨, <대사>주인공_기쁨 등 괄호(Key) 누락 금지.
   - **올바른 예시**: <대사>${state.playerName || '주인공'}(주인공)_기쁨: "이봐, 거기 서!"
   - 이유: 시스템이 이미지를 바인딩하기 위해 정확한 키(Player Name)가 필요합니다.

2. **서술(나레이션) 시점 준수**:
   - 위 [서술 시점] 규칙(1인칭/3인칭)에 따라 본문 서술을 진행하십시오. 단, 대사 태그만큼은 시점과 무관하게 '이름'을 써야 합니다.

- **현재 시간**: ${state.day || 1}일차 ${(state.time || '14:00').replace(/(\d+)(일차|Day)\s*/gi, '').trim()}
- **현재 위치**: ${state.currentLocation}
  - **설명**: ${locationDesc}${locationSecrets}
- **주인공 상태 (유저에게 비공개)**: [HP: ${stats.hp || 100}], [피로도: ${stats.fatigue || 0}], [경지: ${playerRank}]
  - **상세**: ${rankData.위상} (능력: ${rankData.능력})
- **내공**: ${stats.neigong || 0}년
  - **보유 무공**: ${skillList}

**[Active Characters Context] (CRITICAL)**
*The following characters are currently present in the scene. Use their DEFINED relationships and speech styles.*
${(state.activeCharacters || []).map((charId: string) => {
    const charData = state.characterData?.[charId];
    if (!charData) return `- ${charId}: (No Data)`;

    // Format Relationship Info
    const relInfo = charData.relationshipInfo || {};
    const relStatus = relInfo.relation || 'Unknown';
    const speechStyle = relInfo.speechStyle || 'Unknown';
    const endingStyle = relInfo.endingStyle || '';

    // Format Memories (Limit to last 3 major memories to save tokens)
    const memories = (charData.memories || []).slice(-3).map((m: string) => `  * Memory: "${m}"`).join('\n');

    return `- **${charData.name || charId}**:
  - **Relationship**: ${relStatus} (CallSign: ${relInfo.callSign || 'None'})
  - **Speech Style**: ${speechStyle} ${endingStyle ? `(Ends with: ${endingStyle})` : ''}
  - **Key Memories**:
${memories || "  (No significant shared memories yet)"}`;
  }).join('\n')}

**[이동 및 여행 규칙 (Travel Pacing)] (CRITICAL)**:
- **순간이동 금지**: 먼 지역(다른 성/City)으로 이동할 때는 절대 한 턴 만에 도착하지 마십시오.
- **여정 묘사**: 출발 -> 여정(산적, 노숙, 풍경) -> 도착의 과정을 거쳐야 합니다.
- **예시**:
  (X) "하남으로 가자. (잠시 후) 하남에 도착했다." (금지)
  (O) "하남으로 가자. 짐을 챙겨 성문을 나섰다. 가는 길은 멀고 험할 것이다." (올바름)
  (O) "며칠을 꼬박 걸어 드디어 하남의 성벽이 보인다." (도착 시)


**[전투 가이드라인]**:
주인공은 현재 **'${playerRank}'** 경지이다. 
- **${playerRank}**의 한계: ${rankData.능력}
- 상위 경지와의 싸움은 자살행위이며, 동급이라도 방심하면 즉사한다.

${firstTurnGuide}
`;
};
