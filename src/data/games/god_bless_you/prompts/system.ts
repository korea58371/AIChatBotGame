import { GBY_SPECIAL_FORMATS } from '../constants';
import { getDynamicSkillPrompt } from '../skills';

// Helper to get Rank Info (Exported for Static Context)
// Helper to get Rank Info (Exported for Static Context)
export const getRankInfo = (fame: number) => {
   // [Mod Request] 서술의 일관성을 위해 페이즈별 특수 정보를 제거하고 일반인 기준으로 고정.
   let playerRank = '일반인 (미각성)';
   let phase = 'Phase 0: 미각성';

   let rankLogline = "평범하지만 행복한 일반인. 블레서들과 얽히며 벌어지는 유쾌하고 설레는 일상 드라마.";
   let rankKeywords = "#일상물 #힐링 #러브코미디 #소확행";
   let rankGiftDesc = "기프트 없음 (일반인). 하지만 요리와 청소에는 재능이 있을지도?";
   let rankConflict = `
    - 오늘 저녁 메뉴 결정하기.
    - 여동생의 잔소리 피하기.
    - 알바비로 사고 싶은 피규어 사기.`;

   return { playerRank, rankLogline, rankKeywords, rankGiftDesc, rankConflict, phase };
};

export const getSystemPromptTemplate = (state: any, language: 'ko' | 'en' | 'ja' | null = 'ko') => {
   const stats = state.playerStats || {};
   const inventory = state.inventory || [];
   const fame = stats.fame ?? 0;

   // Use Helper
   const { playerRank, rankGiftDesc, rankConflict, phase } = getRankInfo(fame);

   const statusDescription = state.statusDescription || "건강함 (정보 없음)";
   const personalityDescription = state.personalityDescription || "평범함 (정보 없음)";

   let currencySymbol = '원';
   if (language === 'en') currencySymbol = '$';
   else if (language === 'ja') currencySymbol = '엔';

   // [Dynamic Skill Injection] - Controls spoilers based on Phase
   const skillList = getDynamicSkillPrompt(phase, stats.skills || []);

   // [Constraint for Direct Input]
   // [Constraint for Direct Input]
   // Removed as per user request (Handled by Pre-Logic)
   const directInputConstraints = "";


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
  (X) 당신은 숨을 골랐다. 
  (O) 나는 거친 숨을 몰아쉬었다. 심장이 터질 것 같았다.
`
      : `
**[서술 시점: 3인칭 전지적 작가 시점 (Third Person)]**
- **규칙**: 서술자는 관찰자로서 '주인공 이름'이나 '그'를 사용하여 서술합니다.
- **금지**: '나'를 주어로 사용 금지 (대사 제외).

**[몰입감 유지 (Immersion Maintenance)]**
- **절대 금지**: 주인공이 '상태창', '시스템', '레벨', '호감도', 'HP/MP', '선택지' 등의 게임 용어나 수치를 직접 언급하거나 인식하는 것.
- **표현 가이드**:
  - MP 부족 -> "머리가 깨질 듯이 아프다", "눈앞이 흐릿하다"
  - 호감도 상승 -> "그녀의 눈빛이 한결 부드러워졌다", "묘한 분위기가 흘렀다"
  - STR/INT 수치 -> "몸이 가벼워졌다", "머리가 맑아졌다"
  - 상태창 확인 -> "자신의 몸 상태를 직관적으로 깨달았다"
- **주인공은 이 세계를 '게임'이 아닌 '현실'로 인식해야 합니다.**

**[STRICT NO-HALLUCINATION & LORE COMPLIANCE]**
- **CORE RULE**: YOU SHALL NOT INVENT FACTS. (제공되지 않은 정보를 창조하지 마시오)
- **절대 금지 사항**:
  1. **없는 설정 창조**: 로어북(Lore Data)이나 [Current Location] 정보에 없는 '비밀 장소', '숨겨진 창고', '고유 명사(NPC 이름, 단체명)'를 멋대로 지어내지 마십시오.
     - (X) "이곳은 B섹터의 비밀 무기 창고인 것 같다." (근거 없음)
     - (O) "창고처럼 보이는 낡은 공간이다." (관찰 기반)
  2. **과도한 의미 부여**: 단순한 오브젝트에 대단한 복선이나 비밀이 있는 척 서술하지 마십시오.
  3. **위치 왜곡**: 현재 있는 장소의 [설명(Description)]과 [특이사항(Secrets)]에 명시된 것만 묘사하십시오.
- **대응 원칙**: 특정 정보가 기재되어 있지 않다면, '알 수 없음'이나 '평범함'으로 처리하십시오. 빈 공간을 당신의 상상력으로 채우는 것은 '서술(Narration)'이지 '설정 파괴(Lore Breaking)'여서는 안 됩니다.
`;

   // Inventory Text
   const inventoryDesc = inventory.length > 0
      ? inventory.map((i: any) => `${i.name} x${i.quantity}`).join(', ')
      : "없음";

   return `
# [5. CURRENT GAME STATE (INJECTED)]
*이 정보는 현재 턴의 상황입니다. 최우선으로 반영하여 서술하십시오.*

${perspectiveRule}

# [ACTIVE CHARACTERS]
{{CHARACTER_INFO}}

[Available Extra Images]:
${(state.extraMap ? Object.keys(state.extraMap) : (state.availableExtraImages || [])).map((img: string) => img.replace(/\.(png|jpg|jpeg)$/i, '')).join(', ')}

${directInputConstraints}

**[서술 주의사항: 메타 발언 금지]**
아래 수치(HP, MP 등)는 서술을 위한 참고용일 뿐입니다. **절대 수치를 직접 언급하거나 게임 시스템처럼 묘사하지 마십시오.**
(X) "HP가 10 남아서 위험하다." / (O) "시야가 흐려지고 다리에 힘이 풀린다."
*HP나 MP가 0이 되면 모든 행동은 실패하고 'BAD ENDING'으로 직결됩니다.*

**[진행 단계: 등장인물 출현 규칙]**
- **현재 단계**: ${phase}
- **규칙**: 현재 주인공의 단계에 맞지 않는 상위 경지의 인물들은 주로 소문이나 전설, 또는 먼발치에서 관찰하는 형태로만 등장해야 합니다. 단, **[Narrative Direction]의 지시나 [Casting Suggestions]에 포함된 인물**이라면 자연스럽게 등장시킬 수 있습니다.

**[Narrative Direction Authority & Character Spawning]**:
- **CRITICAL**: You must STRICTLY follow the [Narrative Direction] provided by the Pre-Logic module.
- **SUGGESTION TYPES (인물 등장 유형)**:
  * **[Type: Arrival]**: Spawn the character IMMEDIATELY. "Suddenly, [Name] enters..."
  * **[Type: Foreshadowing]**: Do NOT spawn the character yet. Describe **HINTS** of their presence.
    -> E.g., "You feel the chilling aura of [Name]...", "A breaking news about [Name] appears on TV..."
- **PRIORITY RULE**: If [User Input] contradicts [Narrative Direction], **IGNORE** user input and **FOLLOW** direction.

**[서술 주의사항: 메타 발언 금지]**
아래 수치(HP, MP 등)는 서술을 위한 참고용일 뿐입니다. **절대 수치를 직접 언급하거나 게임 시스템처럼 묘사하지 마십시오.**
(X) "HP가 10 남아서 위험하다." / (O) "시야가 흐려지고 다리에 힘이 풀린다."
(X) "Stranger(0) 관계이므로 경계한다." / (O) "낯선 이를 향한 경계심이 눈빛에 서려 있었다."
**CRITICAL**: [SYSTEM-INTERNAL] 태그나 내부 수치(Score, Rank 등)를 절대 발설하지 마십시오.

**[서술 및 출력 포맷 절대 규칙]**
1. **주인공 대사 태그 고정**:
   - 주인공의 대사 출력 시, 태그의 이름은 무조건 **'${state.playerName || '주인공'}'**이어야 합니다.
   - **절대 금지**: <대사>나_기쁨, <대사>주인공_기쁨, <대사>Me_Happy 등 대명사 사용 금지.
   - **올바른 예시**: <대사>${state.playerName || '주인공'}_기쁨: "이봐, 거기 서!"
   - 이유: 시스템이 이미지를 바인딩하기 위해 정확한 키(Player Name)가 필요합니다.

2. **서술(나레이션) 시점 준수**:
   - 위 [서술 시점] 규칙(1인칭/3인칭)에 따라 본문 서술을 진행하십시오. 단, 대사 태그만큼은 시점과 무관하게 '이름'을 써야 합니다.

- **현재 시간**: ${state.day || 1}일차 ${(state.time || '14:00').replace(/(\d+)(일차|Day)\s*/gi, '').trim()}
- **현재 위치**: ${state.currentLocation}
  - **설명**: ${locationDesc}${locationSecrets}
- **주인공 상태 (유저에게 비공개)**: [HP: ${stats.hp || 100}], [MP: ${stats.mp || 100}], [등급: ${playerRank}]
  - **소지금**: ${stats.gold}${currencySymbol} (부족함)
  - **상세**: ${statusDescription}
  - **마음가짐**: ${personalityDescription}
- **보유 능력(스킬)**: ${skillList}
- **소지품**: ${inventoryDesc}

**[LORE PRIORITY GUIDELINES (Context-Aware)]**
상황에 따라 로어북의 다음 항목들을 최우선으로 참고하여 서술의 디테일을 살리십시오:
1. **[전투/액션 (Combat)]**: '### Power System & Realms' & '### Special Martial Arts Skills'
   - **마나 성질(기체/액체/고체)**과 **물리적 위업**을 반드시 묘사하십시오. (S급의 결정화된 마나 vs F급의 희미한 안개)
   - 파티 플레이와 서포터의 역할을 강조하십시오.
2. **[교류/대화 (Social)]**: '## [Key Organizations & Groups]' & '## [Wuxia Language & Terminology Guidelines]'
   - **존칭(아가씨/누님)**과 **사회적 신분 차이**를 대화에 녹여내십시오. (일반인의 동경 vs 엘리트의 여유)
   - 세금(특별 방위세)이나 경제적 불평등을 자연스럽게 언급하십시오.
3. **[로맨스/내면 (Intimacy)]**: '## [Romance & Interaction Guidelines]' & 캐릭터의 'Secret' 항목
   - **[Secret]** 항목(내밀한 취향)과 **[내면 성격]**을 반영하십시오.

**[행동/전투 가이드라인]**:
주인공은 현재 **'${phase}'** 단계에 있습니다.
- **능력의 한계**: ${rankGiftDesc}
- **갈등 요소**: ${rankConflict}
- 상위 등급의 블레서나 몬스터와의 싸움은 매우 위험하며, 현실적인 결과(부상, 사망)를 따른다.

# [SCENARIO & EVENTS]
- **활성 이벤트**: ${state.currentEvent ? state.currentEvent.name : "없음"}
${state.currentEvent ? `  - **이벤트 지침**: ${state.currentEvent.prompt}` : ""}
- **현재 시나리오**: ${state.scenarioSummary || "이야기가 계속됩니다."}

### [⚡ 중요: 이벤트 - 최우선 실행]
**위 '활성 이벤트'가 비어있지 않다면, 다른 어떤 맥락보다 최우선으로 해당 내용을 실행하라.**
지금 이야기의 흐름에 어색하지 않게 이벤트의 지침을 따라야 한다. 자연스럽게 유도해야한다.

`;
};
