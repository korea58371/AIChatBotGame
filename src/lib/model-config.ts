export const MODEL_CONFIG = {
    STORY: 'gemini-3-pro-preview', // Main Story (Synced with Cache)
    LOGIC: 'gemini-2.5-flash',       // Game Logic (Fast, JSON)
    SUMMARY: 'gemini-2.5-flash',      // Summarization (Cheap)
    ROUTER: 'gemini-2.5-flash-lite',       // [NEW] Intent Classification
    PRE_LOGIC: 'gemini-2.5-flash'     // [NEW] Adjudication & Dice Rolls
};

// Pricing Rates (Per 1M Tokens)
// Pricing Rates (Per 1M Tokens)
// Pricing Rates (Per 1M Tokens)
export const PRICING_RATES: { [key: string]: { input: number, output: number, cached?: number } } = {
    // Gemini 3 Series
    'gemini-3-pro-preview': { input: 2.00, output: 12.00, cached: 0.50 }, // Heuristic: 25% of input? Or less? Gemini 1.5 logic. Input $2.00.
    'gemini-3-flash-preview': { input: 0.50, output: 3.00, cached: 0.125 }, // Input $0.50.

    // Gemini 2.5 Series
    'gemini-2.5-pro': { input: 1.25, output: 10.00, cached: 0.3125 },
    'gemini-2.5-flash': { input: 0.30, output: 2.50, cached: 0.075 },
    'gemini-2.5-flash-lite': { input: 0.10, output: 0.40, cached: 0.025 },

    // Gemini 2.0 Series
    'gemini-2.0-flash': { input: 0.10, output: 0.40, cached: 0.025 },
    'gemini-2.0-flash-lite': { input: 0.075, output: 0.30, cached: 0.018 },

    // Legacy / Experimental
    'gemini-2.0-flash-thinking-exp-1219': { input: 0.10, output: 0.40 },
};

export function calculateCost(modelName: string, inputTokens: number, outputTokens: number, cachedTokens: number = 0): number {
    const rate = PRICING_RATES[modelName] || PRICING_RATES['gemini-2.5-flash']; // Default to Flash pricing if unknown

    // Usage Metadata 'promptTokenCount' INCLUDES 'cachedContentTokenCount'
    // So Fresh Input = promptTokenCount - cachedTokens
    const freshInputTokens = Math.max(0, inputTokens - cachedTokens);

    const inputCost = (freshInputTokens / 1_000_000) * rate.input;
    const outputCost = (outputTokens / 1_000_000) * rate.output;

    // Calculate Cached Cost (if supported)
    const cachedRate = rate.cached ?? (rate.input * 0.25); // Default to 25% of input if not specified
    const cachedCost = (cachedTokens / 1_000_000) * cachedRate;

    return inputCost + outputCost + cachedCost;
}
