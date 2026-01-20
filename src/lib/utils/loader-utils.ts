
/**
 * Utility functions for normalizing game data during the loading process.
 * Standardizes Logic between Wuxia (Hierarchy-heavy) and GBY (Flat structure).
 */

/**
 * Merges multiple character sources (Array or Dictionary) into a single normalized dictionary.
 * Applies name sanitization (removes brackets like '(Chinese)').
 * Priority: Later sources overwrite earlier ones.
 */
export function mergeCharacters(...sources: any[]): Record<string, any> {
    const finalDict: Record<string, any> = {};

    sources.forEach(source => {
        if (!source) return;

        // Case 1: Array of Character Objects
        if (Array.isArray(source)) {
            source.forEach(char => {
                const rawName = char.name || (char.profile && char.profile['이름']);
                if (rawName) {
                    const cleanName = sanitizeName(rawName);
                    finalDict[cleanName] = { ...char, name: cleanName };
                }
            });
        }
        // Case 2: Dictionary (Key: Character Object)
        else if (typeof source === 'object') {
            Object.entries(source).forEach(([key, val]) => {
                // If val is just true/false or null, skip (bad data)
                if (!val || typeof val !== 'object') return;

                // Determine name from Key or Internal Name props
                const charData = { ...(val as any) };

                // If name is missing, use Key
                if (!charData.name) {
                    charData.name = key;
                }

                const cleanName = sanitizeName(charData.name);
                finalDict[cleanName] = { ...charData, name: cleanName };
            });
        }
    });

    return finalDict;
}

/**
 * Removes typical metadata brackets from names.
 * e.g., "Jang Wuji (Chinese)" -> "Jang Wuji"
 */
function sanitizeName(name: string): string {
    if (!name) return "";
    return name.split('(')[0].trim();
}

/**
 * Flattens a Hierarchical Map Data structure (Regions -> Zones -> Spots)
 * into a flat dictionary expected by the Engine (world.locations).
 * 
 * Target Output Format:
 * {
 *   "ZoneName": { description: "Zone Desc..." },
 *   "SpotName": { description: "Region Desc + Zone Desc + Spot Name..." }
 * }
 */
export function flattenMapData(regions: Record<string, any> | undefined): Record<string, any> {
    const flatLocations: Record<string, any> = {};

    if (!regions) return flatLocations;

    const addLoc = (key: string, data: any) => {
        if (key && !flatLocations[key]) {
            flatLocations[key] = data;
        } else if (key && flatLocations[key]) {
            // MERGE if exists (Optional, mostly we just blindly add or skip)
            flatLocations[key] = { ...flatLocations[key], ...data };
        }
    };

    const processRegion = (regionKey: string, regionData: any) => {
        if (!regionData) return;

        // Add Region itself (Optional, usually regions are just containers, but valid locations too)
        addLoc(regionKey, {
            description: regionData.description || `${regionKey} Region`,
            type: 'region',
            ...regionData // Expand other metadata
        });

        // Zones
        if (regionData.zones) {
            Object.entries(regionData.zones).forEach(([zoneKey, zoneVal]: [string, any]) => {
                const zoneDesc = zoneVal.description || zoneVal.content || `${zoneKey}`;

                addLoc(zoneKey, {
                    description: zoneDesc,
                    type: 'zone',
                    parent: regionKey,
                    ...zoneVal
                });

                // Spots
                if (zoneVal.spots) {
                    // Spot can be string[] or object[]
                    if (Array.isArray(zoneVal.spots)) {
                        zoneVal.spots.forEach((spot: any) => {
                            if (typeof spot === 'string') {
                                addLoc(spot, {
                                    description: `${zoneKey} 내부의 장소`,
                                    type: 'spot',
                                    parent: zoneKey
                                });
                            } else if (typeof spot === 'object') {
                                const spotName = spot.name || spot.id;
                                if (spotName) {
                                    addLoc(spotName, {
                                        description: spot.description || `${zoneKey} 내부의 장소`,
                                        type: 'spot',
                                        parent: zoneKey,
                                        ...spot
                                    });
                                }
                            }
                        });
                    }
                }
            });
        }
    };

    // Iterate all top-level keys as potential regions
    Object.entries(regions).forEach(([key, val]) => {
        processRegion(key, val);
    });

    return flatLocations;
}
