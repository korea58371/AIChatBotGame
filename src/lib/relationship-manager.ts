
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
        description: "A stranger or strictly professional relationship.",
        allowedInteractions: "Formal speech. Polite but distant. NO ROMANCE allowed. Interactions should be guarded."
    },
    {
        tier: 'Acquaintance',
        minScore: 21,
        maxScore: 40,
        description: "Known by name, friendly but not close.",
        allowedInteractions: "Casual polite speech. Small talk. Sharing surface-level info. ROMANCE PROHIBITED."
    },
    {
        tier: 'Friend',
        minScore: 41,
        maxScore: 70,
        description: "A trusted friend.",
        allowedInteractions: "Comfortable speech. Joking. Emotional support. Light flirting (playful only). Physical contact limited to high-fives or back pats."
    },
    {
        tier: 'CloseFriend',
        minScore: 71,
        maxScore: 90,
        description: "A deep, personal bond. Potential romantic interest.",
        allowedInteractions: "Sharing secrets. Vulnerability. Strong romantic hints/tension. Hand holding or hugging in emotional moments. NO CONFESSION yet."
    },
    {
        tier: 'Lover',
        minScore: 91,
        maxScore: 999,
        description: "Deeply in love, committed, or soulmates.",
        allowedInteractions: "Full romance. Confessions of love. Kissing and intimacy. Unconditional support."
    }
];

export class RelationshipManager {
    static getTier(score: number): TierInfo {
        return RELATIONSHIP_TIERS.find(t => score >= t.minScore && score <= t.maxScore) || RELATIONSHIP_TIERS[0];
    }

    static getCharacterInstructions(name: string, score: number): string {
        const tier = this.getTier(score);
        return `
- **Relationship**: ${tier.tier} (Score: ${score})
- **Behavior Rule**: ${tier.allowedInteractions}
- **Constraint**: ${tier.description} DO NOT exceed this level of intimacy.
`.trim();
    }
}
