
// import { AgentRouter } from './router'; // [REMOVED]
import { AgentRetriever } from './retriever';
import { AgentPreLogic } from './pre-logic';
import { AgentPostLogic } from './post-logic';

import { AgentCasting } from './casting'; // [NEW]
import { AgentSkills } from './skills'; // [NEW] Renamed from martial-arts
import { AgentChoices } from './choices'; // [NEW] Parallel Choice Gen
import { generateResponse, generateResponseStream } from '../ai/gemini'; // Moved to ai/gemini
import { Message } from '../store';
import { calculateCost, MODEL_CONFIG } from '../ai/model-config'; // Moved to ai/model-config
import { PromptManager } from '../engine/prompt-manager'; // Moved to engine/prompt-manager
import { EventManager } from '../engine/event-manager'; // Moved to engine/event-manager
import { AgentScenario } from './scenario-agent'; // [NEW]


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
        console.time("Phase 1 - Casting");
        const castingResult = await AgentCasting.analyze(apiKey, gameState, lastTurnSummary, userInput, playerLevel);
        console.timeEnd("Phase 1 - Casting");
        const { active, background } = castingResult;

        const suggestions = [...active, ...background]; // [Fix] Return ALL 12 candidates to UI for debugging
        const t2 = Date.now();

        // 3. Retriever
        // 3. Retriever (Use userInput directly)
        console.time("Phase 1 - Retriever");
        let retrievedContext = await AgentRetriever.retrieveContext(userInput, gameState, active, background);
        console.timeEnd("Phase 1 - Retriever");

        // [Cleanup] 'Regional Key Figures' injection is now handled by Retriever as '[Background Knowledge]'

        const t3 = Date.now();

        // 4. Pre-Logic
        console.time("Phase 1 - PreLogic");
        console.log(`[Orchestrator] PreLogic State Tension: ${gameState.tensionLevel}, PlayerStats Tension: ${gameState.playerStats?.tensionLevel}`);
        const preLogicOut = await AgentPreLogic.analyze(history, retrievedContext, userInput, gameState, lastTurnSummary, [], language);
        console.timeEnd("Phase 1 - PreLogic");

        // [ADAPTER] Create fake router output for UI compatibility
        const routerOut = {
            type: 'action',
            intent: preLogicOut.judgment_analysis || 'Analyzed by PreLogic',
            target: null,
            keywords: [],
            analysis: preLogicOut.judgment_analysis,
            usageMetadata: preLogicOut.usageMetadata,
            _debug_prompt: "Merged into PreLogic"
        };
        const t4 = Date.now();

        // Mood Override & New Character Injection
        let effectiveGameState = { ...gameState };

        if (preLogicOut.mood_override) {
            effectiveGameState.currentMood = preLogicOut.mood_override;
        }

        // [New] PreLogic Auto-Injection of Characters (Sanitized by Casting)
        if (preLogicOut.new_characters && preLogicOut.new_characters.length > 0) {
            const currentActive = new Set<string>(effectiveGameState.activeCharacters || []);
            const charData = effectiveGameState.characterData || {};

            // [Security] Create Set of Valid Cast IDs + Already Active IDs
            // We do NOT allow PreLogic to summon characters that AgentCasting rejected (Score 0),
            // unless they are already active in the scene.
            const validCastIds = new Set([
                ...suggestions.map(c => c.id),
                ...currentActive
            ]);

            preLogicOut.new_characters.forEach((name: string) => {
                // Find ID by Name (Exact match first, then partial)
                let foundId = Object.keys(charData).find(id => charData[id].name === name);

                // If not found, try partial match if name is long enough
                if (!foundId && name.length > 2) {
                    foundId = Object.keys(charData).find(id => charData[id].name && charData[id].name.includes(name));
                }

                if (foundId) {
                    // [Fix] Enforce Casting Constraint
                    if (validCastIds.has(foundId)) {
                        if (!currentActive.has(foundId)) {
                            currentActive.add(foundId);
                            console.log(`[Orchestrator] PreLogic Auto-Inject Active Character: ${name} -> ${foundId}`);
                        }
                    } else {
                        console.warn(`[Orchestrator] Blocked Hallucinated Character Injection: ${name} (${foundId}) - Not in Casting List`);
                    }
                } else {
                    console.warn(`[Orchestrator] PreLogic Suggested Character '${name}' not found in database.`);
                }
            });

            effectiveGameState.activeCharacters = Array.from(currentActive);
        }

        // [New] Sanitize Character Suggestion Text
        if (preLogicOut.character_suggestion) {
            const validNames = new Set([
                ...suggestions.map(c => c.name),
                ...(effectiveGameState.activeCharacters || []).map((id: string) => effectiveGameState.characterData?.[id]?.name).filter(Boolean)
            ]);

            // Split by comma, filter, rejoin
            const parts = preLogicOut.character_suggestion.split(/[,/]/).map(s => s.trim());
            const filteredParts = parts.filter(s => {
                // Check exact or partial match against valid names
                return Array.from(validNames).some(validName => validName && (validName === s || validName.includes(s) || s.includes(validName)));
            });

            if (filteredParts.length < parts.length) {
                console.log(`[Orchestrator] Sanitized Character Suggestion: "${preLogicOut.character_suggestion}" -> "${filteredParts.join(', ')}"`);
                preLogicOut.character_suggestion = filteredParts.join(', ');
            }
        }

        // 5. [NEW] AI Scenario Director
        try {
            // A. Update Existing Scenario
            if (effectiveGameState.scenario && effectiveGameState.scenario.active) {
                console.log(`[Orchestrator] Updating Scenario: ${effectiveGameState.scenario.title}`);
                const updateResult = await AgentScenario.update(
                    apiKey,
                    effectiveGameState.scenario,
                    userInput,
                    lastTurnSummary
                );

                if (updateResult.status === 'COMPLETED' || updateResult.status === 'FAILED' || updateResult.status === 'IGNORED') {
                    console.log(`[Orchestrator] Scenario Ended: ${updateResult.status}`);
                    effectiveGameState.scenario = null; // Clear
                    // Optional: Add log entry about completion
                } else {
                    // Update State
                    effectiveGameState.scenario.stage = updateResult.stage;
                    effectiveGameState.scenario.variables = updateResult.variables;
                    effectiveGameState.scenario.currentNote = updateResult.directorsNote;
                }
            }
            // B. Generate New Scenario (If Idle)
            else {
                // Trigger Condition: Calm/Daily mood + Random Chance (e.g. 20%)
                const isIdle = !effectiveGameState.activeEvent && (effectiveGameState.currentMood === 'daily' || effectiveGameState.currentMood === 'calm');
                const randomTrigger = Math.random() < 0.2; // 20% chance

                if (isIdle && randomTrigger) {
                    console.log(`[Orchestrator] Attempting to generate new scenario...`);
                    const newScenario = await AgentScenario.generate(
                        apiKey,
                        effectiveGameState,
                        {
                            location: effectiveGameState.currentLocation,
                            activeCharacters: activeCharacterNames,
                            playerStats: effectiveGameState.playerStats
                        }
                    );

                    if (newScenario) {
                        console.log(`[Orchestrator] New Scenario Started: ${newScenario.title}`);
                        effectiveGameState.scenario = newScenario;
                        // Inject initial note if available (or wait for next turn update)
                    }
                }
            }
        } catch (e) {
            console.error(`[Orchestrator] Scenario Error:`, e);
        }

        // 6. Story Generation

        // [Think Process Strategy]
        // Flash models need "Instruction (Do this)" / Pro models need "Review (Check this)"
        const isFlashModel = modelName.toLowerCase().includes('flash');
        const thinkingInstruction = isFlashModel
            ? `[Thinking Process Required (Creative Planning)]
답변을 생성하기 전에, <Thinking> 태그 안에 다음 내용을 먼저 정리하세요:
1. [Situation Summary]: 현재 플레이어의 의도와 상황을 1문장으로 요약하시오.
2. [Character Reaction]: 위 상황(1번)에 대해, 등장인물들이 보일 **가장 자연스럽고 개연성 있는 반응**을 스스로 판단하여 결정하시오. (특정 분위기를 강제하지 말 것)
3. [Tone Planning]: 캐릭터 설정(말투, 어미)을 참고하여, 이번 턴에 사용할 **핵심 대사 키워드**를 미리 2개씩 선정하시오.
4. [Narrative Focus]: 현재 분위기(Mood)가 평화롭다면, 감정선과 분위기 묘사에 집중하시오. 유저가 원하지 않는 한 억지 갈등(Conflict)이나 반전(Twist)을 생성하지 마시오.`
            : `[Thinking Process Required]
답변을 생성하기 전에, <Thinking> 태그 안에 다음 내용을 먼저 정리하세요:
1. 현재 상황(Context)과 모순되는 점이 없는가?
2. 등장인물의 말투(Speech Pattern)는 설정과 일치하는가?
3. 이번 턴의 주요 사건(Key Events)은 무엇인가?
4. 캐릭터들의 기억 정보와 현재 네러티브의 개연성/핍진성이 유지되는가?
5. **[Time Skip Check]**: 이번 행동이 장기간(6시간 이상) 걸리는 일이라면, <시간경과> 태그 사용을 고려했는가?`;

        const compositeInput = `
[Context data]
${PromptManager.getPlayerContext(effectiveGameState, language)}
${PromptManager.getActiveCharacterProps(effectiveGameState, undefined, language)}
${retrievedContext}

[Player Action]
${userInput}

나레이션 가이드와 기존 설정 및 규칙을 참고하여 8000자 분량의 내용을 작성하세요.

[Special Output Rule: Time Skip]
- If the narrative involves a significant passage of time (Travel, Sleep, Training > 6 hours), you MUST use the <시간경과> tag.
- Usage: <시간경과>Text to Display (Newline)
- Example: <시간경과>3일 후, 낙양에 도착했다.
- **[Time Update]**: Immediately after this tag, you MUST output a new <시간> tag adding the elapsed time.
- This triggers a cinematic fade-out effect. Use it to skip boring repetitions.

[Narrative Direction]
${preLogicOut.narrative_guide}

[Casting & Narrative Guidelines]
1. **Selection Authority**: You have the final authority to ignore characters if they don't fit the current mood, even if they are in the [Context].
2. **Narrative Priority**: Prioritize characters who fit the **Current Mood**. If 'Calm', prioritize bonding/dialogue. If 'Tense', prioritize conflict/action. Do not force every active character to speak if it dilutes the scene.
3. **Logic Check**: If a character's presence feels unnatural despite being cast, you may describe them as "silent in the background" or momentarily absent.
4. **Casting Discipline**: If the Current Mood is 'Calm' or 'Daily', avoid introducing more than 1 new character every 5-10 turns.
   - **Focus**: Depth over Width.
   - **Interaction Style**: If NPCs are present, prioritize **Lighthearted Banter (Manzai)** or **Comedic Misunderstandings** over serious plot progression. Making the user laugh is better than making them stressed.
4. **Web Novel Consistency**: Current Turn is ${effectiveGameState.turnCount || 0} (Approx Chapter ${Math.ceil(((effectiveGameState.turnCount || 0) + 1) / 20)}).
   - **MANDATE**: 사건의 규모를 키우지 말고, 현재의 템포를 유지하세요. (Maintain tempo, do not escalate scale).
   - If Chapter 1-2: DO NOT rush the plot. Keep the scale small (Local/Village level). No major secrets.
   - If Chapter 3+: You may introduce larger hooks.

${preLogicOut.combat_analysis ? `[Combat Analysis]: ${preLogicOut.combat_analysis}` : ""}
${preLogicOut.emotional_context ? `[Emotional Context]: ${preLogicOut.emotional_context}` : ""}
${preLogicOut.character_suggestion ? `[Character Suggestion]: ${preLogicOut.character_suggestion}` : ""}
${preLogicOut.goal_guide ? `[Goal Guide]: ${preLogicOut.goal_guide}` : ""}
${preLogicOut.location_inference ? `[Location Guidance]: ${preLogicOut.location_inference}` : ""}
${gameState.activeEvent ? `\n[Active Event Context (Background)]\n[EVENT: ${gameState.activeEvent.id}]\n${gameState.activeEvent.prompt}\n(Use this as background context. Do not disrupt combat/high-tension flows unless necessary.)\n` : ""}


${thinkingInstruction}

그 후, <Output> 태그 안에 본문을 작성하세요.
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
        // [Thinking/Output Parsing]
        let rawText = storyResult.text || "";

        // 1. Extract <Output> content if present
        // [Fix] text Reversion Bug: Always pick the LAST <Output> block.
        // History hallucination can cause the model to repeat previous <Output> blocks before the new one.
        const outputMatches = [...rawText.matchAll(/<Output>([\s\S]*?)<\/Output>/gi)];
        if (outputMatches.length > 0) {
            const lastMatch = outputMatches[outputMatches.length - 1];
            rawText = lastMatch[1];
        } else {
            // Fallback: Remove <Thinking> tags if Output tag is missing
            rawText = rawText.replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, '').trim();
        }

        // [New] Extract Thinking Process for UI Log
        let thinkingContent = null;
        const thinkingMatch = (storyResult.text || "").match(/<Thinking>([\s\S]*?)<\/Thinking>/i);
        if (thinkingMatch) {
            thinkingContent = thinkingMatch[1].trim();
        }

        let cleanStoryText = rawText
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
            .replace(/\[ResolvedInjury[^\]]*\]/gi, '')
            .replace(/<나레이션[^>]*>/gi, '')
            .replace(/<\/나레이션>/gi, '')
            .replace(/\[나레이션[^\]]*\]/gi, '')
            .replace(/<Skill[^>]*>/gi, '') // [NEW] Strip Skill XML tags
            .replace(/\[Skill[^\]]*\]/gi, ''); // [NEW] Strip Skill Bracket tags

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
            thinking: thinkingContent, // [New] Pass Thinking Process to UI
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

                // [Refactor] Enabled for ALL games (Removed 'wuxia' check)
                // if (gameId === 'wuxia') { <--- Previous Limitation
                {
                    // Rehydration Attempt if needed (Server-side safety)
                    let loadedEvents = events;
                    if (!events || events.length === 0) {
                        try {
                            console.log(`[Orchestrator] Rehydrating events for ${gameId}...`);
                            const eventsModule = await import(`@/data/games/${gameId}/events`);
                            if (eventsModule && eventsModule.GAME_EVENTS) {
                                loadedEvents = eventsModule.GAME_EVENTS;
                            }
                        } catch (e) {
                            // Squelch error for games that don't have events yet
                            // console.warn("[Orchestrator] Event Rehydration Failed", e); 
                        }
                    }
                    console.log(`[Orchestrator] Events Loaded for ${gameId}: ${loadedEvents?.length || 0}`);

                    if (loadedEvents && loadedEvents.length > 0) {
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
                }
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
            thinking: p1.thinking, // [New] Pass Thinking Content
            systemPrompt: (p1.storyResult as any).systemPrompt,
            finalUserMessage: (p1.storyResult as any).finalUserMessage
        };
    }

    // [STREAMING] Hybrid Pipeline: PreLogic (Hidden) -> Story (Stream) -> PostLogic (Hidden) -> Final Payload
    static async *executeTurnStream(
        apiKey: string,
        gameState: any,
        history: Message[],
        userInput: string,
        language: 'ko' | 'en' | null = 'ko',
        modelName: string = MODEL_CONFIG.STORY
    ): AsyncGenerator<any, void, unknown> {
        console.log(`[Orchestrator] Stream Turn Start...`);
        const startTime = Date.now();
        const t1 = Date.now();

        // --- PHASE 1: PREPARATION (Hidden) ---

        // 1. Context Preparation
        let lastContext = gameState.lastSystemMessage || "";
        if (!lastContext && history.length > 0) {
            const lastModelMsg = [...history].reverse().find(m => m.role === 'model');
            if (lastModelMsg) lastContext = lastModelMsg.text;
        }
        lastContext = lastContext.replace(/<선택지[^>]*>.*?(\n|$)/g, '').replace(/<배경:[^>]*>/g, '').replace(/<BGM:[^>]*>/g, '').trim();

        const activeCharacterNames: string[] = [];
        if (gameState.activeCharacters && gameState.characterData) {
            gameState.activeCharacters.forEach((id: string) => {
                const char = gameState.characterData[id];
                if (char && char.name) activeCharacterNames.push(char.name);
            });
        }
        const lastTurnSummary = gameState.lastTurnSummary || "";
        const playerLevel = gameState.playerStats?.level || 1;

        // 2. Casting
        const castingResult = await AgentCasting.analyze(apiKey, gameState, lastTurnSummary, userInput, playerLevel);
        const { active, background } = castingResult;
        const suggestions = [...active, ...background];

        // 3. Retriever
        let retrievedContext = await AgentRetriever.retrieveContext(userInput, gameState, active, background);
        const t3 = Date.now();

        // 4. Pre-Logic
        const preLogicOut = await AgentPreLogic.analyze(history, retrievedContext, userInput, gameState, lastTurnSummary, [], language);

        // Router Fake Output
        const routerOut = {
            type: 'action',
            intent: preLogicOut.judgment_analysis || 'Analyzed by PreLogic',
            target: null,
            keywords: [],
            analysis: preLogicOut.judgment_analysis,
            usageMetadata: preLogicOut.usageMetadata,
            _debug_prompt: "Merged into PreLogic"
        };
        const t4 = Date.now();

        // Pre-Logic State Update
        let effectiveGameState = { ...gameState };
        if (preLogicOut.mood_override) effectiveGameState.currentMood = preLogicOut.mood_override;
        if (preLogicOut.new_characters && preLogicOut.new_characters.length > 0) {
            const currentActive = new Set<string>(effectiveGameState.activeCharacters || []);
            const charData = effectiveGameState.characterData || {};
            preLogicOut.new_characters.forEach((name: string) => {
                const foundId = Object.keys(charData).find(id => {
                    const cName = charData[id].name;
                    return cName === name || (cName && name.length > 2 && cName.includes(name));
                });
                if (foundId) currentActive.add(foundId);
            });
            effectiveGameState.activeCharacters = Array.from(currentActive);
        }

        // --- PHASE 2: STORY STREAMING ---

        // --- PHASE 2: STORY STREAMING ---

        let contextPlayer = PromptManager.getPlayerContext(effectiveGameState, language);

        const contextCharacters = PromptManager.getActiveCharacterProps(effectiveGameState, undefined, language);
        const contextRetrieved = retrievedContext || "";

        const narrativeGuide = `[Narrative Direction]
