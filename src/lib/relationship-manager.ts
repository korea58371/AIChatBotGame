
export type RelationshipTier = 'Stranger' | 'Acquaintance' | 'Friend' | 'CloseFriend' | 'Lover';

export interface TierInfo {
    tier: RelationshipTier;
    minScore: number;
    maxScore: number;
    description: string;
    allowedInteractions: string;
}

export const RELATIONSHIP_TIERS: TierInfo[] = [
    {
        tier: 'Stranger',
        minScore: -100,
        maxScore: 20,
        description: "낯선 사람 또는 엄격한 비즈니스 관계.",
        allowedInteractions: "격식체 사용. 예의 바르지만 거리를 둠. **로맨스 절대 불가**. 상호작용은 방어적이어야 함."
    },
    {
        tier: 'Acquaintance',
        minScore: 21,
        maxScore: 40,
        description: "이름은 아는 사이, 우호적이지만 가깝지는 않음.",
        allowedInteractions: "가벼운 존댓말. 스몰 토크. 표면적인 정보 공유. **로맨스 금지**."
    },
    {
        tier: 'Friend',
        minScore: 41,
        maxScore: 70,
        description: "신뢰할 수 있는 친구.",
        allowedInteractions: "편안한 말투(반말 가능). 농담. 감정적 지지. 가벼운 플러팅(장난스러운 수준만). 신체 접촉은 하이파이브나 등을 두드리는 정도로 제한."
    },
    {
        tier: 'CloseFriend',
        minScore: 71,
        maxScore: 90,
        description: "깊고 개인적인 유대감. 잠재적인 연인 관계.",
        allowedInteractions: "비밀 공유. 취약점 드러내기. 강한 로맨틱 텐션/암시. 감정적인 순간에 손 잡기나 포옹 가능. **아직 고백 단계는 아님**."
    },
    {
        tier: 'Lover',
        minScore: 91,
        maxScore: 999,
        description: "깊이 사랑하는 사이, 헌신적인 관계 또는 영혼의 동반자.",
        allowedInteractions: "완전한 로맨스. 사랑 고백. 키스 및 스킨십. 무조건적인 지지."
    }
];

export class RelationshipManager {
    static getTier(score: number): TierInfo {
        return RELATIONSHIP_TIERS.find(t => score >= t.minScore && score <= t.maxScore) || RELATIONSHIP_TIERS[0];
    }

    static getCharacterInstructions(name: string, score: number): string {
        const tier = this.getTier(score);
        return `
- **관계 (Relationship)**: ${tier.tier} (점수: ${score})
- **행동 규칙 (Behavior Rule)**: ${tier.allowedInteractions}
- **제약 사항 (Constraint)**: ${tier.description} 이 친밀도 레벨을 초과하여 행동하지 마십시오.
`.trim();
    }
}
