export const CHARACTER_CREATION_QUESTIONS = [
    {
        id: 'personality_tone',
        question: "1문) [성격] 당신은 전날 읽고 있던 '천하제일' 소설속으로 빙의되었다. 이 황당한 '무림' 세계를 어떤 태도로 대할 것인가?",
        options: [
            { value: 'humorous', label: "매사를 긍정적이고 유머러스하게 넘긴다." },
            { value: 'serious', label: "신중하고 진지하게 상황을 분석한다." },
            { value: 'cynical', label: "세상을 비꼬며 냉소적으로 바라본다." },
            { value: 'timid', label: "겁이 많아 매사에 조심스럽고 위축된다." },
            { value: 'domineering', label: "위압감 넘치는 태도로 상대를 찍어누른다." }
        ]
    },
    {
        id: 'morality_choice',
        question: "2문) [도덕성] 눈앞에서 약한 사람이 괴롭힘을 당하고 있다. 당신의 선택은?",
        options: [
            { value: 'good', label: "위험을 무릅쓰고라도 돕는다." },
            { value: 'pragmatic', label: "안전할 때만 돕는다." },
            { value: 'selfish', label: "철저히 외면하고 내 갈 길만 간다." },
            { value: 'calculation', label: "이득이 될 때만 움직인다." },
            { value: 'evil', label: "괴롭힘에 동참하여 더 심하게 짓밟는다." }
        ]
    },
    {
        id: 'speech_style',
        question: "3문) [말투] 당신은 이 세계 사람들에게 어떻게 말을 걸 것인가?",
        options: [
            { value: 'polite', label: "예의 바르고 정중하게 대한다." },
            { value: 'casual', label: "현대식 말투와 반말을 섞어 쓴다." },
            { value: 'bluff', label: "있어 보이는 척 무게를 잡는다." },
            { value: 'wuxia', label: "강호의 도리를 지키는 고풍스러운 말투." },
            { value: 'mute', label: "말수를 줄이고 필요한 말만 짧게 한다." }
        ]
    },
    {
        id: 'desire_type',
        question: "4문) [욕망] 이 세계에서 가장 먼저 얻고 싶은 것은 무엇인가?",
        options: [
            { value: 'money', label: "돈! (초기 자금 +500)" },
            { value: 'neigong', label: "내공! (초기 내공 10년)" },
            { value: 'martial_arts', label: "무공! (초기 기초무공 획득)" },
            { value: 'love', label: "연인! (히로인 중 한명이 소꿉친구로 설정)" },
            { value: 'fame', label: "명성! (초기 명성 +500)" }
        ]
    },
    {
        id: 'final_goal',
        question: "5문) 이 험난한 무림에서 당신의 최종 목표는?",
        options: [
            { value: 'go_home', label: "다 필요 없어! 와이파이 터지는 내 방으로 돌아갈래!" },
            { value: 'harem_king', label: "이왕 온 거, 무림의 미녀란 미녀는 다 내 걸로 만들겠다." },
            { value: 'tycoon', label: "현대의 지식(다단계, 주식)으로 무림 경제를 지배해주마." },
            { value: 'survival', label: "가늘고 길게 사는 게 최고다. 산속에 숨어서 만수무강하리라." },
            { value: 'murim_lord', label: "무력으로 천하를 제패하는 천하제일인이 되겠다." }
        ]
    },
    {
        id: 'narrative_perspective',
        question: "6문) [시점] 당신의 이야기가 어떻게 서술되길 원하십니까?",
        options: [
            { value: '1인칭', label: "1인칭 시점으로 서술" },
            { value: '3인칭', label: "3인칭 시점으로 서술" }
        ]
    }
];

// [START SCENARIO]: The protagonist reads the ending of "Cheonha Jeil" and wakes up in the novel.
export const START_SCENARIO_TEXT = `
당신은 현생의 고달픔을 달래주던 무협 소설 **'천하제일(天下第一)'**의 마지막 권을 덮었다.

이 소설은 정파가 승리하는 척하다가, 마지막 순간 **마교(魔敎)**가 발발하여 주인공을 비롯한 **모든 등장인물이 몰살당하는 '배드 엔딩'**으로 끝이 났다.
작가의 후기에는 *"현실은 동화가 아니다"*라는 헛소리만 적혀 있었고, 당신은 분노에 차서 책을 집어 던지며 잠이 들었다.

...그리고 눈을 떴을 때, 당신은 소설 속 세상에 와 있었다.

**[현재 시점]**:
- **정사대전(正邪大戰)** 발발까지: **2년**
- **마교(魔敎)**의 침공 및 **몰살 엔딩**까지: **5년**

다행인지 불행인지, 당신이 빙의한 육체는 소설 어디에도 이름이 나온 적 없는 **'완전한 엑스트라'**.
즉, 주인공이 뭘 하든 원작 설정이 꼬일까 봐 걱정할 필요가 없는 **자유로운 존재**다.

당신은 이 비극적인 몰살 엔딩을 피하고 살아남기로 결심한다.
물론, 알고 있는 **기연**과 **히로인들의 비밀**을 아주 조금(?) 이용하여.
`;
