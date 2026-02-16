'use client';

// [Refactor] Extracted from VisualNovelUI.tsx  advanceScript function
// Processes the script queue: backgrounds, characters, choices, dialogues, commands.

import { useGameStore, Skill } from '@/lib/store';
import { getCharacterImage } from '@/lib/utils/image-mapper';
import { isHiddenProtagonist } from '@/lib/utils/character-utils';
import { resolveBackground } from '@/lib/engine/background-manager';
import { findBestMatch, findBestMatchDetail } from '@/lib/utils/name-utils';
import { normalizeCharacterId } from '@/lib/utils/character-id';
import React from 'react';

// Dependency injection interface
export interface AdvanceScriptDeps {
    // State setters
    setBackground: (bg: string) => void;
    setCharacterExpression: (expr: string) => void;
    setChoices: (choices: any[]) => void;
    setCurrentSegment: (seg: any) => void;
    setScriptQueue: (queue: any[]) => void;
    setShowTheEnd: (show: boolean) => void;
    setPendingLogic: (logic: any) => void;
    setLastTurnSummary: (summary: string) => void;
    setEventCG: (cg: string | null) => void;
    setExtraOverride: (charId: string, key: string) => void;
    // Refs
    activeSegmentIndexRef: React.MutableRefObject<number>;
    currentSegmentRef: React.MutableRefObject<any>;
    isEpilogueRef: React.MutableRefObject<boolean>;
    pendingEndingRef: React.MutableRefObject<string | null>;
    scriptQueueRef: React.MutableRefObject<any[]>;
    // Callbacks
    addToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
    applyGameLogic: (logicResult: any) => void;
    handleVisualDamage: (changeAmount: number, currentHp: number, maxHp: number) => void;
    playBgm: (bgm: string) => void;
    addTextMessage: (character: string, message: any) => void;
    processRealmProgression: (stats: any, toastCb: any) => any;
    // State values (read via refs/getState to avoid stale closures)
    isProcessing: boolean;
    pendingLogic: any;
    availableExtraImages: string[];
    playerName: string;
    t: any;
}

