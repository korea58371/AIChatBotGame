
const locations = require('../src/data/games/wuxia/jsons/locations.json');

function resolveLocationHierarchy(locName: string): string[] {
    if (!locName) return [];

    // 0. Tokenize (Split by space, _, >)
    const tokens = locName.split(/[\s_>]+/).filter(Boolean);
    if (tokens.length === 0) return [locName];

    // 1. ANCHOR: Find explicit Region first
    const regionKeys = Object.keys(locations.regions);
    let matchedRegionKey: string | null = null;

    for (const token of tokens) {
        if (regionKeys.includes(token)) {
            matchedRegionKey = token;
            break;
        }
    }

    // 2. Strict Check: If no Region found, fail (return raw)
    if (!matchedRegionKey) {
        return [locName];
    }

    // 3. Search within the matched Region
    const regionVal = locations.regions[matchedRegionKey];
    if (regionVal.zones) {
        for (const [zKey, zVal] of Object.entries(regionVal.zones)) {
            // Check if ANY token matches Zone
            if (tokens.includes(zKey)) {
                // Check if ANY token matches Spot in this Zone
                const zoneData = zVal as any;
                if (zoneData.spots && Array.isArray(zoneData.spots)) {
                    for (const spot of zoneData.spots) {
                        if (tokens.includes(spot)) {
                            return [matchedRegionKey, zKey, spot]; // Fully Resolved
                        }
                    }
                }
                return [matchedRegionKey, zKey]; // Zone Resolved
            }

            // Also check spots directly under Zone even if Zone name isn't in tokens?
            // Logic: "Henan Cave" -> [Henan, Mountain, Cave]. 
            // "Cave" is in "Mountain" zone. 
            // We need to check spots of ALL zones in this region if Zone name is not explicit?
            // Let's iterate all zones to find spot match if strictly searching.
        }

        // Deep Search for Spot if Zone not explicitly named
        for (const [zKey, zVal] of Object.entries(regionVal.zones)) {
            const zoneData = zVal as any;
            if (zoneData.spots && Array.isArray(zoneData.spots)) {
                for (const spot of zoneData.spots) {
                    if (tokens.includes(spot)) {
                        return [matchedRegionKey, zKey, spot]; // Spot Resolved (Implicit Zone)
                    }
                }
            }
        }
    }

    return [matchedRegionKey]; // Only Region Resolved
}

console.log("Testing '하남 동굴' (Expected: [하남, 산, 동굴])...");
console.log("Result:", resolveLocationHierarchy("하남 동굴"));

console.log("\nTesting '하남_동굴' (Expected: [하남, 산, 동굴])...");
console.log("Result:", resolveLocationHierarchy("하남_동굴"));

console.log("\nTesting '동굴' (Expected: [동굴] - Ambiguous Fail)...");
console.log("Result:", resolveLocationHierarchy("동굴"));

console.log("\nTesting '안휘 동굴' (Expected: [안휘, 산, 동굴])...");
console.log("Result:", resolveLocationHierarchy("안휘 동굴"));