${preLogicOut.narrative_guide}
${preLogicOut.combat_analysis ? `[Combat Analysis]: ${preLogicOut.combat_analysis}` : ""}
${preLogicOut.emotional_context ? `[Emotional Context]: ${preLogicOut.emotional_context}` : ""}
${preLogicOut.character_suggestion ? `[Character Suggestion]: ${preLogicOut.character_suggestion}` : ""}
${preLogicOut.goal_guide ? `[Goal Guide]: ${preLogicOut.goal_guide}` : ""}
${preLogicOut.location_inference ? `[Location Guidance]: ${preLogicOut.location_inference}` : ""}
${gameState.activeEvent ? `\n[Active Event Context (Background)]\n[EVENT: ${gameState.activeEvent.id}]\n${gameState.activeEvent.prompt}\n(Use this as background context. Do not disrupt combat/high-tension flows unless necessary.)\n` : ""}`;

        // [Stream] Conditional CoT Logic
        const isFlashModel = modelName.toLowerCase().includes('flash');
        const thinkingInstruction = isFlashModel
            ? `[Thinking Process Required (Creative Planning)]
답변을 생성하기 전에, <Thinking> 태그 안에 다음 내용을 먼저 정리하세요:
1. [Situation Summary]: 현재 플레이어의 의도와 상황을 1문장으로 요약하시오.
2. [Character Reaction]: 위 상황(1번)에 대해, 등장인물들이 보일 **가장 자연스럽고 개연성 있는 반응**을 스스로 판단하여 결정하시오. (특정 분위기를 강제하지 말 것)
3. [Tone Planning]: 캐릭터 설정(말투, 어미)을 참고하여, 이번 턴에 사용할 **핵심 대사 키워드**를 미리 2개씩 선정하시오.
4. [Narrative Focus]: 현재 분위기(Mood)가 평화롭다면, 감정선과 분위기 묘사에 집중하시오. 유저가 원하지 않는 한 억지 갈등(Conflict)이나 반전(Twist)을 생성하지 마시오.

