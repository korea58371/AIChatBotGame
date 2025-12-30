
import { AgentRouter } from './router';
import { AgentRetriever } from './retriever';
import { AgentPreLogic } from './pre-logic';
import { AgentPostLogic } from './post-logic';
import { generateResponse } from '../gemini'; // 기존 함수 재사용/리팩토링
import { Message } from '../store';
import { calculateCost, MODEL_CONFIG } from '../model-config';

export class AgentOrchestrator {

    /**
     * 5단계 에이전틱 워크플로우를 사용하여 전체 게임 턴을 실행합니다.
     */
    static async executeTurn(
        apiKey: string,
        gameState: any,
        history: Message[],
        userInput: string,
        language: 'ko' | 'en' | null = 'ko',
        modelName: string = 'gemini-3-pro-preview' // [NEW]
    ) {
        console.log(`[AgentOrchestrator] 턴 시작... 입력: "${userInput}"`);
        const startTime = Date.now();

        // [Step 1] Router: 의도 파악 (Determine Intent)
        // 컨텍스트를 위해 최근 기록 전달 (예: 대화의 연속성)
        const routerOut = await AgentRouter.analyze(history, gameState.lastSystemMessage || "");
        console.log(`[AgentOrchestrator] 라우터 의도: ${routerOut.type} -> ${routerOut.intent}`);

        // [Step 2] Retriever: 컨텍스트 검색 (Fetch Context)
        const retrievedContext = await AgentRetriever.retrieveContext(routerOut, gameState);
        console.log(`[AgentOrchestrator] 검색된 컨텍스트 길이: ${retrievedContext.length} chars`);

        // [Step 3] Pre-Logic: 룰 판정 (Adjudicate Rules)
        const preLogicOut = await AgentPreLogic.adjudicate(routerOut, retrievedContext, userInput, gameState);
        console.log(`[AgentOrchestrator] Pre-Logic 결과: ${preLogicOut.success ? '성공' : '실패'}`);
        console.log(`[AgentOrchestrator] 서사 가이드: "${preLogicOut.narrative_guide}"`);

        // [Step 4] Story Generation (Narrator)
        // Pre-Logic 가이드 + 검색된 컨텍스트를 프롬프트에 주입

        // 모델을 이끄는 복합적인 "사용자 입력" 구성
        // Narrative Guide를 컨텍스트로 위장한 [System Directive]로 앞에 붙입니다.
        const compositeInput = `
[Narrative Direction]
${preLogicOut.narrative_guide}

[Context data]
${retrievedContext}

[Player Action]
${userInput}
`;

        // 기존 Gemini 생성 함수 사용
        // 참고: gameState는 다른 정적 프롬프트 필요를 위해 전달되지만, 동적인 부분은 input을 통해 오버라이드합니다.
        const storyResult = await generateResponse(
            apiKey,
            history,
            compositeInput,
            gameState,
            language,
            modelName // [NEW] Pass model name
        );

        // [Step 5] Post-Logic: 상태 분석 (Fire-and-Forget / Async)
        // UI 반환을 위해 이를 엄격하게 기다리진 않지만, 일단 상태 무결성을 위해 await 합니다.
        // 실제 서버 액션에서는 일찍 리턴할 수도 있지만, Vercel 서버 액션은 떠있는 프로미스를 죽일 수 있습니다.
        // 따라서 await 합니다.
        const postLogicOut = await AgentPostLogic.analyze(userInput, storyResult.text, gameState.currentMood || "daily");

        const totalTime = Date.now() - startTime;
        console.log(`[AgentOrchestrator] 턴 완료 (${totalTime}ms)`);

        // [Cost Calculation]
        const routerCost = calculateCost(MODEL_CONFIG.ROUTER, routerOut.usageMetadata?.promptTokenCount || 0, routerOut.usageMetadata?.candidatesTokenCount || 0, routerOut.usageMetadata?.cachedContentTokenCount || 0);
        const preLogicCost = calculateCost(MODEL_CONFIG.PRE_LOGIC, preLogicOut.usageMetadata?.promptTokenCount || 0, preLogicOut.usageMetadata?.candidatesTokenCount || 0, preLogicOut.usageMetadata?.cachedContentTokenCount || 0);
        const postLogicCost = calculateCost(MODEL_CONFIG.LOGIC, postLogicOut.usageMetadata?.promptTokenCount || 0, postLogicOut.usageMetadata?.candidatesTokenCount || 0, postLogicOut.usageMetadata?.cachedContentTokenCount || 0);
        const storyCost = calculateCost(
            (storyResult as any).usedModel || MODEL_CONFIG.STORY,
            storyResult.usageMetadata?.promptTokenCount || 0,
            storyResult.usageMetadata?.candidatesTokenCount || 0,
            (storyResult.usageMetadata as any)?.cachedContentTokenCount || 0 // [NEW] Pass Cached Tokens
        );

        const totalCost = routerCost + preLogicCost + postLogicCost + storyCost;

        return {
            reply: storyResult.text,
            logic: preLogicOut, // 판정 결과 노출
            post_logic: postLogicOut, // 상태 업데이트 노출
            router: routerOut, // 디버그 정보
            usageMetadata: storyResult.usageMetadata,
            usedModel: (storyResult as any).usedModel,
            // [Cost Aggregation]
            allUsage: {
                router: routerOut.usageMetadata,
                preLogic: preLogicOut.usageMetadata,
                postLogic: postLogicOut.usageMetadata,
                story: storyResult.usageMetadata
            },
            cost: totalCost, // [NEW] Actual calculated cost
            systemPrompt: (storyResult as any).systemPrompt,
            finalUserMessage: (storyResult as any).finalUserMessage
        };
    }
}
