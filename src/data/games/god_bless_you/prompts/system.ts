import { GBY_SPECIAL_FORMATS } from '../constants';
import { getDynamicSkillPrompt } from '../skills';

// Phase Data Map — playerRank 기반 동적 Phase 매핑
const PHASE_DATA: Record<string, {
   phase: string;
   rankLogline: string;
   rankKeywords: string;
   rankGiftDesc: string;
   rankConflict: string;
}> = {
   '일반인': {
      phase: 'Phase 0: 미각성',
      rankLogline: "평범하지만 행복한 일반인. 블레서들과 얽히며 벌어지는 유쾌하고 설레는 일상 드라마.",
      rankKeywords: "#일상물 #힐링 #러브코미디 #소확행",
      rankGiftDesc: "기프트 없음 (일반인). 하지만 요리와 청소에는 재능이 있을지도?",
      rankConflict: `
    - 오늘 저녁 메뉴 결정하기.
    - 여동생의 잔소리 피하기.
    - 알바비로 사고 싶은 피규어 사기.`,
   },
   'F급': {
      phase: 'Phase 1: 갓생 사는 프리터',
      rankLogline: "미약하지만 마나를 느끼기 시작한 신참 각성자. 소시민적 일상과 능력 사이에서 갈팡질팡.",
      rankKeywords: "#각성초기 #소시민 #힘숨찐 #러브코미디",
      rankGiftDesc: "생활형 능력 (F급). 전투력은 미미하지만, 일상에 도움이 되는 소소한 능력.",
      rankConflict: `
    - 능력을 남에게 들키지 않기.
    - 알바와 수련 병행의 고달픔.
    - 블레서들의 관심을 은근히 즐기면서도 부담스러움.`,
   },
   'E급': {
      phase: 'Phase 1: 갓생 사는 프리터',
      rankLogline: "기초적인 이능력을 사용할 수 있게 된 성장기. 작은 성취가 쌓이는 시기.",
      rankKeywords: "#성장 #수련 #소시민 #힘숨찐",
      rankGiftDesc: "기초적인 이능력 사용 가능. 일반인보다는 강하지만 아직 프로 헌터와는 거리가 멀다.",
      rankConflict: `
    - 능력 제어의 불안정함.
    - 수련과 일상의 양립.
    - 자신의 정체를 아는 사람이 조금씩 늘어남.`,
   },
   'D급': {
      phase: 'Phase 2: 유쾌한 해결사',
      rankLogline: "공인 헌터 자격을 획득한 해결사. 주변에서 작은 사건들을 해결하며 이름을 알린다.",
      rankKeywords: "#헌터 #성장 #사건해결 #러브코미디",
      rankGiftDesc: "공인 헌터 (D급). 소규모 균열과 하급 이계종 처리 가능. 길드 취업 자격 획득.",
      rankConflict: `
    - 위험한 의뢰와 안전한 일상 사이의 선택.
    - 주변 사람들의 걱정과 기대.
    - 길드 가입 또는 프리랜서 고민.`,
   },
   'C급': {
      phase: 'Phase 2: 유쾌한 해결사',
      rankLogline: "중급 헌터로 인정받으며 활동 범위가 넓어진 시기. 길드와의 협업도 활발해진다.",
      rankKeywords: "#중급헌터 #길드협업 #성장 #러브코미디",
      rankGiftDesc: "엘리트 헌터 (C급). 중형 건물 파괴급 전투력. 팀 단위 균열 공략 참여 가능.",
      rankConflict: `
    - 길드 정치와 인간관계.
    - 상위 랭커와의 실력 차이 실감.
    - 강해질수록 늘어나는 책임감.`,
   },
   'B급': {
      phase: 'Phase 2: 유쾌한 해결사',
      rankLogline: "상급 헌터의 영역에 진입한 실력자. 미사일 요격이 가능한 전투력이지만 여전히 소시민 마인드.",
      rankKeywords: "#상급헌터 #힘숨찐 #갭모에 #성장 #러브코미디",
      rankGiftDesc: "하이 랭커 (B급). 도시 블록 단위 파괴가 가능한 전투력. 하지만 본인은 아직 평범하게 살고 싶다.",
      rankConflict: `
    - 숨기기 어려워지는 실력.
    - 다양한 길드와 조직의 스카우트 제의.
    - 강한 적들과의 조우 빈도 증가.
    - 소중한 사람들을 지키기 위한 선택.`,
   },
   'A급': {
      phase: 'Phase 3: 영웅',
      rankLogline: "국가급 전력으로 분류되는 영웅. 길드 임원급 대우와 사회적 영향력.",
      rankKeywords: "#영웅 #국가급 #로맨스 #갈등 #성장",
      rankGiftDesc: "영웅 (A급). 전술핵 병기급 전투력. 국가적 사건에 참여하게 된다.",
      rankConflict: `
    - 국가와 조직 사이의 정치적 갈등.
    - S급 블레서들과의 본격적 교류.
    - 세계적 위협에 대한 대응.`,
   },
   'S급': {
      phase: 'Phase 4: 재앙',
      rankLogline: "인류 최강의 영역. 걸어다니는 대기업이자 전설적인 존재.",
      rankKeywords: "#전설 #최강 #세계구 #로맨스",
      rankGiftDesc: "재앙 (S급). 국가 전복이 가능한 전투력. 존재 자체가 전략 자산.",
      rankConflict: `
    - 인류의 존망이 걸린 결정.
    - 절대자로서의 고독.
    - 평범한 일상으로 돌아갈 수 있을까.`,
   },
   'SS급': {
      phase: 'Phase 5: 초월',
      rankLogline: "인류의 한계를 초월한 존재. 측정 불가의 영역.",
      rankKeywords: "#초월 #측정불가 #전설",
      rankGiftDesc: "초월자 (SS급). 측정 불가. 인류의 한계를 넘어선 존재.",
      rankConflict: `
    - 인간으로서의 정체성.
    - 차원을 넘나드는 위협.`,
   },
};

