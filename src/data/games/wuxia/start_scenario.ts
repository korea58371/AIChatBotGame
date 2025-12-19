export const CHARACTER_CREATION_QUESTIONS = [
    {
        id: 'identity',
        question: "1문) 소협은 강호에서 어떤 신분으로 시작하시겠습니까?",
        options: [
            { value: 'orthodox_elite', label: "1. [명문정파] 규율과 명예를 중시하며, 사형제들의 모범이 되고자 하는 바른 성품." },
            { value: 'ronin_playboy', label: "2. [풍류낭인] 얽매임 없이 강호를 유람하며 술과 예술을 사랑하는 자유로운 영혼." },
            { value: 'ruthless_overlord', label: "3. [사파무인] 강함과 실리를 최우선으로 여기며, 목적을 위해 수단을 가리지 않는 냉철함." },
            { value: 'cute_shota', label: "4. [귀여운 막내] 천진난만한 외모와 성격으로 주변의 귀여움을 독차지하는 사랑스러운 성격." }
        ]
    },
    {
        id: 'desire',
        question: "2문) 소협이 무림에 나온 진정한 목적은 무엇입니까?",
        options: [
            { value: 'supreme', label: "1. [천하제일] 무공의 끝을 보고 우화등선하는 것." },
            { value: 'harem', label: "2. [하렘 건설] 천하의 절세미녀들을 모두 나의 여인으로 만드는 것." },
            { value: 'revenge', label: "3. [혈수복수] 가문을 멸문시킨 원수들을 찾아 처참하게 죽이는 것." },
            { value: 'wealth', label: "4. [거상/유유자적] 막대한 부를 쌓아 평생 놀고 먹는 것." }
        ]
    },
    {
        id: 'combat_style',
        question: "3문) 소협이 선호하는 무공 스타일은 무엇입니까?",
        options: [
            { value: 'sword_art', label: "1. [검법/도법] 화려하고 빠른 변화, 혹은 묵직한 한 방." },
            { value: 'fist_art', label: "2. [권각술] 강인한 신체를 무기로 삼는 투박하지만 강력한 무공." },
            { value: 'internal_art', label: "3. [내공/기공] 장풍과 지법 등 원거리에서 기를 쏘아 제압하는 무공." },
            { value: 'dirty_art', label: "4. [암기/독술] 승리를 위해서라면 수단과 방법을 가리지 않는 실전 무공." }
        ]
    },
    {
        id: 'reaction_beauty',
        question: "4문) [상황] 도적 떼에게 포위된 '절세미녀'를 발견했습니다. 소협의 선택은?",
        options: [
            { value: 'save_justice', label: "1. [협행] \"대낮에 무슨 짓이냐!\" 즉시 검을 뽑아 도적들을 베어버린다." },
            { value: 'flirt_save', label: "2. [작업] \"이런 미인을 험하게 다루다니... 제가 모셔다 드리지요.\" 멋지게 등장해 호감을 산다." },
            { value: 'ignore', label: "3. [외면] \"내 알 바 아니다.\" 득실이 없다면 조용히 지나간다." },
            { value: 'weak_act', label: "4. [반전] \"히익! 살려주세요!\" 겁쟁이인 척하며 도적들을 방심시킨 뒤 기습한다." }
        ]
    },
    {
        id: 'secret_manual',
        question: "5문) [상황] 전설의 마공서 '천마흡성공'을 손에 넣었습니다.",
        options: [
            { value: 'burn', label: "1. [파기] \"강호에 피바람을 몰고 올 물건이다.\" 미련 없이 태워버린다." },
            { value: 'learn', label: "2. [습득] \"힘에는 선악이 없다. 내가 쓰면 정의다.\" 익혀서 내 것으로 만든다." },
            { value: 'sell', label: "3. [판매] \"황궁 보물고에 팔면 평생 먹고 놀 수 있겠군!\" 비싸게 판다." },
            { value: 'hide', label: "4. [은닉] 일단 숨겨두고 나중에 필요할 때를 대비한다." }
        ]
    },
    {
        id: 'rival_fate',
        question: "6문) [상황] 당신을 괴롭히던 원수를 결투 끝에 쓰러뜨렸습니다. 마무리는?",
        options: [
            { value: 'mercy', label: "1. [용서] \"승부는 났다. 다시는 내 앞에 나타나지 마라.\" 등을 돌려 떠난다." },
            { value: 'kill', label: "2. [살해] \"후환은 남기지 않는다.\" 망설임 없이 숨통을 끊는다." },
            { value: 'cripple', label: "3. [폐인] \"죽는 것보다 더한 고통을 주지.\" 단전을 파괴해 무공을 못 쓰게 만든다." },
            { value: 'recruit', label: "4. [포섭] \"내 밑으로 들어와라. 더 큰 세상을 보여주지.\" 부하로 삼는다." }
        ]
    }
];

export const START_SCENARIO_TEXT = `

`;

