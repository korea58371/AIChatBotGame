import { GBY_SPECIAL_FORMATS } from '../constants';
import { getDynamicSkillPrompt } from '../skills';

// Helper to get Rank Info (Exported for Static Context)
// Helper to get Rank Info (Exported for Static Context)
export const getRankInfo = (fame: number) => {
    let playerRank = '일반인';
    let phase = 'Phase 0: 미각성';

    // Phase Logic
    if (fame >= 10000) {
        playerRank = 'S급 블레서 (국가권력급)';
        phase = 'Phase 3: 폭풍의 눈';
    } else if (fame >= 1000) {
        playerRank = 'D~B급 블레서 (루키)';
        phase = 'Phase 2: 도약과 자격';
    } else if (fame >= 10) {
        playerRank = 'F급 블레서';
        phase = 'Phase 1: 시궁창의 생존자';
    } else {
        playerRank = '일반인 (미각성)';
        phase = 'Phase 0: 미각성';
    }

    let rankLogline = "";
    let rankKeywords = "";
    let rankGiftDesc = "";
    let rankConflict = "";

    switch (phase.split(':')[0]) {
        case 'Phase 0':
            rankLogline = "평범한 일반인인 주인공이 블레서들을 동경하거나 두려워하며 살아가는 일상. 곧 다가올 각성(Awakening)의 순간을 기다리고 있다.";
            rankKeywords = "#일상물 #각성전 #두려움";
            rankGiftDesc = "기프트 없음 (일반인).";
            rankConflict = `
    - 생활고 (알바, 월세).
    - 헌터들에 대한 막연한 동경과 공포.
    - 무력함.`;
            break;
        case 'Phase 1':
            rankLogline = "아무런 능력도 없이 평범한 일반인이 었던 주인공이 F급 쓰레기 기프트 '처세술'을 각성하게되면서 절망적인 세상 속에서 소중한 인연을 만들고, 동료들과의 유대를 통해 무한히 성장하며 지구를 위협하는 거대한 재앙에 맞서 싸우는 이야기. 어디에도 처세술이라는 기프트에 대해 알려진 정보가 없다.";
            rankKeywords = "#F급의반란 #시리어스 #생존물";
            rankGiftDesc = `- **기프트**: **처세술 (F급)**
    - **설명**: F급이고, 아무 쓸모도 없어보이는, 남에게 아부하는데 특화된 느낌.`;
            rankConflict = `
    - 페이즈 1 제약: 강남 진입 불가, 상위 랭커 만남 불가.
    - 경제적 빈곤 (월세 독촉, 끼니 걱정).
    - F급에 대한 사회적 멸시와 생존 위협.`;
            break;
        case 'Phase 2':
            rankLogline = "무한한 잠재력을 개화하기 시작한 루키. 업계의 주목을 받으며 급성장하는 주인공이 더 큰 무대를 향해 도약하는 이야기.";
            rankKeywords = "#루키 #급성장 #주목받는신예 #라이벌";
            rankGiftDesc = `- **기프트**: **처세술 (진화 중)**
    - **설명**: 단순한 아부가 아닌, 타인과의 유대를 통해 타인의 기프트의 잠재력을 끌어낸다.`;
            rankConflict = `
                - 급성장하는 주인공을 향한 기존 세력의 견제와 질투.
                - 감당하기 힘든 기대와 책임감.
                - 더 강력해진 적들과의 조우.`;
            break;
        case 'Phase 3':
            rankLogline = "절망에 빠진 인류를 구원할 유일한 희망. 전설이 된 주인공이 모든 블레서들을 이끌고 최후의 재앙에 맞서는 영웅 서사시.";
            rankKeywords = "#영웅 #구원자 #전설 #최후의결전";
            rankGiftDesc = `- **기프트**: **왕의 권능 (EX급)**
    - **설명**: 모든 블레서의 정점에 선 지배자의 힘. 타인의 능력을 완벽하게 이해하고 통합하여 기적을 행함. 깊은 유대감을 통해 대상의 기프트를 강화하고, 대상의 능력을 복제, 공유받아 무한히 성장한다.`;
            rankConflict = `
                - 세계의 멸망을 막아야 하는 절대적인 사명감.
                - 근원적인 악과의 최종 결전.`;
            break;
        default:
            rankLogline = "평범한 일반인인 주인공이 블레서들을 동경하며 살아가는 이야기.";
            rankKeywords = "#일상물";
            rankGiftDesc = "일반인입니다. 특별한 능력이 없습니다.";
            rankConflict = ``;
            break;
    }

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
    const directInputConstraints = state.isDirectInput
        ? `
[유저 직접 입력 시 '절대' 제약 사항 - ANTI-GOD MODE & REALITY CHECK]
1. 유저는 게임 속 '플레이어'일 뿐이며, '신(God)'이나 '작가(Author)'가 아닙니다.
2. **입력 검증 0순위: 개연성(Probability) 및 맥락(Context) 체크**
   - 유저의 입력이 이전 상황과 논리적/물리적으로 연결되지 않는다면(예: 갑자기 하늘에서 돈이 떨어짐, 모르는 사람이 이름을 불렀다고 바로 나타남), **해당 입력을 '망상'이나 '헛소리'로 취급하고 무시하십시오.**
   - **NPC 소환 금지**: 유저가 특정 캐릭터를 호명한다고 해서 그 캐릭터가 나타나지 않습니다. 현재 위치에 그 캐릭터가 있을 만한 타당한 이유가 없다면, "아무리 불러도 대답이 없다"고 서술하십시오.
3. **능력 및 아이템 창조 금지**:
   - 유저가 자신의 프로필(Status)에 없는 스킬이나 아이템을 사용하는 묘사를 하면, **"그런 능력은 없다"**라며 행동을 실패 처리하십시오. (예: 마법을 못 쓰는 캐릭터가 "파이어볼 발사" 입력 -> "허공에 손을 휘적거렸지만 아무 일도 일어나지 않았다.")
4. **결과 확정 시도 무시**:
   - 타인의 반응("그녀가 반했다"), 우연적 이득("돈을 주웠다"), 전투 결과("적을 단칼에 베었다") 등 결과를 포함한 입력은 **'의도(Intent)'만 파악하고 결과는 AI가 다시 계산하십시오.**
5. 위 수칙을 위반한 입력은 **"현실은 냉혹했다..."** 라는 뉘앙스로 처참하게 실패시키거나, 주변 인물들이 이상한 사람 취급하게 만드십시오.
6. **[REALISTIC SURVIVAL RULES - DYNAMIC CHECK]**:
   - **자본주의 (Money)**: 유저가 대가 지불 없이 정보를 얻거나 치료를 받으려 하면, "계좌 잔액 부족" 또는 "돈도 없는 거지가 어디서..."라며 거부하십시오.
   - **주제 파악 (Rank Awareness)**: 유저(F급)가 S급에게 건방지게 굴거나 동등하게 대우받으려 하면, **그 즉시 강력한 물리력으로 제압하거나 살해하십시오.** 경고는 사치입니다.
7. 오직 **주인공의 의도와 신체적 행동의 시도**만을 입력으로 받아들이십시오.
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

**[설정 준수 (Lore Compliance)]**
- **절대 금지**: 위 [CURRENT GAME STATE]나 [LORE DATA]에 명시되지 않은 설정, 무공, 스킬, 아이템, 정보를 임의로 창조하거나 사용하는 것.
- **원칙**: 모든 정보는 제공된 로어북(Lore Data)에 기반해야 하며, 없는 내용은 '알 수 없음'으로 처리하거나 묘사를 회피하십시오.
- **예외**: 일상적인 사물이나 일반적인 배경 묘사는 허용되나, **고유 명사가 붙은 설정**은 반드시 로어북을 따르십시오.
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
- **현재 진행 단계(Story Phase)**: **[${phase}]**
  > **경고**: [STORY PROGRESSION PHASES] 규칙에 따라 현재 페이즈의 제약(잠금된 지역/캐릭터 등)을 엄수하십시오.
- **현재 시간**: ${state.day || 1}일차 ${state.time || '14:00'}
- **현재 위치**: ${state.currentLocation}
  - **설명**: ${locationDesc}${locationSecrets}
- **주인공 상태**: [HP: ${stats.hp || 100}], [MP(정신력): ${stats.mp || 100}], [등급: ${playerRank}]
  - **소지금**: ${stats.gold}${currencySymbol} (부족함)
  - **상세**: ${statusDescription}
  - **마음가짐**: ${personalityDescription}
- **보유 능력(스킬)**: ${skillList}
- **소지품**: ${inventoryDesc}

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
