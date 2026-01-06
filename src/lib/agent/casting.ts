import { characters_main_typed, characters_supporting_typed, CharacterData, SystemLogic } from '../../data/games/wuxia/jsons/characters';

export interface CastingCandidate {
    id: string;
    name: string;
    data: CharacterData;
    score: number;
    reasons: string[];
}

interface GameState {
    phase?: number;
    currentLocation?: string; // or inferred from last context
    lastTurnSummary?: string;
    activeCharacters?: string[]; // IDs
    [key: string]: any;
}

export class AgentCasting {
    private static readonly REGION_HOME_MULTIPLIER = 2.0;
    private static readonly REGION_ACTIVE_MULTIPLIER = 1.0;
    private static readonly REGION_WILDCARD_MULTIPLIER = 0.5; // [NEW] Lower priority for "Anywhere" matches
    private static readonly REGION_MISMATCH_PENALTY = 0.2; // [NEW] Soft Filter
    private static readonly LIFECYCLE_PENALTY = 0.1; // [NEW] Soft Filter for Phase
    private static readonly TAG_BONUS = 0.5;
    private static readonly RELATIONSHIP_BONUS = 1.0; // [NEW] Bonus for existing relationships
    private static readonly USER_MENTION_BONUS = 10.0; // [CRITICAL] Force include if mentioned
    private static readonly CONTEXT_MENTION_BONUS = 5.0; // [NEW] Narrative consistency
    private static readonly THRESHOLD = 0.01; // [Modified] Low threshold for multi-tiered filtering

