export const PACING_RULES = {
    adaptation: {
        maxTurn: 20,
        // [감독 연출 노트: 적응기 (만담/일상)]
        // 절대 위협 금지. 갈등 요소 제거. 가벼운 만담 위주.
        directorNote: `
[Director's Note: Chapter 0 - Adaptation (Comedy & Banter)]
- **Genre**: Slice of Life / Light Comedy / Manzai (Banter).
- **Atmosphere**: Peaceful, Humorous, Relaxed.
- **Mandate**: 
  - **NO COMBAT / NO CRISIS / NO TENSION**: The world is completely safe.
  - **Remove All Conflict**: Do not even introduce "bullies" or "thieves". Everyone is friendly or funny.
  - **Focus on Banter (Manzai)**: If NPCs appear, they should engage in lighthearted small talk, jokes, or funny misunderstandings. 
  - **Sensory Details**: Focus on food, scenery, and the protagonist's internal monologue about the new world.
        `,
        forbiddenKeywords: [
            "Combat", "Fight", "Kill", "Bandit", "Assassin", "Secret Plot", "Mission", "Quest", "Crisis", "Killing Intent", "Tension", "Murderous Aura",
            "Bully", "Thug", "Argument", "Conflict", "Suspicion", "Interrogation"
        ],
        allowedKeywords: ["Innkeeper", "Passerby", "Merchant", "Food", "Sleep", "Scenery", "Joke", "Laughter", "Gossip"],
        focus: "Adapting to the new world with lighthearted banter and rest. No stress."
    },
    introduction: {
        maxTurn: 50, // Extended to 50
        // [감독 연출 노트]
        // 부정적인 명령(Don't)보다 긍정적인 연출(Do)을 통해 AI의 창의성을 유도합니다.
        directorNote: `
[Director's Note: Chapter 1 - The Cold Reality]
- **Genre**: Survival Documentary / Slow-burn Drama.
- **Atmosphere**: Extreme Cold, Hunger, Indifference of the Strong.
- **North Sea Ice Palace**: They are NOT villains. They are [Noble/Aloof/Indifferent]. They ignore the weak (Player) like bugs. They do NOT act like petty thugs.
- **Action**: Focus on menial labor (Dishwashing, Chopping Wood) and the physical struggle of the protagonist.
- **Pacing**: DEAD SLOW. Do not rush. Describe the steam from a hot dumpling, the sting of the wind, the numbness of fingers.
        `,
        forbiddenKeywords: [
            "Secret Delivery (밀서/밀명)", "Hidden Item (영물/비급)",
            "Wanted Status (수배)", "Chases (추격전)", "Mysterious Strangers (의문의 인물 의뢰)"
        ],
        allowedKeywords: ["Petty Thugs", "Corrupt Officials", "Wild Beasts", "Street Scammers", "Innkeepers", "Laborers"],
        focus: "Jianghu code learning, survival, basic martial arts, establishing identity."
    },
    risingAction: {
        maxTurn: 60,
        directorNote: `
[Director's Note: Chapter 2 - The First Step]
- **Genre**: Growth Drama / Rookie's Journey.
- **Action**: Learning the first Martial Art. Minor conflicts with local thugs.
- **Scale**: Keep it local. No world-ending threats yet.
        `,
        forbiddenKeywords: ["Final Bosses", "Demon God", "World-Ending Conspiracies"],
        allowedKeywords: ["Third-rate Experts", "Local Sect Disputes", "Escort Missions"],
        focus: "Minor conflicts, reputation building, learning new techniques.",
    },
    // [시스템 규칙] 성장 및 시간 스킵
    growth: {
        geniusMultiplier: 12, // 일반인보다 12배 빠른 성장 (10일에 1년)
        timeSkipStyle: "Describe the changing of seasons or the accumulation of dust/cobwebs. Focus on the internal flow of Qi.",
        mandate: "주인공이 수련에 집중할 때 AI는 과감하게 시간을 스킵하고 경지를 끌어올리세요. '열흘이 흘렀다'와 같은 서술을 권장합니다."
    },
    // [시스템 규칙] 전역 분위기 및 연출 (Global Atmosphere)
    global: {
        directorNote: `
[Director's Note: Shin-Wuxia Atmosphere]
- **Celebrity Culture**: Heroines (e.g., Namgung Se-ah, Tang Soyul) are equivalent to 'Idols'. 
  - NPCs MUST react with awe, jealousy, or fanboying. (e.g., "I wish I could get stepped on by her!", "Did you see that aura?!")
  - Rumors and fame spread fast.
- **The Gossiping Jianghu**: Background NPCs (Gossipers/Busybodies) continuously discuss 'Power Rankings' (10 Great Masters, 100 Experts) and 'Recent Events'.
  - Use this to deliver exposition naturally. (e.g., "Did you hear? The Sword Saint defeated the Blood Demon!")
- **Slice of Life Focus**: 
  - Do NOT invent random crises. Focus on the *details of life*: the taste of tea, the texture of dumplings, the banter between characters, and the warmth of bonding.
  - Let the 'Event Manager' handle big plots. You focus on the *chemistry*.
        `
    }
};
