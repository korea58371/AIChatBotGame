
// import { AgentRouter } from './router'; // [REMOVED]
import { AgentRetriever } from './retriever';
import { AgentPreLogic } from './pre-logic';
import { AgentPostLogic } from './post-logic';

import { AgentCasting } from './casting'; // [NEW]
import { AgentSkills } from './skills'; // [NEW] Renamed from martial-arts
import { AgentChoices } from './choices'; // [NEW] Parallel Choice Gen
import { generateResponse } from '../gemini'; // 기존 함수 재사용/리팩토링
import { Message } from '../store';
import { calculateCost, MODEL_CONFIG } from '../model-config';
import { PromptManager } from '../prompt-manager';
import { EventManager } from '../event-manager'; // [NEW]

export class AgentOrchestrator {

    /**
     * 5단계 에이전틱 워크플로우를 사용하여 전체 게임 턴을 실행합니다.
     */
    /**
     * [Phase 1] Router -> Casting -> PreLogic -> Story -> Clean Text
     * Returns the 'clean' story text immediately for UI display.
     */
    static async executeStoryPhase(
        apiKey: string,
        gameState: any,
        history: Message[],
        userInput: string,
        language: 'ko' | 'en' | null = 'ko',
        modelName: string = MODEL_CONFIG.STORY
    ) {
        console.log(`[Orchestrator] Phase 1: Story Generation Start...`);
        const startTime = Date.now();
        const t1 = Date.now();

        // 1. Context Preparation
        let lastContext = gameState.lastSystemMessage || "";
        if (!lastContext && history.length > 0) {
            const lastModelMsg = [...history].reverse().find(m => m.role === 'model');
            if (lastModelMsg) lastContext = lastModelMsg.text;
        }

        if (!lastContext) lastContext = "";

        lastContext = lastContext
            .replace(/<선택지[^>]*>.*?(\n|$)/g, '')
            .replace(/<배경:[^>]*>/g, '')
            .replace(/<BGM:[^>]*>/g, '')
            .trim();

        const activeCharacterNames: string[] = [];
        if (gameState.activeCharacters && gameState.characterData) {
            gameState.activeCharacters.forEach((id: string) => {
                const char = gameState.characterData[id];
                if (char && char.name) activeCharacterNames.push(char.name);
            });
        }

        const lastTurnSummary = gameState.lastTurnSummary || "";
        const playerLevel = gameState.playerStats?.level || 1;

        // 2. Parallel Router & Casting
        // 2. Casting Only (Router Merged)
        //    AgentRouter.analyze(history, lastContext, activeCharacterNames, lastTurnSummary),
        //    AgentCasting.analyze(gameState, lastTurnSummary, userInput, playerLevel)
        // ]);
        const castingResult = await AgentCasting.analyze(gameState, lastTurnSummary, userInput, playerLevel);
        const { active, background } = castingResult;

        const suggestions = [...active, ...background]; // [Fix] Return ALL 12 candidates to UI for debugging
        const t2 = Date.now();

        // 3. Retriever
        // 3. Retriever (Use userInput directly)
        // [Refactor] Pass both Active and Background lists to Retriever for distinct formatting
        let retrievedContext = await AgentRetriever.retrieveContext(userInput, gameState, active, background);

        // [Cleanup] 'Regional Key Figures' injection is now handled by Retriever as '[Background Knowledge]'

        const t3 = Date.now();

        // 4. Pre-Logic
        console.log(`[Orchestrator] PreLogic State Tension: ${gameState.tensionLevel}, PlayerStats Tension: ${gameState.playerStats?.tensionLevel}`);
        // 4. Pre-Logic (Handles classification now)
        console.log(`[Orchestrator] PreLogic State Tension: ${gameState.tensionLevel}, PlayerStats Tension: ${gameState.playerStats?.tensionLevel}`);
        const preLogicOut = await AgentPreLogic.analyze(history, retrievedContext, userInput, gameState, lastTurnSummary, [], language);

        // [ADAPTER] Create fake router output for UI compatibility
        const routerOut = {
            type: preLogicOut.intent || 'action',
            intent: preLogicOut.judgment_analysis || 'Analyzed by PreLogic',
            target: preLogicOut.target,
            keywords: [],
            analysis: preLogicOut.judgment_analysis,
            usageMetadata: preLogicOut.usageMetadata,
            _debug_prompt: "Merged into PreLogic"
        };
        const t4 = Date.now();

        // Mood Override
        let effectiveGameState = gameState;
        if (preLogicOut.mood_override) {
            effectiveGameState = { ...gameState, currentMood: preLogicOut.mood_override };
        }

        // 5. Story Generation
        const compositeInput = `
[Narrative Direction]
${preLogicOut.narrative_guide}
${preLogicOut.combat_analysis ? `[Combat Analysis]: ${preLogicOut.combat_analysis}` : ""}
${preLogicOut.emotional_context ? `[Emotional Context]: ${preLogicOut.emotional_context}` : ""}
${preLogicOut.character_suggestion ? `[Character Suggestion]: ${preLogicOut.character_suggestion}` : ""}
${preLogicOut.goal_guide ? `[Goal Guide]: ${preLogicOut.goal_guide}` : ""}
${preLogicOut.location_inference ? `[Location Guidance]: ${preLogicOut.location_inference}` : ""}
${gameState.activeEvent ? `\n[Active Event Context (Background)]\n[EVENT: ${gameState.activeEvent.id}]\n${gameState.activeEvent.prompt}\n(Use this as background context. Do not disrupt combat/high-tension flows unless necessary.)\n` : ""}

[Context data]
${PromptManager.getPlayerContext(effectiveGameState, language)}
${PromptManager.getActiveCharacterProps(effectiveGameState, undefined, language)}
${retrievedContext}

[Player Action]
${userInput}

나레이션 가이드와 기존 설정 및 규칙을 참고하여 6000자 분량의 내용을 작성하세요.
`;

        // [Critical] Scrub <선택지> tags from History to prevent the model from learning to generate them again.
        // We only want the Choice Agent to see/generate choices.
        const cleanHistory = history.map(msg => {
            if (msg.role === 'model') {
                return {
                    ...msg,
                    text: msg.text.replace(/<선택지[^>]*>.*?(\n|$)/g, '').trim()
                };
            }
            return msg;
        });

        const storyResult = await generateResponse(
            apiKey,
            cleanHistory, // [Fix] Use Cleaned History
            compositeInput,
            effectiveGameState,
            language,
            modelName
        );
        const t5 = Date.now();

        // Scrubbing
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
            .replace(/<Injury[^>]*>/gi, '')
            .replace(/<Dead[^>]*>/gi, '')
            .replace(/\[Dead[^\]]*\]/gi, '')
            .replace(/<Location[^>]*>/gi, '')
            .replace(/<Faction[^>]*>/gi, '')
            .replace(/<Rank[^>]*>/gi, '')
            .replace(/<PlayerRank[^>]*>/gi, '')
            .replace(/\[PlayerRank[^\]]*\]/gi, '')
            .replace(/<EventProgress[^>]*>/gi, '')
            .replace(/\[EventProgress[^\]]*\]/gi, '')
            .replace(/<ResolvedInjury[^>]*>/gi, '')
            .replace(/\[ResolvedInjury[^\]]*\]/gi, '');

        // [Guard] Empty Story Validation
        if (!cleanStoryText || !cleanStoryText.trim()) {
            console.error(`[Orchestrator] Critical: Story Generation returned empty text (or only filtered tags). Raw Length: ${storyResult.text?.length || 0}`);
            // If the model returned *something* but we filtered it all out (e.g. just tags), that's also a failure.
            throw new Error("Story Generation Failed: Model returned empty or filtered-out content.");
        }

        // Calculations
        const routerCost = 0; // [MERGED] Input merged into PreLogic, no separate Router cost
        const preLogicCost = calculateCost(MODEL_CONFIG.PRE_LOGIC, preLogicOut.usageMetadata?.promptTokenCount || 0, preLogicOut.usageMetadata?.candidatesTokenCount || 0, preLogicOut.usageMetadata?.cachedContentTokenCount || 0);
        const storyCost = calculateCost(
            (storyResult as any).usedModel || MODEL_CONFIG.STORY,
            storyResult.usageMetadata?.promptTokenCount || 0,
            storyResult.usageMetadata?.candidatesTokenCount || 0,
            (storyResult.usageMetadata as any)?.cachedContentTokenCount || 0
        );

        return {
            cleanStoryText,
            routerOut,
            preLogicOut,
            storyResult,
            suggestions,
            latencies: {
                router: 0,
                retriever: (t3 - t2),
                preLogic: (t4 - t3),
                story: (t5 - t4),
                total: (t5 - t1)
            },
            costs: {
                total: preLogicCost + storyCost // [FIXED] Removed routerCost
            },
            usage: {
                preLogic: this.normalizeUsage(preLogicOut.usageMetadata, preLogicCost),
                story: this.normalizeUsage(storyResult.usageMetadata, storyCost)
            },
            usedModel: (storyResult as any).usedModel,
            effectiveGameState,
            retrievedContext, // Optional debug
            systemPrompt: (storyResult as any).systemPrompt, // [Fix] Expose Static Prompt
            finalUserMessage: (storyResult as any).finalUserMessage // [Fix] Expose Dynamic Prompt
        };
    }

    // Helper for timing
    static async measure<T>(promise: Promise<T>): Promise<{ result: T, duration: number }> {
        const start = Date.now();
        const result = await promise;
        return { result, duration: Date.now() - start };
    }

    /**
     * [Phase 2] Post-Logic -> Summary -> Martial Arts -> Injection
     * Can be run in background.
     */
    static async executeLogicPhase(
        apiKey: string,
        gameState: any,
        history: Message[],
        userInput: string,
        cleanStoryText: string,
        language: 'ko' | 'en' | null = 'ko'
    ) {
        console.log(`[Orchestrator] Phase 2: Logic Execution Start... ActiveGameId: ${gameState.activeGameId}`);
        const startTime = Date.now();

        const validCharacters = Object.keys(gameState.characterData || {});
        const playerName = gameState.playerName || 'Player';

        // Parallel Execution
        const [postLogicRes, martialArtsRes, choicesRes, eventRes] = await Promise.all([
            this.measure(AgentPostLogic.analyze(
                userInput,
                cleanStoryText,
                gameState.currentMood || "daily",
                validCharacters,
                playerName,
                gameState.playerStats || {},
                gameState.playerStats?.relationships || {},
                gameState,
                language
            )),
            this.measure(AgentSkills.analyze(
                userInput,
                cleanStoryText,
                gameState.playerStats?.level || 1, // Pass Level (Number)
                gameState, // Pass Full State for activeGameId check
                gameState.turnCount || 0
            )),
            this.measure(AgentChoices.generate(
                userInput,
                cleanStoryText,
                gameState,
                language
            )),
            // [NEW] Parallel Event System (Deterministic)
            this.measure((async () => {
                const gameId = gameState.activeGameId;
                console.log(`[Orchestrator] Event System Start. GameID: ${gameId}`);

                // Determine events
                const events = gameState.events || [];

                // [Fix] Check for Active Event First
                if (gameState.activeEvent) {
                    console.log(`[Orchestrator] Active Event Exists (${gameState.activeEvent.id}). Skipping Scan.`);
                    return {
                        triggerEventId: null,
                        currentEvent: gameState.activeEvent.prompt, // Keep enforcing current event prompt
                        type: 'ACTIVE_MAINTAINED',
                        candidates: null,
                        debug: {
                            serverGameId: gameId,
                            status: 'ACTIVE_SKIPPED',
                            loadedEventsCount: events.length
                        }
                    };
                }

                // If ID is Wuxia, we use EventManager
                if (gameId === 'wuxia') {
                    // Rehydration Attempt if needed (Server-side safety)
                    let loadedEvents = events;
                    if (!events || events.length === 0) {
                        try {
                            console.log(`[Orchestrator] Rehydrating events for ${gameId}...`);
                            const eventsModule = await import(`@/data/games/${gameId}/events`);
                            if (eventsModule && eventsModule.GAME_EVENTS) {
                                loadedEvents = eventsModule.GAME_EVENTS;
                            }
                        } catch (e) { console.warn("[Orchestrator] Event Rehydration Failed", e); }
                    }
                    console.log(`[Orchestrator] Events Loaded: ${loadedEvents?.length || 0}`);

                    const { mandatory, randomCandidates } = EventManager.scan(loadedEvents, gameState);
                    console.log(`[Orchestrator] Scan Result - Mandatory: ${mandatory.length}, Random: ${randomCandidates.length}`);
                    console.log(`[Orchestrator] Client Triggered Events: ${gameState.triggeredEvents?.length || 0} (${JSON.stringify(gameState.triggeredEvents?.slice(-5) || [])})`);

                    const resultOut = {
                        triggerEventId: null as string | null,
                        currentEvent: null as string | null,
                        type: null as string | null,
                        candidates: {
                            mandatory: mandatory.map(m => m.id),
                            random: randomCandidates.map(r => r.id)
                        },
                        debug: {
                            serverGameId: gameId,
                            status: 'SCANNED',
                            loadedEventsCount: loadedEvents?.length || 0
                        }
                    };

                    // Logic: Mandatory > Random Pick (2) > None
                    if (mandatory.length > 0) {
                        resultOut.triggerEventId = mandatory[0].id;
                        resultOut.currentEvent = mandatory[0].prompt;
                        resultOut.type = 'MANDATORY';
                        return resultOut;
                    }

                    if (randomCandidates.length > 0) {
                        // Weighted Random
                        const picked = EventManager.pickRandom(randomCandidates, 1);
                        if (picked.length > 0) {
                            // "Next Turn" trigger
                            resultOut.triggerEventId = picked[0].id;
                            resultOut.currentEvent = picked[0].prompt;
                            resultOut.type = 'RANDOM';
                            return resultOut;
                        }
                    }
                    return resultOut;
                }
                return null;
            })())
        ]);

        const postLogicOut = postLogicRes.result;
        const martialArtsOut = martialArtsRes.result;
        const choicesOut = choicesRes.result;
        const eventOut = eventRes.result || { debug: { status: 'UNKNOWN_ERROR', serverGameId: 'UNKNOWN' } };

        const t6 = Date.now();

        // Inject Inline Event Tags
        let finalStoryText = cleanStoryText;
        if (postLogicOut.inline_triggers && postLogicOut.inline_triggers.length > 0) {

            postLogicOut.inline_triggers.forEach(trigger => {
                const quote = trigger.quote.trim();
                const tag = trigger.tag;

                if (!quote) return;

                // 1. Precise Match
                if (finalStoryText.includes(quote)) {
                    if (tag.startsWith('<BGM')) {
                        finalStoryText = finalStoryText.replace(quote, `\n${tag}\n${quote}`);
                    } else {
                        finalStoryText = finalStoryText.replace(quote, `${quote} ${tag}`);
                    }
                    return;
                }

                // 2. Normalized Match (Ignore Whitespace differences)
                // Collapse all whitespace to single space for comparison
                const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
                const normText = normalize(finalStoryText);
                const normQuote = normalize(quote);

                if (normText.includes(normQuote)) {
                    // It exists, but spacing is different. We need to find *where* in original string.
                    // Heuristic: Find a unique enough substring (e.g. first 20 chars) and hope it's unique.
                    const seed = quote.substring(0, Math.min(quote.length, 20));
                    const seedIndex = finalStoryText.indexOf(seed);

                    if (seedIndex !== -1) {
                        // Fallback: Just inject after the seed + loose length estimate? 
                        // Risk: Injecting in middle of sentence if quote was partial.
                        // Safer: Inject after the seed + quote length (clamped).
                        const safeEnd = Math.min(finalStoryText.length, seedIndex + quote.length + 5);
                        const targetPart = finalStoryText.substring(seedIndex, safeEnd);
                        // Just append to the seed for now to be safe.
                        finalStoryText = finalStoryText.replace(seed, `${seed} ${tag}`); // A bit awkward but works
                        console.log(`[Orchestrator] Normalized match used for tag: ${tag}`);
                        return;
                    }
                }

                // 3. Partial Match (Head/Tail) for Long Quotes
                if (quote.length > 30) {
                    const head = quote.substring(0, 15);
                    const tail = quote.substring(quote.length - 15);

                    if (finalStoryText.includes(tail)) {
                        finalStoryText = finalStoryText.replace(tail, `${tail} ${tag}`);
                        console.log(`[Orchestrator] Tail match used for tag: ${tag}`);
                        return;
                    }
                    if (finalStoryText.includes(head)) {
                        finalStoryText = finalStoryText.replace(head, `${head} ${tag}`);
                        console.log(`[Orchestrator] Head match used for tag: ${tag}`);
                        return;
                    }
                }

                // 4. Fallback: Append to end (Better than losing the stat change)
                console.warn(`[Orchestrator] Quote failed to match. Appending tag to end. Quote: "${quote.substring(0, 20)}..."`);
                finalStoryText += `\n${tag}`;
            });
        }


        if (postLogicOut.relationship_updates) {
            Object.entries(postLogicOut.relationship_updates).forEach(([charId, val]) => {
                const hasTag = new RegExp(`(char|id)=["']?${charId}["']?`, 'i').test(finalStoryText);
                if (!hasTag) {
                    finalStoryText += `\n<Rel char="${charId}" val="${val}">`;
                }
            });
        }


        // [Phase 2-B] Append Choices (Parallel Generated)
        if (choicesOut.text) {
            finalStoryText += `\n\n${choicesOut.text}`;
        }

        // Death Cleanup
        if (postLogicOut.activeCharacters) {
            const deadIds = new Set<string>();
            if (gameState.characterData) {
                for (const [id, char] of Object.entries(gameState.characterData)) {
                    if ((char as any).hp !== undefined && (char as any).hp <= 0) deadIds.add(id);
                }
            }
            if (deadIds.size > 0) {
                postLogicOut.activeCharacters = postLogicOut.activeCharacters.filter(id => !deadIds.has(id));
            }
        }

        const postLogicCost = calculateCost(MODEL_CONFIG.LOGIC, postLogicOut.usageMetadata?.promptTokenCount || 0, postLogicOut.usageMetadata?.candidatesTokenCount || 0, postLogicOut.usageMetadata?.cachedContentTokenCount || 0);


        const martialCost = calculateCost(MODEL_CONFIG.LOGIC, martialArtsOut.usageMetadata?.promptTokenCount || 0, martialArtsOut.usageMetadata?.candidatesTokenCount || 0, martialArtsOut.usageMetadata?.cachedContentTokenCount || 0);
        const choiceCost = calculateCost(MODEL_CONFIG.CHOICES || 'gemini-2.5-flash-lite', choicesOut.usageMetadata?.promptTokenCount || 0, choicesOut.usageMetadata?.candidatesTokenCount || 0, choicesOut.usageMetadata?.cachedContentTokenCount || 0);

        return {
            finalStoryText,
            postLogicOut,
            martialArtsOut,
            choicesOut, // [NEW] Return for Debugging
            eventOut, // [NEW] Return for Orchestrator Wrapper
            latencies: {
                postLogic: postLogicRes.duration,
                martial_arts: martialArtsRes.duration,
                choices: choicesRes.duration,
                total: (t6 - startTime)
            },
            costs: {
                total: postLogicCost + martialCost + choiceCost
            },
            usage: {
                postLogic: this.normalizeUsage(postLogicOut.usageMetadata, postLogicCost),
                martialArts: this.normalizeUsage(martialArtsOut.usageMetadata, martialCost),
                choices: this.normalizeUsage(choicesOut.usageMetadata, choiceCost)
            }
        };


    }

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
        console.log(`[AgentOrchestrator] Legacy Wrapper: Executing full turn...`);
        const startTime = Date.now();

        // Phase 1
        const p1 = await this.executeStoryPhase(apiKey, gameState, history, userInput, language, modelName);

        // Phase 2
        const p2 = await this.executeLogicPhase(apiKey, p1.effectiveGameState, history, userInput, p1.cleanStoryText, language);

        const totalCost = p1.costs.total + p2.costs.total;

        // Construct Legacy Return Object
        return {
            reply: p2.finalStoryText,
            raw_story: p1.cleanStoryText,
            logic: {
                ...p1.preLogicOut,
                // [NEW] Map Phase 2 Parallel Event to Legacy Logic Key
                triggerEventId: (p2 as any).eventOut?.triggerEventId,
                currentEvent: (p2 as any).eventOut?.currentEvent,
                candidates: (p2 as any).eventOut?.candidates // [NEW] Pass candidates for debugging
            },
            post_logic: p2.postLogicOut,
            martial_arts: p2.martialArtsOut, // [NEW]

            martial_arts_debug: { // [NEW] Martial Arts Debug Info
                _debug_prompt: p2.martialArtsOut._debug_prompt
            },
            choices_debug: { // [NEW] Choices Debug Info
                _debug_prompt: p2.choicesOut._debug_prompt,
                output: p2.choicesOut.text
            },
            event_debug: { // [NEW] Event Debug Info
                output: (p2 as any).eventOut
            },
            router: p1.routerOut,
            casting: p1.suggestions, // [NEW] Returns ALL candidates for UI debugging
            usageMetadata: p1.storyResult.usageMetadata,
            usedModel: p1.usedModel,
            allUsage: {
                preLogic: p1.usage.preLogic,
                postLogic: p2.usage.postLogic,
                story: p1.usage.story,

                martialArts: p2.usage.martialArts, // [NEW]
                choices: p2.usage.choices // [NEW]
            },
            latencies: {
                ...p1.latencies,
                postLogic: p2.latencies.postLogic,
                total: Date.now() - startTime
            },
            cost: totalCost,
            systemPrompt: (p1.storyResult as any).systemPrompt,
            finalUserMessage: (p1.storyResult as any).finalUserMessage
        };
    }

    // [Helper] Normalize Usage Metadata for UI (Gemini -> OpenAI/Generic format)
    static normalizeUsage(usage: any, cost: number) {
        if (!usage) return {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cost: cost || 0
        };
        return {
            promptTokens: usage.promptTokenCount || 0,
            completionTokens: usage.candidatesTokenCount || 0,
            cachedTokens: usage.cachedContentTokenCount || 0,
            totalTokens: usage.totalTokenCount || (usage.promptTokenCount + usage.candidatesTokenCount) || 0,
            cost: cost || 0
        };
    }
}
