
import { GameEvent } from '@/lib/event-manager';

export const GAME_EVENTS: GameEvent[] = [
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
    {
        id: 'rescue_beauty',
        type: 'RANDOM',
        priority: 50,
        probability: 0.15, // 15% Chance
        cooldown: 20,
        name: '미녀 구출',
        condition: (state) => {
            const loc = state.currentLocation || "";
            return loc.includes('산') || loc.includes('숲') || loc.includes('길');
        },
        prompt: `
        ## [EVENT: 위기일발의 미녀 (Damsel in Distress)]
        [Trigger]: 인적 드문 산길에서 비명 소리가 들린다.
        가보니 흉악한 산적들이나 사파의 무리들이 가녀린 여인을 포위하고 있다.
        
        - **전개**: 뻔한 상황이지만, 그 여인의 미모가 예사롭지 않다.
        - **행동**: 정의감에 불타 뛰어들 것인가? 아니면 상황을 관망하며 이득을 잴 것인가?
        - **보상 기대**: 그녀가 명문가의 여식이라면 막대한 사례금을, 아니라면... 인연(Romance)을?
        `
    },
    {
        id: 'corrupt_official',
        type: 'RANDOM',
        priority: 50,
        probability: 0.1,
        name: '탐관오리 응징',
        condition: (state) => !!state.currentLocation?.includes('객잔') || !!state.currentLocation?.includes('마을'),
        prompt: `
        ## [EVENT: 민심의 분노 (Wrath of the People)]
        [Trigger]: 마을이 소란스럽다. 관아의 포졸들이 들이닥쳐 가난한 상인이나 백성의 고혈을 짜내고 있다.
        탐관오리가 직접 가마를 타고 나타나 거드름을 피운다.
        
        - **상황**: 백성들의 원망 어린 눈빛, 하지만 무력이 무서워 나서지 못한다.
        - **주인공의 개입**: 참을 수 없는 분노, 혹은 '이때다' 싶은 영웅 심리.
        - **사이다**: 권력을 믿고 설치는 관리 앞에서 무림인의 '무력'이 얼마나 무서운지 보여주어라.
        `
    },

    // ============================================================
    // [MODERN WUXIA PARODY] 현대적 풍자 & 개그
    // ============================================================
    {
        id: 'golden_alley',
        type: 'RANDOM',
        priority: 60,
        probability: 0.08, // 8% Chance
        cooldown: 30,
        name: '골목식당 객잔',
        condition: (state) => !!state.currentLocation?.includes('객잔'),
        prompt: `
        ## [EVENT: 골목상권 살리기 (Kitchen Nightmare in Jianghu)]
        [Trigger]: 우연히 들어간 객잔. 파리만 날리고 음식 맛은 형편없다.
        주인장 오누이는 빚더미에 앉아 울고 있다.
        
        - **현대적 풍자**: 백종원 빙의. "기본이 안 되어 있다!"
        - **솔루션**:
          1. **메뉴 축소**: "만두랑 국수만 해!"
          2. **내공 조리법**: "반죽에 내공을 실어서 쫄깃하게!"
          3. **마케팅**: "무림맹주가 즐겨찾는(거짓말) 맛집" 소문내기.
        - **결말**: 대박 난 가게와 경쟁 업체의 견제(프랜차이즈 갑질) 참교육.
        `
    },
    {
        id: 'coin_crash',
        type: 'RANDOM',
        priority: 70,
        probability: 0.05,
        once: true,
        name: '천년설삼 코인',
        condition: (state) => state.turnCount > 15,
        prompt: `
        ## [EVENT: 천년설삼 투기 광풍 (Ginseng Coin Crash)]
        [Trigger]: 강호에 "북해 빙궁에서 독점 채굴하던 천년설삼 광맥이 터졌다"는 소문과 함께,
        '설삼 전표(Exchange Ticket)'의 가격이 미친 듯이 치솟고 있다. (무림판 비트코인)
        
        - **광기**: 너도나도 검을 팔아 전표를 사재기한다. "존버는 승리한다!"
        - **위기**: 주인공도 솔깃한다. 지금 들어가면 2배?
        - **반전**: 사실은 사파의 작전 세력이 퍼뜨린 헛소문. 가격이 폭락하고 한강(절벽)에 줄을 선 무림인들.
        - **교훈**: 땀 흘려 얻지 않은 내공은 허상이다.
        `
    },
    {
        id: 'csi_wuxia',
        type: 'RANDOM',
        priority: 40,
        probability: 0.1,
        name: '과학수사대 CSI',
        condition: (state) => !!state.currentLocation, // Anywhere
        prompt: `
        ## [EVENT: 강호 과학수사대 (Forensic Investigation)]
        [Trigger]: 의문의 살인 사건 발생. 관아에서는 단순 객사로 처리하려 한다.
        하지만 주인공의 눈에는 다르다.
        
        - **추리**:
          1. "시체의 혈색이 푸르다? 이건 빙백신장(Ice Palm)의 흔적이야."
          2. "발자국 깊이를 보니, 범인은 경공의 고수지만 왼쪽 다리를 다쳤군."
        - **전개**: 무식하게 칼부터 뽑는 무림인들 사이에서, **지적이고 냉철한 추리**로 범인을 지목하여 꼼짝 못 하게 만들어라.
        `
    },
    {
        id: 'namjang_romance',
        type: 'RANDOM',
        priority: 65,
        probability: 0.07,
        once: true,
        name: '남장여자 로맨스',
        condition: (state) => state.turnCount > 10,
        prompt: `
        ## [EVENT: 위험한 의형제 (Coffee Prince Romance)]
        [Trigger]: 여행 중에 만난 미소년 협객과 의기투합하여 '의형제'를 맺었다.
        그런데 이 녀석, 묘하게 예쁘장하고 스킨십을 기겁하며 피한다.
        
        - **상황**:
          1. **합숙**: "형님, 저는 옷을 입고 자는 버릇이 있어서..." (철벽 방어)
          2. **목욕**: "저는 피부가 약해서 혼자 씻겠습니다!"
        - **위기**: 물에 빠지거나 옷이 찢어져서 **여자인 게 들통날 뻔한** 아슬아슬한 순간.
        - **감정**: 주인공은 자신이 남자를 좋아하는 줄 알고 정체성 혼란에 빠진다. (개그 포인트)
        `
    },

    // ============================================================
    // [SUB STORIES] 기타 기연 및 성장
    // ============================================================
    {
        id: 'realization_training',
        type: 'SUB',
        priority: 30,
        name: '깨달음과 수련',
        condition: (state) => {
            const turn = state.turnCount || 0;
            const rank = state.playerStats?.playerRank || '삼류';
            // Trigger if stuck in rank for a while (Turn 10+)
            return turn >= 10 && (rank === '삼류' || rank === '이류');
        },
        prompt: `
        ## [EVENT: 무학의 깨달음 (Martial Realization)]
        [Trigger]: 오랫동안 경지가 정체되어 있다.
        떨어지는 낙엽, 흐르는 물, 혹은 대장장이의 망치질 소리에서 문득 무학의 이치를 깨닫는다.
        깊은 수련(폐관수련)을 통해 한 단계 도약할 기회다.
        `
    },
    {
        id: 'lucky_encounter',
        type: 'RANDOM',
        priority: 80,
        probability: 0.05, // Rare
        name: '기연 획득',
        condition: (state) => !!state.currentLocation?.includes('산') || !!state.currentLocation?.includes('절벽'),
        prompt: `
        ## [EVENT: 절벽 아래의 기적 (Miracle under the Cliff)]
        [Trigger]: 쫓기거나 실수로 절벽 아래로 떨어졌다. 죽은 줄 알았는데 나뭇가지에 걸려 살았다.
        눈앞에 덩굴로 가려진 낡은 동굴이 보인다.
        
        - **탐험**: 먼지 쌓인 해골과 낡은 양피지. 혹은 영롱하게 빛나는 열매(영약).
        - **보상**: 전설적인 고수의 유산이나, 만독불침의 신체.
        - **대가**: 공짜는 없다. 유언을 들어주거나, 영약의 고통을 견뎌야 한다.
        `
    }
];
