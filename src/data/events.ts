
export interface GameEvent {
    id: string; // Unique ID
    condition: (state: any) => boolean; // access to full state
    priority: number; // Higher checks first.
    prompt: string; // The instruction to inject into the system prompt
    type: 'narrative' | 'system';
    once: boolean; // If true, only triggers once
}

export const GAME_EVENTS: GameEvent[] = [
    {
        id: 'awakening_f_rank',
        priority: 100,
        type: 'narrative',
        once: true,
        condition: (state) => {
            // Trigger when player has no rank (initial) but stats suggest potential? 
            // OR simply trigger at start if not yet triggered?
            // For now, let's say if turn count > 1 and rank is still default/low, force awareness
            // Or simpler: If "Fame" > 0 or specific item acquired?

            // User request context: "F급 기프트 처세술 각성"
            // Let's make it trigger when the user first gains a specific "Insight" or "Stress"
            // For now, let's trigger it if the user has < 100 gold and Turn > 3 (Desperation)
            return state.turnCount >= 3 && state.playerStats.rank === '일반인';
        },
        prompt: `
        ## [🔥 EVENT: Awakening of the F-Class]
        **NARRATIVE INSTRUCTION**: 
        The protagonist is currently an ordinary person ("일반인"), but fate has intercepted.
        Describe the sudden awakening of the **F-Class Gift: 'Art of Living' (처세술)**.
        
        - Symptoms: A sudden electric shock in the brain, data streaming before eyes.
        - Effect: He can now instinctively sense the "Needs" and "Moods" of others (Described as a game UI to him).
        - Emotional Tone: Confusion mixed with a strange sense of clarity.
        
        **Constraint**: Make this the focus of the current turn's output.
        `
    },
    {
        id: 'poverty_strike',
        priority: 50,
        type: 'narrative',
        once: true,
        condition: (state) => state.playerStats.gold <= 0 && state.turnCount > 5,
        prompt: `
        ## [😢 EVENT: Reality Check]
        **NARRATIVE INSTRUCTION**:
        The protagonist's wallet is completely empty (0 Gold).
        Describe a humiliating or desperate moment due to this poverty.
        (e.g., Stomach growling loudly in public, unable to buy a cheap drink, or getting a loan offer text).
        Emphasize the contrast between the "Awakened World" and his "Empty Wallet".
        `
    }
];
