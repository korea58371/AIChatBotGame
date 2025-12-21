

export interface GameEvent {
    id: string; // Unique ID
    condition: (state: any) => boolean; // access to full state
    priority: number; // Higher checks first.
    prompt: string; // The instruction to inject into the system prompt
    type: 'narrative' | 'system';
    once: boolean; // If true, only triggers once
}

export class EventManager {
    /**
     * Checks all events against the current game state and triggers the highest priority one.
     * @param state The full Game State (from Zustand)
     * @returns The GameEvent to trigger, or null if none.
     */
    static checkEvents(state: any): GameEvent[] {
        if (!state || !state.events) return [];

        const triggeredEvents: GameEvent[] = [];

        // Sort events by priority (High -> Low)
        const sortedEvents = [...state.events].sort((a: any, b: any) => b.priority - a.priority);

        for (const event of sortedEvents) {
            // 1. Check if already triggered (if 'once' is true)
            if (event.once && state.triggeredEvents && state.triggeredEvents.includes(event.id)) {
                continue;
            }

            // 2. Evaluate Condition
            try {
                const isConditionMet = event.condition(state);
                // console.log(`[EventManager] Checking ${event.id}: Condition=${isConditionMet}`);

                if (isConditionMet) {
                    console.log(`[EventManager] Event Triggered: ${event.id}`);
                    triggeredEvents.push(event);
                }
            } catch (err) {
                console.error(`[EventManager] Error evaluating event ${event.id}:`, err);
            }
        }

        return triggeredEvents;
    }
}
