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
    private static readonly RELATIONSHIP_BONUS = 1.0; // [NEW] Bonus for existing relationships
    private static readonly USER_MENTION_BONUS = 10.0; // [CRITICAL] Force include if mentioned
    private static readonly CONTEXT_MENTION_BONUS = 5.0; // [NEW] Narrative consistency
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
            if (!rankStr) return 0;
            if (rankStr.includes('현경') || rankStr.includes('신화') || rankStr.includes('SS')) return 7;
            if (rankStr.includes('화경') || rankStr.includes('탈각') || rankStr.includes('S')) return 6;
            if (rankStr.includes('초절정') || rankStr.includes('A')) return 5;
            if (rankStr.includes('절정') || rankStr.includes('B')) return 4;
            if (rankStr.includes('일류') || rankStr.includes('C')) return 3;
            if (rankStr.includes('이류') || rankStr.includes('D')) return 2;
            if (rankStr.includes('삼류') || rankStr.includes('E') || rankStr.includes('F')) return 1;
            if (rankStr.includes('삼류') || rankStr.includes('E') || rankStr.includes('F')) return 1;
            return 0;
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
            const rankStr = cAny.강함?.등급 || cAny.profile?.등급 || cAny.등급 || "삼류";
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

            // Condition 2: Crisis Intervention (Values 'Righteous' or 'Main')
            // If player is dying, someone MUST save them.
            if (playerHpPct < 30) {
                const isRighteous = cAny.profile?.성향?.includes('정파') || cAny.profile?.alignment?.includes('Good');
                if (mainCharacterIds.has(id) || isRighteous) {
                    baseScore += 5.0; // Crisis Savior Bonus
                    baseReasons.push(`Crisis Intervention Protocol (+5.0)`);
                }
            }

            // Region Logic
            const region = cAny.profile?.거주지 || cAny.region || "";
            // const regionReasons: string[] = []; // Removed separate array to unify
            if (fullLocation.includes(region)) {
                baseScore += 1.0;
                baseReasons.push("Base Region Match (+1.0)");
            }

            // --- Active Scoring ---
            let actScore = baseScore;
            const actReasons: string[] = [...baseReasons];

            // 1. Rank Penalty (Moved to End)

            // 2. Location/Tag Bonus (Active)
            const affiliationStr = cAny.profile?.소속 || cAny.소속 || "";
            if (affiliationStr && fullLocation && (fullLocation.includes(affiliationStr) || affiliationStr.includes(fullLocation))) {
                actScore += 3.0; // User Request: +3.0
                actReasons.push("Location/Tag Match (+3.0)");
            }

            // 3. Affection/Relation (Active)
            // if (userInput.includes(kName)) {
            //    actScore += 10.0;
            //    actReasons.push("User Mentioned (+10.0)");
            // }

            // [Refinement] Removed redundant logging block since we added it above directly
            // ...

            // 4. Tag Resonance (Active) [NEW]
            let tags = [...(cAny.system_logic?.tags || [])];

            // [Auto-Include] Affiliation & Nicknames as Tags
            if (cAny.profile?.소속) {
                const affiliationTags = cAny.profile.소속.split(/[\/,]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                tags.push(...affiliationTags);
            }
            if (cAny.profile?.별명) {
                const nicknameTags = cAny.profile.별명.split(/[\/,]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                tags.push(...nicknameTags);
            }

            if (tags.length > 0) {
                for (const tag of tags) {
                    if (!tag) continue;
                    // [Fix] Balance Issue: Single character tags (e.g. '공', '용', '일') trigger too easily.
                    // Ignore them unless specifically whitelisted (none for now).
                    if (tag.length < 2) continue;

                    // User Input Match (Strong)
                    if (userInput.includes(tag)) {
                        actScore += 1.5;
                        actReasons.push(`Tag Resonance [${tag}] (User) (+1.5)`);
                    }
                    // Summary Match (Weak) - only if not already matched by user input to avoid double counting? 
                    // Let's allow stacking but maybe smaller weight or just distinct reasons.
                    else if (summary.includes(tag)) {
                        actScore += 0.5;
                        actReasons.push(`Tag Resonance [${tag}] (Story) (+0.5)`);
                    }
                }
            }

            // RELATION CHECK
            const activeCharIdsArr = Array.from(activeCharIds);
            const relations = cAny.인간관계 || {};
            for (const activeId of activeCharIdsArr) {
                if (relations[activeId]) {
                    actScore += 2.0;
                    actReasons.push(`Related to ${activeId}`);
                }
            }


            // -----------------------------------------------------------------------
            // 7. [NEW] Early Game Helper Bias (Opposite Sex + Righteous)
            // -----------------------------------------------------------------------
            const playerGender = gameState.playerStats?.gender || 'male';
            const isEarlyGame = (gameState.turnCount || 0) < 30;

            if (isEarlyGame) {
                const targetGender = playerGender === 'male' ? '여성' : '남성';
                // Check if Righteous (Affiliation or Tags)
                // Righteous: Not Magyo, Not Sapa. Or has 'Righteous' tag.
                const isMagyo = region?.home?.includes('마교') || region?.home?.includes('십만대산') || tags.includes('마교');
                const isSapa = region?.home?.includes('사파') || region?.home?.includes('패천맹') || tags.includes('녹림') || tags.includes('악당');

                const isRighteous = !isMagyo && !isSapa;
                const charGender = cAny.profile?.성별 || '남성'; // Default to male if unknown

                if (isRighteous && charGender === targetGender) {
                    actScore += 3.0;
                    actReasons.push(`Early Game Companion (${charGender} Righteous)`);
                }
            }


            // -----------------------------------------------------------------------
            // 8. FINAL: Rank Penalty (Dynamic)
            // -----------------------------------------------------------------------
            // Apply AFTER all bonuses to strictly gate content.
            const pRankVal = AgentCasting.getRankFromLevel(playerLevel);
            const rankGap = charLevel - pRankVal;

            // [New Formula] Penalty = 1 / (Gap * 2)
            // e.g. Gap 2 -> 1/4 = 0.25
            // e.g. Gap 3 -> 1/6 = 0.16
            // e.g. Gap 4 -> 1/8 = 0.125
            if (rankGap >= 2) {
                // Too Strong (Anti-Bullying)
                // Exception: If explicitly mentioned by user, we allow it slightly more (already +10 bonus).
                const penaltyMp = 1.0 / (rankGap * 2.0);
                actScore *= penaltyMp;
                actReasons.push(`Rank Gap(${rankGap}) Penalty [Too Strong] (x${penaltyMp.toFixed(2)})`);
            } else if (rankGap <= -2) {
                // Too Weak
                // Use same formula for symmetry or keep static?
                // User said "The bigger the difference, the lower the probability".
                // Let's apply symmetric logic for purely keeping balance, but usually weaklings are fine fodder.
                // However, "Too Weak" was 0.5. Let's keep it 0.5 for now unless user asked for symmetric.
                // User input: "grade difference... probability drops" implies both ways, but context usually implies "Too Strong".
                // Let's stick to the specific request formula for "Gap".
                // Assuming absolute gap for now.
                const absGap = Math.abs(rankGap);
                const penaltyMp = 1.0 / (absGap * 2.0);
                actScore *= penaltyMp;
                actReasons.push(`Rank Gap(${rankGap}) Penalty [Too Weak] (x${penaltyMp.toFixed(2)})`);
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
            for (const activeId of activeCharIdsArr) {
                if (relations[activeId]) {
                    bgScore += 2.0;
                    bgReasons.push(`Related to ${activeId}`);
                }
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
                r.includes("Region Match") // [Fix] Allow simple region matches
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
    static getRankFromLevel(level: number): number {
        if (level >= 80) return 7;
        if (level >= 60) return 6;
        if (level >= 40) return 5;
        if (level >= 30) return 4;
        if (level >= 20) return 3;
        if (level >= 10) return 2;
        if (level >= 1) return 1;
        return 0;
    }

    static parseRank(rankStr: string): number {
        if (!rankStr) return 0;
        if (rankStr.includes('현경') || rankStr.includes('신화') || rankStr.includes('SS')) return 7;
        if (rankStr.includes('화경') || rankStr.includes('탈각') || rankStr.includes('S')) return 6;
        if (rankStr.includes('초절정') || rankStr.includes('A')) return 5;
        if (rankStr.includes('절정') || rankStr.includes('B')) return 4;
        if (rankStr.includes('일류') || rankStr.includes('C')) return 3;
        if (rankStr.includes('이류') || rankStr.includes('D')) return 2;
        if (rankStr.includes('삼류') || rankStr.includes('E') || rankStr.includes('F')) return 1;
        return 0;
    }
}

