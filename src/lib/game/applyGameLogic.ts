'use client';

// [Refactor] Extracted from VisualNovelUI.tsx  applyGameLogic function
// This module applies AI logic results to the game state.

import { useGameStore, Skill } from '@/lib/store';
import { normalizeCharacterId } from '@/lib/utils/character-id';
import { findBestMatch, findBestMatchDetail } from '@/lib/utils/name-utils';
import { translations } from '@/data/translations';
import { EventManager } from '@/lib/engine/event-manager';
import { GameRegistry } from '@/lib/registry/GameRegistry';
import { checkUniversalProgression } from '@/lib/engine/progression-types';
import { serverGenerateCharacterMemorySummary } from '@/app/actions/game';
import React from 'react';

// Dependency injection interface for local state/callbacks
export interface ApplyGameLogicDeps {
    addToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
    t: any;
    setLastLogicResult: (result: any) => void;
    setChoices: (choices: any[]) => void;
    handleVisualDamage: (changeAmount: number, currentHp: number, maxHp: number) => void;
    pendingEndingRef: React.MutableRefObject<string | null>;
    isEpilogueRef: React.MutableRefObject<boolean>;
}

export function applyGameLogic(logicResult: any, deps: ApplyGameLogicDeps) {
    const { addToast: _rawToast, t, setLastLogicResult, setChoices, handleVisualDamage, pendingEndingRef, isEpilogueRef } = deps;
    // [Immersion] Only HP changes, new skills, and injuries are shown to the player.
    // All other notifications are console-only to preserve game immersion.
    const addToast = (msg: string, type: string) => { console.log(`[Toast Suppressed] ${msg}`); };
    const essentialToast = _rawToast;
    const activeGameId = useGameStore.getState().activeGameId || 'wuxia';
    const addItem = useGameStore.getState().addItem;
    const removeItem = useGameStore.getState().removeItem;

    console.groupCollapsed("▶ [applyGameLogic] Received Payload");
    console.dir(logicResult);
    console.groupEnd();

    if (!logicResult) {
        console.warn('applyGameLogic: logicResult is null or undefined');
        return;
    }
    setLastLogicResult(logicResult);

    // [New] Ending Trigger
    // [Fix] Epilogue Guard: Do not re-trigger ending if already in Epilogue mode
    if (logicResult.ending_trigger && ['BAD', 'GOOD', 'TRUE'].includes(logicResult.ending_trigger) && !isEpilogueRef.current) {
        console.log(`[Ending] Detected: ${logicResult.ending_trigger}. Deferring trigger until text completion.`);
        // [Fix] Defer ending trigger until script queue is empty
        pendingEndingRef.current = logicResult.ending_trigger;
        setChoices([]); // [Fix] Force-clear any floating choices to prevent UI overlap
    }

    // Update Stats
    const currentStats = useGameStore.getState().playerStats;
    console.log('Current Stats before update:', currentStats);

    const newStats = { ...currentStats };
    let hasInjuryChanges = false;

    // [Fix] Deep clone nested objects to prevent mutation of INITIAL_STATS
    newStats.relationships = { ...(newStats.relationships || {}) };
    newStats.skills = [...(newStats.skills || [])];
    // [Universal] Deep clone customStats
    newStats.customStats = { ...(newStats.customStats || {}) };
    // [Migration] Copy legacy neigong to customStats if not yet migrated
    if (newStats.neigong > 0 && !newStats.customStats.neigong) {
        newStats.customStats.neigong = newStats.neigong;
    }
    // Initialize stagnation if missing
    if (typeof newStats.growthStagnation !== 'number') newStats.growthStagnation = 0;

    // [Growth Monitoring] Detect significant growth to reset Stagnation
    const isGrowthEvent =
        (logicResult.neigongChange && logicResult.neigongChange > 0) ||
        logicResult.realmChange || // Hypothetical field, but let's assume specific realm update logic down below covers it
        (logicResult.expChange && logicResult.expChange > 10) || // Major EXP gain
        // [NEW] Check for new skills (unified)
        (logicResult.new_skills && logicResult.new_skills.length > 0);

    if (isGrowthEvent) {
        newStats.growthStagnation = 0;
        // console.log("[Growth] Stagnation Reset!");
    }

    // Initialize if missing (Redundant but safe)
    if (!newStats.relationships) newStats.relationships = {};

    // [New] Generic Stat Updates (PostLogic)
    // [Universal] Get progression config from GameRegistry
    const gameConfig = GameRegistry.get(activeGameId);
    const progressionConfig = gameConfig?.progressionConfig;
    const customStatIds = new Set(progressionConfig?.stats.map(s => s.id) || []);

    if (logicResult.stat_updates) {
        console.log("[applyGameLogic] Processing Generic Stat Updates:", logicResult.stat_updates);
        Object.entries(logicResult.stat_updates).forEach(([key, val]) => {
            const numVal = Number(val);
            if (isNaN(numVal) || numVal === 0) return;

            const lowerKey = key.toLowerCase();

            // 1. Core Stats (Universal)
            if (lowerKey === 'hp') {
                newStats.hp = Math.min(Math.max(0, newStats.hp + numVal), newStats.maxHp);
                handleVisualDamage(numVal, newStats.hp, newStats.maxHp);

                // [Fix] HARD Auto-Death Trigger (Backup if AI misses it)
                if (newStats.hp <= 0 && useGameStore.getState().endingType === 'none') {
                    console.log("HP <= 0 detected. Queuing DEFERRED BAD ENDING.");
                    pendingEndingRef.current = 'bad';
                }
            }
            else if (lowerKey === 'mp') newStats.mp = Math.min(Math.max(0, newStats.mp + numVal), newStats.maxMp);
            else if (lowerKey === 'gold') newStats.gold = Math.max(0, newStats.gold + numVal);
            else if (lowerKey === 'fame') {
                newStats.fame = Math.max(0, (newStats.fame || 0) + numVal);
                addToast(`${t.fame} ${numVal > 0 ? '+' : ''}${numVal}`, numVal > 0 ? 'success' : 'warning');
            }
            else if (lowerKey === 'fate') newStats.fate = Math.max(0, (newStats.fate || 0) + numVal);
            // [Fix] Level & EXP — PostLogic stat_updates에서 성장 수치 반영
            else if (lowerKey === 'level') {
                const oldLevel = newStats.level || 1;
                newStats.level = Math.max(1, oldLevel + numVal);
                console.log(`[applyGameLogic] Level: ${oldLevel} → ${newStats.level} (delta: ${numVal})`);
            }
            else if (lowerKey === 'exp') {
                newStats.exp = (newStats.exp || 0) + numVal;
            }

            // 2. [Universal] Genre-Specific Custom Stats (내공, 마나, 오러 등)
            else if (customStatIds.has(lowerKey)) {
                const statDef = progressionConfig!.stats.find(s => s.id === lowerKey)!;
                if (statDef.isFixed) return; // Fixed stats cannot be changed by AI
                const curr = newStats.customStats[lowerKey] || statDef.defaultValue;
                const newVal = statDef.max > 0
                    ? Math.min(curr + numVal, statDef.max)
                    : curr + numVal;
                newStats.customStats[lowerKey] = Math.max(statDef.min, newVal);
                // [Compat] Sync to legacy field if it exists
                if (lowerKey === 'neigong') newStats.neigong = newStats.customStats[lowerKey];
                // Toast
                const template = statDef.toastTemplate || '{displayName} {delta}';
                const toastMsg = template
                    .replace('{displayName}', statDef.displayName)
                    .replace('{delta}', `${numVal > 0 ? '+' : ''}${numVal}`);
                addToast(toastMsg, numVal > 0 ? 'success' : 'warning');
            }


            // [Dead Stats Removed] Personality stats and base stats (STR/AGI/INT/VIT/LUK) no longer processed
        });
    }

    // [Universal] Handle "customStatsChange" from new Output Format
    // e.g., { neigongChange: 5, mana_affinityChange: 1 }
    if (logicResult.customStatsChange && progressionConfig) {
        console.log("[applyGameLogic] Processing customStatsChange:", logicResult.customStatsChange);
        Object.entries(logicResult.customStatsChange).forEach(([key, val]) => {
            const numVal = Number(val);
            if (isNaN(numVal) || numVal === 0) return;

            // Strip "Change" suffix: "neigongChange" -> "neigong"
            const statId = key.replace(/Change$/, '');
            const statDef = progressionConfig!.stats.find(s => s.id === statId);
            if (!statDef) {
                console.warn(`[applyGameLogic] Unknown custom stat in customStatsChange: ${statId}`);
                return;
            }
            if (statDef.isFixed) return;

            const curr = newStats.customStats[statId] || statDef.defaultValue;
            const newVal = statDef.max > 0
                ? Math.min(curr + numVal, statDef.max)
                : curr + numVal;
            newStats.customStats[statId] = Math.max(statDef.min, newVal);

            // Legacy sync
            if (statId === 'neigong') newStats.neigong = newStats.customStats[statId];

            // Toast
            const template = statDef.toastTemplate || '{displayName} {delta}';
            const toastMsg = template
                .replace('{displayName}', statDef.displayName)
                .replace('{delta}', `${numVal > 0 ? '+' : ''}${numVal}`);
            addToast(toastMsg, numVal > 0 ? 'success' : 'warning');
        });
    }

    // [Legacy Compat] Handle top-level "neigongChange" field (old prompt format)
    if (logicResult.neigongChange && logicResult.neigongChange !== 0 && !logicResult.stat_updates && !logicResult.customStatsChange) {
        const numVal = Number(logicResult.neigongChange);
        if (!isNaN(numVal) && numVal !== 0) {
            const curr = newStats.customStats.neigong || newStats.neigong || 0;
            newStats.customStats.neigong = curr + numVal;
            newStats.neigong = newStats.customStats.neigong;
            addToast(`내공 ${numVal > 0 ? '+' : ''}${numVal}년`, numVal > 0 ? 'success' : 'warning');
        }
    }

    // [Universal] Deterministic Rank Progression (All Games via ProgressionConfig)
    if (progressionConfig) {
        const result = checkUniversalProgression(
            progressionConfig,
            newStats.level,
            newStats.customStats,
            newStats.playerRank
        );
        if (result) {
            console.log(`[Progression] Rank Up: ${newStats.playerRank} → ${result.newTier.title}`);
            newStats.playerRank = result.newTier.title;
            addToast(`[${progressionConfig.tierDisplayName}] ${result.newTier.title}`, 'success');
        }
    }

    if (logicResult.hpChange) {
        newStats.hp = Math.min(Math.max(0, newStats.hp + logicResult.hpChange), newStats.maxHp);
        handleVisualDamage(logicResult.hpChange, newStats.hp, newStats.maxHp);
    }
    if (logicResult.mpChange) newStats.mp = Math.min(Math.max(0, newStats.mp + logicResult.mpChange), newStats.maxMp);
    if (logicResult.goldChange) newStats.gold = Math.max(0, newStats.gold + logicResult.goldChange);

    if (logicResult.expChange) newStats.exp += logicResult.expChange;
    if (logicResult.fameChange) newStats.fame = Math.max(0, (newStats.fame || 0) + logicResult.fameChange);
    // [Fate System] Update Fate (Generic 'fate' or legacy 'fateChange')
    if (logicResult.fate !== undefined) {
        console.log(`[applyGameLogic] Applying Fate Change: ${logicResult.fate}`);
        // [Toast] Visual Feedback
        if (logicResult.fate !== 0) addToast(`운명 포인트 ${logicResult.fate > 0 ? '+' : ''}${logicResult.fate}`, 'info');
        newStats.fate = Math.max(0, (newStats.fate || 0) + logicResult.fate);
    }
    else if (logicResult.fateChange !== undefined) {
        console.log(`[applyGameLogic] Applying Fate Change (Legacy): ${logicResult.fateChange}`);
        newStats.fate = Math.max(0, (newStats.fate || 0) + logicResult.fateChange);
    }


    // [Dead Stats Removed] Base stat changes (STR/AGI/INT/VIT/LUK) no longer processed

    // [New] Sleep Logic (Overrides Time Consumed if present)
    if (logicResult.isSleep) {
        newStats.fatigue = 0; // Reset Fatigue
        const currentState = useGameStore.getState();
        currentState.setDay((currentState.day || 1) + 1); // Advance Day
        currentState.setTime('Morning'); // Reset Time to Morning
        addToast("휴식을 취했습니다. (피로도 초기화)", 'success');
        console.log("[Logic] isSleep: True -> Day Advanced, Fatigue Reset");
    }

    // [New] Location Update (From PostLogic)
    if (logicResult.location) {
        const currentLoc = useGameStore.getState().currentLocation;
        // Only update if changed (ignoring null/undefined)
        if (logicResult.location && currentLoc !== logicResult.location) {
            useGameStore.getState().setCurrentLocation(logicResult.location);
            console.log(`[Logic] Location Updated: ${currentLoc} -> ${logicResult.location}`);
        }
    }

    // [New] Time Progression Logic (Only if not sleeping)
    else if (logicResult.timeConsumed) {
        const timeMap = ['morning', 'afternoon', 'evening', 'night'];
        const currentState = useGameStore.getState();
        // Normalize & Legacy Fallback
        let currentTime = (currentState.time || 'morning').toLowerCase();
        const koMap: Record<string, string> = { '아침': 'morning', '점심': 'afternoon', '저녁': 'evening', '밤': 'night' };
        if (koMap[currentTime]) currentTime = koMap[currentTime];

        let timeIndex = timeMap.indexOf(currentTime);
        if (timeIndex === -1) timeIndex = 0; // Default

        const consumed = logicResult.timeConsumed; // 1=Small, 2=Medium, 4=Long
        const totalIndex = timeIndex + consumed;

        const daysPassed = Math.floor(totalIndex / 4);
        const newTimeIndex = totalIndex % 4;

        if (daysPassed > 0) {
            const newDay = (currentState.day || 1) + daysPassed;
            currentState.setDay(newDay);
            addToast(`${daysPassed}일이 지났습니다. (Day ${newDay})`, 'info');
        }

        const newTime = timeMap[newTimeIndex];
        if (newTime !== currentTime) {
            currentState.setTime(newTime);
            console.log(`[Time] ${currentTime} -> ${newTime} (+${daysPassed} days)`);
        }

        // [Growth Monitoring] Increment Stagnation if time passed AND no growth this turn
        if (!isGrowthEvent) {
            // Increment by 1 per logic execution (Turn)
            newStats.growthStagnation = (newStats.growthStagnation || 0) + 1;
        }
    }

    // [Fix] REMOVED: Duplicate goldChange application
    // Gold is already applied at line 210 via logicResult.goldChange.
    // This second application was causing gold duplication (e.g., 500k → 1M).
    // if (logicResult.goldChange) {
    //     newStats.gold = Math.max(0, (newStats.gold || 0) + logicResult.goldChange);
    // }
    // [Fix] REMOVED Redundant Fame & Fate Logic Update
    // Similar to HP/MP, these are now handled via tags or were duplicated above.
    // if (logicResult.fameChange) {
    //     newStats.fame = (newStats.fame || 0) + logicResult.fameChange;
    // }
    // if (logicResult.fateChange) {
    //     newStats.fate = (newStats.fate || 0) + logicResult.fateChange;
    // }


    // [Dead Stats Removed] personalityChange no longer processed

    // [Universal] Legacy neigongChange → customStats migration
    if (logicResult.neigongChange) {
        const delta = logicResult.neigongChange;
        newStats.customStats.neigong = Math.max(0, (newStats.customStats.neigong || 0) + delta);
        newStats.neigong = newStats.customStats.neigong; // [Compat] Sync legacy field
        addToast(`내공 ${delta > 0 ? '+' : ''}${delta}년`, delta > 0 ? 'success' : 'warning');
    }

    // [New] Player Rank & Faction Update
    if (logicResult.playerRank) {
        newStats.playerRank = logicResult.playerRank;
        addToast(`등급 변경: ${logicResult.playerRank}`, 'success');
    }
    if (logicResult.factionChange) {
        newStats.faction = logicResult.factionChange;
        addToast(`소속 변경: ${logicResult.factionChange}`, 'info');
    }

    // Skills
    // Skills (Unified System)
    // logicResult.new_skills is Array of Skill Objects
    if (logicResult.new_skills) {
        logicResult.new_skills.forEach((skill: Skill) => {
            // Check duplicate by ID
            if (!newStats.skills.find(s => s.id === skill.id)) {
                newStats.skills.push(skill);
                essentialToast(`신규 스킬 획득: ${skill.name}`, 'success');
            }
        });
    }

    // [Unified] Skill Proficiency Updates
    if (logicResult.updated_skills) {
        logicResult.updated_skills.forEach((update: { id: string, proficiency_delta: number }) => {
            const skillIndex = newStats.skills.findIndex(s => s.id === update.id);
            if (skillIndex > -1) {
                const skill = newStats.skills[skillIndex];
                const oldProf = skill.proficiency || 0;
                const newProf = Math.min(100, Math.max(0, oldProf + update.proficiency_delta));

                // Direct mutation of the clones array object
                newStats.skills[skillIndex] = { ...skill, proficiency: newProf };

                if (newProf !== oldProf) {
                    addToast(`${skill.name} 숙련도: ${oldProf}% -> ${newProf}% (${update.proficiency_delta > 0 ? '+' : ''}${update.proficiency_delta})`, 'info');
                }
            }
        });
    }

    // Relationships
    if (logicResult.relationshipChange) {
        // [Fix] Defensive check for AI hallucination (returning object instead of array)
        const changes = Array.isArray(logicResult.relationshipChange)
            ? logicResult.relationshipChange
            : [logicResult.relationshipChange];

        changes.forEach((rel: any) => {
            if (!rel || !rel.characterId) return;
            // [Fix] Normalize ID
            const normalizedId = normalizeCharacterId(rel.characterId);
            newStats.relationships[normalizedId] = (newStats.relationships[normalizedId] || 0) + (rel.change || 0);
        });
    }

    console.log('New Stats after update:', newStats);

    // [New] Injuries Update
    if (logicResult.injuriesUpdate) {
        let currentInjuries = [...(newStats.active_injuries || [])];
        let changed = false;

        // Add
        if (logicResult.injuriesUpdate.add) {
            const addList = Array.isArray(logicResult.injuriesUpdate.add)
                ? logicResult.injuriesUpdate.add
                : [logicResult.injuriesUpdate.add];

            addList.forEach((injury: string) => {
                if (!currentInjuries.includes(injury)) {
                    currentInjuries.push(injury);
                    essentialToast(`부상 발생(Injury): ${injury}`, 'warning');
                    changed = true;
                }
            });
        }

        // Remove
        // Remove
        if (logicResult.injuriesUpdate.remove) {
            const initialLen = currentInjuries.length;
            const toRemove = new Set<string>();

            const removeList = Array.isArray(logicResult.injuriesUpdate.remove)
                ? logicResult.injuriesUpdate.remove
                : [logicResult.injuriesUpdate.remove];

            removeList.forEach((targetInj: string) => {
                // 1. Exact Match
                if (currentInjuries.includes(targetInj)) {
                    toRemove.add(targetInj);
                    return;
                }

                // 1.5 Lenient Substring & Normalized Match (User Request)
                // If AI says "Internal Injury", it should remove "Severe Internal Injury" or "Internal Injury (Recovering)"
                const substringMatch = currentInjuries.find(curr => {
                    // Normalize: Remove (...) and whitespace
                    const cleanCurr = curr.replace(/\(.*\)/, '').replace(/\s+/g, '');
                    const cleanTarget = targetInj.replace(/\(.*\)/, '').replace(/\s+/g, '');

                    // Check containment (bi-directional)
                    return curr.includes(targetInj) || targetInj.includes(curr) ||
                        cleanCurr.includes(cleanTarget) || cleanTarget.includes(cleanCurr);
                });

                if (substringMatch) {
                    console.log(`[Injury] Substring Removal: '${substringMatch}' matches target '${targetInj}'`);
                    toRemove.add(substringMatch);
                    return;
                }

                // 2. Fuzzy Match (Fallback)
                const best = findBestMatchDetail(targetInj, currentInjuries);
                // Threshold 0.6 (Dice Coefficient) -> Lowered to 0.5 for leniency
                if (best && best.rating >= 0.5) {
                    console.log(`[Injury] Fuzzy Removal: '${targetInj}' matches '${best.target}' (Score: ${best.rating.toFixed(2)})`);
                    toRemove.add(best.target);
                }
            });

            currentInjuries = currentInjuries.filter(inj => !toRemove.has(inj));

            if (currentInjuries.length !== initialLen) {
                essentialToast("부상 회복!", 'success');
                changed = true;
            }
        }

        if (changed) {
            // [Sanitization] Auto-clean invalid injuries (Psychological, duplicates)
            const INVALID_KEYWORDS = ['심리적', '정신적', '공포', '두려움', '위축', '긴장', '불안', '경직', '뻐근함'];
            currentInjuries = currentInjuries.filter(inj => {
                // 1. Check Blacklist
                if (INVALID_KEYWORDS.some(kw => inj.includes(kw))) return false;
                // 2. Check Empty/Short
                if (!inj || inj.trim().length < 2) return false;
                return true;
            });
            // Deduplicate
            currentInjuries = Array.from(new Set(currentInjuries));

            newStats.active_injuries = currentInjuries;
            hasInjuryChanges = true;
        }
    }

    // [Universal] Level & Rank Progression via martial_arts result
    const maResult = logicResult.martial_arts;
    if (maResult && maResult.level_delta) {
        const delta = maResult.level_delta;
        const oldLevel = newStats.level || 1;
        newStats.level = oldLevel + delta;

        // [Universal] Use ProgressionConfig for rank check instead of hardcoded maps
        if (progressionConfig) {
            const result = checkUniversalProgression(
                progressionConfig,
                newStats.level,
                newStats.customStats,
                newStats.playerRank
            );
            if (result) {
                newStats.playerRank = result.newTier.title;
                addToast(`[${progressionConfig.tierDisplayName}] ${result.newTier.title}`, 'success');
                console.log(`[Progression] Level ${oldLevel.toFixed(2)} -> ${newStats.level.toFixed(2)} | Rank: ${result.newTier.title}`);
            }
        }
    }

    // [New Wuxia] New Skills Logic
    if (maResult && maResult.new_skills && maResult.new_skills.length > 0) {
        const currentSkills = useGameStore.getState().playerStats.skills || [];
        maResult.new_skills.forEach((skill: any) => {
            // Check duplicate ID
            if (!currentSkills.find((s: any) => s.id === skill.id)) {
                // Logic to add skill is handled in setState below, but we can do a toast here
                addToast(`New Skill: ${skill.name}`, 'success');
            }
        });
    }



    // [Narrative Systems: Tension & Goals]
    if (logicResult.new_goals) {
        logicResult.new_goals.forEach((g: any) => {
            const newGoal = {
                id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                description: g.description,
                type: g.type,
                status: 'ACTIVE',
                createdTurn: useGameStore.getState().turnCount
            };
            // @ts-ignore
            useGameStore.getState().addGoal(newGoal);
            // [Suppressed] New Goal Toast
            // addToast(`New Goal: ${g.description}`, 'info');
        });
    }

    // [New] Event Lifecycle Management (Fix for Event Loop Bug)
    // 1. Trigger New Event
    if (logicResult.triggerEventId) {
        const currentActive = useGameStore.getState().activeEvent;
        // Only trigger if not already active (or different)
        if (!currentActive || currentActive.id !== logicResult.triggerEventId) {
            const eventPayload = {
                id: logicResult.triggerEventId,
                prompt: logicResult.currentEvent || "", // Save prompt for context
                startedTurn: useGameStore.getState().turnCount
            };
            useGameStore.getState().setActiveEvent(eventPayload);
            console.log(`[VisualNovelUI] Marking Event as Triggered: ${logicResult.triggerEventId}`);
            useGameStore.getState().addTriggeredEvent(logicResult.triggerEventId);
            addToast("새로운 이벤트가 발생했습니다!", 'info');
            console.log(`[Event System] New Event Triggered & Activated: ${logicResult.triggerEventId}`);
        }
    }

    // 2. Clear Completed/Ignored Event (From PreLogic)
    if (logicResult.event_status === 'completed' || logicResult.event_status === 'ignored') {
        const currentActive = useGameStore.getState().activeEvent;
        if (currentActive) {
            // [Fix] Failsafe: Ensure it is marked as triggered (Prevent Loops)
            if (logicResult.event_status === 'completed') {
                const triggered = useGameStore.getState().triggeredEvents || [];
                if (!triggered.includes(currentActive.id)) {
                    useGameStore.getState().addTriggeredEvent(currentActive.id);
                    console.log(`[Event System] Failsafe: Added ${currentActive.id} to triggeredEvents on completion.`);
                }
            }

            useGameStore.getState().setActiveEvent(null);
            console.log(`[Event System] Event Cleared (${logicResult.event_status}): ${currentActive.id}`);
            addToast(logicResult.event_status === 'completed' ? "이벤트가 종료되었습니다." : "이벤트가 넘어갔습니다.", 'info');
        }
    }

    if (logicResult.goal_updates) {
        logicResult.goal_updates.forEach((u: any) => {
            // @ts-ignore
            useGameStore.getState().updateGoal(u.id, { status: u.status });
            // [Suppressed] Goal Status Toasts
            // if (u.status === 'COMPLETED') addToast(`Goal Completed!`, 'success');
            // if (u.status === 'FAILED') addToast(`Goal Failed!`, 'warning');
        });
    }

    // Final Commit
    if (Object.keys(logicResult).some(k => k === 'hpChange' || k === 'mpChange' || k === 'goldChange' || k === 'relationshipChange') || hasInjuryChanges) {
        useGameStore.getState().setPlayerStats(newStats);
    }



    // Toasts
    if (logicResult.hpChange) essentialToast(`${t.hp} ${logicResult.hpChange > 0 ? '+' : ''}${logicResult.hpChange}`, logicResult.hpChange > 0 ? 'success' : 'warning');
    if (logicResult.mpChange) addToast(`${t.mp} ${logicResult.mpChange > 0 ? '+' : ''}${logicResult.mpChange}`, 'info');
    if (logicResult.goldChange) addToast(`${t.gold} ${logicResult.goldChange > 0 ? '+' : ''}${logicResult.goldChange}`, 'success');
    if (logicResult.fameChange) addToast(`Fame ${logicResult.fameChange > 0 ? '+' : ''}${logicResult.fameChange}`, logicResult.fameChange > 0 ? 'success' : 'warning');
    if (logicResult.fateChange) addToast(`Fate ${logicResult.fateChange > 0 ? '+' : ''}${logicResult.fateChange}`, logicResult.fateChange > 0 ? 'info' : 'warning');



    // Inventory
    if (logicResult.newItems && logicResult.newItems.length > 0) {
        logicResult.newItems.forEach((item: any) => {
            addItem(item);
            // [Suppressed] Item Acquired Toast
            // addToast(t.acquired.replace('{0}', item.name), 'success');
        });
    }
    if (logicResult.removedItemIds && logicResult.removedItemIds.length > 0) {
        logicResult.removedItemIds.forEach((id: string) => {
            removeItem(id);
            // [Suppressed] Item Lost Toast
            // addToast(t.usedLost.replace('{0}', id), 'info');
        });
    }



    // [New] Player Rank Update (Sync mechanism if Logic returns direct rank)
    if (logicResult.playerRank) {
        const currentRank = useGameStore.getState().playerStats.playerRank;
        if (currentRank !== logicResult.playerRank) {
            // Update Rank AND Realm to remain consistent
            newStats.playerRank = logicResult.playerRank;
            // We don't call setPlayerStats here directly anymore, as newStats is committed at the end
            // setPlayerStats({ ...newStats, playerRank: logicResult.playerRank }); <-- Removed direct set

            // Also update top-level playerRealm State immediately for safety
            // useGameStore.getState().setPlayerRealm(logicResult.playerRank); // [Removed] Legacy

            // [Suppressed] Rank Up Toast
            // queueToast(`Rank Up: ${logicResult.playerRank}`, 'success');
            console.log(`Rank updated from ${currentRank} to ${logicResult.playerRank}`);
        }
    }

    // [New] Faction Update
    if (logicResult.factionChange) {
        const currentFaction = useGameStore.getState().playerStats.faction;
        if (currentFaction !== logicResult.factionChange) {
            newStats.faction = logicResult.factionChange;
            useGameStore.getState().setPlayerStats(newStats);
            addToast(`소속 변경: ${logicResult.factionChange}`, 'success');
            console.log(`Faction updated from ${currentFaction} to ${logicResult.factionChange}`);
        }
    }

    // Debug Fame Change
    if (logicResult.fameChange !== undefined) {
        console.log(`[Logic] Fame Change: ${logicResult.fameChange}`);
    }

    // [Fix] Update Active Characters FIRST to ensure they exist in store
    if (logicResult.activeCharacters) {
        useGameStore.getState().setActiveCharacters(logicResult.activeCharacters);
    }

    // Character Updates (Bio & Memories)
    if (logicResult.characterUpdates && logicResult.characterUpdates.length > 0) {
        logicResult.characterUpdates.forEach((char: any) => {
            // [Fix] Normalize ID
            const normalizedId = normalizeCharacterId(char.id, useGameStore.getState().language || 'ko');

            // [Fix] Fetch existing data to safely merge
            const existingData = useGameStore.getState().characterData[normalizedId] || {
                id: normalizedId,
                name: char.name || normalizedId,
                relationship: 0,
                memories: []
            };

            const updateData = { ...char, id: normalizedId };

            // [Critical Fix] Merge Memories instead of Replacing
            // The Logic Model returns NEW memories or relevant ones. We must not wipe old ones.
            if (updateData.memories && Array.isArray(updateData.memories)) {
                const oldMemories = existingData.memories || [];
                const newMemories = updateData.memories;

                // Deduplicate and Append (TaggedMemory 호환)
                const mergedMemories = [...oldMemories];
                const getMemText = (m: any) => typeof m === 'string' ? m : (m?.text || '');
                newMemories.forEach((m: any) => {
                    const newText = getMemText(m);
                    if (!newText) return;
                    const isDup = mergedMemories.some((existing: any) => getMemText(existing) === newText);
                    if (!isDup) {
                        mergedMemories.push(m);
                    }
                });

                updateData.memories = mergedMemories;
                addToast(`Memories Updated: ${normalizedId} (+${newMemories.length})`, 'info');
            } else {
                // If no memories provided in update, DO NOT touch existing memories
                delete updateData.memories;
            }

            // [Safe Update] Use updateCharacterData (which now works because we initialized above, or we can use dedicated setter if needed)
            // Since updateCharacterData might fail if ID missing (though setActiveCharacters handles it), 
            // we can rely on it now.
            useGameStore.getState().updateCharacterData(normalizedId, updateData);

            if (!char.memories) addToast(`Character Updated: ${normalizedId}`, 'info');
        });
    }

    // Location Update
    if (logicResult.newLocation) {
        useGameStore.getState().setCurrentLocation(logicResult.newLocation);
        // Optional: Add toast or log
        console.log(`Location updated to: ${logicResult.newLocation}`);
    }

    // Location Updates (Description & Secrets)
    if (logicResult.locationUpdates && logicResult.locationUpdates.length > 0) {
        logicResult.locationUpdates.forEach((loc: any) => {
            // If secrets are provided, they REPLACE the old list
            const updateData: any = {};
            if (loc.description) updateData.description = loc.description;
            if (loc.secrets) {
                updateData.secrets = loc.secrets;
                addToast(t.systemMessages?.secretsUpdated?.replace('{0}', loc.id) || `Secrets Updated: ${loc.id}`, 'info');
            }

            if (Object.keys(updateData).length > 0) {
                useGameStore.getState().updateLocation(loc.id, updateData);
            }
        });
    }

    // [Moved] Post-Logic Processing (Apply Outcomes)
    if (logicResult.post_logic) {
        const postLogic = logicResult.post_logic;

        if (postLogic.mood_update) {
            useGameStore.getState().setMood(postLogic.mood_update as any);
        }

        if (postLogic.relationship_updates) {
            console.log("Relations Update:", postLogic.relationship_updates);
            // TODO: Implement actual relationship update in store if needed
        }

        // [Fix] REMOVED: Duplicate Faction/Rank processing from post_logic
        // These are already handled via logicResult.factionChange/playerRank (lines 310-317)
        // Processing them again here from post_logic caused duplicate toast alerts.

        // [Fix] REMOVED: Duplicate Injury processing from post_logic
        // Injuries are already handled via logicResult.injuriesUpdate (lines 368-440)
        // which contains the same data (postLogicOut.new_injuries/resolved_injuries)
        // mapped by VisualNovelUI.tsx combinedLogic assembly.
        // Processing them again here caused duplicate injury toasts and double-application.

        // [Dead Stats Removed] Personality processing removed. Core stats only.
        // [Fix] stat_updates: Only process fame/neigong here.
        // hp, mp, gold are already handled at top-level (lines 205-210)
        // via logicResult.hpChange, mpChange, goldChange.
        // Processing them here again from post_logic caused double-counting.
        if (postLogic.stat_updates) {
            const currentStats = useGameStore.getState().playerStats;

            Object.entries(postLogic.stat_updates).forEach(([key, val]) => {
                if (['fame', 'neigong'].includes(key)) {
                    const currentVal = (currentStats as any)[key] || 0;
                    const newVal = Math.max(0, currentVal + (val as number));
                    const updatePayload: any = {};
                    updatePayload[key] = newVal;
                    const freshStats = useGameStore.getState().playerStats;
                    useGameStore.getState().setPlayerStats({ ...freshStats, ...updatePayload });
                }
            });
        }

        if (postLogic.new_memories && postLogic.new_memories.length > 0) {
            // Initial stub for memory handling
        }

        // [Deleted] Duplicate/Broken Memory Logic
        // The correct logic is implemented below (after activeCharacters)
    }

    // [NEW] Martial Arts & Realm Updates (Sync with Server)
    // This is the SINGLE SOURCE OF TRUTH for Martial Arts updates.
    if (logicResult.martial_arts) {
        const ma = logicResult.martial_arts;
        console.log("[MartialArts] Update Received:", ma);

        useGameStore.setState(state => {
            const currentStats = { ...state.playerStats };
            let hasUpdates = false;

            // 1. Realm Update
            if (ma.realm_update) {
                // Update generic PlayerRank (Unified Skill System)
                const normalizedRealm = ma.realm_update.split('(')[0].trim(); // Normalize "이류 (2nd Rate)" -> "이류"

                if (currentStats.playerRank !== normalizedRealm) {
                    currentStats.playerRank = normalizedRealm;
                    // currentStats.realm = ma.realm_update; // [Removed] Legacy
                    // currentStats.realmProgress = 0; // [Removed] Legacy
                    hasUpdates = true;
                    // [Suppressed] Realm Ascension Toast
                    // queueToast(t.systemMessages?.realmAscension?.replace('{0}', ma.realm_update) || `경지 등극: ${ma.realm_update}`, 'success');
                }
            }

            // 2. Realm Progress Delta -> Map to EXP
            if (ma.realm_progress_delta !== undefined) {
                // Treat progress delta as EXP gain for now
                const currentExp = currentStats.exp || 0;
                currentStats.exp = currentExp + ma.realm_progress_delta;
                hasUpdates = true;
                // Only toast for significant gain
                if (ma.realm_progress_delta >= 5) {
                    // [Suppressed] Realm Progress Toast
                    // queueToast(t.systemMessages?.realmProgress?.replace('{0}', ma.realm_progress_delta) || `깨달음: 경험치 +${ma.realm_progress_delta}`, 'info');
                }
            }

            // 3. Neigong (Internal Energy) Update
            if (ma.stat_updates?.neigong) {
                const delta = ma.stat_updates.neigong;
                currentStats.neigong = (currentStats.neigong || 0) + delta;
                // Float correction (optional, but display usually handles it)
                currentStats.neigong = Math.round(currentStats.neigong * 100) / 100;
                hasUpdates = true;
                const sign = delta > 0 ? '+' : '';
                // [Suppressed] Neigong Gain Toast (often frequent)
                // queueToast(t.systemMessages?.neigongGain?.replace('{0}', `${sign}${delta}`) || `내공 ${sign}${delta}년`, 'success');
            }

            // 3.5. HP/MP Logic from Martial Arts (Penalty/Growth)
            if (ma.stat_updates?.hp) {
                currentStats.hp = Math.max(0, (currentStats.hp || 0) + ma.stat_updates.hp);
                hasUpdates = true;
            }
            if (ma.stat_updates?.mp) {
                currentStats.mp = Math.max(0, (currentStats.mp || 0) + ma.stat_updates.mp);
                hasUpdates = true;
            }

            // 3.6 Merge Injuries from Martial Arts
            if (ma.stat_updates?.active_injuries) {
                const currentInj = currentStats.active_injuries || [];
                ma.stat_updates.active_injuries.forEach((inj: string) => {
                    if (!currentInj.includes(inj)) {
                        currentInj.push(inj);
                        essentialToast(t.systemMessages?.internalInjury?.replace('{0}', inj) || `내상(Internal Injury): ${inj}`, 'warning');
                        hasUpdates = true;
                    }
                });
                currentStats.active_injuries = currentInj;
            }


            // 4. Skills Update
            // Add New Skills
            if (ma.new_skills && ma.new_skills.length > 0) {
                const currentSkills = currentStats.skills || [];
                const newSkills = ma.new_skills.filter((n: any) => !currentSkills.find((e: any) => e.name === n.name));
                if (newSkills.length > 0) {
                    currentStats.skills = [...currentSkills, ...newSkills];
                    hasUpdates = true;
                    newSkills.forEach((skill: any) => essentialToast(t.systemMessages?.newArt?.replace('{0}', skill.name) || `신규 스킬 습득: ${skill.name}`, 'success'));
                }
            }

            // Update Existing Skills (Proficiency)
            if (ma.updated_skills && ma.updated_skills.length > 0) {
                const currentSkills = currentStats.skills || [];
                let skillUpdated = false;
                const updatedList = currentSkills.map((skill: any) => {
                    const update = ma.updated_skills.find((u: any) => u.id === skill.id || u.name === skill.name); // Support Name or ID
                    if (update) {
                        skillUpdated = true;
                        // Update Proficiency
                        const newProf = Math.min(100, Math.max(0, (skill.proficiency || 0) + update.proficiency_delta));
                        return { ...skill, proficiency: newProf };
                    }
                    return skill;
                });

                if (skillUpdated) {
                    currentStats.skills = updatedList;
                    hasUpdates = true;
                }
            }

            // 5. Growth Stagnation - Calculated from update existence
            if (hasUpdates) {
                currentStats.growthStagnation = 0;
            } else {
                // Only increment if we actually ran MA logic but got no growth?
                // Rely on external cycle for general stagnation, but here we reset it on growth.
            }

            if (hasUpdates) {
                console.log("[MartialArts] State Updated:", currentStats);
                // Also update top-level playerRealm if a realm update occurred
                if (ma.realm_update) {
                    return { playerStats: currentStats, playerRealm: ma.realm_update };
                }
                return { playerStats: currentStats };
            }
            return {};
        });
    }



    // Mood Update
    if (logicResult.newMood) {
        const currentMood = useGameStore.getState().currentMood;
        if (currentMood !== logicResult.newMood) {
            useGameStore.getState().setMood(logicResult.newMood);
            addToast(t.systemMessages?.moodChanged?.replace('{0}', logicResult.newMood.toUpperCase()) || `Mood Changed: ${logicResult.newMood.toUpperCase()}`, 'info');
            console.log(`Mood changed from ${currentMood} to ${logicResult.newMood}`);
        }
    }

    if (logicResult.activeCharacters) {
        // [Safety] Ensure it's an array (AI might return single string)
        const activeList = Array.isArray(logicResult.activeCharacters)
            ? logicResult.activeCharacters
            : [logicResult.activeCharacters];

        // [Fix] Fuzzy Match & Normalize Logic
        const store = useGameStore.getState();
        const availableChars = store.availableCharacterImages || [];

        // Map AI output names to Valid Image Keys
        const resolvedChars = activeList.map((rawName: string) => {
            // [Clean] Strip emotion suffixes (e.g. "_Anger_Lv1", "_Smile")
            // Assumption: Character ID is the first part before the first underscore acting as a delimiter for emotion
            // BUT: Some IDs actully have underscores (e.g. "jun_seo_yeon"). 
            // Hybrid Strategy:
            const playerName = useGameStore.getState().playerName || 'Player';

            // Use Regex to remove _Emotion or _Lv patterns for cleaning
            // Example: BaekSoYu_Anger_Lv1 -> BaekSoYu
            const cleaned = rawName.replace(/(_[A-Z][a-z]+)+(_Lv\d+)?$/, '');

            // 1. Check if it's the Player (Exact name or Alias)
            const isPlayer = rawName === playerName
                || ['player', 'me', 'i', 'myself', '나', '자신', '플레이어', '본인', '주인공'].includes(cleaned.toLowerCase())
                || cleaned === playerName;

            if (isPlayer) {
                return playerName;
            }

            // 2. Check exact match in assets
            if (availableChars.includes(rawName)) return rawName;

            // Check if cleaned version exists
            // We also need to handle cases like "baek_so_yu" vs "BaekSoYu" -> normalize to lowercase for check

            if (['player', 'me', 'i', 'myself', '나', '자신', '플레이어', '본인'].includes(cleaned.toLowerCase())) {
                return useGameStore.getState().playerName || 'Player';
            }

            // Try fuzzy match on Cleaned Name first
            const matchClean = findBestMatch(cleaned, availableChars);
            if (matchClean) {
                console.log(`[ActiveChar] Cleaned Match: "${rawName}" -> "${cleaned}" -> "${matchClean}"`);
                return matchClean;
            }

            // 3. Fuzzy match against available characters
            const match = findBestMatch(rawName, availableChars);
            if (match) {
                console.log(`[ActiveChar] Fuzzy Request: "${rawName}" -> Resolved: "${match}"`);
                return match;
            }

            return rawName;
        });

        // De-duplicate & Remove Player
        const playerName = useGameStore.getState().playerName || 'Player';
        const uniqueChars = Array.from(new Set(resolvedChars)).filter(c => c !== playerName) as string[];

        useGameStore.getState().setActiveCharacters(uniqueChars);
        console.log("Active Characters Updated:", uniqueChars);
    }

    // [New] Dead Character Processing
    if (logicResult.post_logic?.dead_character_ids) {
        const deadList = logicResult.post_logic.dead_character_ids;
        if (Array.isArray(deadList) && deadList.length > 0) {
            const store = useGameStore.getState();
            deadList.forEach((id: string) => {
                // Prevent duplicates in logic (Store handles it too but safe to check)
                if (!store.deadCharacters?.includes(id)) {
                    if (store.addDeadCharacter) {
                        store.addDeadCharacter(id);
                        addToast(t.systemMessages?.characterDefeated?.replace('{0}', id) || `Character Defeated: ${id}`, 'warning');
                        console.log(`[Death] Character ${id} marked as dead.`);
                    }
                }
            });
        }
    }

    // [NEW] Memory Decay — 만료된 기억 제거
    {
        const store = useGameStore.getState();
        const currentTurn = store.turnCount;
        const charData = store.characterData;
        let totalExpired = 0;

        Object.entries(charData).forEach(([charId, char]) => {
            const memories = (char as any).memories;
            if (!Array.isArray(memories) || memories.length === 0) return;

            const before = memories.length;
            const filtered = memories.filter((m: any) => {
                // string 타입 기억은 소멸 대상 아님 (레거시 호환)
                if (typeof m === 'string') return true;
                // expireAfterTurn이 없거나 null이면 영구 보존
                if (m.expireAfterTurn == null) return true;
                // 만료 여부 체크
                return currentTurn <= m.expireAfterTurn;
            });

            if (filtered.length < before) {
                const expired = before - filtered.length;
                totalExpired += expired;
                useGameStore.getState().updateCharacterData(charId, { memories: filtered });
                console.log(`[Memory Decay] ${charId}: ${expired} memories expired (${before} → ${filtered.length})`);
            }
        });

        if (totalExpired > 0) {
            console.log(`[Memory Decay] Total: ${totalExpired} memories expired this turn.`);
        }
    }

    // [New] Character Memories Update
    // Fix: content is nested in post_logic
    const memorySource = logicResult.post_logic?.character_memories || logicResult.character_memories;

    if (memorySource) {
        console.log("Processing Character Memories:", logicResult.character_memories); // [DEBUG]
        const store = useGameStore.getState();
        const availableChars = store.availableCharacterImages || [];
        const playerStats = store.playerStats;

        Object.entries(memorySource).forEach(([charId, memories]) => {
            if (!Array.isArray(memories) || memories.length === 0) return;

            // Resolve ID (Fuzzy Match + Player Map)
            let targetId = charId;

            // Handle Player Aliases
            if (['player', 'me', 'i', 'myself', '나', '자신', '플레이어', '본인'].includes(charId.toLowerCase())) {
                targetId = useGameStore.getState().playerName || 'Player'; // Use actual player name
            } else {
                // [Fix] Resolve ID against Character Data Keys (Primary) to prevent Phantom Entries
                const dataKeys = Object.keys(store.characterData);

                // 1. Try match against Data Keys first (Name-based)
                let match = findBestMatch(charId, dataKeys);

                // 2. Reverse Lookup via Maps (Asset ID -> Data Key)
                // If the AI output an Asset ID (e.g. "NamgungSeAh") instead of Name ("남궁세아")
                if (!match) {
                    const potentialAssetId = findBestMatch(charId, availableChars) || charId;

                    // Helper to find key for value
                    const findKeyForValue = (map: Record<string, string> | undefined, val: string) => {
                        if (!map) return null;
                        return Object.keys(map).find(key => map[key] === val && dataKeys.includes(key));
                    };

                    // Try characterData direct lookup first (Korean names), then availableExtraImages
                    const charDataMatch = dataKeys.find(k => k === potentialAssetId || k.toLowerCase() === potentialAssetId.toLowerCase());
                    const extraMatch = !charDataMatch ? (store.availableExtraImages || []).find((img: string) => img === potentialAssetId || img.toLowerCase() === potentialAssetId.toLowerCase()) : null;
                    const mappedKey = charDataMatch || extraMatch;

                    if (mappedKey) {
                        match = mappedKey;
                        console.log(`[ID Resolution] Resolved ${charId} -> ${potentialAssetId} -> ${mappedKey}`);
                    }
                }

                // 3. Fallback: Asset ID
                if (!match) {
                    match = findBestMatch(charId, availableChars);
                }

                if (match) targetId = match;
            }

            console.log(`[MemoryUpdate] Adding memory to ${targetId} (raw: ${charId}):`, memories);

            // Update Store
            store.addCharacterMemory(targetId, memories[0]);
            if (memories.length > 1) {
                for (let i = 1; i < memories.length; i++) {
                    store.addCharacterMemory(targetId, memories[i]);
                }
            }

            // [Optimization] Memory Summarization Logic
            // Trigger if memories exceed threshold (12) -> Summarize down to ~10
            const updatedCharData = useGameStore.getState().characterData[targetId];
            const currentMemories = updatedCharData?.memories || [];

            if (currentMemories.length > 12) {
                console.log(`[Memory Limit] ${targetId} has ${currentMemories.length} memories. Triggering Summary...`);
                // activeToast is annoying if it happens too often, maybe just log? 
                // User requested functionality so a toast is good feedback.
                addToast(`${targetId}의 기억을 정리하는 중...`, 'info');

                // Fire-and-forget (don't await) to not block UI
                // Convert (string | TaggedMemory)[] to string[] for summary function
                const plainMemories = currentMemories.map(m => typeof m === 'string' ? m : m.text);
                serverGenerateCharacterMemorySummary(targetId, plainMemories)
                    .then((summarized: string[]) => {
                        if (summarized && Array.isArray(summarized) && summarized.length > 0) {
                            console.log(`[Memory Summary] ${targetId}: ${currentMemories.length} -> ${summarized.length}`);
                            // Verify we actually reduced it or at least didn't break it
                            if (summarized.length < currentMemories.length) {
                                useGameStore.getState().updateCharacterData(targetId, { memories: summarized });
                                addToast(`${targetId}의 중요한 기억만 남겼습니다.`, 'success');
                            }
                        }
                    })
                    .catch(err => console.error(`[Memory Summary Failed] ${targetId}`, err));
            }
        });
    }

    // [New] Status & Personality Description Updates (Natural Language)
    if (logicResult.statusDescription) {
        useGameStore.getState().setStatusDescription(logicResult.statusDescription);
    }
    if (logicResult.personalityDescription) {
        useGameStore.getState().setPersonalityDescription(logicResult.personalityDescription);
    }

    // [New] Event System Check
    // Check events based on the NEW stats
    const { mandatory: triggeredEvents } = EventManager.checkEvents({
        ...useGameStore.getState(),
        playerStats: newStats // Use the updated stats for checking
    });

    // [CRITICAL FIX] Merge Server-Side Logic Events with Client-Side triggers
    // If Logic Model explicitly returned a 'triggerEventId' and 'currentEvent' prompt, we MUST process it.
    // This fixes the issue where 'wuxia_intro' (triggered by LLM) was ignored by client.

    let activeEventPrompt = '';
    let hasActiveEvent = false;

    // 1. Prioritize Server-Side Event (Narrative Logic)
    // 1. Prioritize Server-Side Event (Narrative Logic)
    if (logicResult.triggerEventId) { // [Fix] Removed check for .currentEvent which is usually null
        console.log(`[Validating Logic] Server triggered event ID: ${logicResult.triggerEventId}`);

        // Lookup the event prompt from the Store
        const storedEvents = useGameStore.getState().events || [];
        const matchedEvent = storedEvents.find((e: any) => e.id === logicResult.triggerEventId);

        if (matchedEvent) {
            // Add to triggered list (so it doesn't trigger again if 'once')
            useGameStore.getState().addTriggeredEvent(logicResult.triggerEventId);

            // Set as current prompt
            activeEventPrompt = matchedEvent.prompt;
            hasActiveEvent = matchedEvent.id; // Store ID as truthy value

            addToast(t.systemMessages?.eventTriggered?.replace('{0}', matchedEvent.id) || `Event Triggered: ${matchedEvent.id}`, 'info');

            // [CRITICAL] Persist Active Event for Next Turn's Context
            useGameStore.getState().setActiveEvent(matchedEvent);

            console.log(`[Event Found] Prompt Length: ${matchedEvent.prompt.length}`);
        } else {
            console.warn(`[Logic Warning] Triggered ID '${logicResult.triggerEventId}' not found in Client Event Registry.`);

            // [Fix] Even if local definition is missing, we must record that this ID triggered
            // to prevent loop if the Server keeps suggesting it.
            useGameStore.getState().addTriggeredEvent(logicResult.triggerEventId);

            // [Fallback] Construct Event from Server Data
            if (logicResult.currentEvent) {
                console.log(`[Fallback] Using Server-provided Event Prompt for '${logicResult.triggerEventId}'`);
                const syntheticEvent = {
                    id: logicResult.triggerEventId,
                    title: logicResult.triggerEventId, // Fallback title
                    prompt: logicResult.currentEvent,
                    type: logicResult.type || 'SERVER_EVENT',
                    priority: 100
                };

                useGameStore.getState().setActiveEvent(syntheticEvent);
                activeEventPrompt = syntheticEvent.prompt;
                hasActiveEvent = syntheticEvent.id;

                addToast(t.systemMessages?.eventTriggered?.replace('{0}', syntheticEvent.id) || `Event Triggered: ${syntheticEvent.id}`, 'info');
            }
        }
    }


    // [Event System Refactor] PreLogic determines Event Lifecycle
    // Instead of auto-clearing, we listen to the AI's judgment.
    // 'active': Keep event / 'completed' or 'ignored': Clear event.
    if (logicResult.logic && (logicResult.logic.event_status === 'completed' || logicResult.logic.event_status === 'ignored')) {
        const currentActiveEvent = useGameStore.getState().activeEvent;
        if (currentActiveEvent) {
            console.log(`[Event System] PreLogic signaled '${logicResult.logic.event_status}'. Clearing Active Event: ${currentActiveEvent.id}`);
            addToast(`Event Resolved: ${currentActiveEvent.title || currentActiveEvent.id}`, 'info');
            useGameStore.getState().setActiveEvent(null);
        }
    }

    // 2. Client-Side Stat Events (e.g. Low HP, Injuries)
    if (triggeredEvents.length > 0) {
        console.log("Client Events Triggered:", triggeredEvents.map(e => e.id));

        triggeredEvents.forEach(event => {
            // If it's the SAME event as server (duplicate), skip adding prompt again
            if (event.id === logicResult.triggerEventId) return;

            if (event.once) {
                useGameStore.getState().addTriggeredEvent(event.id);
            }

            // Append prompt
            activeEventPrompt += (activeEventPrompt ? '\n\n' : '') + event.prompt;
            hasActiveEvent = true;
        });

        if (!logicResult.triggerEventId) {
            addToast(t.systemMessages?.eventsTriggered?.replace('{0}', triggeredEvents.length.toString()) || `${triggeredEvents.length} Event(s) Triggered`, 'info');
        }
    }

    if (hasActiveEvent) {
        console.log(`[VisualNovelUI] Setting Current Event Prompt (Length: ${activeEventPrompt.length})`);
        useGameStore.getState().setCurrentEvent(activeEventPrompt);
        // Optionally set active event object if needed for UI, prioritizing Server one if available
        // For now, just ensuring the PROMPT is set is key for the Story Model.
    } else {
        // Clear active event if none triggered
        useGameStore.getState().setActiveEvent(null);
        useGameStore.getState().setCurrentEvent('');
    }
}
