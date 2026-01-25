
import { PlayerStats, Skill } from '@/lib/store';

// Famous Families and their specific settings
// Surnames must be checked by length descending to handle 2-char surnames correctly if any (though usually 2 chars like Namgung are distinct).
export const FAMOUS_FAMILIES: Record<string, {
    id: string;
    name: string;
    description: string;
    initial_skills: Skill[];
    disadvantage: string;
    narrative_intro: string;
}> = {
    '남궁': {
        id: 'namgung',
        name: '남궁세가',
        description: '창궁의 제왕. 검을 숭상하는 명문가.',
        initial_skills: [
            {
                id: 'namgung_basic_sword',
                name: '창궁검법(기초)',
                rank: '삼류',
                type: '검법',
                description: '남궁세가의 입문 검법. 찌르기 위주의 쾌검이다.',
                proficiency: 30,
                effects: ['검격 속도 증가'],
                createdTurn: 0
            }
        ],
        disadvantage: '가문의 수치: 방계 출신으로, 본가 사람들에게 멸시받고 있다.',
        narrative_intro: '당신은 **남궁세가(南宮世家)**의 핏줄을 이어받았으나, 방계라는 이유로 가문 구석의 허름한 별채에서 눈을 떴다.'
    },
    '모용': {
        id: 'moyong',
        name: '모용세가',
        description: '연환의 대가. 변화무쌍한 검수를 자랑한다.',
        initial_skills: [
            {
                id: 'moyong_basic_sword',
                name: '모용연환검(약식)',
                rank: '삼류',
                type: '검법',
                description: '모용세가의 변화초를 흉내 낸 검법.',
                proficiency: 30,
                effects: ['연계 공격 확률 증가'],
                createdTurn: 0
            }
        ],
        disadvantage: '잊혀진 자: 가문 내 정치 싸움에서 패배한 부모님으로 인해 투명인간 취급을 받는다.',
        narrative_intro: '당신은 **모용세가(慕容世家)**의 일원이지만, 아무도 당신의 안위를 신경 쓰지 않는 차가운 방 안에서 깨어났다.'
    },
    '당': {
        id: 'tang',
        name: '당가',
        description: '독과 암기의 명가.',
        initial_skills: [
            {
                id: 'tang_throwing',
                name: '만천화우(모작)',
                rank: '삼류',
                type: '암기',
                description: '당가의 투척술을 어설프게 흉내 낸 기술.',
                proficiency: 30,
                effects: ['암기 정확도 상승'],
                createdTurn: 0
            }
        ],
        disadvantage: '독기의 저주: 어릴 적 독 실험의 희생양이 되어 체질이 허약하다.',
        narrative_intro: '당신은 **사천당가(四川唐家)**의 음습한 독방에서 눈을 떴다. 몸 안에 잠재된 미약한 독기가 느껴진다.'
    },
    '제갈': {
        id: 'jegal',
        name: '제갈세가',
        description: '천하의 두뇌. 지략과 진법의 가문.',
        initial_skills: [
            {
                id: 'jegal_calculus',
                name: '천기연산(기초)',
                rank: '삼류',
                type: '기예',
                description: '기초적인 수리 연산과 전장 파악 능력.',
                proficiency: 30,
                effects: ['통찰력 보정'],
                createdTurn: 0
            }
        ],
        disadvantage: '책상물림: 무공 재능이 없어 가문 무인들에게 무시당한다.',
        narrative_intro: '당신은 **제갈세가(諸葛世家)**의 서고 구석에서 눈을 떴다. 손에는 붓이 들려 있다.'
    },
    '팽': {
        id: 'paeng',
        name: '팽가',
        description: '오호단문도. 패도적인 도법의 가문.',
        initial_skills: [
            {
                id: 'paeng_blade',
                name: '오호단문도(입문)',
                rank: '삼류',
                type: '도법',
                description: '팽가의 패도적인 도법의 기초.',
                proficiency: 30,
                effects: ['파괴력 증가'],
                createdTurn: 0
            }
        ],
        disadvantage: '겁쟁이: 팽가의 핏줄답지 않게 겁이 많아 조롱거리가 되었다.',
        narrative_intro: '당신은 **하북팽가(河北彭家)**의 연무장 구석진 곳, 아무도 찾지 않는 창고에서 눈을 떴다.'
    },
    '독고': {
        id: 'dokgo',
        name: '독고세가',
        description: '검마(劍魔)를 배출한 무패의 가문. 오직 승리만을 추구한다.',
        initial_skills: [
            {
                id: 'dokgo_basic_sword',
                name: '독고검법(기초)',
                rank: '삼류',
                type: '검법',
                description: '독고세가의 검술 원리를 흉내 낸 초식.',
                proficiency: 30,
                effects: ['치명타 확률 증가'],
                createdTurn: 0
            }
        ],
        disadvantage: '고독한 늑대: 특유의 오만함 때문에 주변에 사람이 모이지 않는다.',
        narrative_intro: '당신은 **독고세가(獨孤世家)**의 황량한 연무장에서 홀로 검을 닦으며 눈을 떴다.'
    },
    '위지': {
        id: 'wiji',
        name: '위지세가',
        description: '폭풍(暴風). 하북팽가와 패권을 다투는 쾌검과 장법의 명가.',
        initial_skills: [
            {
                id: 'wiji_cloud_sword',
                name: '일운검법(기초)',
                rank: '삼류',
                type: '검법',
                description: '구름 속에서 번개처럼 찌르는 위지세가의 쾌검. 상대의 방심을 유도한다.',
                proficiency: 30,
                effects: ['공격 속도 증가'],
                createdTurn: 0
            }
        ],
        disadvantage: '이인자의 설움: 하북 패권 경쟁에서 팽가에 밀린 탓에, 가문 전체가 과도한 명예욕과 열등감에 사로잡혀 있다.',
        narrative_intro: '당신은 **하북 위지세가(尉遲世家)**의 연무장에서 거친 숨을 몰아쉬며 눈을 떴다.'
    },
    '사마': {
        id: 'sama',
        name: '사마세가',
        description: '잠룡(潛龍). 조조의 군사 사마의의 후예를 자처하는 책략가들의 가문.',
        initial_skills: [
            {
                id: 'sama_white_crane_sword',
                name: '백학검법(기초)',
                rank: '삼류',
                type: '검법',
                description: '사마세가가 수집한 절전 검법 중 하나. 우아하고 날카롭다.',
                proficiency: 30,
                effects: ['통찰력 보정'],
                createdTurn: 0
            }
        ],
        disadvantage: '의심암귀: 매사 의심이 많아 동료를 온전히 신뢰하지 못하며, 때로는 아군조차 장기말 취급한다.',
        narrative_intro: '당신은 **하남 사마세가(司馬世家)**의 은밀한 밀실에서 병법서를 덮으며 눈을 떴다.'
    },
    '단리': {
        id: 'danli',
        name: '단리세가',
        description: '왕족의 후예. 검과 암기, 그리고 진법이 어우러진 철벽의 가문.',
        initial_skills: [
            {
                id: 'danli_fly_sword',
                name: '비천검법(기초)',
                rank: '삼류',
                type: '검법',
                description: '하늘을 비상하는 듯한 화려한 검결.',
                proficiency: 30,
                effects: ['회피율 증가'],
                createdTurn: 0
            }
        ],
        disadvantage: '망국의 굴레: 옛 왕족이라는 콧대 높은 자존심 탓에 타 문파를 은연중에 깔보는 경향이 있다.',
        narrative_intro: '당신은 **안휘 단리세가(段利世家)**의 고풍스러운 정원에서 검을 닦으며 눈을 떴다.'
    },
    '상관': {
        id: 'sanggwan',
        name: '상관세가',
        description: '도혼(刀魂). 재력으로 무림을 움직이는 상인과 무인의 이중적 면모.',
        initial_skills: [
            {
                id: 'sanggwan_wind_blade',
                name: '광풍십팔도(입문)',
                rank: '삼류',
                type: '도법',
                description: '돈으로 구한 비급을 집대성한 패도적인 도법.',
                proficiency: 30,
                effects: ['치명타 피해량 증가'],
                createdTurn: 0
            }
        ],
        disadvantage: '전전긍긍: 모든 가치를 돈으로 환산하려 들어, 진정한 협객들에게 경멸을 사곤 한다.',
        narrative_intro: '당신은 **하남 상관세가(上官世家)**의 화려한 금장식 방 안에서 장부를 덮으며 눈을 떴다.'
    }
};

