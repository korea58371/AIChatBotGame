export const GOD_BLESS_YOU_BGM_MAP: Record<string, string[]> = {
    // [Moods / Generic Keys]
    "거대한 압박감": ["압도적 격차 (Overwhelming Pressure)", "압도적 격차 (Overwhelming Pressure) (1)"],
    "공포": ["공포와 파괴 (Horror)", "은밀한 위협 (Creeping Danger)"],
    "위기": ["압도적 격차 (Overwhelming Pressure)", "은밀한 위협 (Creeping Danger)", "압도적 격차 (Overwhelming Pressure) (1)"],
    "격정": ["두근두근 썸 (Flirting)", "Erotic (에로)"],
    "유혹": ["두근두근 썸 (Flirting)", "Erotic (에로)"],
    "일상": ["경쾌한 만담 (Light Banter)", "나른한 오후 (Relaxing Afternoon)", "엉뚱한 실수 (Goofy Mistake)", "경쾌한 만담 (Light Banter) (1)", "나른한 오후 (Relaxing Afternoon) (1)"],
    "평온": ["나른한 오후 (Relaxing Afternoon)", "나른한 오후 (Relaxing Afternoon) (1)"],
    "개그": ["경쾌한 만담 (Light Banter)", "엉뚱한 실수 (Goofy Mistake)", "경쾌한 만담 (Light Banter) (1)"],
    "전투": ["각성 및 반격 (Battle _ Awakening)", "전세 역전 (Counterattack _ Heroic)", "한계 돌파 (Level Up)"],
    "승리": ["전세 역전 (Counterattack _ Heroic)", "한계 돌파 (Level Up)"],
    "슬픔": ["궁핍한 현실 (Life is Hard)", "궁핍한 현실 (Life is Hard) (1)"],
    "비극": ["궁핍한 현실 (Life is Hard)", "궁핍한 현실 (Life is Hard) (1)"],
    "미스터리": ["신비로운 발견 (Mystery)"],
    "활기": ["분주한 도심 (Busy City Life)", "분주한 도심 (Busy City Life) (1)"],
    "도시": ["분주한 도심 (Busy City Life)", "분주한 도심 (Busy City Life) (1)"],

    // [Direct File Name Access]
    "Battle": ["각성 및 반격 (Battle _ Awakening)"],
    "Awakening": ["각성 및 반격 (Battle _ Awakening)"],
    "Light Banter": ["경쾌한 만담 (Light Banter)", "경쾌한 만담 (Light Banter) (1)"],
    "Horror": ["공포와 파괴 (Horror)"],
    "Life is Hard": ["궁핍한 현실 (Life is Hard)", "궁핍한 현실 (Life is Hard) (1)"],
    "Relaxing Afternoon": ["나른한 오후 (Relaxing Afternoon)", "나른한 오후 (Relaxing Afternoon) (1)"],
    "Flirting": ["두근두근 썸 (Flirting)"],
    "Busy City Life": ["분주한 도심 (Busy City Life)", "분주한 도심 (Busy City Life) (1)"],
    "Mystery": ["신비로운 발견 (Mystery)"],
    "Overwhelming Pressure": ["압도적 격차 (Overwhelming Pressure)", "압도적 격차 (Overwhelming Pressure) (1)"],
    "Goofy Mistake": ["엉뚱한 실수 (Goofy Mistake)"],
    "Creeping Danger": ["은밀한 위협 (Creeping Danger)"],
    "Counterattack": ["전세 역전 (Counterattack _ Heroic)"],
    "Level Up": ["한계 돌파 (Level Up)"],
    "Erotic": ["Erotic (에로)"]
};

export const GOD_BLESS_YOU_BGM_ALIASES: Record<string, string> = {
    // [Wuxia Fallbacks]
    "마교의 의식": "공포",
    "멸문지화": "비극",
    "살기": "위기",
    "야심한 밤": "평온",
    "활기찬 객잔": "활기",
    "접전": "전투",
    "반격": "전투",
    "진심": "유혹",
    "취권": "개그",
    "운기조식": "평온",
    "우당탕탕 추격전": "개그",
    "방중술": "유혹",
    "환골탈태": "승리",
    "평온한 아침": "평온",
    "미스터리 & 잠입": "미스터리"
};
