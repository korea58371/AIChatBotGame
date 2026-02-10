import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { MODEL_CONFIG } from '../ai/model-config';
import { ScenarioState, GameState } from '../store';
import { retryWithBackoff } from '../ai/gemini'; // Reusing retry logic

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export class AgentScenario {

    /**
     * [Generate] New Scenario
     * Triggered when player is idle (Daily mood).
     */
    static async generate(
        apiKey: string,
        gameState: GameState,
        context: {
            location: string;
            activeCharacters: string[];
            playerStats: any;
        }
    ): Promise<ScenarioState | null> {
        if (!apiKey) return null;
        console.log(`[ScenarioAgent] Generating new scenario for location: ${context.location}`);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.LOGIC, // Use Flash for speed
            safetySettings,
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
        당신은 '무협 게임 시나리오 디렉터'입니다.
        현재 플레이어가 특별한 사건 없이 시간을 보내고 있습니다. 
        플레이어에게 흥미를 유발할 **단기 퀘스트(Mini-Scenario)**를 설계하십시오.

        [현재 상황]
        - 장소: ${context.location}
        - 등장인물: ${context.activeCharacters.join(', ') || "없음"}
        - 플레이어 수준: ${context.playerStats.playerRank} (명성: ${context.playerStats.fame})

        [시나리오 조건]
        1. **규모**: 5~10턴 내외로 끝나는 소규모 에피소드.
        2. **유형**:
           - **심부름/관계**: 짝사랑 전달, 오해 풀기, 물건 배달.
           - **사건/갈등**: 소매치기 추격, 취객 제압, 상단 호위.
           - **기연/수련**: 무공 비급 힌트, 은거 고수와의 만남.
        3. **자유도**: 유저가 거절하거나 무시할 수 있음을 전제로 설계.

        [Output Format (JSON)]
        {
            "title": "시나리오 제목 (예: 사라진 당가의 비급)",
            "goal": "시나리오의 최종 목표 (예: 비급을 찾아 당소소에게 전달)",
            "description": "UI에 표시될 퀘스트 설명",
            "npcs": ["관련 NPC ID 1", "관련 NPC ID 2"],
            "variables": { "status": "started", "clueFound": false },
            "stage": "intro"
        }
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            const json = JSON.parse(text);

            return {
                id: `scen_${Date.now()}`,
                active: true,
                title: json.title,
                goal: json.goal,
                description: json.description,
                npcs: json.npcs || [],
                variables: json.variables || {},
                stage: json.stage || "intro",
                turnCount: 0
            };
        } catch (e) {
            console.error("[ScenarioAgent] Generation Failed:", e);
            return null;
        }
    }

    /**
     * [Update] Existing Scenario
     * Triggered every turn if scenario is active.
     */
    static async update(
        apiKey: string,
        scenario: ScenarioState,
        lastUserMessage: string,
        lastAiStory: string
    ): Promise<{
        status: 'CONTINUE' | 'COMPLETED' | 'FAILED' | 'IGNORED';
        stage: string;
        variables: Record<string, any>;
        directorsNote: string;
    }> {
        if (!apiKey) return { status: 'CONTINUE', stage: scenario.stage, variables: scenario.variables, directorsNote: "" };

        console.log(`[ScenarioAgent] Updating scenario: ${scenario.title} (Stage: ${scenario.stage})`);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.LOGIC,
            safetySettings,
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
        당신은 '시나리오 디렉터'입니다.
        현재 진행 중인 시나리오의 상태를 업데이트하고, 다음 턴의 연출 지시(Note)를 작성하십시오.

        [시나리오 정보]
        - 제목: ${scenario.title}
        - 목표: ${scenario.goal}
        - 현재 단계: ${scenario.stage}
        - 변수: ${JSON.stringify(scenario.variables)}

        [최근 상황]
        - 플레이어 행동: "${lastUserMessage}"
        - 게임 전개: "${lastAiStory.substring(0, 300)}..."

        [판단 기준]
        1. **진행(CONTINUE)**: 플레이어가 시나리오에 협조적임. -> 다음 단계로 진행.
        2. **완료(COMPLETED)**: 목표를 달성함.
        3. **실패(FAILED)**: 중요 NPC 사망, 기한 초과, 적대적 행위 등.
        4. **무시(IGNORED)**: 플레이어가 퀘스트를 거절하거나, 관련 없는 곳으로 이동함.

        [Output Format (JSON)]
        {
            "status": "CONTINUE" | "COMPLETED" | "FAILED" | "IGNORED",
            "stage": "업데이트된 단계 (예: 'investigation' -> 'confrontation')",
            "variables": { "기존변수": "값", "새변수": "값" },
            "directorsNote": "다음 턴 메인 작가에게 전달할 연출 지침. (예: '상인이 플레이어를 의심합니다. 긴장감을 조성하세요.')"
        }
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            const json = JSON.parse(text);

            return {
                status: json.status,
                stage: json.stage,
                variables: { ...scenario.variables, ...json.variables },
                directorsNote: json.directorsNote
            };
        } catch (e) {
            console.error("[ScenarioAgent] Update Failed:", e);
            // Fallback: Maintain state
            return {
                status: 'CONTINUE',
                stage: scenario.stage,
                variables: scenario.variables,
                directorsNote: "AI 판단 실패. 기존 흐름 유지."
            };
        }
    }
}
