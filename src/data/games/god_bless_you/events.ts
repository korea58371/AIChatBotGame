import { GameState } from '@/lib/store';
import { GameEvent } from '@/lib/engine/event-manager';

export const GAME_EVENTS: GameEvent[] = [
    {
        id: 'intro_debt_crisis',
        priority: 0, // Highest Priority
        type: 'MAIN',
        once: true,
        name: '월세 독촉',
        condition: (state) => {
            return (state.turnCount || 0) <= 1; // Trigger immediately at start
        },
        prompt: `
        ## [EVENT: 월세 독촉 (Rent Crisis)]
        [Trigger]: 게임 시작. 주인공의 핸드폰이 요란하게 울린다. 집주인(혹은 사채업자)의 독촉 문자다.
        
        **상황**: 통장 잔고 0원. 당장 일주일 안에 **500,000원(500 Gold)**을 마련하지 못하면 쫓겨날 위기다.
        **목표 설정**: 거창한 영웅적 목표가 아니다. 오직 '돈을 버는 것'이 당면한 지상 과제다.
        **행동 유도**: 알바를 찾거나, 돈이 될만한 의뢰를 찾아나서야 한다. (세계 평화 따위 챙길 여력이 없다).
        `
    },
    {
        id: 'awakening_f_rank',
        priority: 1,
        type: 'MAIN',
        once: true,
        name: 'F급 각성',
        condition: (state) => {
            // 6턴 이상, 아직 랭크가 없거나 '일반인' 혹은 'F급'인 경우 (레벨 매핑으로 인해 이미 F급일 수 있음)
            const turn = state.turnCount || 0;
            const rank = state.playerStats?.playerRank || '일반인';
            // [Fix] F급도 포함 (Level 1 자동 매핑 대응)
            return turn >= 6 && (rank === '일반인' || rank === 'F급' || rank === 'F-Rank');
        },
        prompt: `
        ## [EVENT: F급의 각성 (Awakening of the F-Class)]
        [Trigger]: 지금까지 '일반인'에 불과했던 주인공에게 운명의 순간이 찾아왔다.
        
        **F급 기프트: '처세술'**이 갑작스럽게 각성하는 과정을 묘사하라.
        - **증상**: 거창한 전조 없이, 그저 상대가 듣고 싶어 하는 말이 본능적으로 떠오름.
        - **효과**: 생각할 겨를도 없이 상대의 비위를 맞추는 현란한 아첨이 줄줄 쏟아짐.
        - **감정선**: 고작 이딴 능력이나 각성했다는 깊은 실망감과 자괴감.
        
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
    },
    {
        id: 'awakening_han_gaeul',
        priority: 10,
        type: 'MAIN', // 필수 진행
        once: true,
        name: '한가을 각성',
        condition: (state) => {
            const turn = state.turnCount || 0;
            // 20턴 이상 + 한가을이 현장에 있음 (선택적) or 그냥 턴 되면 강제 이벤트?
            // 유저 요청: "게임 플레이 20턴 이후에 블래서로 각성하게 이벤트 추가"
            return turn >= 20;
        },
        prompt: `
        ## [EVENT: 흩날리는 단풍 (Awakening of Autumn)]
        [Trigger]: 20번째 턴이 도래하여, '한가을'의 잠재력이 폭발한다.
        
        **상황**: 위기의 순간 혹은 깨달음의 순간. 한가을이 **'블레서(Blesser)'**로 각성하는 장면을 묘사하라.
        - **각성 스킬**: [낙엽 베기 (Falling Leaves Cut)] - B급 위력.
        - **묘사**: 그녀의 검 끝에서 붉은 단풍 형상의 검기가 흩날리며 적을 베어낸다.        
        (이 이벤트 이후, 한가을은 '낙엽 베기' 스킬을 사용할 수 있게 된다.)
        `
    }
];
