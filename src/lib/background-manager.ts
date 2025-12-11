import stringSimilarity from 'string-similarity';
import bgList from '../data/background_list.json';
import { backgroundMappings } from '../data/backgroundMappings';

// Ensure bgList is a string array (it should be valid from the JSON)
const backgroundFiles: string[] = bgList as string[];

/**
 * Resolves an AI background tag to the most similar filename in the assets folder.
 * Strategy:
 * 1. Direct Mapping (Korean/Alias -> Filename)
 * 2. Fuzzy Mapping (Fuzzy Alias -> Filename)
 * 3. Fuzzy Filename (Fuzzy Keyword -> Actual Filename)
 * 4. Fallback (Default_Fallback.png)
 * 
 * @param tag The tag from AI, e.g., "<배경>City_Street"
 * @returns The resolved absolute path, e.g., "/assets/backgrounds/City_Street.jpg"
 */
export function resolveBackground(tag: string): string {
    // 1. Clean the tag: Remove <배경>, </배경>, whitespace
    const query = tag.replace(/<배경>|<\/배경>/g, '').trim();

    if (!query) return '/assets/backgrounds/Home_Entrance.jpg'; // Fallback if empty

    console.log(`[BackgroundManager] Resolving: "${query}"`);

    // ---------------------------------------------------------
    // STRATEGY 1: Direct Mapping (Fast & Exact)
    // ---------------------------------------------------------
    if (backgroundMappings[query]) {
        console.log(`[BackgroundManager] Direct Match: "${query}" -> "${backgroundMappings[query]}"`);
        return `/assets/backgrounds/${backgroundMappings[query]}`;
    }

    // ---------------------------------------------------------
    // STRATEGY 2: Fuzzy Mapping (Match against Keys of Mapping)
    // ---------------------------------------------------------
    // Useful if AI says "반지하방" instead of "반지하"
    const mappingKeys = Object.keys(backgroundMappings);
    const keyMatches = stringSimilarity.findBestMatch(query, mappingKeys);

    if (keyMatches.bestMatch.rating > 0.6) { // High confidence for aliases
        const mappedFile = backgroundMappings[keyMatches.bestMatch.target];
        console.log(`[BackgroundManager] Fuzzy Alias Match: "${query}" -> "${keyMatches.bestMatch.target}" -> "${mappedFile}"`);
        return `/assets/backgrounds/${mappedFile}`;
    }

    // ---------------------------------------------------------
    // STRATEGY 2.5: Category-First Fuzzy Matching (Hierarchical Search)
    // ---------------------------------------------------------
    // If input is "City_Something", prioritize files starting with "City_"
    const parts = query.split('_');
    if (parts.length > 1) {
        const category = parts[0];
        // Filter files that start with this category
        const categoryFiles = backgroundFiles.filter(f => f.toLowerCase().startsWith(category.toLowerCase() + '_'));

        if (categoryFiles.length > 0) {
            console.log(`[BackgroundManager] Category Match Found: "${category}" (${categoryFiles.length} files)`);
            const subMatch = stringSimilarity.findBestMatch(query, categoryFiles);
            // Heightened threshold (0.3 -> 0.55) to prevent "City_Sewer" matching "City_Street" randomly
            if (subMatch.bestMatch.rating > 0.55) {
                console.log(`[BackgroundManager] Category-Constrained Match: "${query}" -> "${subMatch.bestMatch.target}"`);
                return `/assets/backgrounds/${subMatch.bestMatch.target}`;
            }
        }
    }

    // ---------------------------------------------------------
    // STRATEGY 3: Global Fuzzy Filename (Match against actual files)
    // ---------------------------------------------------------
    const fileMatches = stringSimilarity.findBestMatch(query, backgroundFiles);
    const bestFileMatch = fileMatches.bestMatch;

    console.log(`[BackgroundManager] Fuzzy File Match: "${query}" -> "${bestFileMatch.target}" (Score: ${bestFileMatch.rating.toFixed(2)})`);

    // Threshold increased (0.5 -> 0.6) to avoid generic inputs matching specific unrelated files
    if (bestFileMatch.rating > 0.6) {
        return `/assets/backgrounds/${bestFileMatch.target}`;
    }

    // ---------------------------------------------------------
    // STRATEGY 4: Strict Fallback (Immersion Preservation)
    // ---------------------------------------------------------
    // User preference: "Better to have NO background than a WRONG one."
    console.warn(`[BackgroundManager] No good match for "${query}". Returning empty (Black Screen).`);
    return '';
}