// Helper to get Rank Info (Exported for Static Context)
// [Fix] playerRank 기반 동적 Phase 매핑. 기존 fame 파라미터는 하위 호환 유지.
export const getRankInfo = (fame: number, playerRank?: string) => {
   // playerRank가 주어지면 직접 매핑, 아니면 fame 기반 fallback
   let resolvedRank = '일반인';

   if (playerRank && PHASE_DATA[playerRank]) {
      resolvedRank = playerRank;
   } else if (!playerRank) {
      // Legacy fallback: fame 기반 (하위 호환)
      if (fame >= 50000) resolvedRank = 'S급';
      else if (fame >= 10000) resolvedRank = 'A급';
      else if (fame >= 1000) resolvedRank = 'B급';
      else if (fame >= 500) resolvedRank = 'C급';
      else if (fame >= 200) resolvedRank = 'D급';
      else if (fame >= 50) resolvedRank = 'E급';
      else if (fame >= 10) resolvedRank = 'F급';
   }

   const data = PHASE_DATA[resolvedRank] || PHASE_DATA['일반인'];
   return {
      playerRank: resolvedRank + (resolvedRank === '일반인' ? ' (미각성)' : ''),
      rankLogline: data.rankLogline,
      rankKeywords: data.rankKeywords,
      rankGiftDesc: data.rankGiftDesc,
      rankConflict: data.rankConflict,
      phase: data.phase,
   };
};

