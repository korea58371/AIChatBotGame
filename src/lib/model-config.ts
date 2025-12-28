export const MODEL_CONFIG = {
    STORY: 'gemini-3-pro-preview', // Main Story (Synced with Cache)
    LOGIC: 'gemini-2.5-flash',       // Game Logic (Fast, JSON)
    SUMMARY: 'gemini-2.5-flash'      // Summarization (Cheap)
};

// Pricing Rates (Per 1M Tokens)
export const PRICING_RATES: { [key: string]: { input: number, output: number } } = {
    'gemini-2.0-flash-thinking-exp-1219': { input: 0.075, output: 0.30 },
    'gemini-3-flash-preview': { input: 0.075, output: 0.30 },
    'gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'gemini-3-pro-preview': { input: 1.25, output: 5.00 }
};

export function calculateCost(modelName: string, inputTokens: number, outputTokens: number): number {
    const rate = PRICING_RATES[modelName] || PRICING_RATES['gemini-2.5-flash']; // Default to Flash pricing if unknown
    const inputCost = (inputTokens / 1_000_000) * rate.input;
    const outputCost = (outputTokens / 1_000_000) * rate.output;
    return inputCost + outputCost;
}
