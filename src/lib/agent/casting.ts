import { MODEL_CONFIG } from '../ai/model-config';
import { PromptManager } from '../engine/prompt-manager';
import { RelationshipManager } from '../engine/relationship-manager';
import { EventManager } from '../engine/event-manager';

// Helper: Resolve Location to Hierarchy [Region, Zone, Spot]
// [Modified] Game-agnostic: receives regions data as parameter
export function resolveLocationHierarchy(locName: string, regions?: Record<string, any>): string[] {
    if (!locName) return [];
    if (!regions || Object.keys(regions).length === 0) return [locName];

    // 0. Tokenize (Split by space, _, >)
    const tokens = locName.split(/[\s_>]+/).filter(Boolean);
    if (tokens.length === 0) return [locName];

    // 1. ANCHOR: Find explicit Region first
    const regionKeys = Object.keys(regions);
    let matchedRegionKey: string | null = null;

    // [Fix] Normalized English Code Check (e.g. "North Sea" -> "NorthSea" -> Match "북해")
    // We check the FULL string against eng_codes first, because tokens might split "North Sea" into ["North", "Sea"]
    const normalizedLocName = locName.toLowerCase().replace(/[\s_>(),.-]/g, ''); // aggressive normalization

    for (const rKey of regionKeys) {
        // 1. Check Korean Key (Exact token match)
        if (tokens.includes(rKey)) {
            matchedRegionKey = rKey;
            break;
        }

        // 2. Check English Code (Substring match on normalized input)
        const regionData = regions[rKey] as any;
        if (regionData?.eng_code) {
            const normEng = regionData.eng_code.toLowerCase().replace(/\s/g, '');
            if (normalizedLocName.includes(normEng)) {
                matchedRegionKey = rKey;
                break;
            }
        }
    }

    // 2. Strict Check: If no Region found, fail (return raw)
    if (!matchedRegionKey) {
        return [locName];
    }

    // 3. Search within the matched Region
    const regionVal = regions[matchedRegionKey];
    if ((regionVal as any).zones) {
        const zones = (regionVal as any).zones;

        // Priority A: Check for Zone Match First
        for (const [zKey, zVal] of Object.entries(zones)) {
            if (tokens.includes(zKey)) {
                // Check for Spot inside this Zone
                const zoneData = zVal as any;
                if (zoneData.spots && Array.isArray(zoneData.spots)) {
                    for (const spot of zoneData.spots) {
                        if (tokens.includes(spot)) {
                            return [matchedRegionKey, zKey, spot]; // Fully Resolved [Region, Zone, Spot]
                        }
                    }
                }
                return [matchedRegionKey, zKey]; // Zone Resolved [Region, Zone]
            }
        }

        // Priority B: Check for Spot Match (Implicit Zone)
        for (const [zKey, zVal] of Object.entries(zones)) {
            const zoneData = zVal as any;
            if (zoneData.spots && Array.isArray(zoneData.spots)) {
                for (const spot of zoneData.spots) {
                    if (tokens.includes(spot)) {
                        return [matchedRegionKey, zKey, spot]; // Spot Resolved [Region, Zone, Spot]
                    }
                }
            }
        }
    }

    return [matchedRegionKey]; // Only Region Resolved [Region]
}

export interface CastingCandidate {
    id: string;
    name: string;
    data: any;
    score: number;
    reasons: string[];
    isHomeGround?: boolean;
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
    private static readonly RELATIONSHIP_BONUS = 2.0; // [Modified] Base multiplier (actual weight comes from data)
    private static readonly RELATIONSHIP_DEFAULT_WEIGHT = 1.0; // [NEW] Default weight when 인간관계 has no explicit weight
    private static readonly USER_MENTION_BONUS = 10.0; // [CRITICAL] Force include if mentioned
    private static readonly CONTEXT_MENTION_BONUS = 5.0; // [NEW] Narrative consistency
    private static readonly LOCATION_TAG_BONUS = 2.0; // [NEW] Bonus if tag matches location
    private static readonly THRESHOLD = 0.01; // [Modified] Low threshold for multi-tiered filtering

