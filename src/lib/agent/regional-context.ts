/**
 * Regional Context Composer
 * 
 * 현재 위치 기반으로 Director에게 필요한 지역/세력 정보를 선별 조합합니다.
 * LLM 호출 불필요 — 순수 룰 기반(문자열 매칭).
 */

import locationsData from '@/data/games/wuxia/jsons/locations.json';
import factionsData from '@/data/games/wuxia/jsons/factions.json';

interface AdjacentInfo {
    region: string;
    travel_days: number;
    route: string;
}

interface ZoneMetadata {
    owner?: string;
    faction?: string;
    ruler_title?: string;
}

interface FactionRelation {
    대상: string;
    관계: string;
    설명: string;
}

interface FactionInfo {
    이름: string;
    구분: string;
    설명: string;
    주요무공?: string;
    위치?: string;
    주요인물?: Record<string, string>;
    등장히로인?: string[];
    성향?: string;
    전투스타일?: string;
    relations?: FactionRelation[];
}

export class RegionalContext {

    /**
     * 현재 위치 문자열에서 Region 이름을 해석합니다.
     * locations.json의 Region 키와 Zone 키를 역매칭합니다.
     */
    static resolveRegion(location: string): { regionName: string; zoneName: string | null } | null {
        if (!location) return null;

        const regions = (locationsData as any).regions;
        if (!regions) return null;

        // 1. Zone 이름으로 역매칭 (가장 정확)
        for (const [regionKey, regionVal] of Object.entries(regions) as [string, any][]) {
            if (!regionVal.zones) continue;
            for (const zoneKey of Object.keys(regionVal.zones)) {
                if (location.includes(zoneKey)) {
                    return { regionName: regionKey, zoneName: zoneKey };
                }
            }
        }

        // 2. Region 이름으로 직접 매칭
        for (const regionKey of Object.keys(regions)) {
            if (location.includes(regionKey)) {
                return { regionName: regionKey, zoneName: null };
            }
        }

        // 3. eng_code로 매칭
        for (const [regionKey, regionVal] of Object.entries(regions) as [string, any][]) {
            if (regionVal.eng_code && location.toLowerCase().includes(regionVal.eng_code.toLowerCase())) {
                return { regionName: regionKey, zoneName: null };
            }
        }

        return null;
    }

    /**
     * factions.json에서 이름으로 세력 정보를 찾습니다.
     */
    static findFaction(name: string): FactionInfo | null {
        const factions = (factionsData as any).문파 as FactionInfo[];
        return factions?.find(f => f.이름 === name) || null;
    }

    /**
     * 현재 위치 기반 지역 컨텍스트를 조합합니다.
     * Director에게 전달할 ~600 토큰 분량의 정보를 생성합니다.
     */
    static compose(location: string): string {
        const resolved = this.resolveRegion(location);
        if (!resolved) {
            return `[Regional Landscape]\n위치 불명: "${location}"\n세계관: 정파/사파/마교가 삼분하는 무림 세계`;
        }

        const { regionName, zoneName } = resolved;
        const regions = (locationsData as any).regions;
        const currentRegion = regions[regionName];

        const lines: string[] = [];
        lines.push(`[Regional Landscape]`);
        lines.push(`세계관: 정파(무림맹) / 사파(패천맹) / 마교(천마신교)가 삼분하는 무림. 새외세력(북해빙궁, 남만야수궁)과 관부(황실/금의위)가 별도 존재.`);
        lines.push(``);

        // 1. 현재 Region 상세
        lines.push(`[현재 지역: ${regionName}]`);
        lines.push(`설명: ${currentRegion.description}`);

        // Zone별 세력 요약
        if (currentRegion.zones) {
            const zoneEntries: string[] = [];
            for (const [zKey, zVal] of Object.entries(currentRegion.zones) as [string, any][]) {
                const meta = zVal.metadata as ZoneMetadata | undefined;
                if (meta?.faction) {
                    const marker = zKey === zoneName ? '★' : '';
                    zoneEntries.push(`  ${marker}${zKey}: ${meta.faction} (${meta.ruler_title || '수장'}: ${meta.owner || '불명'})`);
                }
            }
            if (zoneEntries.length > 0) {
                lines.push(`세력 구도:`);
                lines.push(...zoneEntries);
            }
        }

        // 2. 현재 Zone의 세력 상세 (faction data)
        if (zoneName) {
            const zoneData = currentRegion.zones?.[zoneName];
            const factionName = zoneData?.metadata?.faction;
            if (factionName) {
                const faction = this.findFaction(factionName);
                if (faction) {
                    lines.push(``);
                    lines.push(`[현재 Zone 세력: ${faction.이름}]`);
                    lines.push(`구분: ${faction.구분} | ${faction.성향 || ''}`);
                    lines.push(`설명: ${faction.설명}`);
                    if (faction.주요무공) lines.push(`무공: ${faction.주요무공}`);
                    if (faction.주요인물) {
                        const people = Object.entries(faction.주요인물)
                            .map(([name, role]) => `${name}(${role})`)
                            .join(', ');
                        lines.push(`주요인물: ${people}`);
                    }
                    if (faction.전투스타일) lines.push(`전투스타일: ${faction.전투스타일}`);

                    // 세력 관계
                    if (faction.relations && faction.relations.length > 0) {
                        const relStr = faction.relations
                            .map(r => `${r.대상}(${r.관계}: ${r.설명})`)
                            .join(', ');
                        lines.push(`외교: ${relStr}`);
                    }
                }
            }
        }

        // 3. 인접 Region 요약
        const adjacent = currentRegion.adjacent as AdjacentInfo[] | undefined;
        if (adjacent && adjacent.length > 0) {
            lines.push(``);
            lines.push(`[인접 지역]`);
            for (const adj of adjacent) {
                const adjRegion = regions[adj.region];
                if (!adjRegion) continue;

                // 인접 지역의 대표 세력 찾기
                const mainFactions: string[] = [];
                if (adjRegion.zones) {
                    for (const [, zVal] of Object.entries(adjRegion.zones) as [string, any][]) {
                        if ((zVal as any).metadata?.faction) {
                            mainFactions.push((zVal as any).metadata.faction);
                        }
                    }
                }

                const factionStr = mainFactions.length > 0 ? mainFactions.join(', ') : '특별 세력 없음';
                lines.push(`  ${adj.region} (${adj.travel_days}일, ${adj.route}): ${factionStr}`);
            }
        }

        return lines.join('\n');
    }
}
