
// Simple manual mock for reproduction
const mockState = {
    backgroundMappings: {
        "남만_객잔_마구간": "Inn_Stable.jpg"
    },
    availableBackgrounds: ["Inn_Stable.jpg"],
    activeGameId: 'wuxia'
};

// Mock the background manager logic directly since we can't easily deep import with mocks in ts-node without setup
function resolveBackground(tag: string): string {
    const backgroundMappings = mockState.backgroundMappings as Record<string, string>;
    const basePath = `/assets/wuxia/backgrounds`;

    if (tag.startsWith('/assets/') || tag.startsWith('http')) return tag;
    // [Fix Applied Mock] Added replace(/['"]/g, '')
    const query = tag.replace(/<배경>|<\/배경>/g, '').replace(/['"]/g, '').trim();
    if (!query) return `${basePath}/Default_Fallback.jpg`;

    // 1. Direct Match
    if (backgroundMappings[query]) {
        console.log(`[Result] Direct Match: "${query}" -> "${backgroundMappings[query]}"`);
        return `${basePath}/${backgroundMappings[query]}`;
    }

    // 2. Mock Fallback Logic (simplified from actual file)
    console.log(`[Result] Fallback (No Match): "${query}"`);
    return `${basePath}/Default_Fallback.jpg`;
}

async function runSimulation() {
    console.log("--- Simulating Streaming Background Resolution (With Quotes) ---");

    // Case 1: Quotes
    const fullTag = `"남만_객잔_마구간"`;
    console.log(`Testing Quote Handling: Input = ${fullTag}`);

    // Simulate full tag resolution
    const result = resolveBackground(fullTag);
    console.log(`Resolved: ${result}`);
}

runSimulation();