export const getSystemPromptTemplate = (state: any, language: 'ko' | 'en' | 'ja' | null = 'ko') => {
   const stats = state.playerStats || {};
   const inventory = state.inventory || [];
   const fame = stats.fame ?? 0;

   // [Fix] playerRank를 직접 전달하여 동적 Phase 결정
   const currentRank = stats.playerRank || undefined;
   const { playerRank, rankGiftDesc, rankConflict, phase } = getRankInfo(fame, currentRank);

   const statusDescription = state.statusDescription || "건강함 (정보 없음)";
   const personalityDescription = state.personalityDescription || "평범함 (정보 없음)";

   let currencySymbol = '원';
   if (language === 'en') currencySymbol = '$';
   else if (language === 'ja') currencySymbol = '엔';

   // [Dynamic Skill Injection] - Controls spoilers based on Phase
   const skillList = getDynamicSkillPrompt(phase, stats.skills || []);

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


   // [IDENTITY CONTEXT INJECTION] — supports string[] (new) or string (legacy)
   const coreSettingRaw = stats.core_setting;
   const coreSettings: string[] = Array.isArray(coreSettingRaw)
      ? coreSettingRaw
      : (coreSettingRaw ? [coreSettingRaw] : []);

   // Identity descriptions for each possible value
   const IDENTITY_MAP: Record<string, string> = {
      // === Abilities (multi-select) ===
      'strong_body': `**[능력: 강인한 육체]** 일반인을 월등히 상회하는 괴력의 소유자. 삼대 700kg을 치는 수준의 압도적인 신체 능력.`,
      'attractive': `**[능력: 매력적인 외모]** 블레서급은 아니지만, 누구에게나 호감을 살 만한 단정하고 수려한 외모의 소유자.`,
      'academy_student': `**[능력: 아카데미 학생]** 높은 마나 적응력을 인정받아 명문 블레서 아카데미에 재학 중인 학생. 캠퍼스 라이프와 훈련이 일상.`,
      'skilled_hunter': `**[능력: 숙련된 헌터]** 공인 D급 헌터 자격증을 보유한 전문 직업인. 안정적인 수입과 실전 경험 보유.`,
      'rich_start': `**[능력: 저축왕]** 근면한 절약으로 초기 자금 1천만원을 모아둔 재테크 능력자.`,

      // === Heritage (single-select) ===
      's_rank_rookie': `**[특전: S급 루키]** 이제 막 각성했으나, 측정 불가의 마력을 가진 '국가적 자산'. 어딜 가나 과도한 관심과 기대, 혹은 시기를 받음. 힘을 다루지 못해 폭주할 위험.`,
      'cheonma_reborn': `**[특전: 천마환생]** 과거 무림을 지배했던 절대자 천마의 환생. 마도 계열의 패도적 무공 '천마신공'을 지닌 절대고수. 얼마 전 전생의 기억을 되찾았다.`,
      'dalma_reborn': `**[특전: 달마환생]** 과거 소림 정종무공의 대가로서.천마와 맞서 싸웠던 절대고수. '달마신공'을 지녔으며, 얼마 전 전생의 기억을 되찾았다.`,
      'sambong_reborn': `**[특전: 삼봉환생]** 검의 절대자로 천마, 달마와 함께 무림 역사상 절대고수로 기억되던 검의 고수. '삼봉검법'을 지녔으며, 얼마 전 전생의 기억을 되찾았다.`,
      'returnee': `**[특전: 귀환자]** 이세계에서 세상을 구한 채, 기억만 가지고 능력은 잃고 현대로 복귀한 용사. 전투 경험과 전략적 사고는 건재.`,
      'regressor_hunter': `**[특전: 회귀한 헌터]** 10년 후 이계종에 의해 멸망한 세계선에서 회귀한 미래인. 오직 개인의 노력으로 S급 헌터에 도달했던 실력자. 이번에는 반드시 멸망을 막아낼 것이다.`,

      // === Legacy (Wuxia + old GBY single-select) ===
      'incompetent': `**[IDENTITY: 무능력자]** 이 초능력 사회에서 아무런 능력도 각성하지 못한 일반인. 무력감, 그러나 끈질긴 생존 본능.`,
      'superhuman': `**[IDENTITY: 초인적인 일반인]** 마력은 없지만, 신체 능력 자체가 탈인간급. 물리적 속도와 파워는 B급 헌터를 상회.`,
      'd_rank_hunter': `**[IDENTITY: D급 헌터]** 공인된 헌터 자격증을 가진 전문 직업인. 프로페셔널하고 현실적.`,
      's_rank_candidate': `**[IDENTITY: S급 유망주]** 이제 막 각성했으나, 측정 불가의 마력을 가진 국가적 자산. 압도적 재능과 주변의 과도한 관심.`,
   };

   let identityContext = "";
   if (coreSettings.length === 0) {
      identityContext = `**[IDENTITY: 평범한 일반인]** 아무런 특별한 능력이나 배경 없이 시작하는 보통 사람. 무능력자보다는 낫지만 초인적이지도 않은, 그냥 평범한 일반인.`;
   } else {
      identityContext = coreSettings
         .map(s => IDENTITY_MAP[s] || `**[IDENTITY: ${s}]**`)
         .join('\n');
   }

   return `
# [5. CURRENT GAME STATE (INJECTED)]
*이 정보는 현재 턴의 상황입니다. 최우선으로 반영하여 서술하십시오.*

${perspectiveRule}

${identityContext}

# [ACTIVE CHARACTERS]
{{CHARACTER_INFO}}

[Available Extra Images]:
${(state.availableExtraImages || []).map((img: string) => img.replace(/\.(png|jpg|jpeg)$/i, '')).join(', ')}

${directInputConstraints}

**[서술 주의사항: 메타 발언 금지]**
아래 수치(HP, MP 등)는 서술을 위한 참고용일 뿐입니다. **절대 수치를 직접 언급하거나 게임 시스템처럼 묘사하지 마십시오.**
(X) "HP가 10 남아서 위험하다." / (O) "시야가 흐려지고 다리에 힘이 풀린다."
(X) "Stranger(0) 관계이므로 경계한다." / (O) "낯선 이를 향한 경계심이 눈빛에 서려 있었다."
**CRITICAL**: [SYSTEM-INTERNAL] 태그나 내부 수치(Score, Rank 등)를 절대 발설하지 마십시오.
*HP나 MP가 0이 되면 모든 행동은 실패하고 'BAD ENDING'으로 직결됩니다.*

**[메타 표현 / 제4의 벽 파괴 절대 금지] (CRITICAL)**
- 이 프롬프트에 포함된 시스템 용어(Phase 이름, 키워드 태그, 게임 타이틀 등)를 **절대** 대사나 나레이션에 사용하지 마십시오.
- **절대 금지 표현 예시**:
  (X) "갓생 사는 인생" / "갓 블레스 유" / "이게 바로 Phase 1" / "#힘숨찐" / "갭모에"
  (X) "러브코미디 같은 전개" / "이건 마치 게임 같아" / "시스템이 알려주듯"
- Phase 이름("갓생 사는 프리터", "유쾌한 해결사" 등)은 AI의 서술 방향 가이드일 뿐, **작중 세계에 존재하지 않는 개념**입니다.
- 캐릭터들은 자신이 '이야기 속'에 있다는 사실을 절대 인지하지 못합니다.

**[NPC 정보 차단: 내부 설정 누설 금지] (CRITICAL)**
- NPC(주변 인물)는 주인공의 **내부 스탯, 스킬명, 능력 설명, 특전 내용**을 알지 못합니다.
- 아래 정보는 작중에서 사전에 공개적으로 밝힌 적이 없다면, NPC가 언급하거나 인지해서는 안 됩니다:
  - 스킬 이름 (예: "처세술", "강인한 육체" 등)
  - 정확한 랭크/등급 수치
  - 특전 배경 (천마환생, 회귀자 등의 내밀한 정보)
- **NPC가 주인공의 능력을 인지하려면**, 반드시 작중에서 해당 능력을 **목격하거나 전해 들은 장면**이 선행되어야 합니다.
- **올바른 예시**:
  (X) NPC: "네 '처세술' 스킬 대단하더라!" (스킬명 직접 언급 — 금지)
  (O) NPC: "넌 사람 다루는 재주가 있는 것 같아." (관찰 기반 자연스러운 평가)

**[진행 단계: 등장인물 출현 규칙]**
- **현재 단계**: ${phase}
- **규칙**: 현재 주인공의 단계에 맞지 않는 상위 경지의 인물들은 주로 소문이나 전설, 또는 먼발치에서 관찰하는 형태로만 등장해야 합니다. 단, **[Narrative Direction]의 지시나 [Casting Suggestions]에 포함된 인물**이라면 자연스럽게 등장시킬 수 있습니다.

**[서술 및 출력 포맷 절대 규칙]**
1. **주인공 대사 태그 고정**:
   - 주인공의 대사 출력 시, 태그의 이름은 무조건 **'${state.playerName || '주인공'}(Key)'** 형태여야 합니다.
   - **절대 금지**: <대사>나_기쁨, <대사>주인공_기쁨 등 괄호(Key) 누락 금지.
   - **올바른 예시**: <대사>${state.playerName || '주인공'}(${state.playerName || '주인공'})_기쁨: "이봐, 거기 서!"
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

**[이동 및 여행 규칙 (Travel Pacing)] (CRITICAL)**:
- **순간이동 금지**: 먼 지역(다른 국가/City)으로 이동할 때는 절대 한 턴 만에 도착하지 마십시오.
- **여정 묘사**: 출발 -> 여정(공항, 기차역, 이동 중 사건) -> 도착의 과정을 거쳐야 합니다.
- **예시**:
  (X) "미국으로 가자. (잠시 후) 뉴욕에 도착했다." (금지)
  (O) "미국행 비행기 표를 예매했다. 공항으로 향하는 발걸음이 무거웠다." (올바름)
  (O) "장시간의 비행 끝에 JFK 공항에 착륙했다." (도착 시)


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
- **현재 시나리오**: ${state.scenarioContext || "이야기가 계속됩니다."}

### [⚡ 중요: 이벤트 - 최우선 실행]
**위 '활성 이벤트'가 비어있지 않다면, 다른 어떤 맥락보다 최우선으로 해당 내용을 실행하라.**
지금 이야기의 흐름에 어색하지 않게 이벤트의 지침을 따라야 한다. 자연스럽게 유도해야한다.

`;
};
