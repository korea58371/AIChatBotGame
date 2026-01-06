
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
    statsModifier?: Partial<PlayerStats>;
} | null {
    const trimmedName = name.trim();

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
