
import { GameEvent } from '@/lib/event-manager';

export const GAME_EVENTS: GameEvent[] = [
    {
        id: 'awakening_f_rank',
        priority: 1,
        type: 'MAIN',
        once: true,
        name: 'F급 각성',
        condition: (state) => {
            // 3턴 이상, 아직 랭크가 없거나 '일반인'인 경우
            const turn = state.turnCount || 0;
            const rank = state.playerStats?.playerRank || '일반인';
            return turn >= 3 && rank === '일반인';
        },
        prompt: `
        ## [EVENT: F급의 각성 (Awakening of the F-Class)]
        [Trigger]: 지금까지 '일반인'에 불과했던 주인공에게 운명의 순간이 찾아왔다.
        
        **F급 기프트: '처세술'**이 갑작스럽게 각성하는 과정을 묘사하라.
        - **증상**: 뇌를 관통하는 듯한 전율, 눈앞에 쏟아지는 데이터 스트림.
        - **효과**: 타인의 '욕구'와 '기분'을 본능적으로 감지할 수 있게 됨 (마치 게임 UI처럼 보임).
        - **감정선**: 당혹감과 동시에 느껴지는 기묘한 명료함.
        
        이번 턴의 출력은 이 각성 과정에 집중할 것.
        `
    },
    {
        id: 'poverty_strike',
        priority: 50,
        type: 'SUB',
        once: true,
        name: '빈곤의 습격',
        condition: (state) => {
            const gold = state.playerStats?.gold || 0;
            const turn = state.turnCount || 0;
            return gold <= 0 && turn > 5;
        },
        prompt: `
        ## [EVENT: 현실 자각 (Reality Check)]
        [Trigger]: 주인공의 지갑 상황은 처참하다 (소지금 0 Gold).
        
        가난으로 인해 겪는 굴욕적이거나 절박한 순간을 묘사하라.
        (예: 공공장소에서 크게 울리는 꼬르륵 소리, 자판기 음료수조차 고민하다 포기함, 또는 대출 권유 문자 수신 등).
        화려한 '각성자의 세계'와 대비되는 초라한 '빈 지갑'의 현실을 강조하라.
        `
    }
];
