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
    private static readonly RELATIONSHIP_BONUS = 2.0; // [Modified] Reduced from 4.0 to 2.0
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
        const allCharacters = gameState.characterData || {};
        const mainCharacterIds = new Set(Object.keys(allCharacters)); // For now treat all loaded as potential candidates

        // [FIX] Extract regions ONCE outside loop (performance optimization)
        // [FIX] Use gameState.worldData (hydrated by route.ts) — gameState.gameData does NOT exist
        const worldData = gameState.worldData || {};
        const gameRegions: Record<string, any> = worldData.regions || gameState.lore?.locations?.regions || {};

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

            if (!isUserInvoked && !isCrisis && rankGap >= 2) {
                // Too Strong (Anti-Bullying/Gating)

                if (isEnemy) {
                    // [Enemy] Keep strict disqualification
                    // "적군의 경우 현재 보정치(0.01) 유지"
                    actScore = 0.01;
                    actReasons.push(`Rank Gap(${rankGap}: L${charLevel}-P${pRankVal}) Enemy Disqualified`);
                } else if (rankGap >= 3) {
                    // [Gatekeeper Protocol] Huge Gap (>= 3) for Allies/Neutrals
                    // Even if Ally, if the gap is too huge (e.g. Level 1 vs Level 99), they shouldn't just hang out.
                    // Force heavy penalty unless User Mentioned.
                    actScore *= 0.1;
                    actReasons.push(`Rank Gap(${rankGap}) [Gatekeeper] Too High (x0.1)`);
                } else {
                    // [Ally/Neutral] Moderate Gap (2) -> Relaxed Penalty (50%)
                    // "아군일 경우, 0.01이 아닌 50% 정도로"
                    actScore *= 0.5;
                    actReasons.push(`Rank Gap(${rankGap}: L${charLevel}-P${pRankVal}) Ally Soft Penalty (x0.5)`);
                }

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
                // [FIX] Nerfed from 50.0 to 15.0 to prevent instant boss spawns
                bgScore += 15.0;
                bgReasons.push("Home Ground Bonus (+15.0)");
            }

            // 3. Active Relation Bonus for Background too
            // 3. Active Relation Bonus (Applied to BOTH Active and Background)
            for (const activeId of activeCharIds) {
                if (relationships[activeId]) {
                    // [FIX] Nerfed from 4.0 to 2.5
                    bgScore += 2.5;
                    bgReasons.push(`Related to Active(${activeId})`);

                    // [Modified] Also apply to Active Score
                    actScore += 4.0;
                    actReasons.push(`Related to Active(${activeId})`);
                }
            }

            // 4. Background specific Relationship Bonus
            if (hasDirectRelation) {
                bgScore += AgentCasting.RELATIONSHIP_BONUS;
                bgReasons.push(`Existing Relationship (+${AgentCasting.RELATIONSHIP_BONUS})`);
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

        let finalActive = nomineeActive.slice(0, 6); // Default Fallback
        let finalBackground = nomineeBg.slice(0, 12); // Default Fallback

        // 2. AI Decision (If API Key available)
        // [NOTE] apiKey is not directly in GameState in some versions.
        // We need to check if 'gameState.apiKey' is available or if we can get it from somewhere.
        // For now, let's assume AgentOrchestrator passes it or injected into gameState.
        // [NOTE] apiKey is passed as Argument now.
        // const apiKey = gameState.apiKey || gameState.secrets?.apiKey; // [REMOVED]

        if (apiKey) {
            // console.log(`[Casting] Requesting AI Decision for ${nomineeActive.length} Active / ${nomineeBg.length} BG candidates...`);

            try {
                // Dynamic Import to avoid cycle if necessary, or just use imported
                const { generateCastingDecision } = await import('../ai/gemini');

                const decision = await generateCastingDecision(
                    apiKey,
                    {
                        location: fullLocation,
                        summary: summary,
                        userInput: userInput,
                        activeCharacters: gameState.activeCharacters || []
                    },
                    nomineeActive.map(c => ({ id: c.id, name: c.name, score: c.activeScore, reasons: c.activeReasons })),
                    nomineeBg.map(c => ({ id: c.id, name: c.name, score: c.bgScore, reasons: c.bgReasons }))
                );

                if (decision && decision.active && Array.isArray(decision.active)) {
                    const aiActiveMap = new Map<string, number>();
                    const aiScenarioMap = new Map<string, string>(); // [NEW] Store scenarios

                    decision.active.forEach((item: any, idx: number) => {
                        // Handle both string (Legacy) and object (New) formats
                        if (typeof item === 'string') {
                            aiActiveMap.set(item, idx);
                        } else if (typeof item === 'object' && item.id) {
                            aiActiveMap.set(item.id, idx);
                            if (item.scenario) aiScenarioMap.set(item.id, item.scenario);
                        }
                    });

                    const aiChosenActive = allCandidates.filter(c => aiActiveMap.has(c.id));
                    aiChosenActive.sort((a, b) => (aiActiveMap.get(a.id) || 0) - (aiActiveMap.get(b.id) || 0));

                    if (aiChosenActive.length > 0) {
                        finalActive = aiChosenActive;
                        // Attach scenarios to the source candidate objects temporarily
                        // (We will map them in the final step)
                        finalActive.forEach(c => {
                            (c as any).aiScenario = aiScenarioMap.get(c.id);
                        });
                    }

                    // Background Map (Keep original string array format for now, or update if needed)
                    if (decision.background && Array.isArray(decision.background)) {
                        const aiBgMap = new Map();
                        decision.background.forEach((id: string, idx: number) => aiBgMap.set(id, idx));

                        const aiChosenBg = allCandidates.filter(c => aiBgMap.has(c.id));
                        aiChosenBg.sort((a, b) => (aiBgMap.get(a.id) || 0) - (aiBgMap.get(b.id) || 0));

                        if (aiChosenBg.length > 0) {
                            finalBackground = aiChosenBg;
                        }
                    }
                }
            } catch (e) {
                console.warn("[Casting] AI Decision Failed, using Heuristic Fallback", e);
            }
        }

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