    static async analyze(
        gameState: GameState,
        summary: string,
        userInput: string = "",
        playerLevel: number = 1 // [Modified] Use Level instead of Realm string
    ): Promise<CastingCandidate[]> {
        const currentPhase = gameState.phase || 1;
        // Clean location: remove specific details if needed, but for now use raw string matching
        // In Wuxia, location format might be "Region_Place" e.g. "하북_팽가"
        let specificLocation = gameState.currentLocation || "중원";

        // [Fix] Normalize "home" (UI default) to "중원" to ensure candidates appear at start
        if (specificLocation.toLowerCase() === 'home') {
            specificLocation = "중원";
        }

        const regionPrefix = specificLocation.split('_')[0]; // "하북", "사천", "중원" etc.

        const activeIds = new Set(gameState.activeCharacters || []);

        const allCharacters = { ...characters_main_typed, ...characters_supporting_typed };
        const candidates: CastingCandidate[] = [];

        // [Helper] Rank Value Mapper (Based on Wuxia Constants)
        const getRankFromLevel = (level: number): number => {
            if (level >= 80) return 7; // Mystic (현경)
            if (level >= 60) return 6; // Harmony (화경)
            if (level >= 40) return 5; // Transcendent (초절정)
            if (level >= 30) return 4; // Peak (절정)
            if (level >= 20) return 3; // 1st Rate (일류)
            if (level >= 10) return 2; // 2nd Rate (이류)
            if (level >= 1) return 1;  // 3rd Rate (삼류)
            return 0;
        };

        // [Helper] String Rank Mapper (For NPCs who still use string ranks in JSON)
        const getRankFromString = (rankStr: string): number => {
            if (!rankStr) return 0;
            if (rankStr.includes('현경') || rankStr.includes('신화') || rankStr.includes('SS')) return 7;
            if (rankStr.includes('화경') || rankStr.includes('탈각') || rankStr.includes('S')) return 6;
            if (rankStr.includes('초절정') || rankStr.includes('A')) return 5;
            if (rankStr.includes('절정') || rankStr.includes('B')) return 4;
            if (rankStr.includes('일류') || rankStr.includes('C')) return 3;
            if (rankStr.includes('이류') || rankStr.includes('D')) return 2;
            if (rankStr.includes('삼류') || rankStr.includes('E') || rankStr.includes('F')) return 1;
            return 0;
        };

        const playerRankVal = getRankFromLevel(playerLevel);

        // [Phase Synchronization]
        // 시스템 프롬프트(system.ts)와 동일하게, 플레이어 경지에 따라 Phase를 보정합니다.
        // 일류(3) 이상 -> Phase 2 (강호 출두)
        // 화경(6) 이상 -> Phase 3 (정점)
        let effectivePhase = currentPhase;
        if (playerRankVal >= 6) {
            effectivePhase = Math.max(effectivePhase, 3);
        } else if (playerRankVal >= 3) {
            effectivePhase = Math.max(effectivePhase, 2);
        }

        console.log(`[AgentCasting] Analyzing for Phase: ${effectivePhase} (Base: ${currentPhase}, Level: ${playerLevel}), Location: ${specificLocation}`);
        console.log(`[AgentCasting] User Input: "${userInput}", Player Level: ${playerLevel}(RankVal:${playerRankVal})`);
        console.log(`[AgentCasting] Active Characters: ${Array.from(activeIds).join(', ')}`);

        let countSkippedActive = 0;
        let countSkippedLifecycle = 0;
        let countSkippedRegion = 0;
        let countPenalizedRank = 0;

        for (const [id, char] of Object.entries(allCharacters)) {
            // 1. Filter: Already Active
            if (activeIds.has(id)) {
                countSkippedActive++;
                continue;
            }

            // [CRITICAL] Filter: Dead Characters
            // Check dynamic state for death markers
            const charState = gameState.characterData?.[id];
            if (charState) {
                if (charState.isDead || (charState.hp !== undefined && charState.hp <= 0)) {
                    // Skip dead characters UNLESS the user explicitly calls for a ghost/memory?
                    // For now, strict exclusion to prevent zombies.
                    continue;
                }
            }
            if (gameState.deadCharacters && gameState.deadCharacters.includes(id)) {
                continue;
            }

            // CRITICAL: Mention Detection (Moved Up for Override)
            let isUserMentioned = false;
            let isContextMentioned = false;
            const cAny = char as any;
            const kName = cAny.이름 || cAny.name || id;

            if (userInput && kName && userInput.includes(kName)) {
                isUserMentioned = true;
            }

            // Context Mention Check
            const lastContext = gameState.lastSystemMessage || "";
            if (lastContext && kName && lastContext.includes(kName)) {
                isContextMentioned = true;
            }

            // 2. Filter: Lifecycle (Soft Penalty)
            let isLifecycleMatch = true;
            if (char.system_logic) {
                const { start, end } = char.system_logic.lifecycle;
                if (effectivePhase < start || effectivePhase > end) {
                    isLifecycleMatch = false;
                }
            } else if (char.appearance_phase && effectivePhase < char.appearance_phase) {
                isLifecycleMatch = false;
            }

            if (!isLifecycleMatch) {
                countSkippedLifecycle++;
                // Don't continue, just apply penalty later
            }

            // 3. Filter: Region (Must match at least one active zone or home)
            let isRegionMatch = false;
            let regionMultiplier = 0;

            if (char.system_logic) {
                const { home, active_zones } = char.system_logic.region;
                if (specificLocation.includes(home) || regionPrefix === home) {
                    isRegionMatch = true;
                    regionMultiplier = this.REGION_HOME_MULTIPLIER;
                } else if (active_zones.some(zone => zone !== "중원_전역" && (specificLocation.includes(zone) || zone === "중원_전역" && false))) {
                    // [Fix] Check specific zones first (Exclude wildcard for now)
                    // Logic Correction: We need to check if specificLocation includes any NON-WILDCARD zone
                    isRegionMatch = true;
                    regionMultiplier = this.REGION_ACTIVE_MULTIPLIER;
                }

                // Re-evaluating logic for cleanliness:
                const isSpecificActive = active_zones.some(zone => zone !== "중원_전역" && specificLocation.includes(zone));
                const isWildcard = active_zones.includes("중원_전역");

                if (isRegionMatch && regionMultiplier === this.REGION_HOME_MULTIPLIER) {
                    // Already set
                } else if (isSpecificActive) {
                    isRegionMatch = true;
                    regionMultiplier = this.REGION_ACTIVE_MULTIPLIER;
                } else if (isWildcard) {
                    isRegionMatch = true;
                    regionMultiplier = this.REGION_WILDCARD_MULTIPLIER;
                }
            } else {
                if (char.활동지역 && specificLocation.includes(char.활동지역)) {
                    isRegionMatch = true;
                    regionMultiplier = 1.0;
                }
            }

            // [Modified] Soft Penalty instead of Hard Filter
            if (!isRegionMatch) {
                regionMultiplier = this.REGION_MISMATCH_PENALTY;
            }

            // --- Scoring ---
            const reasons: string[] = [];
            let score = char.system_logic?.base_weight || 1.0;

            if (isUserMentioned) {
                score += this.USER_MENTION_BONUS;
                reasons.push(`User Mentioned (+${this.USER_MENTION_BONUS})`);
            } else if (isContextMentioned) {
                score += this.CONTEXT_MENTION_BONUS;
                reasons.push(`Context Mentioned (+${this.CONTEXT_MENTION_BONUS})`);
            }

            // Apply Region Multiplier
            if (regionMultiplier === this.REGION_HOME_MULTIPLIER) {
                reasons.push(`Home Region (x${this.REGION_HOME_MULTIPLIER})`);
                score *= regionMultiplier;
            } else if (regionMultiplier === this.REGION_ACTIVE_MULTIPLIER) {
                reasons.push(`Active Zone (x${this.REGION_ACTIVE_MULTIPLIER})`);
                score *= regionMultiplier;
            } else if (regionMultiplier === this.REGION_WILDCARD_MULTIPLIER) {
                reasons.push(`Wildcard Zone (x${this.REGION_WILDCARD_MULTIPLIER})`);
                score *= regionMultiplier;
            } else {
                reasons.push(`Region Mismatch (x${this.REGION_MISMATCH_PENALTY})`);
                score *= regionMultiplier;
                countSkippedRegion++; // Log it as a "Region Penalty" for stats
            }

            // Apply Lifecycle Penalty
            if (!isLifecycleMatch) {
                reasons.push(`Lifecycle Mismatch (x${this.LIFECYCLE_PENALTY})`);
                score *= this.LIFECYCLE_PENALTY;
            }

            // [NEW] 등급 기반 필터링 (Rank Gating - Soft Filter)
            // 목적: 플레이어보다 압도적으로 강한 적(고수)이 초반에 무분별하게 등장하는 것을 방지합니다.

            // [Fix] 아군/지인 면제 (만약 관계가 있거나 아군이라면 등급에 상관없이 등장 허용)
            // 관계가 '존재'하기만 하면(적대 관계라도 스토리에 중요할 수 있으므로) 우선 허용합니다. (단, 랜덤 인카운터 제외는 별도 고려 가능하나 현재는 관계 우선)
            const hasRelationship = char.인간관계 && Object.keys(char.인간관계).some(relId => activeIds.has(relId) || relId === 'player');

            if (!isUserMentioned && !isContextMentioned && !hasRelationship) {
                // 유저 언급이나 맥락상 등장이 아니고, 관계도 없는 '완전 무작위' 등장일 때만 필터링합니다.

                // 등급 추출 (Extract Rank)
                const charRankStr = cAny.강함?.['등급'] || cAny.profile?.['등급'] || "Unknown";
                const charRankVal = getRankFromString(charRankStr);

                // 등급 차이 계산 (상대 - 플레이어)
                // 예: 상대가 1류(3)이고 플레이어가 3류(1)이면 차이는 2
                const rankDiff = charRankVal - playerRankVal;

                if (rankDiff >= 2) {
                    // 격차 심각 (예: 상급자/절정 고수가 하수에게 등장)
                    // 초보자 학살(Bullying)을 방지하기 위해 출현 점수에 0.1배 패널티
                    score *= 0.1;
                    reasons.push(`Rank Gap[${charRankStr}] (x0.1)`);
                    countPenalizedRank++;
                } else if (rankDiff === 1) {
                    // 격차 보통 (예: 2류 고수가 3류에게 등장)
                    // 도전적인 난이도이나 억까는 아니므로 0.5배 패널티 (적당히 덜 나오게)
                    score *= 0.5;
                    reasons.push(`High Rank[${charRankStr}] (x0.5)`);
                    countPenalizedRank++;
                }
                // 동급이거나 유저보다 약하면 패널티 없음
            }


            // Tag Matching
            if (char.system_logic?.tags) {
                const summaryLower = summary.toLowerCase();
                char.system_logic.tags.forEach(tag => {
                    if (summaryLower.includes(tag.toLowerCase())) {
                        score += this.TAG_BONUS;
                        reasons.push(`Tag: ${tag}`);
                    }
                });
            }

            // [NEW] Relationship Bonus
            if (char.인간관계) {
                const relations = char.인간관계;
                for (const activeId of activeIds) {
                    if (relations[activeId]) {
                        score += this.RELATIONSHIP_BONUS;
                        reasons.push(`Related to ${activeId} (${relations[activeId]})`);
                    }
                }
            }

            // Final Threshold Check
            if (score >= this.THRESHOLD) {
                candidates.push({
                    id,
                    name: kName,
                    score,
                    reasons,
                    data: char
                });
            }
        } // End For Loop

        // Log Stats when no candidates found (or even when found for debug)
        if (candidates.length === 0) {
            console.log(`[Casting(Debug)] Skipped - Active: ${countSkippedActive}, Lifecycle: ${countSkippedLifecycle}, Region: ${countSkippedRegion}, Rank: ${countPenalizedRank}`);
        }

        // Sort by score descending
        candidates.sort((a, b) => b.score - a.score);

        // Return top 3? or all qualified? Let's return top 3 for now to avoid overcrowding
        const topCandidates = candidates.slice(0, 10);

        if (candidates.length > 0) {
            console.log(`[Casting(Recruitment)] Top Candidates: ${topCandidates.map(c => `${c.name}(${c.score.toFixed(1)})`).join(', ')}`);
        } else {
            console.log(`[Casting(Recruitment)] No NEW candidates found.`);
        }

        return topCandidates;
    }
}

