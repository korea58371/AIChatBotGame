
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../ai/model-config';
// import { WUXIA_CHOICE_RULES } from '../../data/games/wuxia/constants'; // [Removed] Generic Refactor

// Define Interface for Output
export interface ChoiceOutput {
    text: string; // The formatted choice text (<선택지1>... )
    usageMetadata?: any;
    _debug_prompt?: string;
}

export class AgentChoices {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

    /**
     * Generates 3 choices based on the current story context using a lightweight model.
     */
    static async generate(
        userInput: string,
        storyText: string,
        gameState: any,
        language: 'ko' | 'en' | null = 'ko',
        directorOut?: any // [NEW] Director output for context-aware choices
    ): Promise<ChoiceOutput> {
        const apiKey = this.apiKey;
        if (!apiKey) return { text: "" };

        const genAI = new GoogleGenerativeAI(apiKey);

        // [1] Location Context Extraction (Using shared location-utils)
        let locationContext = "";
        const currentLocation = gameState.currentLocation || "Unknown";
        const locationsData = gameState.lore?.locations;
        if (locationsData && locationsData.regions && currentLocation) {
            const { getStoryLocationContext } = await import('./location-utils');
            locationContext = getStoryLocationContext(currentLocation, locationsData.regions);
        } else {
            locationContext = `Location: ${currentLocation} (Details Unknown)`;
        }

        // [2] Active Character Context Extraction
        const activeCharIds = gameState.activeCharacters || [];
        let activeCharContext = "";
        const playerRelationships = gameState.playerStats?.relationships || {};

        if (activeCharIds.length > 0) {
            activeCharContext = activeCharIds.map((id: string) => {
                const char = gameState.characterData?.[id];
                if (!char) return "";
                const relScore = playerRelationships[id] || 0;
                let relStatus = "Stranger";
                if (relScore > 50) relStatus = "Close Friend/Ally";
                if (relScore > 80) relStatus = "Lover/Devoted";
                if (relScore < -20) relStatus = "Hostile/Enemy";

                return `- [${char.name}] (${char.title || "NPC"})\n  Desc: ${char.profile?.신분 || "Unknown"} | Faction: ${char.faction || "None"}\n  Relation: ${relStatus} (Score: ${relScore})`;
            }).filter(Boolean).join('\n');
        } else {
            activeCharContext = "None (Only Protagonist present)";
        }

        // [3] Genre/World Rule Extraction (Dynamic from Lorebook)
        const worldRules = gameState.lore?.worldRules || gameState.constants?.CORE_RULES || "";
        const choiceRules = gameState.lore?.choiceRules || gameState.constants?.CHOICE_RULES || gameState.constants?.choiceRules ||
            "- (1번) 적극적/주도적 (상황을 진전시킴)\n- (2번) 신중한/관찰 (정보를 모음)\n- (3번) 창의적/유머 (캐릭터 개성 반영)";

        // System Prompt: Generic Choice Specialist
        const systemPrompt = `
당신은 텍스트 RPG의 [선택지 생성기]입니다.
유일한 역할: 제공된 스토리의 **마지막 문장을 읽고**, 그 직후에 플레이어가 할 수 있는 3가지 행동을 생성하는 것입니다.

[선택지 생성 규칙]
${choiceRules}

[⭐ 핵심 원칙 - 연속성 (CONTINUATION)]
- **선택지는 스토리의 마지막 문장에서 바로 이어지는 '다음 행동'이어야 합니다.**
- 마지막 문장이 "~했다."로 끝나면, 선택지는 그 직후 0.1초 뒤의 행동이어야 합니다.
- 마지막 문장이 누군가의 대사/질문으로 끝나면, 선택지는 그에 대한 반응이어야 합니다.
- **금지**: 이미 완료된 행동을 반복하거나, 갑자기 맥락 없는 새 행동을 제시하는 것.

[핵심 원칙 - 시간과 장소]
- **[Current Story Segment]가 절대적 진실입니다.**
- **마지막 문단**에 집중하십시오.
- **플레이어가 장소를 떠났다면**: 남겨진 캐릭터와의 상호작용은 즉시 버리십시오.
- **대화가 끝났다면**: 같은 주제를 계속하지 마십시오.

[핵심 원칙 - 플레이어 행동만]
- 오직 주인공(${gameState.playerName || '주인공'})의 행동만 생성하십시오.
- NPC의 행동/반응/대사를 선택지에 넣지 마십시오.
- 나쁜 예: "상인이 화를 낸다." (NPC 행동)
- 좋은 예: "상인에게 따진다." (플레이어 행동)

[핵심 원칙 - 맥락 인식]
- **[Active Characters]**에 있는 인물만 대화 대상으로 사용하십시오.
- **[Location Context]**를 확인하십시오. 실내에 있으면서 "거리를 걷는다"는 선택지를 내지 마십시오.

[출력 규칙]
- 오직 3줄의 선택지만 출력하십시오.
- 대화, 설명, JSON 출력 금지.
- 태그 형식 준수: <선택지N> 내용
- **[길이 제한]**: 각 선택지는 64바이트(한글 약 32자) 이내로 간결하게.
`;

        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.CHOICES || 'gemini-2.5-flash-lite',
            systemInstruction: systemPrompt
        });

        // [New] Skill Extraction
        const skills = gameState.playerStats?.skills || gameState.skills || [];
        const skillList = skills.length > 0
            ? skills.map((s: any) => `- [${s.name}] (${s.rank}): ${s.description}`).join('\n')
            : "No known skills.";

        // Construct Dynamic Prompt
        const dynamicPrompt = `
[Player Info]
Name: ${gameState.playerName || 'Protagonist'}
Identity: ${gameState.playerStats?.playerRank || 'Unknown'} Rank
Personality: ${gameState.playerStats?.personalitySummary || 'Unknown'}
Final Goal: ${gameState.playerStats?.final_goal || 'Survival'}
Current Status: ${gameState.statusDescription || 'Normal'}
Active Injuries: ${(() => {
                const injuries = gameState.playerStats?.active_injuries || [];
                return injuries.length > 0 ? injuries.join(', ') : 'None';
            })()}

[Location Context]
${locationContext}

[Active Characters]
${activeCharContext}
(Note: These characters are present in the general scene, but if the narrative says the player moved away, ignore them.)

[Known Skills]
${skillList}

[World Rules / Guidelines]
${worldRules}

${(() => {
                // [NEW] Director Context — plot direction for aligned choices
                const parts: string[] = [];
                if (directorOut) {
                    if (directorOut.plot_beats?.length) parts.push(`[Director Plot Direction]\n${directorOut.plot_beats.join(' → ')}`);
                    if (directorOut.tone) parts.push(`Tone: ${directorOut.tone}`);
                    if (directorOut.emotional_direction) parts.push(`Emotional Direction: ${directorOut.emotional_direction}`);
                }
                // [NEW] Active Goals
                const goals = (gameState.goals || []).filter((g: any) => g.status === 'ACTIVE');
                if (goals.length > 0) {
                    parts.push(`[Active Goals]\n${goals.map((g: any) => `- ${g.description}`).join('\n')}`);
                }
                return parts.join('\n');
            })()}

[Previous Action]
${userInput}

[Current Story Segment]
${storyText}

[Task]
[Current Story Segment]의 **마지막 문장을 읽고**, 그 바로 다음에 [${gameState.playerName}]이(가) 할 수 있는 3가지 행동을 생성하십시오.

**[⭐ 핵심 - 마지막 문장에서 이어지는 선택지]**
- 마지막 문장을 인용하며 자문하십시오: "이 문장 직후, 주인공이 할 수 있는 자연스러운 행동은?"
- **이미 일어난 일을 반복하지 마십시오.** (텍스트에 "앉았다"가 있으면 "앉는다"는 금지)
- **생각만 하는 선택지 금지.** ("왜 그런지 생각해 본다"는 금지)
- **다음 행동을 제시하십시오.** ("물어본다", "자리를 뜬다", "핸드폰을 꺼낸다")
- Director Plot Direction이 있으면, 최소 1개는 그 방향에 맞추십시오.
- Active Goals가 있으면, 최소 1개는 목표 진행과 관련되어야 합니다.

- 선택지 1: 적극적/주도적 ([Director Plot Direction] 또는 [Active Goals] 방향).
- 선택지 2: 신중한/관찰/실리적.
- 선택지 3: 창의적/사교적/유머 ([Personality] 반영).

[상황별 가이드]
- 마지막 문장을 확인하십시오. 플레이어는 어디에, 누구와 있습니까?
- 플레이어가 방금 이동했다면: 도착지에서 할 행동에 집중.
- [Active Injuries]가 있다면: 회복 관련 선택을 고려.
- 평화로운 상황이라면: 일상/대화/관계 진전 선택.
- 전투 상황이라면: [Known Skills]를 활용한 전투 선택.

[검증 체크리스트]
- 다른 사람의 행동을 묘사하고 있는가? → 거부.
- 플레이어의 행동인가? → 허용.
- 대화 대상이 [Active Characters]에 있는가? → 없으면 거부.
- **[반복 방지]**: [Current Story Segment]에서 이미 완료된 행동/생각을 반복하는가? → 거부.
- **[전진]**: 이야기를 앞으로 진전시키는가? → 우선.
- **[명확한 의도]**: 선택지가 구체적인 '다음 행동'을 암시하는가? → 필수.
`;
        try {
            const result = await model.generateContent(dynamicPrompt);
            const response = result.response;
            const text = response.text().trim();

            return {
                text: text,
                usageMetadata: response.usageMetadata,
                _debug_prompt: `${systemPrompt}\n\n${dynamicPrompt}`
            };

        } catch (error) {
            console.error("[AgentChoices] Generation Error:", error);
            // Fallback choices in case of error (Safety Net)
            return { text: "<선택지1> 상황을 살핀다.\n<선택지2> 신중하게 행동한다.\n<선택지3> 과감하게 나선다." };
        }
    }
}
