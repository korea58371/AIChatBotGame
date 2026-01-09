
// import { GameState } from '../prompt-manager'; 
// import { PromptManager } from '../prompt-manager';
// import { RouterOutput } from './router'; // [REMOVED]

export class AgentRetriever {

    // "Lorebook" 정규식 데이터베이스 (코드 기반 필터링)
    private static readonly LORE_PATTERNS: Record<string, string> = {
        "연화린|(?<![가-힣])린이": "Yeon Hwarin",
        "팽소소": "Pang Soso",
        "한가을|가을이": "Han Ga-Eul", // [GBY] 히로인
        "고하늘|하늘이": "Go Ha-Neul", // [GBY] 주인공
        "빙백신권": "MartialArts:Ice_Soul_Fist",
        "화산파": "Faction:Mount_Hua"
    };

    /**
     * 유저 입력 및 후보군에 기반하여 관련 컨텍스트를 검색합니다.
     */
    static async retrieveContext(
        userInput: string,
        state: any,
        suggestedCharacters: any[] = [],
        backgroundCharacters: any[] = [] // [NEW] Background List
    ): Promise<string> {

        console.log(`[Retriever] 컨텍스트 검색 중... Input Length: ${userInput.length}`);
        let context = "";

        // 1. Casting Suggestions (Active - Full Details)
        if (suggestedCharacters.length > 0) {
            context += `[Casting Suggestions] (Available for Narrative - You may introduce these characters if relevant)\n`;
            suggestedCharacters.forEach(candidate => {
                const charData = candidate.data;
                const desc = charData.profile?.신분 || charData.title || "Unknown";
                const appearance = charData.외형?.얼굴형_인상 || charData.외형?.outfit_style || "";
                const faction = charData.faction || charData.profile?.소속 || "Unknown";
                const pVal = charData.personality ? JSON.stringify(charData.personality) : "Unknown";
                const rank = charData.강함?.등급 || charData.profile?.등급 || "Unknown";

                let speechStyle = "Unknown";
                if (charData.relationshipInfo?.speechStyle) speechStyle = charData.relationshipInfo.speechStyle;
                else if (JSON.stringify(charData).includes("존댓말")) speechStyle = "Polite/Honorific";

                // [Score Check]
                const isStrong = candidate.score >= 5;
                const strongTag = isStrong ? " [STRONG CANDIDATE - HIGH PRIORITY]" : "";

                context += `- ${candidate.name} (${charData.title})${strongTag}\n  Identity: ${desc} | Faction: ${faction} | Rank: ${rank}\n  Appearance: ${appearance}\n  Personality: ${pVal}\n  Speech: ${speechStyle}\n`;

                if (isStrong) {
                    context += `  >> INSTRUCTION: This character has a high relevance score (${candidate.score}). You MUST actively foreshadow (bait) or introduce them if the scene allows.\n`;
                }

                // [NEW] Memory Injection (Top 3)
                if (charData.memories && charData.memories.length > 0) {
                    const recentMemories = charData.memories.slice(0, 3);
                    context += `  Memories: ${recentMemories.join(" / ")}\n`;
                }
            });
            context += "\n";
        }

        // 2. Background Knowledge (Minimal - Context Only)
        if (backgroundCharacters.length > 0) {
            context += `[Background Knowledge] (Context Only - Do not spawn unless necessary)\n`;
            backgroundCharacters.forEach(candidate => {
                const charData = candidate.data;
                const desc = charData.profile?.신분 || charData.title || "Unknown";
                const rank = charData.강함?.등급 || charData.profile?.등급 || "Unknown";

                // Minimal Info: Name, Title, Identity, Rank
                context += `- ${candidate.name} (${charData.title || "Unknown"}) | Identity: ${desc} | Rank: ${rank}\n`;
            });
            context += "\n";
        }

        // 2. 동적 Lore 검색 (정규식 매칭)
        // 원본 입력 대조
        const retrievedKeys = new Set<string>();

        for (const [pattern, key] of Object.entries(this.LORE_PATTERNS)) {
            if (new RegExp(pattern).test(userInput)) {
                retrievedKeys.add(key);
            }
        }

        if (retrievedKeys.size > 0) {
            context += `[Retrieved Lore]\n- Related Topics: ${Array.from(retrievedKeys).join(', ')}\n`;
            context += this.fetchLoreData(state, Array.from(retrievedKeys));
        }

        // 3. 모드별 검색 (Mode-Specific Retrieval) - Heuristic Inference
        // 라우터가 없으므로 간단한 키워드 매칭으로 대체하거나 항상 포함
        // combat -> always include stats if 'attack', 'kill', 'skill' in input
        const lowerInput = userInput.toLowerCase();
        const isCombat = lowerInput.includes("attack") || lowerInput.includes("kill") || lowerInput.includes("hit") || lowerInput.includes("skill") || lowerInput.includes("공격") || lowerInput.includes("죽이");

        if (isCombat) {
            // 플레이어 전투 스탯 및 스킬 가져오기
            const stats = state.playerStats;
            if (stats) {
                context += `\n[Combat Stats]\nHP: ${stats.hp}/${stats.maxHp}\nATK: ${stats.str}\nSkills: ${stats.skills?.join(', ') || "None"}\n`;
            }
        }

        // Dialogue Profile Injection
        // 단순화: 입력에 이름이 언급된 캐릭터의 프로필과 기억(Memories)을 주입
        if (state.characterData) {
            for (const [id, char] of Object.entries(state.characterData)) {
                const c = char as any;
                const name = c.name?.trim();
                const koreanName = c.이름?.trim();

                let isMentioned = false;

                // [Bug Fix] 빈 문자열("") 체크가 되어 모든 캐릭터가 잡히던 문제 수정
                if (name && lowerInput.includes(name.toLowerCase())) {
                    isMentioned = true;
                } else if (koreanName && lowerInput.includes(koreanName)) {
                    isMentioned = true;
                }

                if (isMentioned) {
                    const activeCharIds = new Set((state.activeCharacters || []).map((ac: any) => String(ac).toLowerCase()));
                    const isActive = activeCharIds.has(id.toLowerCase());

                    // 현재 장면에 없는 경우에만 프로필 추가 (장면에 있으면 Orchestrator가 이미 추가함)
                    if (!isActive) {
                        const displayName = name || koreanName || "Unknown";
                        const relInfo = (c as any).relationshipInfo;
                        const statusStr = relInfo?.status ? ` | Status: ${relInfo.status}` : "";
                        const speechStr = relInfo?.speechStyle ? ` | Speech: ${relInfo.speechStyle}` : "";
                        context += `\n[Target Profile: ${displayName}]\nPersonality: ${JSON.stringify(c.personality)}\nRelationship: ${c.relationship || "Neutral"}${statusStr}${speechStr}\n`;
                    }

                    // 기억(Memories)은 항상 중요하므로 추가
                    const memName = name || koreanName;
                    if (c.memories && c.memories.length > 0 && memName) {
                        context += `[Memories with ${memName}]\n- ${c.memories.join('\n- ')}\n`;
                    }
                }
            }
        }

        return context;
    }

    private static fetchLoreData(state: any, keys: string[]): string {
        // 스텁: 실제로는 state.lore.charactersDetail 등에서 조회
        let data = "";
        keys.forEach(k => {
            // [Wuxia]
            if (k.startsWith("Yeon Hwarin")) {
                const char = state.characterData?.['yeon hwarin'] || state.characterData?.['연화린'];
                if (char) data += `- Yeon Hwarin: ${char.description || "Main Heroine"}\n`;
            }
            // [GBY]
            if (k.startsWith("Han Ga-Eul")) {
                const char = state.characterData?.['han ga-eul'] || state.characterData?.['한가을'];
                if (char) data += `- Han Ga-Eul: ${char.description || "Main Heroine (GBY)"}\n`;
            }
        });
        return data;
    }
}