/**
 * Checks if the player name conflicts with existing characters.
 */
export function checkNameValidity(name: string, characterData: Record<string, any>): { valid: boolean; message?: string } {
    const trimmedName = name.trim().normalize('NFC');
    console.log(`[CheckNameValidity] Checking: '${trimmedName}' vs ${Object.keys(characterData).length} characters`);

    if (!trimmedName) return { valid: false, message: "이름을 입력해주세요." };
    if (trimmedName.length < 2) return { valid: false, message: "이름은 두 글자 이상이어야 합니다." };

    // Exact match check
    if (characterData[trimmedName]) {
        console.log(`[CheckNameValidity] Found duplicate: ${trimmedName}`);
        return { valid: false, message: `이미 존재하는 인물 '${trimmedName}'의 이름입니다. 다른 이름을 선택해주세요.` };
    }

    // Check against normalized names or known aliases if needed
    // For now, strict map check is good as DataManager normalizes names to keys.

    return { valid: true };
}

/**
 * Generates hidden settings based on the player's name.
 */
export function getHiddenSettings(name: string): {
    found: boolean;
    familyId?: string;
    narrative?: string;
    personaOverride?: string;
    scenarioOverride?: string;
    disabledEvents?: string[];
    imageOverride?: string; // [New]
    statsModifier?: Partial<PlayerStats>;
} | null {
    const trimmedName = name.trim();

    // [New] Special Character: Im Seong-jun (Hidden)
    if (trimmedName === '임성준') {
        return {
            found: true,
            familyId: 'hidden_im',
            narrative: `
[히든 설정 발동: 차원 이동자]
당신은 대한민국 서울의 40세 편의점 아르바이트생 '임성준'입니다.
야간 근무 중 알 수 없는 굉음과 함께 이 세계로 소환되었습니다.
당신은 **현대의 몸 그대로**이며, 복장은 **[허름한 무림 복식]**으로 바뀌어 있습니다. 또한 이 세계에 대한 지식이 전무합니다.
`,
            // These will be used to override GameState
            personaOverride: 'WUXIA_IM_SEONG_JUN_PERSONA', // Key reference (resolved in prompt-manager)
            scenarioOverride: 'WUXIA_IM_SEONG_JUN_SCENARIO', // Key reference (resolved in UI)
            disabledEvents: ['wuxia_intro'],
            imageOverride: '임성준', // [New]

            statsModifier: {
                faction: '무소속 (차원 이동자)',
                personalitySummary: '차원 이동자 (현대인 신체, 편의점 유니폼 착용, 오타쿠, 겉과 속이 다름, 게으름, 여색, 망상)',
                // 40yo average male stats (High INT due to Otaku knowledge? Low VIT due to laziness)
                str: 6, agi: 6, int: 14, vit: 6, luk: 20, // Low Phys, High Luck & Int
                skills: [], // No martial arts
                personality: {
                    morality: -20, // Hypocritical
                    courage: -20, // Cowardly
                    patience: 10,
                    energy: -40, // Very Lazy
                    decision: -10,
                    lifestyle: -30, // Unorganized/Otaku lifestyle
                    openness: 30, // Open to delusions
                    warmth: 10,
                    eloquence: 10,
                    leadership: -30,
                    humor: 20,
                    lust: 50 // Very Lustful
                } as any
            }
        };
    } else if (trimmedName === '남강혁') {
        return {
            found: true,
            personaOverride: 'WUXIA_NAM_GANG_HYEOK_PERSONA',
            scenarioOverride: 'WUXIA_NAM_GANG_HYEOK_SCENARIO', // New constant key
            disabledEvents: ['wuxia_intro'], // Disable Possessor Intro
            imageOverride: '남강혁', // [New]
            narrative: "※ 특수 설정 '남강혁(전투광 마초)'가 활성화되었습니다.\n(근력/체력 대폭 증가, 지능 감소, 무림을 드래곤볼 식으로 해석)",
            statsModifier: {
                faction: '무소속 (전투광)',
                personalitySummary: '차원 이동자 (무림을 드래곤볼로 착각, 마초, 의리파, 단순무식, 애완견 마루/꿍이 집착)',
                // Macho Stats: High Phys, Low Int
                str: 18, agi: 12, int: 5, vit: 20, luk: 10,
                skills: [], // No martial arts yet? Or maybe "Basic Fitness"?
                personality: {
                    morality: 10,
                    courage: 50, // Very Brave
                    patience: -20, // Impatient
                    energy: 30, // Energetic
                    decision: 20,
                    lifestyle: 10, // Routine training
                    openness: -30, // Simple minded
                    warmth: 40, // Bromance warmth
                    eloquence: -20, // Blunt
                    leadership: 10,
                    humor: 0,
                    lust: 10 // Normal?
                } as any
            }
        };
    }

    // Check for famous surnames
    // Sort keys by length desc to match 'Namgung' (2 chars) before others if there's overlap
    const surnames = Object.keys(FAMOUS_FAMILIES).sort((a, b) => b.length - a.length);

    for (const surname of surnames) {
        if (trimmedName.startsWith(surname)) {
            const family = FAMOUS_FAMILIES[surname];

            // Construct Hidden Settings
            return {
                found: true,
                familyId: family.id,
                narrative: `
[히든 설정 발동]
- 가문: ${family.name}
- 신분: ${family.description} 하지만 당신은 '${family.disadvantage}'
- 특전: 가문의 기초 무공 습득 (${family.initial_skills.map(s => s.name).join(', ')})
- 시작 지점: ${family.narrative_intro}
`,
                statsModifier: {
                    faction: family.name,
                    skills: family.initial_skills,
                    // Optionally add negative traits to personality or relationships
                    relationships: {}, // Reset or specific
                    active_injuries: [], // Maybe 'weak constitution' for Tang
                }
            };
        }
    }

    return null;
}

