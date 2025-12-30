
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../model-config';
import { Message } from '../store';

export interface RouterOutput {
    type: 'combat' | 'dialogue' | 'action' | 'system' | 'unknown';
    intent: string;
    target?: string;
    keywords: string[];
    analysis: string; // 디버깅용 분석 요약
    usageMetadata?: any; // [Cost] 토큰 사용량
    _debug_prompt?: string; // [Debug] 실제 프롬프트
}

export class AgentRouter {
    private static apiKey: string | undefined = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // 정적 라우터 시스템 프롬프트 (제로샷)
    // 속도와 정확성에 최적화됨
    private static readonly ROUTER_PROMPT = `
You are the [Router Module] of a text-based RPG engine.
Your job is to analyze the User's input and classify their INTENT into specific categories.
Do NOT generate a story response. ONLY output a JSON object.

[Input Context]
1. Last System Message: What happened previously.
2. User Input: What the player wants to do.

[Classification Categories]
- "combat": Attacking, defending, using skills, fleeing, tactical movement.
- "dialogue": Speaking to characters, asking questions, emotional expression.
- "action": General physical actions (searching, crafting, moving to location, sleeping, eating).
- "system": UI requests (save, load, check status, check inventory, debug).

[Output Schema (JSON)]
{
  "type": "combat" | "dialogue" | "action" | "system",
  "intent": "Brief summary of user action (e.g. 'Attack Bandit A')",
  "target": "Target Entity Name/ID (optional, e.g. 'Bandit Leader', 'Yeon Hwarin')",
  "keywords": ["List", "of", "important", "nouns", "for", "retrieval"]
}

[Examples]
Input: "I slash the goblin with my sword."
Output: {"type": "combat", "intent": "Attack Goblin", "target": "Goblin", "keywords": ["Goblin", "Sword", "Slash"]}

Input: "Yeon Hwarin, why are you crying?"
Output: {"type": "dialogue", "intent": "Ask reason for crying", "target": "Yeon Hwarin", "keywords": ["Yeon Hwarin", "Crying", "Reason"]}

Input: "Check my status window."
Output: {"type": "system", "intent": "Check Status", "keywords": ["Status Window"]}
`;

    static async analyze(
        messages: Message[],
        lastSystemMessage: string
    ): Promise<RouterOutput> {
        if (!this.apiKey) {
            console.error("AgentRouter: API 키가 누락되었습니다.");
            return { type: 'unknown', intent: 'API Error', keywords: [], analysis: 'Missing API Key' };
        }

        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_CONFIG.ROUTER,
            generationConfig: { responseMimeType: "application/json" }
        });

        const userMessage = messages[messages.length - 1]?.text || "";

        // 경량화된 프롬프트 구성
        const prompt = `
${this.ROUTER_PROMPT}

[Current Context]
Last System Output: "${lastSystemMessage.slice(-300)}"
User Input: "${userMessage}"

Analyze the User Input:
`;

        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // 마크다운이 포함된 경우 정리
            const jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonText);

            return {
                ...data,
                analysis: `Router 분류 결과: ${data.type}`,
                usageMetadata: result.response.usageMetadata,
                _debug_prompt: prompt
            };

        } catch (e) {
            console.error("AgentRouter 분석 실패:", e);
            // 폴백: 단순 휴리스틱
            return this.heuristicFallback(userMessage);
        }
    }

    private static heuristicFallback(input: string): RouterOutput {
        const lower = input.toLowerCase();
        if (lower.includes('status') || lower.includes('save') || lower.includes('load')) {
            return { type: 'system', intent: '시스템 요청', keywords: [], analysis: '휴리스틱 폴백' };
        }
        if (lower.includes('attack') || lower.includes('kill') || lower.includes('hit')) {
            return { type: 'combat', intent: '전투 행동', keywords: [], analysis: '휴리스틱 폴백' };
        }
        if (input.includes('"') || input.includes("'")) {
            return { type: 'dialogue', intent: '대화', keywords: [], analysis: '휴리스틱 폴백' };
        }
        return { type: 'action', intent: '일반 행동', keywords: [], analysis: '휴리스틱 폴백' };
    }
}
