/**
 * location-utils.ts
 * 
 * 공용 위치 데이터 헬퍼 함수.
 * locations.json의 Region > Zone > Spot 계층 구조에서
 * 각 모델별 필요 수준의 위치 컨텍스트를 추출합니다.
 * 
 * 사용처:
 * - Director: getDirectorLocationContext() — Zone 목록 + Adjacent
 * - Story Model: getStoryLocationContext() — Spots + 이동 목적지 Spots
 * - PreLogic: getPreLogicLocationContext() — Zone 수준만
 */

// ─── Types ──────────────────────────────────────────────────────

export interface LocationRegion {
    eng_code?: string;
    description?: string;
    adjacent?: Array<{
        region: string;
        travel_days?: number;
        route?: string;
        access_method?: string; // GBY uses this instead of route
    }>;
    zones?: Record<string, LocationZone>;
}

export interface LocationZone {
    description?: string;
    metadata?: {
        owner?: string;
        faction?: string;
        ruler_title?: string;
    };
    spots?: string[];
}

export interface LocationLookupResult {
    regionName: string;
    regionData: LocationRegion | null;
    zoneName: string;
    zoneData: LocationZone | null;
}

// ─── Core Lookup ────────────────────────────────────────────────

/**
 * currentLocation 문자열에서 Region/Zone을 찾습니다.
 * "주거지" → { regionName: "서울", zoneName: "주거지", ... }
 * "서울_주거지" → same result (underscore 처리)
 */
export function lookupLocation(
    currentLocation: string,
    regions: Record<string, LocationRegion>
): LocationLookupResult {
    const result: LocationLookupResult = {
        regionName: '',
        regionData: null,
        zoneName: '',
        zoneData: null,
    };

    if (!currentLocation || !regions) return result;

    // Normalize: replace underscores with space separation
    const locNorm = currentLocation.replace(/_/g, ' ').trim();
    const locParts = locNorm.split(/[\s>]+/).map(s => s.trim()).filter(Boolean);

    for (const [rName, rData] of Object.entries(regions)) {
        if (!rData.zones) continue;

        // Case 1: Direct Zone match (e.g. "주거지")
        for (const [zName, zData] of Object.entries(rData.zones)) {
            if (zName === currentLocation || zName === locNorm || locParts.includes(zName)) {
                result.regionName = rName;
                result.regionData = rData;
                result.zoneName = zName;
                result.zoneData = zData;
                return result;
            }
        }

        // Case 2: Region match (e.g. "서울" or "하남")
        if (rName === currentLocation || rName === locNorm || locParts.includes(rName)) {
            result.regionName = rName;
            result.regionData = rData;
            // If there's a zone part too (e.g. "서울 > 주거지")
            for (const part of locParts) {
                if (part !== rName && rData.zones[part]) {
                    result.zoneName = part;
                    result.zoneData = rData.zones[part];
                    break;
                }
            }
            return result;
        }
    }

    return result;
}

// ─── Director Level: Zone List + Adjacent ───────────────────────

/**
 * 디렉터용: Region 수준 지형도.
 * - 현재 Region의 모든 Zone 이름 + 한줄 설명
 * - 인접 Region + 이동 수단
 * - Spots는 포함하지 않음
 */
