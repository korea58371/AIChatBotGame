import { GAME_EVENTS, GameEvent } from '@/data/events';

export class EventManager {
    /**
     * Checks all events against the current game state and triggers the highest priority one.
     * @param state The full Game State (from Zustand)
     * @returns The GameEvent to trigger, or null if none.
     */
    static checkEvents(state: any): GameEvent | null {
        if (!state) return null;

        // Sort events by priority (High -> Low)
        const sortedEvents = [...GAME_EVENTS].sort((a, b) => b.priority - a.priority);

        for (const event of sortedEvents) {
            // 1. Check if already triggered (if 'once' is true)
            if (event.once && state.triggeredEvents && state.triggeredEvents.includes(event.id)) {
                continue;
            }

            // 2. Evaluate Condition
            try {
                const isConditionMet = event.condition(state);
                console.log(`[EventManager] Checking ${event.id}: Condition=${isConditionMet} (Turn: ${state.turnCount}, Rank: ${state.playerStats?.playerRank})`);

                if (isConditionMet) {
                    console.log(`[EventManager] Event Triggered: ${event.id}`);
                    return event;
                }
            } catch (err) {
                console.error(`[EventManager] Error evaluating event ${event.id}:`, err);
            }
        }

        return null;
    }
}
