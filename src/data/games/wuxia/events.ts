import { GameState } from '@/lib/store';
import { EventManager, GameEvent } from '@/lib/engine/event-manager';

export const GAME_EVENTS: GameEvent[] = [
    // ============================================================
    // [INTRO] 시작 이벤트
    // ============================================================
    {
        id: 'intro_survival',
        type: 'MAIN',
        priority: 0, // Highest Priority
        once: true,
        name: '강호의 비정함',
        condition: (state) => {
            return (state.turnCount || 0) <= 1;
        },
        prompt: `
        ## [EVENT: 강호의 비정함 (Ruthless Jianghu)]
        [Trigger]: 강호에 첫발을 내디뎠으나, 현실은 냉혹하다.
        
        **상황**: 가진 것 없는 떠돌이 신세. 배가 고프고 날은 저물어간다.
        **목표 설정**: 무공 비급을 찾는 것이 문제가 아니다. **'오늘 밤 묵을 곳과 한 끼 식사'**를 해결하는 것이 급선무다.
        **행동 유도**: 주막에서 설거지를 하거나, 장작을 패는 등 **단순 육체노동**이나 **구걸**을 통해 끼니를 해결하라.
        **금지 사항 (MANDATORY)**: '의문의 사람을 돕거나', '비밀 물건을 운반하는' 클리셰 전개를 절대 금지한다. 오직 처절한 생존 노동에만 집중하라.
        `
    },
    // ============================================================
    // [MAIN STORY] 핵심 서사
    // ============================================================
    {
        id: 'blood_cult_appearance',
        type: 'MAIN',
        priority: 5,
        once: true,
        name: '혈교의 태동',
        condition: (state) => {
            const turn = state.turnCount || 0;
            const rank = state.playerStats?.playerRank || '삼류';
            const isHighRank = ['절정', '화경', '현경', '생사경'].includes(rank);
            return turn >= 50 && isHighRank;
        },
        prompt: `
        ## [EVENT: 혈교의 등장 (Rise of the Blood Cult)]
        [Trigger]: 강호의 균형이 무너지고 있다.
        오랫동안 자취를 감췄던 '혈교(Blood Cult)'의 무리들이 활동을 시작했다는 흉흉한 소문이 퍼진다.
        마을이나 객잔에서 의문의 실종 사건이나 기이한 죽음에 대한 이야기를 듣게 되며, 심상치 않은 전조를 묘사하라.
        평화롭던 일상에 드리우는 어두운 그림자를 강조하라.
        `
    },

    // ============================================================
    // [CLASSIC WUXIA] 정통 무협 이벤트
    // ============================================================
    {
        id: 'recruitment_test',
        type: 'SUB',
        priority: 20,
        once: true,
        name: '입문/채용 시험',
        // Condition: Early game (Turn 5~30), Low Rank + Specific Location only
        condition: (state) => {
            const turn = state.turnCount || 0;
            const rank = state.playerStats?.playerRank || '삼류';

            // 1. 기간 및 등급 제한
            if (turn < 5 || turn > 30 || (rank !== '삼류' && rank !== '이류')) return false;

            // 2. 장소 제한 (거대 세력 근처에서만 발생)
            const location = state.currentLocation || "";
            const validLocations = ['무림맹', '가', '세가', '표국', '관청', '도시', '장안', '낙양', '성도'];
            // '가'(Family) matches 남궁가, 당가, 팽가 etc. '표국'(Escort), '관청'(Office)
            // Wilderness/Mountains/Caves should be excluded.

            const isNearFaction = validLocations.some(loc => location.includes(loc));
            if (!isNearFaction) return false;

            // 3. 확률 대폭 감소 (매 턴 5% 확률 -> 25턴 동안 약 72% 확률로 1번 발생, 운 없으면 안 뜸)
            return Math.random() < 0.05;
        },
        prompt: `
        ## [EVENT: 등용문 (The Gate to Success)]
        [Trigger]: 명문 세가나 무림맹, 혹은 거대 표국에서 '호위무사'나 '외문제자'를 뽑는다는 공고가 붙었다.
        수많은 낭인들과 하급 무사들이 입신영달을 꿈꾸며 모여들었다.
        
        - **상황**: 시험장 앞의 긴장된 분위기, 라이벌들의 견제.
        - **선택**: 응시하여 실력을 증명할 것인가? 아니면 구경만 하다 다른 기회를 찾을 것인가?
        - **재미 요소**: 시험 과정에서의 부정행위 적발, 혹은 압도적인 실력 차이로 교관을 놀라게 하기.
        `
    },
    {
        id: 'tournament_rookie',
        type: 'SUB',
        priority: 15,
        once: true,
        name: '후기지수 비무대회',
        // Condition: Rank is Second Rate or First Rate (Not Master yet)
        condition: (state) => {
            const turn = state.turnCount || 0;
            const rank = state.playerStats?.playerRank || '삼류';
            return turn >= 20 && ['이류', '일류'].includes(rank);
        },
        prompt: `
        ## [EVENT: 잠룡 승천 (Rise of the Hidden Dragons)]
        [Trigger]: 강호의 유망주들을 가리는 '소룡회(小龍會)'가 개최된다.
        각 문파의 후기지수들이 명예를 걸고 출전한다.
        
        - **분위기**: 젊은 혈기가 넘치는 축제 분위기.
        - **기대감**: 우승자에게는 '별호(Title)'와 '영약'이 주어진다.
        - **주인공의 위치**: '듣보잡' 취급을 받으며 예선에 참가하지만, 본선에서 모두를 경악시킬 잠재력을 가지고 있다.
        `
    },
    // ============================================================
    // [SYSTEM] 자동 성장 및 시간 스킵 이벤트
    // ============================================================
    {
        id: 'generic_cultivation',
        type: 'SUB',
        priority: 10,
        once: false, // Can happen multiple times
        name: '무도수련 (Martial Cultivation)',
        condition: (state) => {
            // Only if user explicitly wants to train
            return false; // Triggered via AI reasoning or manual call in some systems, 
            // but here we define it so the AI can reference the 'template'.
        },
        prompt: `
        ## [EVENT: 무도수련 (Martial Cultivation)]
        [Trigger]: 유저가 수련, 운기조식, 혹은 무공 익히기를 시도함.
        
        **가이드**:
        1. **시간 스킵**: "...열흘이 흘렀다.", "...한 달이 지났다." 등 과감한 시간 경과를 묘사하라.
        2. **경지 상승**: 주인공의 '천재성'을 강조하며, 단련된 기운이 단전에 쌓이는 과정을 생생히 묘사하라. (10일 당 내공 약 1년치 응축 가능)
        3. **상태 변화**: <시간> 태그를 경과된 시간만큼 업데이트하라.
        `
    }
];