/**
 * Selects the protagonist image based on character creation data.
 */
export function selectProtagonistImage(
    name: string,
    gender: 'male' | 'female',
    creationData: Record<string, any>
): string {
    const trimmedName = name.trim();

    // 1. Check for Hidden Character Overrides (Specific Names)
    if (trimmedName === '임성준') return '임성준';
    if (trimmedName === '남강혁') return '남강혁';
    // 2. Check for Appearance/Personality Choices
    const personality = creationData?.['personality_tone'];
    if (personality) {
        const mappings: Record<string, string[]> = {
            'humorous': ['유쾌한주인공1', '유쾌한주인공2', '유쾌한주인공3', '유쾌한주인공4'],
            'serious': ['원칙적주인공', '성실한주인공', '냉철한주인공'],
            'cynical': ['계산적주인공1', '계산적주인공2', '계산적주인공3', '영악한주인공1', '영악한주인공2'],
            'timid': ['소심형주인공'],
            'domineering': ['패도형주인공1', '패도형주인공2', '패도형주인공3', '패도형주인공4', '패도형주인공5']
        };

        const candidates = mappings[personality];
        if (candidates && candidates.length > 0) {
            // Deterministic random based on name to keep it consistent if re-run? 
            // Or just random. creationData usually doesn't change after finish.
            const index = Math.floor(Math.random() * candidates.length);
            return candidates[index];
        }
    }

    // 3. Fallback Defaults
    if (gender === 'male') {
        return 'protagonist_wuxia_male_default';
    } else {
        return 'protagonist_wuxia_female_default';
    }
}
