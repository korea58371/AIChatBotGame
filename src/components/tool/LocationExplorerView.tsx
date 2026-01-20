import React, { useState, useEffect, useMemo } from 'react';
import { Map as MapIcon, ChevronRight, ChevronDown, MapPin, Users, Building, Home, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LocationExplorerViewProps {
    gameId: string;
    allCharacters: Record<string, any>;
    locations: any;
    backgrounds?: string[];
}

type LocationNode = {
    name: string;
    type: 'region' | 'zone' | 'spot';
    data?: any;
    children?: LocationNode[];
    path: string[];
};

export default function LocationExplorerView({ gameId, allCharacters, locations, backgrounds = [] }: LocationExplorerViewProps) {
    const [selectedNode, setSelectedNode] = useState<LocationNode | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // Build Logic Tree
    const treeData = useMemo(() => {
        if (!locations) return [];
        const regions = locations.regions || {};
        return Object.entries(regions).map(([rName, rData]: [string, any]) => ({
            name: rName,
            type: 'region',
            data: rData,
            path: [rName],
            children: Object.entries(rData.zones || {}).map(([zName, zData]: [string, any]) => ({
                name: zName,
                type: 'zone',
                data: zData,
                path: [rName, zName],
                children: (zData.spots || []).map((spot: string) => ({
                    name: spot,
                    type: 'spot',
                    data: { description: spot }, // Spots are just strings usually
                    path: [rName, zName, spot]
                }))
            }))
        }));
    }, [locations]);

    // Helper: Map location names to their hierarchy paths for fast scoring
    const nameToPath = useMemo(() => {
        const map = new Map<any, any>() as Map<string, string[]>;
        const traverse = (node: any) => {
            map.set(node.name, node.path);
            if (node.children) node.children.forEach(traverse);
        };
        treeData.forEach(traverse);
        return map;
    }, [treeData]);

    const OUTER_REGIONS = useMemo(() => new Set(["북해", "남만", "서장", "동영", "몽골", "요동"]), []);

    // Helper: Safely extract location string
    const getSafeLoc = (char: any): string => {
        const raw = char.profile?.['활동지역'] || char['활동지역'] || char.activity_region;
        if (Array.isArray(raw)) return raw.join(", "); // Handle array case
        return (raw || "").toString(); // Handle string/other
    };

    // Helper: Resolve Best Path from Loc + Tags
    // Returns { path: string[], source: 'loc' | 'tag' | null }
    const resolveBestPath = (char: any, nameToPathMap: Map<string, string[]>) => {
        const locRaw = getSafeLoc(char).trim();
        const tags = char.system_logic?.tags || [];

        const candidates: { path: string[], source: 'loc' | 'tag', priority: number }[] = [];

        // 1. Check Loc (Tokenized)
        if (locRaw) {
            // Split by comma or slash to handle "Region, Zone" or "Region/Zone"
            const tokens = locRaw.split(/[,\/]/).map(s => s.trim());

            tokens.forEach(token => {
                if (nameToPathMap.has(token)) {
                    // Exact Token Match (Highest Priority)
                    candidates.push({ path: nameToPathMap.get(token)!, source: 'loc', priority: 3 });
                } else {
                    // Partial Match Scan
                    for (const [key, p] of nameToPathMap.entries()) {
                        if (token.includes(key)) {
                            candidates.push({ path: p, source: 'loc', priority: 2 });
                        }
                    }
                }
            });

            // Fallback: If no tokens matched, check full string key scan
            if (candidates.length === 0) {
                for (const [key, p] of nameToPathMap.entries()) {
                    if (locRaw.includes(key)) {
                        candidates.push({ path: p, source: 'loc', priority: 1 });
                    }
                }
            }
        }

        // 2. Check Tags
        tags.forEach((tag: string) => {
            if (nameToPathMap.has(tag)) {
                candidates.push({ path: nameToPathMap.get(tag)!, source: 'tag', priority: 3 });
            } else {
                for (const [key, p] of nameToPathMap.entries()) {
                    if (tag.includes(key)) {
                        candidates.push({ path: p, source: 'tag', priority: 2 });
                    }
                }
            }
        });

        // 3. Find Best
        // Sort by Priority DESC, then Path Length DESC
        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                if (b.priority !== a.priority) return b.priority - a.priority;
                return b.path.length - a.path.length;
            });
            return candidates[0];
        }
        return null;
    };

    // Calculate Counts (Memoized)
    const nodeCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (!allCharacters) return counts;

        Object.values(allCharacters).forEach(char => {
            const loc = getSafeLoc(char).trim();
            const bestMatch = resolveBestPath(char, nameToPath);

            // 1. Increment Best Path
            if (bestMatch) {
                let currentPath: string[] = [];
                bestMatch.path.forEach(nodeName => {
                    currentPath.push(nodeName);
                    const key = currentPath.join(">");
                    counts.set(key, (counts.get(key) || 0) + 1);
                });
            }

            // 2. Wildcard Match (Central Plains) -> Add to ALL Inner Regions
            if (loc.includes("중원") || loc.includes("강호") || loc.includes("전역")) {
                treeData.forEach((region: any) => {
                    if (!OUTER_REGIONS.has(region.name)) {
                        const key = region.name;
                        counts.set(key, (counts.get(key) || 0) + 1);
                    }
                });
            }
        });
        return counts;
    }, [allCharacters, nameToPath, treeData, OUTER_REGIONS]);

    // Find Residents
    const residents = useMemo(() => {
        if (!selectedNode || !allCharacters) return [];
        const nodeName = selectedNode.name;

        // Helper: Collect all names in the selected subtree
        const subtreeNames = new Set<string>();
        const collectNames = (node: LocationNode) => {
            subtreeNames.add(node.name);
            if (node.children) {
                node.children.forEach(collectNames);
            }
        };
        collectNames(selectedNode);

        // Also add generic fallback to top-level set (e.g. if node is 'Shaanxi', add 'Shaanxi')
        const validLocationTerms = Array.from(subtreeNames);

        return Object.entries(allCharacters).filter(([id, char]) => {
            // Robust Accessor
            const loc = getSafeLoc(char).trim();
            const tags = char.system_logic?.tags || [];

            // Check if Character's location string matches ANY name in the current subtree
            const isLocationMatch = validLocationTerms.some(t => loc.includes(t));


            // Tag Fallback
            const isTagMatch = tags.some((t: string) => validLocationTerms.some(vt => t.includes(vt)));

            // Wildcard Match: "Central Plains" (중원/강호) -> Matches any INNER region
            // Restriction: Wildcard only matches at Region Level
            let isWildcardMatch = false;

            if (selectedNode.type === 'region' && (loc.includes("중원") || loc.includes("강호") || loc.includes("전역"))) {
                const rootRegion = selectedNode.path[0];
                if (!OUTER_REGIONS.has(rootRegion)) {
                    isWildcardMatch = true;
                }
            }

            return isLocationMatch || isTagMatch || isWildcardMatch;
        }).map(([id, char]) => {
            const loc = getSafeLoc(char).trim();
            const bestMatch = resolveBestPath(char, nameToPath);

            // Determine Display Location
            // If loc is generic wildcard but we found a specific tag match, show the tag match
            let displayLoc = loc;
            const isGeneric = (loc.includes("중원") || loc.includes("강호") || loc.includes("전역"));

            if (bestMatch && isGeneric) {
                // Show specific path derived from tags
                displayLoc = bestMatch.path.join(" > ");
            } else if (bestMatch && bestMatch.source === 'tag' && !loc) {
                displayLoc = bestMatch.path.join(" > ");
            }

            // Calculate Score based on Path Intersection
            let charPath: string[] = bestMatch ? bestMatch.path : [];

            // Backup: if resolveBestPath failed for some reason on loc matching (e.g. partials logic diff), try simple nameToPath
            if (!charPath.length && nameToPath.has(loc)) {
                charPath = nameToPath.get(loc) || [];
            }

            // Intersect with Selected Node Path
            const selectedPath = selectedNode.path;
            let matchDepth = 0;
            const maxDepth = Math.min(selectedPath.length, charPath.length);
            for (let i = 0; i < maxDepth; i++) {
                if (selectedPath[i] === charPath[i]) {
                    matchDepth++;
                } else {
                    break;
                }
            }

            // Score = Depth * 30
            let score = matchDepth * 30;

            // Apply Wildcard Bonus if no specific match but is in Central Plains
            if (score < 10 && (loc.includes("중원") || loc.includes("강호") || loc.includes("전역"))) {
                // Double check outer region again (though filter handles it, good for score safety)
                const rootRegion = selectedNode.path[0];
                if (!OUTER_REGIONS.has(rootRegion) && selectedNode.type === 'region') { // Penalty Logic + Type Check
                    score = Math.max(score, 10); // Treat as Wide Area Match (+10)
                }
            }

            return { id, ...char, name: id, score, displayLoc };
        }).filter((c: any) => c.score > 0) // Filter out 0-score matches (Ambiguous name collisions)
            .sort((a: any, b: any) => b.score - a.score); // Sort by score
    }, [selectedNode, allCharacters, nameToPath, OUTER_REGIONS]);


    // Toggle Expand
    const toggleExpand = (id: string, node: LocationNode) => {
        const newSet = new Set(expanded);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpanded(newSet);
        setSelectedNode(node);
    };

    // Find Matching Images
    const matchingImages = useMemo(() => {
        if (!selectedNode || !backgrounds) return [];
        // Use the shared helper to find matches
        return getMatchingImagesForNode(selectedNode, backgrounds);
    }, [selectedNode, backgrounds]);

    if (!locations) return <div className="text-white/50 p-10 flex justify-center">Loading World Map...</div>;

    return (
        <div className="flex h-full bg-[#0a0a0a]">
            {/* Left: Tree Explorer - Resized to 25% (w-1/4) */}
            <div className="w-1/4 border-r border-white/10 overflow-y-auto p-4 custom-scrollbar flex-shrink-0">
                <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <MapIcon className="w-4 h-4" /> Regions & Zones
                </h3>
                <div className="space-y-1">
                    {treeData.map((region: any) => (
                        <TreeNode
                            key={region.name}
                            node={region}
                            level={0}
                            expanded={expanded}
                            onToggle={toggleExpand}
                            selected={selectedNode?.name === region.name}
                            counts={nodeCounts}
                            backgrounds={backgrounds}
                        />
                    ))}
                </div>
            </div>

            {/* Right: Detail View - Resized to 75% (w-3/4) */}
            <div className="w-3/4 p-6 overflow-y-auto custom-scrollbar">
                {selectedNode ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={selectedNode.name}
                        className="flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-6 pb-6 border-b border-white/10 flex-shrink-0">
                            <div>
                                <div className="flex items-baseline gap-3 mb-2">
                                    <h2 className="text-3xl font-bold text-white">{selectedNode.name}</h2>
                                    <span className={`px-2 py-0.5 rounded text-xs font-mono uppercase ${selectedNode.type === 'region' ? 'bg-purple-900/50 text-purple-300' :
                                        selectedNode.type === 'zone' ? 'bg-blue-900/50 text-blue-300' :
                                            'bg-gray-800 text-gray-400'
                                        }`}>
                                        {selectedNode.type}
                                    </span>
                                </div>
                                <div className="text-white/60 text-lg">
                                    {selectedNode.data?.description || "No description available."}
                                </div>
                            </div>
                            {selectedNode.data?.eng_code && (
                                <div className="text-right text-white/30 font-mono text-sm">
                                    {selectedNode.data.eng_code}
                                </div>
                            )}
                        </div>

                        {/* Metadata Grid */}
                        {selectedNode.data?.metadata && (
                            <div className="grid grid-cols-3 gap-4 mb-8 flex-shrink-0">
                                <InfoItem label="Owner" value={selectedNode.data.metadata.owner} />
                                <InfoItem label="Faction" value={selectedNode.data.metadata.faction} />
                                <InfoItem label="Title" value={selectedNode.data.metadata.ruler_title} />
                            </div>
                        )}

                        {/* LOCATION IMAGES */}
                        {matchingImages.length > 0 && (
                            <div className="mb-6 flex-shrink-0">
                                <h4 className="text-sm font-bold text-white/50 mb-3 flex items-center gap-2 uppercase tracking-wider">
                                    <MapIcon className="w-4 h-4" /> Visual References ({matchingImages.length})
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                    {matchingImages.map(bg => (
                                        <div key={bg} className="group relative aspect-video bg-black/50 rounded-lg overflow-hidden border border-white/10 hover:border-cyan-500/50 transition-colors">
                                            <img
                                                src={`/assets/${gameId}/backgrounds/${bg}.jpg`}
                                                alt={bg}
                                                className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                                onError={(e) => {
                                                    // Fallback to png if jpg fails, though simple fallback is hard in pure img tag
                                                    // Just let it break for now or show placeholder
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                <div className="text-[10px] text-white/90 truncate font-mono">{bg}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Resident Characters - Unified Scroll */}
                        <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
                            <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                <h4 className="text-sm font-bold text-white/80 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-cyan-400" />
                                    Residents / Active Here
                                </h4>
                                <span className="text-xs bg-black/50 px-2 py-0.5 rounded text-white/40">
                                    {residents.length}
                                </span>
                            </div>

                            <div className="divide-y divide-white/5">
                                {residents.length > 0 ? residents.map(char => (
                                    <div key={char.id} className="p-3 hover:bg-white/5 flex items-center gap-3 transition-colors">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden">
                                                {/* Simple Avatar Placeholder */}
                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/30">
                                                    {char.name[0]}
                                                </div>
                                            </div>
                                            {/* Score Badge */}
                                            <div className="absolute -bottom-1 -right-1 bg-cyan-900 border border-cyan-500 text-[9px] font-bold text-cyan-200 px-1 rounded-full shadow-lg z-10">
                                                +{char.score}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm font-medium text-white truncate">{char.name}</div>
                                                {char.is_main && <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-1 rounded flex-shrink-0">MAIN</span>}
                                            </div>
                                            <div className="text-xs text-white/40 truncate">
                                                {char.title || char.profile?.신분}
                                            </div>
                                        </div>
                                        <div className="text-xs text-right">
                                            <div className="text-white/70">{char.displayLoc || <span className="text-white/20">Unknown</span>}</div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-8 text-center text-white/20 italic text-sm">
                                        No characters explicitly assigned to this location.
                                    </div>
                                )}
                            </div>
                        </div>

                    </motion.div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-4">
                        <MapIcon className="w-16 h-16 opacity-50" />
                        <p>Select a location from the map to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Sub-components

// Helper function extracted for reuse
function getMatchingImagesForNode(node: LocationNode, backgrounds: string[]): string[] {
    const nodeName = node.name;
    const isSpot = node.path && node.path.length === 3;
    const parentContext = isSpot && node.path.length >= 2 ? node.path[1] : null;

    return backgrounds.filter(bg => {
        const normBg = bg.replace(/\s+/g, '');
        const normNodeName = nodeName.replace(/\s+/g, '');

        if (!normBg.includes(normNodeName)) return false;

        if (parentContext) {
            const normParent = parentContext.replace(/\s+/g, '');
            if (!normBg.includes(normParent)) return false;
        }

        return true;
    });
}

function TreeNode({ node, level, expanded, onToggle, selected, counts, backgrounds }: any) {
    const isExpanded = expanded.has(node.name);
    const hasChildren = node.children && node.children.length > 0;
    const Icon = node.type === 'region' ? MapIcon : node.type === 'zone' ? Building : MapPin;
    // Use path as key to handle duplicate spot names (e.g. "Entrance")
    const countKey = node.path ? node.path.join(">") : node.name;
    const count = counts?.get(countKey) || 0;

    // Check if image exists (Only for spots)
    // Determine Image Match Status (Only for spots)
    const matchStatus = React.useMemo(() => {
        if (node.type !== 'spot' || !backgrounds) return 'valid';

        const matches = getMatchingImagesForNode(node, backgrounds);
        if (matches.length === 0) return 'missing';

        // Check for Region Specificity (Exact Match)
        // Hierarchy: Region [0] -> Zone [1] -> Spot [2]
        const regionName = node.path?.[0];
        if (regionName) {
            const normRegion = regionName.replace(/\s+/g, '');
            // Check if ANY of the matched images contains the Region name
            const hasRegionSpecificMatch = matches.some(bg => bg.replace(/\s+/g, '').includes(normRegion));

            if (hasRegionSpecificMatch) return 'exact'; // Found a file like 'Region_Zone_Spot'
            return 'partial'; // Only found 'Zone_Spot' (Fallback)
        }

        return 'exact';
    }, [node, backgrounds]);

    const textColorClass = matchStatus === 'missing' ? 'text-red-400 font-medium' :
        matchStatus === 'partial' ? 'text-yellow-400' :
            ''; // Default white/gray

    return (
        <div>
            <div
                className={`
                    flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-colors select-none
                    ${selected ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                `}
                style={{ paddingLeft: `${level * 16 + 12}px` }}
                onClick={() => onToggle(node.name, node)}
            >
                {hasChildren ? (
                    <span onClick={(e) => { e.stopPropagation(); onToggle(node.name, node); }} className="p-0.5 hover:bg-white/10 rounded">
                        {isExpanded ? <ChevronDown className="w-3 h-3 opacity-70" /> : <ChevronRight className="w-3 h-3 opacity-70" />}
                    </span>
                ) : (
                    <span className="w-4" /> // Spacer
                )}

                <Icon className={`w-3.5 h-3.5 ${node.type === 'region' ? 'text-purple-400' :
                    node.type === 'zone' ? 'text-blue-400' : 'text-gray-500'
                    }`} />

                <span className={`text-sm truncate flex-1 ${textColorClass}`}>
                    {node.name}
                    {matchStatus === 'missing' && <span className="text-[10px] ml-1 text-red-500/50">(No Asset)</span>}
                    {matchStatus === 'partial' && <span className="text-[10px] ml-1 text-yellow-500/50">(Shared)</span>}
                </span>
                {count > 0 && <span className="text-xs text-white/30 ml-2">({count})</span>}
            </div>

            <AnimatePresence>
                {isExpanded && hasChildren && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        {node.children.map((child: any, idx: number) => (
                            <TreeNode
                                key={`${child.name}-${idx}`}
                                node={child}
                                level={level + 1}
                                expanded={expanded}
                                onToggle={onToggle}
                                selected={selected}
                                counts={counts}
                                backgrounds={backgrounds}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function InfoItem({ label, value }: { label: string, value: string }) {
    if (!value) return null;
    return (
        <div className="bg-white/5 p-3 rounded-lg border border-white/5">
            <div className="text-xs text-secondary-400 uppercase tracking-wider mb-1">{label}</div>
            <div className="font-medium text-white">{value}</div>
        </div>
    );
}