export function advanceScript(deps: AdvanceScriptDeps) {
    const {
        setBackground, setCharacterExpression, setChoices, setCurrentSegment,
        setScriptQueue, setShowTheEnd, setPendingLogic, setLastTurnSummary,
        setEventCG, setExtraOverride,
        activeSegmentIndexRef, currentSegmentRef, isEpilogueRef, pendingEndingRef, scriptQueueRef,
        addToast, applyGameLogic, handleVisualDamage, playBgm, addTextMessage, processRealmProgression,
        isProcessing, pendingLogic, availableExtraImages, playerName, t,
    } = deps;

    const _t0 = performance.now(); // [PERF]
    const _timings: Record<string, number> = {};
    // [Stream] Increment consumed count
    activeSegmentIndexRef.current += 1;

    // Handle Character Exit (Exit Tag Logic)
    if (currentSegmentRef.current?.characterLeave) {
        console.log("Character leaving based on <떠남> tag.");
        setCharacterExpression(''); // Clear character (use empty string as per type definition)
    }

    // Use a local copy of the queue to process immediately
    _timings['queue_copy_start'] = performance.now() - _t0;
    let currentQueue = [...scriptQueueRef.current];
    _timings['queue_copy_end'] = performance.now() - _t0;

    if (currentQueue.length === 0) {
        setCurrentSegment(null);

        // [Fix] Epilogue Completion
        // If we are in Epilogue Mode and the queue is empty, we are DONE.
        // Do NOT trigger pending logic (which might be a new turn loop).
        // [Fix] Add !isProcessing check to prevent premature trigger while generating epilogue
        if (isEpilogueRef.current) {
            console.log(`[Epilogue] Completion Check: isProcessing=${isProcessing}, Queue=${currentQueue.length}`);
            if (!isProcessing) {
                console.log("[Epilogue] Script finished. Triggering THE END.");
                setShowTheEnd(true);
                setPendingLogic(null); // Clear any pending logic
                return;
            } else {
                console.log("[Epilogue] Queue empty but Processing... Waiting.");
            }
        }

        // Check for pending logic
        if (pendingLogic) {
            applyGameLogic(pendingLogic);
            setPendingLogic(null);
        }
        return;
    }

    let nextSegment = currentQueue[0];

    // Process background, command, and BGM segments iteratively to avoid recursion
    while (nextSegment && (nextSegment.type === 'background' || nextSegment.type === 'command' || nextSegment.type === 'bgm' || nextSegment.type === 'event_cg')) {
        console.log(`[ScriptLoop] Processing Segment: Type=${nextSegment.type}, Content=${nextSegment.content}`);

        if (nextSegment.type === 'background') {
            // Resolve fuzzy tag to actual file path
            console.log(`[Background Debug] AI Tag: "${nextSegment.content}"`);
            const resolvedBg = resolveBackground(nextSegment.content);
            console.log(`[Background Debug] Resolved to: "${resolvedBg}"`);
            setBackground(resolvedBg);

            // [Fix] Sync Current Location with Narrative Tag
            console.log(`[Location] Updating Current Location: ${nextSegment.content}`);
            useGameStore.getState().setCurrentLocation(nextSegment.content);

            useGameStore.getState().setEventCG(null); // [Fix] Clear Event CG on background change
            setCharacterExpression(''); // Clear character on scene change

            // [Fix] Force React Render Cycle for Background
            // Sometimes state update doesn't reflect in time for the next frame if logic is heavy.
            // We rely on 'setBackground' (Zustand) which should trigger re-render.
            // But to be safe for "Streaming", we ensure this runs before next text segment.
            setTimeout(() => { }, 0);
        } else if (nextSegment.type === 'command') {
            // [New] Handle Commands
            if (nextSegment.commandType === 'set_time') {
                const rawContent = nextSegment.content;
                console.log(`[Command] Updating Time/Day: ${rawContent}`);

                // [Fix] Parse Day explicitly to update State
                // Format: "2일차 07:00 (아침)"
                const dayMatch = rawContent.match(/(\d+)(일차|Day)/i);
                if (dayMatch) {
                    const newDay = parseInt(dayMatch[1], 10);
                    if (!isNaN(newDay)) {
                        console.log(`[Command] Day Update: ${newDay}`);
                        useGameStore.getState().setDay(newDay);
                    }
                }

                // [Fix] Clean Time String (Remove Day part to avoid duplication in HUD)
                // "2일차 07:00 (아침)" -> "07:00 (아침)"
                const cleanTime = rawContent.replace(/(\d+)(일차|Day)\s*/gi, '').trim();
                if (cleanTime) {
                    useGameStore.getState().setTime(cleanTime);
                }
            } else if (nextSegment.commandType === 'update_stat') {
                try {
                    const changes = JSON.parse(nextSegment.content);
                    console.log(`[Command] Update Stat:`, changes);
                    const currentStats = useGameStore.getState().playerStats;
                    const newStats = { ...currentStats };

                    Object.keys(changes).forEach(originalKey => {
                        const key = originalKey.toLowerCase(); // [Fix] Normalize key to handle 'Morality' vs 'morality'

                        if (['hp', 'mp', 'gold', 'fame', 'morality'].includes(key)) return; // Handled above (assuming changes.hp check uses original key? No, changes.hp is case-sensitive!)

                        // Wait, if I access `changes.hp` explicitly above, and changes has "HP", `changes.hp` is undefined.
                        // I should probably iterate ALL keys and handle them dynamically to be safe, 
                        // OR map changes to a lower-cased object first.

                    });

                    // Better approach: Normalize entire changes object first
                    const normalizedChanges: Record<string, any> = {};
                    Object.keys(changes).forEach(k => normalizedChanges[k.toLowerCase()] = changes[k]);

                    // Now use normalizedChanges for everything
                    if (normalizedChanges.hp !== undefined) {
                        const val = Number(normalizedChanges.hp);
                        if (!isNaN(val)) {
                            newStats.hp = Math.min(Math.max(0, newStats.hp + val), newStats.maxHp);
                            addToast(`${t.hp} ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');

                            // [Fix] Trigger Visual Damage for Inline Tag
                            if (val < 0) {
                                handleVisualDamage(val, newStats.hp, newStats.maxHp);
                            }
                        }
                    }
                    if (normalizedChanges.mp !== undefined) {
                        const val = Number(normalizedChanges.mp);
                        if (!isNaN(val)) {
                            newStats.mp = Math.min(Math.max(0, newStats.mp + val), newStats.maxMp);
                            addToast(`${t.mp} ${val > 0 ? '+' : ''}${val}`, 'info');
                        }
                    }
                    if (normalizedChanges.gold !== undefined) {
                        const val = Number(normalizedChanges.gold);
                        if (!isNaN(val)) {
                            newStats.gold = Math.max(0, newStats.gold + val);
                            addToast(`${t.gold} ${val > 0 ? '+' : ''}${val}`, 'success');
                        }
                    }
                    if (normalizedChanges.fame !== undefined) {
                        const val = Number(normalizedChanges.fame);
                        if (!isNaN(val)) {
                            newStats.fame = Math.max(0, (newStats.fame || 0) + val);
                            addToast(`${t.fame} ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');
                        }
                    }

                    // [Fix] Explicit Neigong Handling (Years)
                    if (normalizedChanges.neigong !== undefined) {
                        const val = Number(normalizedChanges.neigong);
                        if (!isNaN(val)) {
                            const oldVal = newStats.neigong || 0;
                            newStats.neigong = Math.max(0, oldVal + val);

                            console.log(`[Stat] Neigong Update: ${oldVal} -> ${newStats.neigong} (Change: ${val})`);

                            // Distinct Toast for Years
                            if (val > 0) {
                                addToast(`내공(갑자) ${val}년 증가!`, 'success');
                            } else if (val < 0) {
                                addToast(`내공(갑자) ${Math.abs(val)}년 손실! (심각한 부상)`, 'error');
                            }
                        }
                    }

                    // Generic Fallback
                    Object.keys(normalizedChanges).forEach(key => {
                        if (['hp', 'mp', 'gold', 'fame', 'neigong'].includes(key)) return;

                        const val = Number(normalizedChanges[key]);
                        if (!isNaN(val)) {
                            if (typeof (newStats as any)[key] === 'number') {
                                (newStats as any)[key] = ((newStats as any)[key] as number) + val;
                                // @ts-ignore
                                const label = t[key] || key.toUpperCase();
                                addToast(`${label} ${val > 0 ? '+' : ''}${val}`, 'info');
                            }
                        }
                    });



                    // [New] Apply Realm/Level Logic
                    const progression = processRealmProgression(newStats, addToast);
                    if (progression.narrativeEvent) {
                        console.log("[Progression] Event Triggered:", progression.narrativeEvent);
                        // Append to LastTurnSummary for PreLogic to see next turn
                        const currentSummary = useGameStore.getState().lastTurnSummary || "";
                        setLastTurnSummary(currentSummary + "\n" + progression.narrativeEvent);
                    }

                    useGameStore.getState().setPlayerStats(progression.stats);


                } catch (e) {
                    console.error("Failed to parse update_stat command:", e);
                }
            } else if (nextSegment.commandType === 'update_relationship') {
                try {
                    const data = JSON.parse(nextSegment.content);
                    if (data.charId && data.value) {
                        // [Fix] Normalize ID
                        const canonicalId = normalizeCharacterId(data.charId, useGameStore.getState().language || 'ko');
                        const val = Number(data.value);
                        console.log(`[Command] Update Rel: ${canonicalId} (User: ${data.charId}) += ${val}`);

                        // [Fix] Update PlayerStats (Primary Data Source for UI)
                        const currentStats = useGameStore.getState().playerStats;
                        const currentRel = currentStats.relationships[canonicalId] || 0;
                        const newRel = currentRel + val;

                        useGameStore.getState().setPlayerStats({
                            relationships: {
                                ...currentStats.relationships,
                                [canonicalId]: newRel
                            }
                        });

                        // [Fix] Sync CharacterData (Secondary)
                        useGameStore.getState().updateCharacterRelationship(canonicalId, newRel);

                        // Try to resolve name for toast
                        const charData = useGameStore.getState().characterData[canonicalId];
                        const name = charData ? charData.name : canonicalId;
                        addToast(`${name} 호감도 ${val > 0 ? '+' : ''}${val}`, val > 0 ? 'success' : 'warning');
                    }
                } catch (e) {
                    console.error("Failed to parse update_relationship command:", e);
                }
            } else if (nextSegment.commandType === 'update_time') {
                // [New] Inline Time Update
                // [New] Inline Time Update
                const rawContent = nextSegment.content;
                console.log(`[Command] Inline Time Update: ${rawContent}`);

                // Parse Day (reused logic from set_time)
                const dayMatch = rawContent.match(/(\d+)(일차|Day)/i);
                if (dayMatch) {
                    const newDay = parseInt(dayMatch[1], 10);
                    if (!isNaN(newDay)) {
                        useGameStore.getState().setDay(newDay);
                    }
                }

                // Clean Time String
                const cleanTime = rawContent.replace(/(\d+)(일차|Day)\s*/gi, '').trim();
                if (cleanTime) {
                    useGameStore.getState().setTime(cleanTime);
                    addToast(`시간 업데이트: ${cleanTime}`, 'info');
                }

            } else if (nextSegment.commandType === 'add_injury') {
                // [New] Inline Injury
                try {
                    const data = JSON.parse(nextSegment.content);
                    if (data.name) {
                        console.log(`[Command] Inline Injury: ${data.name}`);
                        const state = useGameStore.getState();
                        const currentInjuries = state.playerStats.active_injuries || [];

                        if (!currentInjuries.includes(data.name)) {
                            state.setPlayerStats({
                                active_injuries: [...currentInjuries, data.name]
                            });
                            addToast(`부상 발생: ${data.name}`, 'warning');
                            handleVisualDamage(-10, state.playerStats.hp, state.playerStats.maxHp);
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse add_injury command:", e);
                }
            }
        } else if (nextSegment.type === 'bgm') {
            // [New] Handle BGM
            playBgm(nextSegment.content);
        } else if (nextSegment.type === 'event_cg') {
            // [New] Handle Event CG
            const content = nextSegment.content;
            if (content.toLowerCase() === 'off') {
                useGameStore.getState().setEventCG(null);
            } else {
                useGameStore.getState().setEventCG(content);
            }
        }

        currentQueue.shift(); // Remove processed segment
        if (currentQueue.length === 0) break;
        nextSegment = currentQueue[0];
    }

    // If queue is empty after processing backgrounds
    if (currentQueue.length === 0) {
        setScriptQueue([]);
        setCurrentSegment(null);
        if (pendingLogic) {
            applyGameLogic(pendingLogic);
            setPendingLogic(null);
        }
        return;
    }

    // Handle Text Messages (Store)
    if (nextSegment.type === 'text_message') {
        console.log(`[Script] Text Message from ${nextSegment.character}: ${nextSegment.content}`);
        addTextMessage(nextSegment.character || 'Unknown', {
            sender: nextSegment.character || 'Unknown',
            content: nextSegment.content,
            timestamp: Date.now()
        });
        addToast(`📩 ${nextSegment.character}: ${nextSegment.content.substring(0, 15)}...`, 'info');
        setScriptQueue(currentQueue.slice(1));
        setCurrentSegment(nextSegment); // [Changed] Show Popup
        return;
    }

    // Handle Text Replies (Player)
    if (nextSegment.type === 'text_reply') {
        const receiver = nextSegment.character || 'Unknown';
        console.log(`[Script] Text Reply to ${receiver}: ${nextSegment.content}`);
        addTextMessage(receiver, {
            sender: '주인공',
            content: nextSegment.content,
            timestamp: Date.now()
        });
        addToast(`📤 답장 전송: ${receiver}`, 'info');
        setScriptQueue(currentQueue.slice(1));
        setCurrentSegment(null);
        return;
    }

    // Handle Phone Call
    if (nextSegment.type === 'phone_call') {
        console.log(`[Script] Phone Call: ${nextSegment.content}`);
        // Logic for phone call (UI component)
        // Falls through to default segment handling
    }

    // If queue is empty after processing backgrounds
    if (currentQueue.length === 0) {
        setScriptQueue([]);
        setCurrentSegment(null);
        if (pendingLogic) {
            applyGameLogic(pendingLogic);
            setPendingLogic(null);
        }

        // [Fix] Trigger Deferred Ending (After text finishes)
        if (pendingEndingRef.current) {
            console.log(`[Ending] Triggering Deferred Ending: ${pendingEndingRef.current}`);
            useGameStore.getState().setEndingType(pendingEndingRef.current.toLowerCase() as any);
            pendingEndingRef.current = null;
        }
        return;
    }

    // Handle Choices
    if (nextSegment.type === 'choice') {
        const newChoices = [];
        let i = 0;
        while (i < currentQueue.length && currentQueue[i].type === 'choice') {
            newChoices.push(currentQueue[i]);
            i++;
        }

        // [Epilogue Guard] Do NOT show choices during Epilogue (Streaming Fix)
        if (isEpilogueRef.current) {
            console.log("[Epilogue] Choices detected in queue. Suppressing and auto-advancing.");
            // We consumed them, so we just clear choices to be safe and continue
            setChoices([]);
        } else {
            setChoices(newChoices);
        }

        setScriptQueue(currentQueue.slice(i));
        setCurrentSegment(null);

        // [Fix] Apply Pending Logic when Reaching Choices (End of Turn)
        if (pendingLogic) {
            console.log("[VisualNovelUI] Applying Pending Logic at Choice Boundary", pendingLogic);
            applyGameLogic(pendingLogic);
            setPendingLogic(null);
        }
        return;
    }

    // Handle Normal Segment (Dialogue/Narration)
    _timings['before_setQueue'] = performance.now() - _t0;
    setScriptQueue(currentQueue.slice(1));
    _timings['after_setQueue'] = performance.now() - _t0;
    setCurrentSegment(nextSegment);

    // [Fix] Normalize inputs to NFC (Standard) to match JSON keys
    if (nextSegment.character) nextSegment.character = nextSegment.character.normalize('NFC');
    if (nextSegment.characterImageKey) nextSegment.characterImageKey = nextSegment.characterImageKey.normalize('NFC');

    if (nextSegment.type === 'dialogue') {
        // [New] Dynamic Override for Extra Characters
        const charMap = useGameStore.getState().characterMap || {};
        const isMainCharacter = !!charMap[nextSegment.character || ''];

        // Prevent override if it is a Main Character
        if (nextSegment.characterImageKey && nextSegment.character && !isMainCharacter) {
            useGameStore.getState().setExtraOverride(nextSegment.character, nextSegment.characterImageKey);
        }

        if (nextSegment.character) {
            // Determine Name and Emotion from AI output
            // AI is instructed to output Korean Name and Korean Emotion.
            const charName = nextSegment.character === playerName ? '주인공' : nextSegment.character;
            const emotion = nextSegment.expression || 'Default'; // AI output (e.g., '기쁨', 'Happy')

            let imagePath = '';

            // Prevent Protagonist Image from showing (Immersion)
            // [Modified] Allow if Override exists (Persisted Choice)
            const state = useGameStore.getState();
            // [Fix] Priority 0: Hidden Protagonist Override
            // If this is a hidden character, we MUST show their specific image.
            if (isHiddenProtagonist(charName, playerName, state.protagonistImageOverride)) {
                // [Fix] Force distinct image for hidden protagonist
                // We can now safely rely on getCharacterImage because image-mapper also checks isHiddenProtagonist
                imagePath = getCharacterImage(charName, emotion);
                setCharacterExpression(imagePath);
                return; // Skip standard hiding logic
            }

            if (charName === '주인공' || charName === playerName) {
                const state = useGameStore.getState();
                // [Fix] Check PlayerName key (Standard) OR '주인공' key (Legacy/Fallback)
                const overrideKey = state.extraOverrides?.[playerName] || state.extraOverrides?.['주인공'];

                if (overrideKey) {
                    const extraMap = state.extraMap;
                    let finalImage = '';

                    if (extraMap && extraMap[overrideKey]) {
                        finalImage = extraMap[overrideKey];
                    } else {
                        finalImage = `${overrideKey}.png`;
                    }

                    // Set full path
                    imagePath = `/assets/${useGameStore.getState().activeGameId || 'wuxia'}/ExtraCharacters/${finalImage}`;
                    setCharacterExpression(imagePath);
                    return;
                }

                setCharacterExpression('');
                return;
            }

            const combinedKey = `${charName}_${emotion}`;
            const gameId = useGameStore.getState().activeGameId || 'god_bless_you';
            const extraMap = useGameStore.getState().extraMap; // Get extraMap from store

            // [Fix] Explicit Key Lookup (Priority)
            // Only use characterImageKey if NOT a Main Character
            if (nextSegment.characterImageKey && !isMainCharacter) {
                if (extraMap && extraMap[nextSegment.characterImageKey]) {
                    imagePath = `/assets/${gameId}/ExtraCharacters/${extraMap[nextSegment.characterImageKey]}`;
                } else {
                    // Fallback for direct matches?
                    imagePath = getCharacterImage(nextSegment.characterImageKey, emotion);
                }
            }
            // Existing Logic
            else if (availableExtraImages && availableExtraImages.includes(combinedKey)) {
                // Check direct file match (name_emotion)
                imagePath = `/assets/${gameId}/ExtraCharacters/${combinedKey}.png`;
            } else if (extraMap && extraMap[charName]) {
                // Check exact name match in extraMap (e.g. "점소이(비굴한)" -> "점소이_비굴한.png")
                imagePath = `/assets/${gameId}/ExtraCharacters/${extraMap[charName]}`;
            } else {
                // Clean up emotion input (remove parens if any, though system prompt forbids them)
                // The mapper expects clean distinct Korean words.
                imagePath = getCharacterImage(charName, emotion);
                _timings['getCharacterImage_done'] = performance.now() - _t0;

                // [Fallback] Fuzzy Match for Missing Images
                // If imagePath is empty, try to find the best match from availableExtraImages
                if (!imagePath && availableExtraImages && availableExtraImages.length > 0) {
                    // Priority 1: Match defined image key (e.g. "냉철한사파무인남")
                    let targetKey = nextSegment.characterImageKey || charName;

                    // Clean target key (remove brackets if any remaining)
                    targetKey = targetKey.replace(/\(.*\)/, '').trim();

                    const candidates = availableExtraImages;
                    // Use Detail version for Score Access
                    const bestMatch = findBestMatchDetail(targetKey, candidates);

                    if (bestMatch && bestMatch.rating > 0.4) { // 40% similarity threshold
                        console.log(`[Image Fallback] Fuzzy Match: ${targetKey} -> ${bestMatch.target}`);
                        imagePath = `/assets/${gameId}/ExtraCharacters/${bestMatch.target}.png`; // Simplified assumption: extra images are flat
                        // Wait, availableExtraImages might be full filenames or keys? 
                        // Usually they are keys like "점소이_비굴한" or just "점소이".
                        // Let's assume they are keys without extension if coming from store, 
                        // BUT lines 926 and 950 add .png extension.
                        // Let's check how availableExtraImages is populated. 
                        // It is likely filenames without extension or keys.
                        // Line 950: `.../${combinedKey}.png` implies combinedKey is the filename base.
                        // If bestMatch.target is the filename base, we append .png.

                        // Re-verify: availableExtraImages comes from store.

                    }
                }
            }

            _timings['before_setCharExpr'] = performance.now() - _t0;
            setCharacterExpression(imagePath);
            _timings['after_setCharExpr'] = performance.now() - _t0;
        }
    }


    // Response Time Tracking
    _timings['total'] = performance.now() - _t0;
    console.log(`%c[PERF] advanceScript took ${_timings['total'].toFixed(1)}ms`, 'color: orange;');
    if (_timings['total'] > 50) {
        console.log('[PERF] advanceScript breakdown:', Object.fromEntries(Object.entries(_timings).map(([k, v]) => [k, `${v.toFixed(1)}ms`])));
    }
}
