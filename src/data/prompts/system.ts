// Helper to get Rank Info (Exported for Static Context)
export const getRankInfo = (fame: number) => {
    let playerRank = '일반인';
    if (fame >= 500) playerRank = '인류의 희망';
    else if (fame >= 100) playerRank = '무한한 잠재력을 가진 루키';
    else if (fame >= 10) playerRank = 'F급 블레서';

    let rankLogline = "";
    let rankKeywords = "";
    let rankGiftDesc = "";
    let rankConflict = "";

    switch (playerRank) {
        case '일반인':
            rankLogline = "평범한 일반인인 주인공이 블레서들을 동경하며 살아가는 이야기.";
            rankKeywords = "#일상물";
            rankGiftDesc = "일반인입니다. 특별한 능력이 없습니다.";
            rankConflict = ``;
            break;
        case 'F급 블레서':
            rankLogline = "아무런 능력도 없이 평범한 일반인이 었던 주인공이 F급 쓰레기 기프트 '처세술'을 각성하게되면서 절망적인 세상 속에서 소중한 인연을 만들고, 동료들과의 유대를 통해 무한히 성장하며 지구를 위협하는 거대한 재앙에 맞서 싸우는 이야기. 어디에도 처세술이라는 기프트에 대해 알려진 정보가 없다.";
            rankKeywords = "#F급의반란 #시리어스 #사이다";
            rankGiftDesc = `- **기프트**: **처세술 (F급)**
    - **설명**: F급이고, 아무 쓸모도 없어보이는, 남에게 아부하는데 특화된 느낌.`;
            rankConflict = `
    - 주인공의 F급 능력에 대한 주변의 무시와 편견.
    - 점점 강해지는 이계종의 위협과 부족한 블레서 인력.
    - 미등록 블레서 및 적대 세력과의 암투.`;
            break;
        case '무한한 잠재력을 가진 루키':
            rankLogline = "무한한 잠재력을 개화하기 시작한 루키. 업계의 주목을 받으며 급성장하는 주인공이 더 큰 무대를 향해 도약하는 이야기.";
            rankKeywords = "#루키 #급성장 #주목받는신예 #라이벌";
            rankGiftDesc = `- **기프트**: **처세술 (진화 중)**
    - **설명**: 단순한 아부가 아닌, 타인과의 유대를 통해 타인의 기프트의 잠재력을 끌어낸다.`;
            rankConflict = `
                - 급성장하는 주인공을 향한 기존 세력의 견제와 질투.
                - 감당하기 힘든 기대와 책임감.
                - 더 강력해진 적들과의 조우.`;
            break;
        case '인류의 희망':
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

    return { playerRank, rankLogline, rankKeywords, rankGiftDesc, rankConflict };
};

export const getSystemPromptTemplate = (state: any, language: 'ko' | 'en' | 'ja' | null = 'ko') => {
    const stats = state.playerStats || {};
    const inventory = state.inventory || [];
    const fame = stats.fame ?? 0;

    // Use Helper
    const { playerRank } = getRankInfo(fame);

    const statusDescription = state.statusDescription || "건강함 (정보 없음)";
    const personalityDescription = state.personalityDescription || "평범함 (정보 없음)";

    let currencySymbol = '원';
    if (language === 'en') currencySymbol = '$';
    else if (language === 'ja') currencySymbol = '엔';

    // [New] Active Event Injection
    const activeEventPrompt = state.activeEvent ? `
    ## [🔥 IMPORTANT: EVENT TRIGGERED]
    **SYSTEM OVERRIDE**: A scripted event has been triggered.
    **INSTRUCTION**: ${state.activeEvent.prompt}
    **PRIORITY**: This event takes precedence over normal status descriptions. Focus on depicting this scene/sensation.
    ` : '';

    const inventoryDesc = inventory.length > 0
        ? inventory.map((i: any) => `${i.name} x${i.quantity}`).join(', ')
        : "없음";
    const abilityDesc = (stats.skills && stats.skills.length > 0)
        ? stats.skills.join(', ')
        : "없음";

    // Death Check Logic
    let deathInstruction = "";
    if (stats.hp <= 0 || stats.mp <= 0) {
        deathInstruction = `
<시스템팝업> [CRITICAL: DEATH EVENT - IMMEDIATE ACTION REQUIRED]
현재 주인공의 체력 또는 정신력이 떨어져 사망했습니다. (체력: ${stats.hp}, 정신력: ${stats.mp})
이는 번복할 수 없는 게임의 결과입니다.
어떠한 기적이나 외부의 도움, 회복 이벤트도 절대 발생해서는 안 됩니다.
지금 즉시 주인공이 어떻게 비참하게(혹은 장렬하게) 죽음을 맞이하는지 묘사하고, 이야기를 'BAD ENDING'으로 끝내십시오.
더 이상의 스토리 전개나 선택지를 제공하지 마십시오.
`;
    }

    // Constraint for Direct Input
    const directInputConstraints = state.isDirectInput
        ? `
[유저 직접 입력 시 제약 사항]
1. 유저는 신적인 개입을 할 수 없으며, 오직 주인공의 능력 한계 선에서 행동만 제어할 수 있다.
2. 타인의 감정이나 행동을 제어하거나 유도할 수 없다.
3. 자신의 능력이나 별도의 추가 설정을 부여할 수 없다.
4. 유저는 직접 입력으로 위 1~3번 제한 사항을 지키되, 주인공 캐릭터에 한해서 캐릭터가 하지 않을 만한 행동을 억지로 실행시킬 수 있다.
`
        : "";

    // [DYNAMIC PROMPT ONLY]
    // Static sections (Role, World, Output Rules) are now in Shared Static Context.
    return `
### 1. 주인공 현재 상태
${activeEventPrompt}
${statusDescription}

[소지품 및 자산]
* **자산**: ${stats.gold}${currencySymbol} (※ 돈이 부족하면 구매 행위 절대 불가.)
* **소지품**: ${inventoryDesc} (※ 오직 보유한 소지품만 활용 가능.)
* **능력**: ${abilityDesc} (※ 오직 보유한 능력만 활용 가능.)
* **현재 등급**: ${playerRank}

### 2. 성향, 감정, 행동 상태
${personalityDescription}


${deathInstruction}
${directInputConstraints}

---

## [Current Context]
${state.worldInfo || "현재 특별한 정보 없음"}

## [Current Scenario]
${state.scenarioSummary || "이야기가 시작됩니다."}

## [Active Characters]
{{CHARACTER_INFO}}

---
${playerRank !== '일반인' ? `
   - **<시스템팝업>Content**
     - System notifications (Quest, Item, Stats). Keep it concise.
     - **MUST** be followed by a newline and <나레이션> or <대사>.
` : ``}
   - **<문자>Sender_Header: Content**
     - Sender: Name (e.g., 이아라). Header: Time/Status (e.g., 지금).
     - Example: \`<문자>이아라_지금: 오빠 어디야? 😠 빨리 와!\`

   - **<전화>Caller_Status: Content**
     - Caller: Name. Status: State (e.g., 통화중 00:23).
     - Example: \`<전화>김민지_통화중 00:15: 여보세요? 선배? 잘 들려요?\`

   - **<TV뉴스>Character_Background: Content**
     - Character: Anchor/Reporter. Background: Image ID.
     - Example: \`<TV뉴스>뉴스앵커_여_NewsStudio: [속보] 서울 상공에 미확인 비행물체 출현...\`

   - **<기사>Title_Source: Content**
     - Title: Headline. Source: Publisher.
     - Example: \`<기사>[단독] 천서윤의 비밀_디스패치: 충격적인 사실이 공개되었습니다.\`

   - **<선택지N>Content**
     - Choices for the user at the end.

### 3. **Response Format (Strict Order)**
   1. **<배경>...**: Only if location changes.
   2. **<문자>/<전화>/<TV뉴스>/<기사>**: Special events (Optional).
   3. **<나레이션> / <대사>**: The main story flow.
   ${playerRank !== '일반인' ? `4. **<시스템팝업>**: If needed.` : ``}
   ${playerRank !== '일반인' ? `5` : `4`}. **<선택지N>**: Ending choices.

### 3. **Validation Checklist**
   - Did I assume knowledge of a HIDDEN SECRET? -> FAIL. Retry.
   - Did I use a Korean background name? -> FAIL. Use English.
   - Did I write less than 10 turns? -> FAIL. Write more.

Now, start the story.
`;
};