export function getDirectorLocationContext(
    currentLocation: string,
    regions: Record<string, LocationRegion>
): string {
    const lookup = lookupLocation(currentLocation, regions);
    if (!lookup.regionName || !lookup.regionData) {
        return `[World Map]\n현재 위치: ${currentLocation || 'Unknown'}\n(지역 데이터 없음)`;
    }

    const lines: string[] = [];
    const r = lookup.regionData;

    lines.push(`[World Map (Director Level)]`);
    lines.push(`현재 지역: ${lookup.regionName}${lookup.zoneName ? ' > ' + lookup.zoneName : ''}`);
    if (r.description) lines.push(`지역 설명: ${r.description}`);
    lines.push('');

    // Zone list with one-line descriptions (NO spots)
    if (r.zones) {
        lines.push(`[${lookup.regionName} 내 Zone 목록]`);
        for (const [zName, zData] of Object.entries(r.zones)) {
            const marker = zName === lookup.zoneName ? ' ← 현재' : '';
            const desc = zData.description ? `: ${zData.description}` : '';
            lines.push(`- ${zName}${desc}${marker}`);
        }
        lines.push('');
    }

    // Adjacent regions
    if (r.adjacent && r.adjacent.length > 0) {
        lines.push(`[인접 지역 (이동 가능)]`);
        for (const adj of r.adjacent) {
            const travel = adj.travel_days ? `${adj.travel_days}일` : '';
            const route = adj.route || adj.access_method || '';
            lines.push(`- ${adj.region}${travel ? ' (' + travel + ')' : ''}${route ? ' — ' + route : ''}`);
        }
    }

    return lines.join('\n');
}

// ─── Story Model Level: Spots + Target Zone ────────────────────

/**
 * 스토리 모델용: 현재 Zone의 Spots + 디렉터 이동 지시 목적지 Spots.
 * @param targetZone 디렉터가 지시한 이동 목적지 Zone 이름 (없으면 null)
 */
export function getStoryLocationContext(
    currentLocation: string,
    regions: Record<string, LocationRegion>,
    targetZone?: string | null
): string {
    const lookup = lookupLocation(currentLocation, regions);
    const lines: string[] = [];

    // Current location info
    lines.push(`[Current Location: ${lookup.regionName || 'Unknown'}${lookup.zoneName ? ' > ' + lookup.zoneName : ''}]`);

    if (lookup.zoneData) {
        if (lookup.zoneData.description) {
            lines.push(`설명: ${lookup.zoneData.description}`);
        }
        if (lookup.zoneData.spots && lookup.zoneData.spots.length > 0) {
            lines.push(`이동 가능 장소: ${lookup.zoneData.spots.join(', ')}`);
        }
    } else if (lookup.regionData?.zones) {
        // At Region level — show Zone names as available locations
        lines.push(`이동 가능 구역: ${Object.keys(lookup.regionData.zones).join(', ')}`);
    }

    // Target zone info (if Director instructed movement)
    if (targetZone && lookup.regionData) {
        const targetData = findZoneByName(targetZone, regions);
        if (targetData) {
            lines.push('');
            lines.push(`[이동 목적지: ${targetData.regionName} > ${targetData.zoneName}]`);
            if (targetData.zoneData?.description) {
                lines.push(`설명: ${targetData.zoneData.description}`);
            }
            if (targetData.zoneData?.spots && targetData.zoneData.spots.length > 0) {
                lines.push(`도착 시 이용 가능 장소: ${targetData.zoneData.spots.join(', ')}`);
            }
        }
    }

    return lines.join('\n');
}

// ─── PreLogic Level: Zone Description Only ─────────────────────

/**
 * PreLogic용: Zone 수준 컨텍스트만 (spots 없음).
 * 행동 타당성 판정에 필요한 최소 정보.
 */
export function getPreLogicLocationContext(
    currentLocation: string,
    regions: Record<string, LocationRegion>
): string {
    const lookup = lookupLocation(currentLocation, regions);

    if (!lookup.regionName) {
        return `[Location Context: Unknown] Current: "${currentLocation}". (PreLogic MUST infer region from context).`;
    }

    const desc = lookup.zoneData?.description || lookup.regionData?.description || '';
    return `[Location Context: ${lookup.regionName}${lookup.zoneName ? ' / ' + lookup.zoneName : ''}]
- Description: ${desc}`;
}


// ─── Helper: Find Zone by name across all regions ──────────────

function findZoneByName(
    zoneName: string,
    regions: Record<string, LocationRegion>
): (LocationLookupResult) | null {
    for (const [rName, rData] of Object.entries(regions)) {
        if (rData.zones && rData.zones[zoneName]) {
            return {
                regionName: rName,
                regionData: rData,
                zoneName: zoneName,
                zoneData: rData.zones[zoneName],
            };
        }
    }
    return null;
}
