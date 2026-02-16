/**
 * Universal Progression System - Type Definitions
 * 
 * Data-driven schema for defining genre-specific growth systems.
 * Each game mode defines its own stats and tier tables using these interfaces.
 */

/** Genre-specific custom stat definition (내공, 마나, 오러 등) */
export interface GenreStat {
    id: string;           // PostLogic output key: "neigong", "mana", "aura"
    displayName: string;  // UI display: "내공", "마나", "오러"
    description: string;  // AI guide: how this stat grows narratively
    defaultValue: number; // Initial value (usually 0)
    min: number;          // Minimum bound
    max: number;          // Maximum bound (-1 = unbounded)
    isFixed?: boolean;    // If true, AI cannot change this (e.g., mana affinity)
    toastTemplate?: string; // e.g., "{displayName} {delta}년", defaults to "{displayName} {delta}"
}

/** A single tier/rank in the progression table */
export interface ProgressionTier {
    id: string;                         // "third_rate", "1circle", "swordman"
    title: string;                      // "삼류", "1써클", "소드맨"
    conditions: Record<string, number>; // { "level": 10, "neigong": 0 } - ALL must be met
    message: string;                    // Displayed on rank-up
}

/** Complete progression definition for a game mode */
export interface ProgressionConfig {
    stats: GenreStat[];           // Custom stats for this genre
    tiers: ProgressionTier[];     // Rank table (ascending order)
    tierDisplayName: string;      // "경지", "써클", "등급" - label for the rank system
}

/**
 * Universal rank progression check.
 * Finds the highest tier where ALL conditions are met.
 */
export function checkUniversalProgression(
    config: ProgressionConfig,
    playerLevel: number,
    customStats: Record<string, number>,
    currentRankTitle: string | null
): { newTier: ProgressionTier } | null {
    const allStats: Record<string, number> = { level: playerLevel, ...customStats };

    let bestTier: ProgressionTier | null = null;

    for (const tier of config.tiers) {
        const allConditionsMet = Object.entries(tier.conditions).every(
            ([key, threshold]) => (allStats[key] || 0) >= threshold
        );
        if (allConditionsMet) bestTier = tier;
    }

    if (!bestTier) return null;

    // Only return if rank actually changed
    if (bestTier.title !== currentRankTitle) {
        return { newTier: bestTier };
    }

    return null;
}

/**
 * Generate a rules section for static logic prompt explaining custom stats.
 * e.g., "내공(Neigong): 수행의 깊이를 측정..."
 */
export function generateCustomStatsRulesPrompt(config: ProgressionConfig): string {
    if (!config.stats || config.stats.length === 0) return '';

    const lines = config.stats.map(stat => {
        let rule = `    - **${stat.displayName} (${stat.id})**: ${stat.description}`;
        if (stat.isFixed) rule += ` (시스템 고정값 - AI가 변경 불가)`;
        return rule;
    });

    return `
** [장르 고유 스탯 (Genre-Specific Stats)] **:
${lines.join('\n')}
`;
}

/**
 * Generate the "customStatsChange" portion for the output format section.
 * Only includes mutable stats (isFixed !== true).
 */
export function generateCustomStatsOutputFormat(config: ProgressionConfig): string {
    const mutableStats = config.stats.filter(s => !s.isFixed);
    if (mutableStats.length === 0) return '';

    const fields = mutableStats.map(s => `        "${s.id}Change": number`).join(',\n');
    const comments = mutableStats.map(s => `// ${s.displayName} 변화량`).join(', ');
    return `    "customStatsChange": { ${comments}
${fields}
    },`;
}

/**
 * Generate a dynamic prompt section showing current custom stats + tier conditions.
 * Injected into the dynamic logic prompt so AI can see current values and rank thresholds.
 */
export function generateProgressionContextPrompt(
    config: ProgressionConfig,
    customStats: Record<string, number>,
    currentRank: string | null,
    playerLevel: number
): string {
    const lines: string[] = [];

    // Current custom stats values
    if (config.stats.length > 0) {
        lines.push(`**[장르 스탯 현황 (Genre Stats)]**:`);
        for (const stat of config.stats) {
            const value = customStats[stat.id] ?? stat.defaultValue;
            lines.push(`- ${stat.displayName} (${stat.id}): ${value}${stat.isFixed ? ' (고정)' : ''}`);
        }
    }

    // Current rank and next rank conditions
    lines.push(`\n**[${config.tierDisplayName} 현황]**:`);
    lines.push(`- 현재 ${config.tierDisplayName}: ${currentRank || '없음'}`);
    lines.push(`- 현재 레벨: ${playerLevel}`);

    // Find current and next tier
    const allStats: Record<string, number> = { level: playerLevel, ...customStats };
    let currentTierIdx = -1;
    for (let i = 0; i < config.tiers.length; i++) {
        const tier = config.tiers[i];
        const met = Object.entries(tier.conditions).every(
            ([key, threshold]) => (allStats[key] || 0) >= threshold
        );
        if (met) currentTierIdx = i;
    }

    if (currentTierIdx >= 0 && currentTierIdx < config.tiers.length - 1) {
        const nextTier = config.tiers[currentTierIdx + 1];
        const condStr = Object.entries(nextTier.conditions)
            .map(([key, val]) => `${key} >= ${val}`)
            .join(', ');
        lines.push(`- 다음 ${config.tierDisplayName}: **${nextTier.title}** (조건: ${condStr})`);
    } else if (currentTierIdx >= config.tiers.length - 1) {
        lines.push(`- 최고 ${config.tierDisplayName} 달성`);
    }

    return lines.join('\n');
}
