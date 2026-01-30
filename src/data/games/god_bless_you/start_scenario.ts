export const CHARACTER_CREATION_QUESTIONS = [
    {
        id: 'blesser_attitude',
        question: "1문) [세계관] 2025년, 균열과 이계종이 나타난 세상. 인류의 유일한 희망인 여성 능력자 '블레서'를 대하는 당신의 자세는?",
        options: [
            { value: 'fan', label: "블레서의 활약에 열광하며 덕질을 한다." },
            { value: 'wary', label: "알 수 없는 능력을 지닌 그녀들을 경계한다." },
            { value: 'hater', label: "특별 방위세 명목으로 돈을 뜯어가서 증오한다." },
            { value: 'business', label: "그들의 인기와 힘을 이용해 이득을 취하려 한다." },
            { value: 'inferiority', label: "남성은 각성할 수 없다는 현실에 깊은 박탈감을 느낀다." },
            { value: 'citizen', label: "그들이 있기에 우리가 안전하다고 생각하며 소소하게 응원한다." }
        ]
    },
    {
        id: 'personality_type',
        question: "2문) [성격] 혼란스러운 세상 속, 당신은 어떤 성향의 사람인가?",
        options: [
            { value: 'introvert', label: "조용하지만 꿋꿋하게 삶을 이어간다." },
            { value: 'extravert', label: "사람들과 어울리고 분위기를 띄우는 걸 좋아한다." },
            { value: 'psycho', label: "종잡을 수 없는 또라이 기질이 있다." },
            { value: 'egoist', label: "내 안위와 이득을 최우선으로 생각한다." }
        ]
    },
    {
        id: 'desire_type',
        question: "3문) [욕망] 만약 당신에게도 특별한 힘이 생긴다면, 무엇을 하고 싶은가?",
        options: [
            { value: 'revenge', label: "나를 깔보던 자들에게 본때를 보여준다." },
            { value: 'altruism', label: "사람들을 지키고 돕는 영웅이 된다." },
            { value: 'power', label: "막대한 부와 권력을 손에 쥔다." },
            { value: 'casanova', label: "수많은 블레서들과 깊은 관계를 맺고 싶다." }
        ]
    },
    {
        id: 'gapjil_response',
        question: "4문) [처세] 길을 가다가 S급 블레서의 고급 세단을 실수로 긁었다. 그녀가 차에서 내려 당신을 벌레 보듯 내려다본다. 당신의 반응은?",
        options: [
            { value: 'submissive', label: "90도로 허리를 굽히며 납작 엎드린다. 생존이 우선이다." },
            { value: 'rebellious', label: "상대가 누구든 할 말은 한다. 자존심은 굽히지 않는다." },
            { value: 'logical', label: "당황하지 않고 침착하게 절차대로 대응한다. 꼬투리 잡힐 짓은 안 한다." },
            { value: 'charm', label: "위기를 기회로? 능글맞게 넘겨본다." }
        ]
    },
    {
        id: 'narrative_perspective',
        question: "5문) [서술/묘사] 당신의 이야기는 어떤 방식으로 서술되길 원하는가?",
        options: [
            { value: '1인칭', label: "1인칭 주인공 시점" },
            { value: '3인칭', label: "3인칭 관찰자 시점" }
        ]
    },
    {
        id: 'core_setting',
        question: "6문) [핵심 설정] 당신의 영혼에 새겨진 근원은 무엇인가?",
        options: [
            { value: 'incompetent', label: "무능력자 일반인 (평범 그 자체, Cost: 0)" },
            { value: 'superhuman', label: "초인적인 전투능력을 가진 일반인 (신체 능력 특화, Cost: 100 Fate)", cost: 100, costType: 'fate' },
            { value: 'd_rank_hunter', label: "D급 헌터 (밸런스형, 라이센스 보유, Cost: 50 Fate)", cost: 50, costType: 'fate' },
            { value: 'academy_student', label: "블레서 아카데미의 학생 (잠재력/지능 특화, Cost: 100 Fate)", cost: 100, costType: 'fate' },
            { value: 's_rank_candidate', label: "S급 능력을 이제 막 각성한 예비 블레서 (먼치킨/마력 특화, Cost: 300 Fate)", cost: 300, costType: 'fate' }
        ]
    }
];

export const START_SCENARIO_TEXT = `

`;
