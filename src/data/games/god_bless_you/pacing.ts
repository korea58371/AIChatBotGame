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
        guidance: "사건의 규모를 키우지 말고, 소소한 일상과 가벼운 해프닝의 템포를 유지하세요. 거창한 음모나 비밀 조직의 등장을 금지합니다."
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
        mandate: "주인공이 수련이나 단련을 시작하면 과감하게 며칠~몇 주를 스킵하세요. '한 달간의 지옥 훈련이 끝났다'와 같은 서술을 권장합니다."
    }
};
