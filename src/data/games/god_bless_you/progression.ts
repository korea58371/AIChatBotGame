import { ProgressionConfig } from '@/lib/engine/progression-types';

/**
 * God Bless You Progression Data
 * 커스텀 스탯(마나적합률) + 헌터 등급 테이블 정의
 */
export const gbyProgression: ProgressionConfig = {
    stats: [
        {
            id: 'mana_affinity',
            displayName: '마나적합률',
            description: '마나에 대한 친화력. 일반적으로 자연적으로 증가하지 않지만 이레귤러가 존재. 거의 고정값.',
            defaultValue: 0,
            min: 0,
            max: 100,
            isFixed: true,
            toastTemplate: '{displayName} {delta}%'
        }
    ],
    tiers: [
        { id: 'rank_none', title: '일반인', conditions: { level: 0 }, message: '평범한 일반인입니다.' },
        { id: 'rank_f', title: 'F급', conditions: { level: 10 }, message: '미약하지만 마나를 느끼기 시작했습니다.' },
        { id: 'rank_e', title: 'E급', conditions: { level: 20 }, message: '기초적인 이능력을 사용할 수 있습니다.' },
        { id: 'rank_d', title: 'D급', conditions: { level: 30 }, message: '공인 헌터 자격을 획득했습니다.' },
        { id: 'rank_c', title: 'C급', conditions: { level: 40 }, message: '중급 헌터로 인정받습니다.' },
        { id: 'rank_b', title: 'B급', conditions: { level: 50 }, message: '상급 헌터의 영역에 진입했습니다.' },
        { id: 'rank_a', title: 'A급', conditions: { level: 60 }, message: '국가급 전력으로 분류됩니다.' },
        { id: 'rank_s', title: 'S급', conditions: { level: 70 }, message: '인류 최강의 영역. 전설적인 존재입니다.' },
        { id: 'rank_ss', title: 'SS급', conditions: { level: 90 }, message: '측정 불가. 인류의 한계를 초월한 존재입니다.' }
    ],
    tierDisplayName: '등급'
};
