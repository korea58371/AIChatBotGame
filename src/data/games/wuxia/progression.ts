import { ProgressionConfig } from '@/lib/engine/progression-types';

/**
 * Wuxia Progression Data
 * 커스텀 스탯(내공) + 경지 테이블 정의
 */
export const wuxiaProgression: ProgressionConfig = {
    stats: [
        {
            id: 'neigong',
            displayName: '내공',
            description: '내공심법 수련을 통해 증가. 영약 복용, 내공 전수, 큰 깨달음으로도 획득. 단위: 년',
            defaultValue: 0,
            min: 0,
            max: -1,
            toastTemplate: '{displayName} {delta}년',
            gainConditions: '⚠️ 턴당 내공 총 변화량 엄격 제한. 아래 범위를 절대 초과 금지:\n' +
                '  - [수련/시간경과] 며칠~수일 집중 수련 → +1~2. 수개월 묘사 → +2~3. 턴당 최대 +3.\n' +
                '  - [영약/선단 복용] 희귀 약재 직접 복용 → +3~10. 천년급 영약이라도 최대 +15.\n' +
                '  - [기연 (극히 드묾)] 고수의 내공 직접 전수, 고대 비급 핵심 깨달음, 영기 흡수, 환골탈태 → +10~30. 기연이라도 최대 +30 엄수.\n' +
                '  - ❌ 절대 금지: 턴당 +10 초과 (기연 제외). 기연이라도 +30 초과 금지. "15년 상승", "20년 증가" 같은 대량 증가 출력 금지.',
            lossConditions: '치명적 부상으로 내상, 단전 파괴, 내공을 타인에게 전수(넘김)',
            noChangeConditions: '전투, 대화, 휴식, 운기조식 → MP 회복만. 내공 연수 변화 없음'
        }
    ],
    tiers: [
        { id: 'intro', title: '입문', conditions: { level: 1, neigong: 0 }, message: '무학의 기초에 발을 들였습니다.' },
        { id: 'third_rate', title: '삼류', conditions: { level: 10, neigong: 0 }, message: '미약하지만 내공의 흐름을 느끼기 시작했습니다.' },
        { id: 'second_rate', title: '이류', conditions: { level: 30, neigong: 10 }, message: '내공이 단전에 쌓이며 진정한 무인으로 거듭났습니다.' },
        { id: 'first_rate', title: '일류', conditions: { level: 50, neigong: 20 }, message: '검 끝에 기를 실을 수 있는 경지에 올랐습니다.' },
        { id: 'peak', title: '절정', conditions: { level: 70, neigong: 40 }, message: '검기를 자유자재로 다루며 강호의 고수로 인정받습니다.' },
        { id: 'transcendent', title: '초절정', conditions: { level: 90, neigong: 60 }, message: '검강을 휘두르며 인간의 한계를 초월하기 시작했습니다.' },
        { id: 'harmony', title: '화경', conditions: { level: 110, neigong: 120 }, message: '환골탈태. 육체의 한계를 벗어나 자연과 하나가 됩니다.' },
        { id: 'mystic', title: '현경', conditions: { level: 130, neigong: 200 }, message: '반로환동. 이기에 도달하여 생사를 초월한 전설이 되었습니다.' },
        { id: 'life_death', title: '생사경', conditions: { level: 160, neigong: 500 }, message: '신의 영역. 등선하여 무의 극치에 도달했습니다.' }
    ],
    tierDisplayName: '경지'
};
