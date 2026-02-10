
// [Updated] Granular 20-Step Tiers
export type RelationshipTier = string;

export interface TierInfo {
    tier: RelationshipTier;
    minScore: number;
    maxScore: number;
    description: string;
    allowedInteractions: string;
}

export const RELATIONSHIP_TIERS: TierInfo[] = [
    // --- NEGATIVE RANGE (-100 ~ -1) ---
    { tier: 'Lvl -10 (불대천지수)', minScore: -100, maxScore: -91, description: "살의를 품은 원수. 만나는 즉시 칼을 뽑음.", allowedInteractions: "즉각적인 공격. 대화 거부. 살기 등등." },
    { tier: 'Lvl -9 (적대)', minScore: -90, maxScore: -81, description: "명확한 적의. 기회만 되면 해치려 함.", allowedInteractions: "욕설, 비난, 함정 파기." },
    { tier: 'Lvl -8 (증오)', minScore: -80, maxScore: -71, description: "혐오하는 사이. 말 섞기조차 싫어함.", allowedInteractions: "냉대, 무시, 침 뱉기." },
    { tier: 'Lvl -7 (위협)', minScore: -70, maxScore: -61, description: "서로를 위협으로 간주.", allowedInteractions: "경고, 협박, 무기 과시." },
    { tier: 'Lvl -6 (견제)', minScore: -60, maxScore: -51, description: "경쟁자. 사사건건 방해함.", allowedInteractions: "비꼬기, 도발, 방해 공작." },
    { tier: 'Lvl -5 (불쾌)', minScore: -50, maxScore: -41, description: "비호감. 행동 하나하나가 거슬림.", allowedInteractions: "짜증, 퉁명스러운 대답." },
    { tier: 'Lvl -4 (불신)', minScore: -40, maxScore: -31, description: "믿지 못함. 의심의 눈초리.", allowedInteractions: "정보 숨기기, 거짓말, 떠보기." },
    { tier: 'Lvl -3 (경계)', minScore: -30, maxScore: -21, description: "경계심을 품음.", allowedInteractions: "거리 두기, 단답형 대화." },
    { tier: 'Lvl -2 (어색)', minScore: -20, maxScore: -11, description: "불편한 사이.", allowedInteractions: "어색한 침묵, 눈 피하기." },
    { tier: 'Lvl -1 (냉담)', minScore: -10, maxScore: -1, description: "관심 없으나 부정적 기류.", allowedInteractions: "무관심, 사무적인 태도." },

    // --- POSITIVE RANGE (0 ~ 100) ---
    { tier: 'Lvl 0 (초면)', minScore: 0, maxScore: 9, description: "완전한 타인. 무관심.", allowedInteractions: "무관심. **로맨스 불가**." },
    { tier: 'Lvl 1 (구면)', minScore: 10, maxScore: 19, description: "안면 튼 사이. 가벼운 인사.", allowedInteractions: "이름 기억함." },
    { tier: 'Lvl 2 (호감)', minScore: 20, maxScore: 29, description: "좋은 인상. 대화가 즐거움.", allowedInteractions: "웃음, 호의적인 태도. 식사 제안." },
    { tier: 'Lvl 3 (동료)', minScore: 30, maxScore: 39, description: "협력적인 관계.", allowedInteractions: "정보 공유. 가벼운 부탁. 등을 맡길 수 있음(초기)." },
    { tier: 'Lvl 4 (신뢰)', minScore: 40, maxScore: 49, description: "등을 맡길 수 있음.", allowedInteractions: "거짓 없는 대화. 위험 감수하고 도움." },
    { tier: 'Lvl 5 (절친)', minScore: 50, maxScore: 59, description: "사적인 비밀 공유 가능.", allowedInteractions: "깊은 고민 상담. 맹목적 내 편." },
    { tier: 'Lvl 6 (유대)', minScore: 60, maxScore: 69, description: "깊은 정서적 유대.", allowedInteractions: "눈빛만으로 통함." },
    { tier: 'Lvl 7 (은애)', minScore: 70, maxScore: 79, description: "썸/존경. 로맨틱 텐션 시작.", allowedInteractions: "설렘, 가벼운 스킨십(손잡기), 간접적 고백." },
    { tier: 'Lvl 8 (헌신)', minScore: 80, maxScore: 89, description: "깊은 사랑.", allowedInteractions: "사랑 고백. 키스. 목숨 건 헌신." },
    { tier: 'Lvl 9 (연인)', minScore: 90, maxScore: 999, description: "운명의 상대. 생사를 함께함.", allowedInteractions: "영혼의 동반자. 모든 것을 공유함." }
];

export class RelationshipManager {
    static getTier(score: number): TierInfo {
        return RELATIONSHIP_TIERS.find(t => score >= t.minScore && score <= t.maxScore) || RELATIONSHIP_TIERS[0];
    }

    static getCharacterInstructions(name: string, score: number): string {
        const tier = this.getTier(score);
        return `
[SYSTEM-INTERNAL DO NOT OUTPUT]
(Relationship Info for AI Judgment Only)
- Tier: ${tier.tier} (Score: ${score})
- Roleplay: ${tier.allowedInteractions}
- Constraint: ${tier.description} Do NOT exceed this intimacy.
[/SYSTEM-INTERNAL]
`.trim();
    }

    static getPromptContext(): string {
        return RELATIONSHIP_TIERS.map(t =>
            `- [${t.minScore} ~ ${t.maxScore}] ${t.tier}: ${t.description} (Interactions: ${t.allowedInteractions})`
        ).join('\n');
    }
}
