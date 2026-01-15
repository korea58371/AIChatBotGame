import { CharacterData } from '../../data/games/wuxia/jsons/characters';

export interface CastingCandidate {
    id: string;
    name: string;
    data: CharacterData;
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
    private static readonly RELATIONSHIP_BONUS = 4.0; // [NEW] Significant bonus for existing relationships
    private static readonly USER_MENTION_BONUS = 10.0; // [CRITICAL] Force include if mentioned
    private static readonly CONTEXT_MENTION_BONUS = 5.0; // [NEW] Narrative consistency
    private static readonly LOCATION_TAG_BONUS = 2.0; // [NEW] Bonus if tag matches location
    private static readonly THRESHOLD = 0.01; // [Modified] Low threshold for multi-tiered filtering

    static async analyze(
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
        const getRankFromString = (rankStr: string): number => {
            if (!rankStr) return 1; // Default min
            if (rankStr.includes('현경') || rankStr.includes('신화') || rankStr.includes('SS')) return 8; // Increased granularity
            if (rankStr.includes('화경') || rankStr.includes('탈각') || rankStr.includes('S')) return 7;
            if (rankStr.includes('초절정') || rankStr.includes('A')) return 6;
            if (rankStr.includes('절정') || rankStr.includes('B')) return 5;
            if (rankStr.includes('일류') || rankStr.includes('C')) return 4;
            if (rankStr.includes('이류') || rankStr.includes('D')) return 3;
            if (rankStr.includes('삼류') || rankStr.includes('E')) return 2;
            if (rankStr.includes('일반') || rankStr.includes('F')) return 1;
            return 1; // Default min
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
        const allCharacters = gameState.gameData?.characters || gameState.characterData || {};
        const mainCharacterIds = new Set(Object.keys(allCharacters)); // For now treat all loaded as potential candidates

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
            if (mainCharacterIds.has(id)) {
                baseScore = Math.max(baseScore, 1.5);
                baseReasons.push(`Base(Main) (1.5)`);

                if (turnCount < 30) {
                    baseScore += 2.0; // Early Game Helper Bonus
                    baseReasons.push(`Early Game Plot Armor (+2.0)`);
                }
            } else {
                baseReasons.push(`Base (0.5)`);
            }

            // --- Active Scoring (For Scene Participation) ---
            let actScore = baseScore;
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

            // 3. Location/Region Logic
            const region = cAny.profile?.거주지 || cAny.profile?.소속 || cAny.활동지역 || "";
            const affiliationStr = cAny.profile?.소속 || "";

            // Normalize for comparison
            const locNorm = fullLocation.replace(/_/g, " ");

            if (locNorm && region && locNorm.includes(region)) {
                actScore += 2.0;
                actReasons.push("Region Match (+2.0)");
            } else if (region === 'Korea' || region === '무림' || region === 'Everywhere') {
                // Generic region match (weak)
                actScore += 0.2;
                actReasons.push("Broad/Wildcard Region (+0.2)");
            }

            // 4. Tag Resonance
            // [Fix] Weighted tags?
            const tags = cAny.system_logic?.tags || [];
            let tagScore = 0;
            for (const tag of tags) {
                if (userInput.includes(tag)) {
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
            // Or look for keywords in values if needed, but Key is safest.
            const hasDirectRelation = relationships['주인공'] || relationships['Player'] || relationships['player'];

            if (hasDirectRelation) {
                actScore += AgentCasting.RELATIONSHIP_BONUS;
                actReasons.push(`Existing Relationship (+${AgentCasting.RELATIONSHIP_BONUS})`);
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

            // 7. [NEW] Early Game Helper Bias (Opposite Sex + Righteous)
            const playerGender = gameState.playerStats?.gender || 'male';
            const isEarlyGame = (gameState.turnCount || 0) < 30;

            if (isEarlyGame) {
                const targetGender = playerGender === 'male' ? '여성' : '남성';
                // Check if Righteous (Affiliation or Tags)
                // Righteous: Not Magyo, Not Sapa. Or has 'Righteous' tag.
                const isMagyo = region?.home?.includes('마교') || region?.home?.includes('십만대산') || tags.includes('마교');
                const isSapa = region?.home?.includes('사파') || region?.home?.includes('패천맹') || tags.includes('녹림') || tags.includes('악당');

                const isRighteous = !isMagyo && !isSapa;

                // [FIX] Gender Inference Fallback
                let charGender = cAny.profile?.성별;

                if (!charGender) {
                    // Try to infer from Tags or Title
                    const indicators = (cAny.title || "") + " " + tags.join(" ");
                    if (indicators.match(/여성|소녀|누나|언니|여제|성녀|마녀|퀸카|히로인|Lady|Girl|Princess/i)) {
                        charGender = '여성';
                    } else if (indicators.match(/남성|소년|형|오빠|황제|왕|Hero|Boy/i)) {
                        charGender = '남성';
                    } else {
                        charGender = '남성'; // Ultimate default
                    }
                }

                if (isRighteous && charGender === targetGender) {
                    actScore += 3.0;
                    actReasons.push(`Early Game Companion (${charGender} Righteous)`);
                } else {
                    // Debug Log for missed companion (Only log if score is relatively high to reduce noise)
                    if (baseScore >= 1.5) {
                        // actReasons.push(`Debug: Missed Companion (G:${charGender} vs T:${targetGender}, R:${isRighteous})`);
                    }
                }
            }


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
                // "isHomeGround" is not fully calculated here yet, but we have 'region' and 'locNorm'
                const isHome = locNorm && region && locNorm.includes(region);

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

            if (!isUserInvoked && !isCrisis && rankGap >= 2) {
                // Too Strong (Anti-Bullying/Gating)
                const penaltyMp = 1.0 / (rankGap * 2.0);
                actScore *= penaltyMp;
                actReasons.push(`Rank Gap(${rankGap}: L${charLevel}-P${pRankVal}) Penalty (x${penaltyMp.toFixed(2)})`);
            } else if (!isUserInvoked && rankGap <= -3) {
                // Too Weak (Fodder) - Only separate if gap is huge
                // Gap -3 (e.g. Player A vs F)
                const absGap = Math.abs(rankGap);
                const penaltyMp = 1.0 / (absGap * 1.5);
                actScore *= penaltyMp;
                actReasons.push(`Rank Gap(${rankGap}: L${charLevel}-P${pRankVal}) Penalty [Weak] (x${penaltyMp.toFixed(2)})`);
            }


            // --- Background Scoring ---
            let bgScore = baseScore;
            const bgReasons: string[] = [...baseReasons];

            // 1. NO Rank Penalty for Background

            // 2. Home Ground Super Bonus (Background)
            if (affiliationStr && fullLocation && (fullLocation.includes(affiliationStr) || affiliationStr.includes(fullLocation))) {
                bgScore += 50.0; // User Request: Super Strong Bonus
                bgReasons.push("Home Ground Super Bonus (+50.0)");
            }

            // 3. Active Relation Bonus for Background too
            for (const activeId of activeCharIds) {
                if (relationships[activeId]) {
                    bgScore += 4.0;
                    bgReasons.push(`Related to Active(${activeId})`);
                }
            }

            // 4. Background specific Relationship Bonus
            if (hasDirectRelation) {
                bgScore += AgentCasting.RELATIONSHIP_BONUS;
                bgReasons.push(`Existing Relationship (+${AgentCasting.RELATIONSHIP_BONUS})`);
            }

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

        // 1. Select ACTIVE (Top 6)
        allCandidates.sort((a, b) => b.activeScore - a.activeScore);

        const ACTIVE_THRESHOLD = 1.0;
        const ACTIVE_MAX = 6;

        const chosenActive = allCandidates
            .filter(c => c.activeScore >= ACTIVE_THRESHOLD)
            .slice(0, ACTIVE_MAX);

        const chosenIds = new Set(chosenActive.map(c => c.id));

        // 2. Select BACKGROUND (Top 6 from Remainder)
        // [New Priority Logic]
        // Priority 1: Home Ground (Must be included if slot available)
        // Priority 2: Related to Active/Player
        // Priority 3: High Relevance Score

        const remainder = allCandidates.filter(c => !chosenIds.has(c.id));

        const backgroundCandidates = remainder.filter(c => {
            // Filter out completely irrelevant characters from Background
            // Must be either HomeGround OR Related OR have high regional relevance/tag match.
            // Bare minimum score check is not enough because randoms start at 0.5.
            const isRelevant = c.bgReasons.some(r =>
                r.includes("Home Ground") ||
                r.includes("Related") ||
                r.includes("User Mentioned") ||
                r.includes("Context Mentioned") ||
                r.includes("Tag Match") ||
                r.includes("Region Match") ||
                r.includes("Existing Relationship") // [Fix] Include Relationship
            );
            // Special case: If score is very high (e.g. > 3.0), keep it even if reason logic misses (shouldn't happen but safeguard)
            // Also allow if we don't have enough candidates? No, better to have valid ones.
            // Let's lower score threshold to 1.0 (Base 0.5 + Region 1.0 = 1.5)
            return isRelevant || c.bgScore >= 1.0;
        });

        // Sort by Priority: Home Ground First, then Score
        backgroundCandidates.sort((a, b) => {
            const aHome = a.bgReasons.some(r => r.includes("Home Ground"));
            const bHome = b.bgReasons.some(r => r.includes("Home Ground"));

            if (aHome && !bHome) return -1;
            if (!aHome && bHome) return 1;

            return b.bgScore - a.bgScore;
        });

        const BG_MAX = 6;
        const chosenBg = backgroundCandidates.slice(0, BG_MAX);

        // Map to Output Format
        const active = chosenActive.map(c => ({
            id: c.id,
            name: c.name,
            score: c.activeScore,
            reasons: c.activeReasons,
            data: c.data
        }));

        const background = chosenBg.map(c => ({
            id: c.id,
            name: c.name,
            score: c.bgScore,
            reasons: c.bgReasons,
            data: c.data
        }));

        // Logging
        if (active.length > 0) console.log(`[Casting(Active)] ${active.map(c => `${c.name}(${c.score.toFixed(1)})`).join(', ')}`);
        if (background.length > 0) console.log(`[Casting(Background)] ${background.map(c => `${c.name}(${c.score.toFixed(1)})`).join(', ')}`);

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