    static async analyze(
        apiKey: string, // [FIX] Require API Key explicitly
        gameState: GameState,
        summary: string,
        userInput: string = "",
        playerLevel: number = 1
    ): Promise<{ active: CastingCandidate[], background: CastingCandidate[] }> {
        const currentPhase = gameState.phase || 1;
        // Clean location (e.g. "하북_남궁세가")
        const fullLocation = gameState.currentLocation || "";

        // Previous Context Check (Avoid duplication if already active)
        const activeCharIds = new Set((gameState.activeCharacters || []).map(id => id.toLowerCase()));

        // We iterate ALL characters to score them for both categories
        // But we pick Active FIRST, then Background from remainder.

        const allCandidates: { id: string, name: string, data: any, activeScore: number, bgScore: number, activeReasons: string[], bgReasons: string[] }[] = [];

        // Helper: Parse Rank
        // [FIX] Korean terms checked FIRST to prevent "일반인 (A급 잠재력)" → A-rank bug.
        // Letter grades use '급' suffix to avoid false positives.
        const getRankFromString = (rankStr: string): number => {
            if (!rankStr) return 1;
            // 1. Korean keywords (most specific, checked first)
            if (rankStr.includes('현경') || rankStr.includes('신화')) return 8;
            if (rankStr.includes('화경') || rankStr.includes('탈각')) return 7;
            if (rankStr.includes('초절정')) return 6;
            if (rankStr.includes('절정')) return 5;
            if (rankStr.includes('일류')) return 4;
            if (rankStr.includes('이류')) return 3;
            if (rankStr.includes('삼류')) return 2;
            if (rankStr.includes('일반')) return 1;
            // 2. Letter grades (with '급' suffix for precision)
            if (rankStr.includes('SS')) return 8;
            if (rankStr.includes('S급') || rankStr === 'S') return 7;
            if (rankStr.includes('A급') || rankStr === 'A') return 6;
            if (rankStr.includes('B급') || rankStr === 'B') return 5;
            if (rankStr.includes('C급') || rankStr === 'C') return 4;
            if (rankStr.includes('D급') || rankStr === 'D') return 3;
            if (rankStr.includes('E급') || rankStr === 'E') return 2;
            if (rankStr.includes('F급') || rankStr === 'F') return 1;
            return 1;
        };

        // Helper: Get Rank from Level (Aligned with getRankFromString)
        const getRankFromLevel = (level: number): number => {
            if (level >= 80) return 7; // S
            if (level >= 60) return 6; // A
            if (level >= 40) return 5; // B
            if (level >= 30) return 4; // C
            if (level >= 20) return 3; // D
            if (level >= 10) return 2; // E
            return 1; // F
        };

        // [MODIFIED] Use GameState provided characters instead of hardcoded Wuxia imports
        // This supports God Bless You and other games dynamically.
        // [Fix] Server Actions hydrate 'characterData', not 'gameData'.
        const allCharacters = gameState.characterData || {};
        const mainCharacterIds = new Set(Object.keys(allCharacters)); // For now treat all loaded as potential candidates

        // [DEBUG] Casting pool size check
        console.log(`[Casting] Character pool: ${mainCharacterIds.size} total, includes 박봄: ${'박봄' in allCharacters}, includes 김채은: ${'김채은' in allCharacters}`);

        // [FIX] Extract regions ONCE outside loop (performance optimization)
        // [FIX] Use gameState.worldData (hydrated by route.ts) — gameState.gameData does NOT exist
        const worldData = gameState.worldData || {};
        const gameRegions: Record<string, any> = worldData.regions || gameState.lore?.locations?.regions || {};

        // [NEW] Helper: Extract Relationship Weight from 인간관계 value
        // Supports: [weight, "description"] tuple OR legacy "description" string
        const getRelationWeight = (relValue: any): { weight: number, desc: string } => {
            if (Array.isArray(relValue) && relValue.length >= 2) {
                return { weight: Number(relValue[0]) || AgentCasting.RELATIONSHIP_DEFAULT_WEIGHT, desc: String(relValue[1]) };
            }
            if (typeof relValue === 'string') {
                return { weight: AgentCasting.RELATIONSHIP_DEFAULT_WEIGHT, desc: relValue };
            }
            return { weight: AgentCasting.RELATIONSHIP_DEFAULT_WEIGHT, desc: String(relValue || '') };
        };

        // [NEW] Player Relationships (for intimacy multiplier)
        const playerRelationships = gameState.playerStats?.relationships || {};

        for (const [id, char] of Object.entries(allCharacters)) {
            const cAny = char as any;

            // 1. Filter: Active or Deceased
            if (activeCharIds.has(id.toLowerCase())) continue;

            // Dynamic Death Check
            const charState = gameState.characterData?.[id];
            if (charState && (charState.isDead || (charState.hp !== undefined && charState.hp <= 0))) continue;
            if (gameState.deadCharacters && gameState.deadCharacters.includes(id)) continue;
            if (cAny.is_dead || cAny.is_retired) continue;

            // Phase Check removed by user request


            const kName = cAny.이름 || cAny.name || cAny.profile?.이름 || cAny.profile?.name || id;
            const rankStr = cAny.강함?.등급 || cAny.profile?.등급 || cAny.등급 || "F급";
            const charLevel = getRankFromString(rankStr);

            // --- Base Scoring (Common) ---
            let baseScore = 0.5; // Start with small base
            const baseReasons: string[] = [];

            // [NEW] Early Game / Crisis Logic
            const turnCount = gameState.turnCount || 0;
            const playerHpPct = (gameState.playerStats?.hp / gameState.playerStats?.maxHp) * 100 || 100;

            // Condition 1: Early Game Heroine Bonus (Plot Armor)
            // If early game, boost Main Heroines to ensure they appear to guide the story.
            // [Fix] Uses injected 'is_main' flag from Loader
            if (cAny.is_main) {
                baseScore = Math.max(baseScore, 2.0);
                baseReasons.push(`Base(Main) (2.0)`);
                // Early Game Bonus (+2.0) removed by user request ("15 points is enough")
            } else {
                baseReasons.push(`Base (0.5)`);
            }

            // --- Active Scoring (For Scene Participation) ---
            let actScore = baseScore;
            let relBonus = 0; // [NEW] Relationship bonus tracked separately (immune to rank penalty)
            const actReasons: string[] = [...baseReasons];

            // 1. User Input Resonance (Top Priority)
            if (userInput.includes(kName) || userInput.includes(id)) {
                actScore += AgentCasting.USER_MENTION_BONUS;
                actReasons.push(`User Mentioned (+${AgentCasting.USER_MENTION_BONUS})`);
            }

            // 2. Summary/Context Resonance
            if (summary.includes(kName)) {
                actScore += AgentCasting.CONTEXT_MENTION_BONUS;
                actReasons.push(`Context Mentioned (+${AgentCasting.CONTEXT_MENTION_BONUS})`);
            }

            // 3. Location/Region Logic (Hierarchical)
            // [MODIFIED] Support array-based 활동지역 (multiple locations per character)
            const rawActivityRegion = cAny.활동지역;
            const activityRegions: string[] = Array.isArray(rawActivityRegion)
                ? rawActivityRegion
                : (rawActivityRegion ? [rawActivityRegion] : []);
            // Fallback: profile fields or backward-compat field
            if (activityRegions.length === 0) {
                const fallback = cAny.profile?.거주지 || cAny.profile?.소속 || cAny.activity_region || "";
                if (fallback) activityRegions.push(fallback);
            }

            const affiliationStr = cAny.profile?.소속 || "";

            // Resolve Player Hierarchy ONCE
            const playerHierarchy = resolveLocationHierarchy(fullLocation.replace(/_/g, " "), gameRegions);
            const locNorm = fullLocation.replace(/_/g, " ");

            // Iterate all activity regions and pick the BEST score
            let locScore = 0;
            let bestLocReason = "";
            let bestCharLoc = activityRegions[0] || "";

            for (const charLoc of activityRegions) {
                const charHierarchy = resolveLocationHierarchy(charLoc, gameRegions);
                let thisScore = 0;
                let thisReason = "";

                if (charHierarchy.length > 0 && playerHierarchy.length > 0) {
                    if (charHierarchy[0] === playerHierarchy[0]) {
                        thisScore += 20;
                        if (charHierarchy[1] && playerHierarchy[1] && charHierarchy[1] === playerHierarchy[1]) {
                            thisScore += 20;
                            if (charHierarchy[2] && playerHierarchy[2] && charHierarchy[2] === playerHierarchy[2]) {
                                thisScore += 20;
                                thisReason = `🎯 Spot Match (${charHierarchy[2]}) (+60)`;
                            } else {
                                thisReason = `🏙️ Zone Match (${charHierarchy[1]}) (+40)`;
                            }
                        } else {
                            thisReason = `🌍 Region Match (${charHierarchy[0]}) (+20)`;
                        }
                    }
                }

                // Wildcard/string fallback for this entry
                if (thisScore === 0) {
                    if (charLoc === 'Korea' || charLoc === '무림' || charLoc === 'Everywhere') {
                        thisScore = 0.2;
                        thisReason = "Broad/Wildcard Region (+0.2)";
                    } else if (locNorm && charLoc && locNorm.includes(charLoc)) {
                        thisScore = 20;
                        thisReason = `Region Match [String] (${charLoc}) (+20)`;
                    }
                }

                if (thisScore > locScore) {
                    locScore = thisScore;
                    bestLocReason = thisReason;
                    bestCharLoc = charLoc;
                }
            }
            if (bestLocReason) actReasons.push(bestLocReason);

            // For backward compat: 'region' used by Fatigue isHome check
            const region = bestCharLoc;

            actScore += locScore;

            // 4. Tag Resonance
            // [Fix] Weighted tags?
            const tags = cAny.system_logic?.tags || [];
            let tagScore = 0;
            for (const tag of tags) {
                // [Fix] Ignore single-char tags for resonance to avoid false positives (e.g. '도' in '도덕')
                if (tag.length > 1 && userInput.includes(tag)) {
                    tagScore += 1.5; // Strong resonance
                    actReasons.push(`Tag Resonance [User] (+1.5)`);
                }
                if (summary.includes(tag)) {
                    tagScore += 0.5;
                    actReasons.push(`Tag Resonance [Context] (+0.5)`);
                }
                // [NEW] Location Context Tag
                // If current location contains the tag (e.g. "Convenience Store"), gives bonus
                if (locNorm.includes(tag)) {
                    tagScore += AgentCasting.LOCATION_TAG_BONUS;
                    actReasons.push(`Location Tag Match [${tag}] (+${AgentCasting.LOCATION_TAG_BONUS})`);
                }
            }
            actScore += tagScore;

            // 5. Existing Relationship Bonus (Critical for Early Game Friends)
            const relationships = cAny.인간관계 || cAny.relationships || {};
            // Check for explicit "주인공" or "Player" key in relationships
            const playerRelKey = relationships['주인공'] || relationships['Player'] || relationships['player'];

            if (playerRelKey) {
                const { weight, desc } = getRelationWeight(playerRelKey);
                const bonus = AgentCasting.RELATIONSHIP_BONUS * weight;
                relBonus += bonus; // [FIX] Track separately — immune to rank penalty
                actReasons.push(`Player Relationship [${desc}] (${AgentCasting.RELATIONSHIP_BONUS}×${weight.toFixed(1)}=+${bonus.toFixed(1)}) [Rank-Immune]`);
            }


            // 6. Crisis Intervention (High Level Characters)
            // If player HP is low < 30%, summon Help
            // Only if Alignment is Good
            if (playerHpPct < 30) {
                // Check alignment... simplified
                if (!tags.includes('마교') && charLevel >= 4) { // B-Rank or higher
                    actScore += 3.0; // Savior bonus
                    actReasons.push(`Crisis Intervention (+3.0)`);
                }
            }

            // 7. [REMOVED] Early Game Helper Bias (Opposite Sex + Righteous)
            // User Request: Removed to prevent forced companion bias.
            /*
            const playerGender = gameState.playerStats?.gender || 'male';
            const isEarlyGame = (gameState.turnCount || 0) < 30;

            if (isEarlyGame) {
                // Logic removed
            }
            */


            // 7.5. [NEW] Progressive Fatigue (Cooldown) System
            // Prevents characters from "flickering" (Exit -> Immediate Re-entry)
            const lastActive = gameState.characterData?.[id]?.lastActiveTurn;
            // Only apply if they are NOT currently active (we don't penalize staying in scene)
            if (lastActive !== undefined && !activeCharIds.has(id.toLowerCase())) {
                const turnsSinceExit = turnCount - lastActive;

                // Exceptions: 
                // 1. User explicitly mentioned them (Strong Narrative Demand)
                // 2. We are at their "Home" (e.g. Store Clerk at Store)
                const isUserDemand = userInput.includes(kName) || userInput.includes(id);
                // \"isHomeGround\": any of the character's activity regions matches current location
                const isHome = locScore >= 20; // Zone match or better = home ground

                if (!isUserDemand) {
                    if (turnsSinceExit <= 1) {
                        // Just left 1 turn ago. Heavy Penalty.
                        // Unless it's their Home, then slight penalty (maybe they just went to back room)
                        if (isHome) {
                            actScore *= 0.5;
                            actReasons.push(`Fatigue (Home, 1T) (x0.5)`);
                        } else {
                            actScore *= 0.1;
                            actReasons.push(`Fatigue (Exit 1T ago) (x0.1)`);
                        }
                    } else if (turnsSinceExit === 2) {
                        // Left 2 turns ago. Moderate Penalty.
                        actScore *= 0.5;
                        actReasons.push(`Fatigue (Exit 2T ago) (x0.5)`);
                    } else {
                        // 3+ turns: Recovered. No Penalty.
                        // actReasons.push(`Fatigue Recovered (3T+)`);
                    }
                } else {
                    actReasons.push(`Fatigue Bypassed (User Demand)`);
                }
            }

            // 7.7. [NEW] Enemy Global Penalty (60% Efficiency)
            // [FIX] Game-agnostic enemy detection: system_logic flag OR universal villain tags
            const ENEMY_TAGS = ['마교', '사파', '악당', '빌런', '네오아카디아', '이면세계', '적대'];
            const isEnemy = cAny.system_logic?.is_enemy || ENEMY_TAGS.some(t => tags.includes(t));

            if (isEnemy) {
                actScore *= 0.6;
                actReasons.push(`Enemy Base Correction (x0.6)`);
            }

            // -----------------------------------------------------------------------
            // 8. FINAL: Rank Penalty (Dynamic)
            // -----------------------------------------------------------------------
            // Apply AFTER all bonuses to strictly gate content.
            const pRankVal = getRankFromLevel(playerLevel);
            const rankGap = charLevel - pRankVal;

            // [New Formula] Penalty = 1 / (Gap * 2)
            // e.g. Gap 2 -> 1/4 = 0.25 (Only 25% of score remains)
            // e.g. Gap 4 -> 1/8 = 0.125

            // Only apply penalty if the character wasn't explicitly mentioned or in crisis.
            const isUserInvoked = actReasons.some(r => r.includes('User Mentioned'));
            const isCrisis = actReasons.some(r => r.includes('Crisis'));

            // [REVISED] Rank Penalty capped at x0.5 max — prevents score annihilation
            // [FIX] Relationship bonus is IMMUNE to rank penalty — separated before penalty, added back after
            if (!isUserInvoked && !isCrisis && rankGap >= 2) {
                // Too Strong (Anti-Bullying/Gating) — capped at x0.5, relationship bonus preserved
                actScore *= 0.5;
                const label = isEnemy ? 'Enemy' : 'Ally';
                actReasons.push(`Rank Gap(${rankGap}: L${charLevel}-P${pRankVal}) ${label} Penalty (x0.5)`);

            } else if (!isUserInvoked && rankGap <= -3) {
                // Too Weak (Fodder) — also capped at x0.5
                actScore *= 0.5;
                actReasons.push(`Rank Gap(${rankGap}: L${charLevel}-P${pRankVal}) Weak Penalty (x0.5)`);
            }

            // [FIX] Add relationship bonus AFTER rank penalty (immune to penalty)
            if (relBonus > 0) {
                actScore += relBonus;
                actReasons.push(`Relationship Bonus (Rank-Immune) (+${relBonus.toFixed(1)})`);
            }


            // --- Background Scoring ---
            let bgScore = baseScore;
            const bgReasons: string[] = [...baseReasons];

            // 1. NO Rank Penalty for Background

            // 2. Home Ground Super Bonus (Background)
            if (affiliationStr && fullLocation && (fullLocation.includes(affiliationStr) || affiliationStr.includes(fullLocation))) {
                // [FIX] Nerfed from 50.0 to 15.0 to prevent instant boss spawns
                bgScore += 15.0;
                bgReasons.push("Home Ground Bonus (+15.0)");
            }

            // 3. Active Relation Bonus (Applied to BOTH Active and Background)
            // [REVAMPED] Uses explicit weight from 인간관계 data + player intimacy multiplier
            for (const activeId of activeCharIds) {
                const relVal = relationships[activeId];
                if (relVal) {
                    const { weight, desc } = getRelationWeight(relVal);

                    // [Intimacy Multiplier] Player's closeness with the active character
                    // Higher intimacy → more likely to pull in related chars
                    const activeCharData = allCharacters[activeId] as any;
                    const activeCharName = activeCharData?.name || activeCharData?.이름 || activeId;
                    const intimacyScore = playerRelationships[activeCharName] || playerRelationships[activeId] || 0;
                    const intimacyMultiplier = 1.0 + Math.min(intimacyScore, 100) / 100; // 1.0 ~ 2.0

                    const bgBonus = weight * intimacyMultiplier;
                    bgScore += bgBonus;
                    bgReasons.push(`Related(${activeId}) [${desc}] (${weight.toFixed(1)}×${intimacyMultiplier.toFixed(1)}=+${bgBonus.toFixed(1)})`);

                    const actBonus = weight * intimacyMultiplier * 1.5; // Active gets 1.5x premium
                    relBonus += actBonus; // [FIX] Track in relBonus — immune to rank penalty
                    actReasons.push(`Related(${activeId}) [${desc}] (${weight.toFixed(1)}×${intimacyMultiplier.toFixed(1)}×1.5=+${actBonus.toFixed(1)}) [Rank-Immune]`);
                }
            }

            // 4. Background specific Relationship Bonus (Player relationship)
            if (playerRelKey) {
                const { weight } = getRelationWeight(playerRelKey);
                const bgRelBonus = AgentCasting.RELATIONSHIP_BONUS * weight;
                bgScore += bgRelBonus;
                bgReasons.push(`Player Relationship (+${bgRelBonus.toFixed(1)})`);
            }

            // [NEW] Randomness (Noise) to break deterministic sorting
            // 0.0 ~ 0.5 points of jitter to allow characters with similar scores to swap places
            const actNoise = Math.random() * 0.5;
            const bgNoise = Math.random() * 0.5;

            actScore += actNoise;
            bgScore += bgNoise;

            if (actNoise > 0.1) actReasons.push(`Random Noise (+${actNoise.toFixed(2)})`);
            if (bgNoise > 0.1) bgReasons.push(`Random Noise (+${bgNoise.toFixed(2)})`);

            allCandidates.push({
                id,
                name: kName,
                data: char,
                activeScore: actScore,
                bgScore: bgScore,
                activeReasons: actReasons,
                bgReasons: bgReasons
            });
        }

        // --- Selection Phase ---

        // 1. Pre-Selection (Nomination)
        // Select Top 20 Active and Top 30 Background candidates purely by Score
        // This filters out "impossible" candidates (e.g. score near 0 or negative)
        allCandidates.sort((a, b) => b.activeScore - a.activeScore);
        const nomineeActive = allCandidates
            .filter(c => c.activeScore >= 0.1) // Minimum viability
            .slice(0, 20);

        const nomineeBg = allCandidates
            .filter(c => !nomineeActive.slice(0, 6).includes(c) && c.bgScore >= 0.1) // Basic check
            .sort((a, b) => b.bgScore - a.bgScore)
            .slice(0, 30);

        // Map for AI Input (Simplified)
        const formatForAI = (list: typeof allCandidates) => list.map(c => ({
            id: c.id,
            name: c.name,
            score: c.activeScore, // or bgScore
            reasons: c.activeReasons // or bgReasons
        }));

        // [OPTIMIZED] Pure score-based selection — AI call removed (14s → ~0s)
        // Rationale: Score system already reflects location/relationship/context/rank precisely,
        // and Director model makes the final character appearance decision anyway.
        const finalActive = nomineeActive.slice(0, 6);
        const finalBackground = nomineeBg.slice(0, 12);

        // Final Polish (Ensure limit)
        // Heuristic fallback logic is already set in finalActive init
        // Just slice to ensure max count
        const ACTIVE_MAX = 6;
        const BG_MAX = 12;

        const active = finalActive.slice(0, ACTIVE_MAX).map(c => ({
            id: c.id,
            name: c.name,
            score: c.activeScore,
            reasons: c.activeReasons,
            scenario: (c as any).aiScenario, // [Fix] Propagate AI scenario to result
            data: c.data
        }));

        const background = finalBackground.slice(0, BG_MAX).map(c => ({
            id: c.id,
            name: c.name,
            score: c.bgScore,
            reasons: c.bgReasons,
            data: c.data
        }));

        // Logging
        if (active.length > 0) console.log(`[Casting(Final)] Active: ${active.map(c => c.name).join(', ')} | BG: ${background.length}`);

        return { active, background };
    }

    // Helper Methods (if needed to restore deleted ones)
    // The getRankFromLevel and parseRank methods are now local to analyze for consistency with the instruction.
    // If they were intended to be static, they should be moved outside analyze.
    // For now, I'm keeping the static ones as they were, and the instruction's versions are local.
    // However, the instruction's `getRankFromLevel` is used as `getRankFromLevel(playerLevel)` which implies a local function.
    // The original static `getRankFromLevel` and `parseRank` are now redundant if the local ones are used.
    // To avoid confusion, I will remove the old static `getRankFromLevel` and `parseRank` and assume the new local ones are the intended helpers.
    // If the user wants them static, they should specify.
}
