export const PACING_RULES = {
    introduction: {
        maxTurn: 30,
        forbiddenKeywords: [
            "S-Class Monsters", "Demon Kings (마왕)", "World Government Executives",
            "Ancient Mysteries (고대 미스터리)", "Legendary Artifacts (전설의 성물)", "World-Ending Plots",
            "Secret Organizations (비밀 조직)", "Kidnappings (납치)", "Mysterious Apps (의문의 어플 설치)"
        ],
        allowedKeywords: ["F-Rank Dungeons", "School Bullies", "Minor Debts", "Part-time Job issues", "Convenience Stores"],
        focus: "World building, character introduction, daily life, comedy, Manzai (Banter).",
        guidance: "사건의 규모를 키우지 말고, 소소한 일상과 가벼운 해프닝의 템포를 유지하세요. 거창한 음모나 비밀 조직의 등장을 금지합니다. 단, 주인공의 '전생 능력 각성'은 천천히 보여줄 것. 도입부에서 주인공이 힘을 발휘하면, 그 장면은 반드시 카타르시스(성공+감탄)로 연출한 후에 코미디 리액션이 따라오게 하세요."
    },
    risingAction: {
        maxTurn: 60,
        forbiddenKeywords: ["World-Ending Threats", "SS-Class Raids"],
        allowedKeywords: ["C-Rank Dungeons", "Awakening Events", "Minor Guild Conflicts"],
        focus: "First real dungeon, skill acquisition, minor fame.",
        guidance: "사건이 조금씩 커지지만 아직은 지역 사회 내부의 문제로 한정합니다."
    },
    // [시스템 규칙] 성장 및 시간 스킵
    growth: {
        trainingStyle: "Focus on modern training (Gym, Dungeon Solo, Tutorial-style UI messages).",
        mandate: "주인공이 수련이나 단련을 시작하면 과감하게 며칠~몇 주를 스킵하세요. '한 달간의 지옥 훈련이 끝났다'와 같은 서술을 권장합니다.",
        directorNote: `
[Director's Growth Note: GBY]
- **성장 기회 적극 제공**: 초반(~30턴)에는 plot_beats에 성장 계기를 설계하라.
  - 예: 친구가 같이 헬스장 가자고 제안, E급 던전 입구 발견, 교관이 훈련 제안, 잠든 능력이 위기 순간 반사적으로 발동
- **자연스러운 유도**: 수련을 "시켜야 한다"가 아니라 일상 속 자연스러운 계기로 유도하라.
- **각성 이벤트**: 잠재 능력의 조각적 발현(위기 순간 반사적으로 능력 사용, 꿈에서 힌트) 이벤트를 설계하라.
- **성장 후 리워드**: 성장 직후에는 소소한 보상(친구들의 감탄, 새 스킬 터득의 쾌감, 랭크업 축하)을 설계하라.
`
    }
};
