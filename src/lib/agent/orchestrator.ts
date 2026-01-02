
import { AgentRouter } from './router';
import { AgentRetriever } from './retriever';
import { AgentPreLogic } from './pre-logic';
import { AgentPostLogic } from './post-logic';
import { AgentSummary } from './summary';
import { AgentCasting } from './casting'; // [NEW]
import { AgentMartialArts } from './martial-arts'; // [NEW]
import { generateResponse } from '../gemini'; // 기존 함수 재사용/리팩토링
import { Message } from '../store';
import { calculateCost, MODEL_CONFIG } from '../model-config';
import { PromptManager } from '../prompt-manager';

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
        modelName: string = MODEL_CONFIG.STORY // [NEW]
    ) {
        console.log(`[AgentOrchestrator] 턴 시작... 입력: "${userInput}"`);
        const startTime = Date.now();
        const t1 = Date.now();

        // [Step 1] Router: 의도 파악 (Determine Intent)
        // 컨텍스트를 위해 최근 기록 전달 (예: 대화의 연속성)
        // [Fix] Extract last system message from history if not explicit in gameState
        let lastContext = gameState.lastSystemMessage || "";
        if (!lastContext && history.length > 0) {
            const lastModelMsg = [...history].reverse().find(m => m.role === 'model');
            if (lastModelMsg) lastContext = lastModelMsg.text;
        }

        // [Sanitize] Remove UI Tags (Choice, Bg, BGM) to reduce noise for Router
        lastContext = lastContext
            .replace(/<선택지[^>]*>.*?(\n|$)/g, '') // Remove Choice lines
            .replace(/<배경:[^>]*>/g, '')           // Remove Background tags
            .replace(/<BGM:[^>]*>/g, '')            // Remove BGM tags
            .trim();

        // [Fix] Extract active characters for Router Context
        const activeCharacterNames: string[] = [];
        if (gameState.activeCharacters && gameState.characterData) {
            gameState.activeCharacters.forEach((id: string) => {
                const char = gameState.characterData[id];
                if (char && char.name) activeCharacterNames.push(char.name);
            });
        }

        const lastTurnSummary = gameState.lastTurnSummary || ""; // [NEW] Context

        // [Step 1] Router & Casting (Parallel Execution)
        const [routerOut, allCastingCandidates] = await Promise.all([
            AgentRouter.analyze(history, lastContext, activeCharacterNames, lastTurnSummary),
            AgentCasting.analyze(gameState, lastTurnSummary, userInput)
        ]);

        // Filter valid suggestions for Retriever (Score >= 1.0 is already filtered in Casting, but we take top 10)
        // [Modified] Increased from 3 to 10 to allow "Tiered Visibility" (Active/Mentioned/Potential)
        const suggestions = allCastingCandidates.slice(0, 10);

        const t2 = Date.now();
        console.log(`[AgentOrchestrator] 라우터 의도: ${routerOut.type} -> ${routerOut.intent}`);
        if (suggestions.length > 0) {
            console.log(`[AgentOrchestrator] 캐스팅 추천: ${suggestions.map(c => c.name).join(', ')}`);
        }

        // [Step 2] Retriever: 컨텍스트 검색 (Fetch Context)
        const retrievedContext = await AgentRetriever.retrieveContext(routerOut, gameState, suggestions);
        const t3 = Date.now();
        console.log(`[AgentOrchestrator] 검색된 컨텍스트 길이: ${retrievedContext.length} chars`);

        // [Step 3] Pre-Logic: 룰 판정 (Adjudicate Rules)
        const preLogicOut = await AgentPreLogic.analyze(routerOut, retrievedContext, userInput, gameState, lastTurnSummary, suggestions);
        const t4 = Date.now();
        console.log(`[AgentOrchestrator] Pre-Logic 결과: ${preLogicOut.success ? '성공' : '실패'}`);
        console.log(`[AgentOrchestrator] 서사 가이드: "${preLogicOut.narrative_guide}"`);

        // [Mood Override] PreLogic determines the atmosphere of the current turn
        // If PreLogic explicitly requests a mood shift (e.g. Combat -> Daily), we honor it for this turn's prompt.
        let effectiveGameState = gameState;
        if (preLogicOut.mood_override) {
            console.log(`[AgentOrchestrator] Mood Override Triggered: ${gameState.currentMood} -> ${preLogicOut.mood_override}`);
            effectiveGameState = { ...gameState, currentMood: preLogicOut.mood_override };
        }

        // [Step 4] Story Generation (Narrator)
        // Pre-Logic 가이드 + 검색된 컨텍스트를 프롬프트에 주입

        // 모델을 이끄는 복합적인 "사용자 입력" 구성
        // Narrative Guide를 컨텍스트로 위장한 [System Directive]로 앞에 붙입니다.
        const compositeInput = `
[Narrative Direction]
${preLogicOut.narrative_guide}

[Context data]
[Context data]
${PromptManager.getPlayerContext(effectiveGameState)} // [NEW] Player Stats & Martial Arts
${PromptManager.getActiveCharacterProps(effectiveGameState)}
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
            effectiveGameState,
            language,
            modelName // [NEW] Pass model name
        );
        const t5 = Date.now();

        // [Scrubbing] Remove any hallucinated or cached tags from Story Model output
        // We want Pure Text for Post-Logic analysis.
        // Remove both [Tag ...] and <Tag ...> patterns just in case.
        let cleanStoryText = storyResult.text
            .replace(/\[Stat[^\]]*\]/gi, '')
            .replace(/<Stat[^>]*>/gi, '')
            .replace(/\[Rel[^\]]*\]/gi, '')
            .replace(/<Rel[^>]*>/gi, '')
            .replace(/\[Relationship[^\]]*\]/gi, '')
            .replace(/<Relationship[^>]*>/gi, '')
            .replace(/\[Tension[^\]]*\]/gi, '')
            .replace(/<Tension[^>]*>/gi, '')
            .replace(/<NewInjury[^>]*>/gi, '')
            .replace(/<Injury[^>]*>/gi, '');

        console.log(`[AgentOrchestrator] Scrubbed Text Length: ${storyResult.text.length} -> ${cleanStoryText.length}`);

        // [Step 5] Post-Logic: 상태 분석 (Fire-and-Forget / Async)
        // UI 반환을 위해 이를 엄격하게 기다리진 않지만, 일단 상태 무결성을 위해 await 합니다.
        // 실제 서버 액션에서는 일찍 리턴할 수도 있지만, Vercel 서버 액션은 떠있는 프로미스를 죽일 수 있습니다.
        // 따라서 await 합니다.
        // [Optimized] Extract Whitelist from GameState
        // Fix: Use 'characterData' keys as the source of truth for existing characters
        const validCharacters = Object.keys(gameState.characterData || {});
        const playerName = gameState.playerName || 'Player';

        // [Parallel Execution] Post-Logic & Turn Summary
        // [Parallel Execution] Post-Logic & Turn Summary
        // [Parallel Execution] Post-Logic & Turn Summary & Martial Arts
        const [postLogicOut, summaryResult, martialArtsOut] = await Promise.all([
            AgentPostLogic.analyze(
                userInput,
                cleanStoryText,
                gameState.currentMood || "daily",
                validCharacters,
                playerName,
                gameState.playerStats || {},
                gameState.playerStats?.relationships || {},
                gameState, // [NEW] Pass Full GameState
                language
            ),
            AgentSummary.summarize(apiKey, history, cleanStoryText),
            AgentMartialArts.analyze(
                userInput,
                cleanStoryText,
                gameState.playerStats?.realm || '삼류',
                gameState.playerStats || {},
                gameState.turnCount || 0
            )
        ]);

        const t6 = Date.now();

        // [Refactor] Inject Inline Event Tags into Story Text (Post-Processing)
        let finalStoryText = cleanStoryText; // Start with clean text
        if (postLogicOut.inline_triggers && postLogicOut.inline_triggers.length > 0) {
            console.log(`[AgentOrchestrator] Injecting ${postLogicOut.inline_triggers.length} inline tags...`);
            postLogicOut.inline_triggers.forEach(trigger => {
                // Find trigger.quote in finalStoryText and append trigger.tag
                // Use simple string replace (first occurrence)
                if (finalStoryText.includes(trigger.quote)) {
                    finalStoryText = finalStoryText.replace(trigger.quote, `${trigger.quote} ${trigger.tag}`);
                    console.log(`   -> Injected "${trigger.tag}" after "${trigger.quote.substring(0, 15)}..."`);
                } else {
                    console.warn(`   -> Warning: Could not find quote "${trigger.quote}" for tag "${trigger.tag}"`);
                }
            });
        }

        if (postLogicOut.relationship_updates) {
            Object.entries(postLogicOut.relationship_updates).forEach(([charId, val]) => {
                // Heuristic Check: Does the text contain a Rel tag with this CharID?
                const hasTag = new RegExp(`(char|id)=["']?${charId}["']?`, 'i').test(finalStoryText);

                if (!hasTag) {
                    console.log(`[AgentOrchestrator] Fallback: Appending missing relationship tag for ${charId} (${val})`);
                    finalStoryText += `\n<Rel char="${charId}" val="${val}">`;
                }
            });
        }

        // [Death Cleanup Protocol]
        // Ensure dead characters are removed from the active list.
        if (postLogicOut.activeCharacters) {
            const deadIds = new Set<string>();

            // 1. Check existing GameState for dead characters
            if (gameState.characterData) {
                for (const [id, char] of Object.entries(gameState.characterData)) {
                    if ((char as any).hp !== undefined && (char as any).hp <= 0) {
                        deadIds.add(id);
                    }
                }
            }

            // 2. Check Pre-Logic State Changes (Current Turn Deaths inside preLogicOut.state_changes.character_updates if existing)
            // For now, relies on GameState.

            if (deadIds.size > 0) {
                const originalCount = postLogicOut.activeCharacters.length;
                postLogicOut.activeCharacters = postLogicOut.activeCharacters.filter(id => !deadIds.has(id));
                if (postLogicOut.activeCharacters.length < originalCount) {
                    console.log(`[Orchestrator] Removed dead characters from active list: ${originalCount} -> ${postLogicOut.activeCharacters.length}`);
                }
            }
        }

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
            (storyResult.usageMetadata as any)?.cachedContentTokenCount || 0
        );
        const summaryCost = calculateCost(MODEL_CONFIG.SUMMARY || 'gemini-2.5-flash', summaryResult.usageMetadata?.promptTokenCount || 0, summaryResult.usageMetadata?.candidatesTokenCount || 0, summaryResult.usageMetadata?.cachedContentTokenCount || 0);
        const martialCost = calculateCost(MODEL_CONFIG.LOGIC, martialArtsOut.usageMetadata?.promptTokenCount || 0, martialArtsOut.usageMetadata?.candidatesTokenCount || 0, martialArtsOut.usageMetadata?.cachedContentTokenCount || 0);

        const totalCost = routerCost + preLogicCost + postLogicCost + storyCost + summaryCost + martialCost;

        return {
            reply: finalStoryText,
            raw_story: cleanStoryText,
            logic: preLogicOut,
            post_logic: postLogicOut,
            martial_arts: martialArtsOut, // [NEW]
            summary: summaryResult.summary, // [NEW] Turn Summary Text
            summaryDebug: { // [NEW] Summary Debug Info
                _debug_prompt: summaryResult._debug_prompt
            },
            martial_arts_debug: { // [NEW] Martial Arts Debug Info
                _debug_prompt: martialArtsOut._debug_prompt
            },
            router: routerOut,
            casting: allCastingCandidates, // [NEW] Returns ALL candidates for UI debugging
            usageMetadata: storyResult.usageMetadata,
            usedModel: (storyResult as any).usedModel,
            allUsage: {
                router: routerOut.usageMetadata,
                preLogic: preLogicOut.usageMetadata,
                postLogic: postLogicOut.usageMetadata,
                story: storyResult.usageMetadata,
                summary: summaryResult.usageMetadata, // [NEW]
                martialArts: martialArtsOut.usageMetadata // [NEW]
            },
            latencies: {
                router: (t2 - t1),
                retriever: (t3 - t2),
                preLogic: (t4 - t3),
                story: (t5 - t4),
                postLogic: (t6 - t5),
                total: totalTime
            },
            cost: totalCost,
            systemPrompt: (storyResult as any).systemPrompt,
            finalUserMessage: (storyResult as any).finalUserMessage
        };
    }
}
