
// import { GameState } from '../prompt-manager'; 
// import { PromptManager } from '../prompt-manager';
import { RouterOutput } from './router';

export class AgentRetriever {

    // "Lorebook" 정규식 데이터베이스 (코드 기반 필터링)
    // Key: 정규식 패턴, Value: 데이터 키 경로 또는 JSON 객체
    private static readonly LORE_PATTERNS: Record<string, string> = {
        // 예시: '린이'가 앞에 한글이 없을 때만 매칭 (어린이, 기린이 등 오탐 방지)
        // RegEx: /(?<![가-힣])린이/
        // 참고: JS RegExp lookbehind는 최신 환경에서 잘 지원됨.
        "연화린|(?<![가-힣])린이": "Yeon Hwarin",
        "팽소소": "Pang Soso",
        "한가을|가을이": "Han Ga-Eul", // [GBY] 히로인
        "고하늘|하늘이": "Go Ha-Neul", // [GBY] 주인공
        "빙백신권": "MartialArts:Ice_Soul_Fist",
        "화산파": "Faction:Mount_Hua"
    };

    /**
     * 라우터 출력에 기반하여 관련 컨텍스트를 검색합니다.
     */
    static async retrieveContext(
        routerOut: RouterOutput,
        state: any, // 지금은 강결합을 피하기 위해 any 사용
        suggestedCharacters: any[] = [] // [NEW] Casting Candidates
    ): Promise<string> {

        console.log(`[Retriever] 컨텍스트 검색 중... 타입: ${routerOut.type}`);
        let context = "";

        // 1. Casting/Encounter Suggestions (Priority)
        // 1. Casting/Encounter Suggestions (Priority)
        if (suggestedCharacters.length > 0) {
            context += `[Casting Suggestions]\n`;
            suggestedCharacters.forEach(candidate => {
                const charData = candidate.data;
                const desc = charData.profile?.신분 || charData.title || "Unknown";
                const appearance = charData.외형?.얼굴형_인상 || charData.외형?.outfit_style || "";

                // Tiered Information based on Score/Reasons
                const isMentioned = candidate.reasons.some((r: string) => r.includes('Mentioned'));
                const isActiveRegion = candidate.reasons.some((r: string) => r.includes('Active Zone') || r.includes('Home Region'));

                let tag = "[Potential]";
                if (isMentioned) tag = "[Mentioned/Relevant]";
                else if (isActiveRegion) tag = "[Nearby]";

                context += `- ${tag} Name: ${candidate.name} (${charData.title})\n  Identity: ${desc}\n  Appearance: ${appearance}\n  Logic: ${candidate.reasons.join(', ')}\n`;

                // Add Personality only if relevant (mentioned or active region) to save tokens
                if (isMentioned || isActiveRegion) {
                    context += `  Personality: ${JSON.stringify(charData.personality)}\n`;
                }
            });
            context += "\n";
        }

        // 2. 동적 Lore 검색 (정규식 매칭)
        // 라우터 키워드 + 원본 입력 vs Lore 패턴 대조
        const keywords = routerOut.keywords || [];
        const retrievedKeys = new Set<string>();

        // 키워드 확인
        keywords.forEach(kw => {
            for (const [pattern, key] of Object.entries(this.LORE_PATTERNS)) {
                if (new RegExp(pattern).test(kw)) {
                    retrievedKeys.add(key);
                }
            }
        });

        if (retrievedKeys.size > 0) {
            context += `[Retrieved Lore]\n- Related Topics: ${Array.from(retrievedKeys).join(', ')}\n`;
            // 실제 구현에서는 여기서 "Yeon Hwarin"에 대한 JSON 데이터를 가져와야 함.
            // 지금은 스텁(Stub) 처리하거나 상태(State)에서 룩업.
            context += this.fetchLoreData(state, Array.from(retrievedKeys));
        }

        // 3. 모드별 검색 (Mode-Specific Retrieval)
        if (routerOut.type === 'combat') {
            // 플레이어 전투 스탯 및 스킬 가져오기
            const stats = state.playerStats;
            context += `\n[Combat Stats]\nHP: ${stats.hp}/${stats.maxHp}\nATK: ${stats.str}\nSkills: ${stats.skills?.join(', ') || "None"}\n`;
        }
        else if (routerOut.type === 'dialogue') {
            // [Optimized Retrieval]
            // 1. Explicit Target found by Router?
            // 2. If Target is ACTIVE, rely on PromptManager for Profile. Only fetch Memories.
            // 3. If Target is NOT ACTIVE (e.g. Reminiscing), fetch Profile + Memories.
            // 4. If No Target, assume General Address -> Rely on PromptManager (No generic memory dump).

            if (routerOut.target && routerOut.target !== 'None') {
                const targetObj = this.findCharacter(state, routerOut.target);

                if (targetObj) {
                    const { id, data: targetData } = targetObj;
                    const activeCharIds = new Set((state.activeCharacters || []).map((c: any) => String(c).toLowerCase()));
                    const isActive = activeCharIds.has(id.toLowerCase());

                    if (!isActive) {
                        context += `\n[Target Profile: ${targetData.name}]\nPersonality: ${JSON.stringify(targetData.personality)}\nRelationship: ${targetData.relationship || "Neutral"}\n`;
                    }

                    // Always inject memories if they exist
                    if (targetData.memories && targetData.memories.length > 0) {
                        context += `[Memories with Player]\n- ${targetData.memories.join('\n- ')}\n`;
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

    private static findCharacter(state: any, targetName: string): { id: string, data: any } | null {
        // state.characterData 내에서 단순 퍼지(Fuzzy) 검색
        if (!state.characterData) return null;

        const lowerTarget = targetName.toLowerCase();
        for (const [id, char] of Object.entries(state.characterData)) {
            const c = char as any;
            // Check ID, Name, EnglishName
            if (id.toLowerCase() === lowerTarget ||
                c.name?.toLowerCase().includes(lowerTarget) ||
                c.englishName?.toLowerCase().includes(lowerTarget)) {
                return { id, data: c };
            }
        }
        return null;
    }
}