**[중요] 답변은 반드시 <Thinking> 태그로 시작해야 합니다.**
그 후, <Output> 태그 안에 본문을 작성하세요.`
            : `[Thinking Process Required]
답변을 생성하기 전에, <Thinking> 태그 안에 다음 내용을 먼저 정리하세요:
1. 현재 상황(Context)과 모순되는 점이 없는가?
2. 등장인물의 말투(Speech Pattern)는 설정과 일치하는가?
3. 이번 턴의 주요 사건(Key Events)은 무엇인가?
4. 캐릭터들의 기억 정보와 현재 네러티브의 개연성/핍진성이 유지되는가?

그 후, <Output> 태그 안에 본문을 작성하세요.`;

        const compositeInput = `
${narrativeGuide}

[Context data]
${contextPlayer}
${contextCharacters}
${contextRetrieved}

[Player Action]
${userInput}

나레이션 가이드와 기존 설정 및 규칙을 참고하여 8000자 분량의 내용을 작성하세요.

${thinkingInstruction}
`;

        const cleanHistory = history.map(msg => msg.role === 'model' ? { ...msg, text: msg.text.replace(/<선택지[^>]*>.*?(\n|$)/g, '').trim() } : msg);

        console.time("Stream - Time To First Token");
        const streamGen = generateResponseStream(
            apiKey,
            cleanHistory,
            compositeInput,
            effectiveGameState,
            language,
            modelName
        );

        let fullRawText = "";
        let storyMetadata: any = null;

        let firstChunkReceived = false;
        // Yield chunks
        for await (const chunk of streamGen) {
            if (!firstChunkReceived) {
                console.timeEnd("Stream - Time To First Token");
                firstChunkReceived = true;
            }

            if (typeof chunk === 'string') {
                fullRawText += chunk;
                // [Fix] Real-time Scrubbing for Stream
                // We must strip tags from chunks to prevent leakage during typing.
                // Note: deeply split tags (e.g. <Sk|ill>) might still leak briefly, but this covers 99%.
                const cleanChunk = chunk
                    .replace(/<Skill[^>]*>/gi, '')
                    .replace(/\[Skill[^\]]*\]/gi, '')
                    .replace(/<Stat[^>]*>/gi, '') // Add other critical tags if needed
                    .replace(/\[Stat[^\]]*\]/gi, '')
                    .replace(/<Rel[^>]*>/gi, '')
                    .replace(/\[Rel[^\]]*\]/gi, '');

                yield { type: 'text', content: cleanChunk };
            } else {
                storyMetadata = chunk;
            }
        }

        const t5 = Date.now();

        // --- PHASE 3: POST-LOGIC & CLEANUP (Hidden) ---

        // Parsing & Scrubbing (Copied Logic)
        let cleanStoryText = fullRawText;

        // [Fix] Use LAST Output block for streaming text validation too
        const outputMatches = [...fullRawText.matchAll(/<Output>([\s\S]*?)<\/Output>/gi)];

        // [New] Extract Thinking Process for Debugging
        // Handle multiple/fragmented blocks (especially from streaming native thoughts)
        const thinkingMatches = [...fullRawText.matchAll(/<Thinking>([\s\S]*?)<\/Thinking>/gi)];
        let thinkingContent = "";

        if (thinkingMatches.length > 0) {
            thinkingContent = thinkingMatches.map(m => m[1]).join(' ').trim();
            console.log(`[Orchestrator] Extracted Thinking Content (${thinkingContent.length} chars)`);
        } else {
            // Fallback: If no tags, but we have text and use thinking model? 
            // Unlikely to recover native thoughts if tags missing.
            console.warn(`[Orchestrator] Failed to Extract Thinking. Raw Preview: ${fullRawText.substring(0, 200)}...`);
        }

        if (outputMatches.length > 0) {
            const lastMatch = outputMatches[outputMatches.length - 1];
            cleanStoryText = lastMatch[1];
        } else {
            cleanStoryText = cleanStoryText.replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, '').trim();
        }

        // Remove Tags for Logical Consistency in Logic Model
        cleanStoryText = cleanStoryText
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

        if (!cleanStoryText || !cleanStoryText.trim()) cleanStoryText = " ... "; // Fallback

        // Execute Phase 2
        const p1Costs = { total: calculateCost((storyMetadata as any)?.usedModel || MODEL_CONFIG.STORY, storyMetadata?.usageMetadata?.promptTokenCount || 0, storyMetadata?.usageMetadata?.candidatesTokenCount || 0, storyMetadata?.usageMetadata?.cachedContentTokenCount || 0) };
        const p1Usage = { preLogic: this.normalizeUsage(preLogicOut.usageMetadata, 0), story: this.normalizeUsage(storyMetadata?.usageMetadata, p1Costs.total) };

        const usedModel = (storyMetadata as any)?.usedModel || modelName;
        // Inject System/Final prompt for debug if available in storyMetadata (it is)
        const systemPrompt = (storyMetadata as any)?.systemPrompt;
        const finalUserMessage = (storyMetadata as any)?.finalUserMessage;

        // Perform Phase 2
        const p2 = await this.executeLogicPhase(apiKey, effectiveGameState, history, userInput, cleanStoryText, language);

        const totalCost = p1Costs.total + p2.costs.total;

        // Construct Final Legacy Data Object
        const finalPayload = {
            reply: p2.finalStoryText, // Has choices appended
            raw_story: cleanStoryText,
            thinking: thinkingContent, // [New] Pass Thinking to UI
            story_debug: { // [NEW] Detailed Prompt Breakdown
                components: {
                    narrative_guide: narrativeGuide,
                    context_player: contextPlayer,
                    context_characters: contextCharacters,
                    context_retrieved: contextRetrieved,
                    instruction_thinking: thinkingInstruction,
                    full_composite: compositeInput
                }
            },
            logic: {
                ...preLogicOut,
                triggerEventId: (p2 as any).eventOut?.triggerEventId,
                currentEvent: (p2 as any).eventOut?.currentEvent,
                candidates: (p2 as any).eventOut?.candidates
            },
            post_logic: p2.postLogicOut,
            martial_arts: p2.martialArtsOut,
            martial_arts_debug: { _debug_prompt: p2.martialArtsOut._debug_prompt },
            choices_debug: { _debug_prompt: p2.choicesOut._debug_prompt, output: p2.choicesOut.text },
            event_debug: { output: (p2 as any).eventOut },
            router: routerOut,
            casting: suggestions,
            usageMetadata: storyMetadata?.usageMetadata,
            usedModel: usedModel,
            allUsage: {
                preLogic: p1Usage.preLogic,
                postLogic: p2.usage.postLogic,
                story: p1Usage.story,
                martialArts: p2.usage.martialArts,
                choices: p2.usage.choices
            },
            latencies: {
                retriever: (t3 - t1), // approx
                preLogic: (t4 - t3),
                story: (t5 - t4),
                postLogic: p2.latencies.postLogic,
                total: Date.now() - startTime
            },
            cost: totalCost,
            costs: {
                total: totalCost,
                breakdown: {
                    preLogic: p1Costs,
                    postLogic: p2.costs
                }
            },
            // [Debug Prompts]
            story_static_prompt: systemPrompt,
            story_dynamic_prompt: finalUserMessage || compositeInput
        };

        // Yield Final Data
        yield { type: 'data', content: finalPayload };
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
