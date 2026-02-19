import { GameRegistry, GameConfig } from '@/lib/registry/GameRegistry';
import { wuxiaProgression } from './progression';
// import WuxiaHUD from '@/components/visual_novel/ui/WuxiaHUD';
import { WUXIA_IDENTITY, WUXIA_BEHAVIOR_RULES, WUXIA_OUTPUT_FORMAT } from './constants';
import { WUXIA_BGM_MAP, WUXIA_BGM_ALIASES } from './bgm_mapping';
import { getSystemPromptTemplate, getRankInfo } from './prompts/system';
import { MOOD_PROMPTS } from './prompts/moods';
import { getLogicPrompt, getStaticLogicPrompt, getDynamicLogicPrompt } from './prompts/logic';

import { getWuxiaStaticContext } from './prompts/staticContext';
import { loadWuxiaData } from './loader';
import wuxiaLocations from './jsons/locations.json';
import wuxiaFactions from './jsons/factions.json';

export const WuxiaConfig: GameConfig = {
    id: 'wuxia',
    name: '천하제일',

    identity: WUXIA_IDENTITY,
    behaviorRules: WUXIA_BEHAVIOR_RULES,
    outputFormat: WUXIA_OUTPUT_FORMAT,

    getSystemPromptTemplate: getSystemPromptTemplate,
    getStaticContext: getWuxiaStaticContext,
    getLogicPrompt: getLogicPrompt,
    getStaticLogicPrompt: (id, rank, rom, com) => getStaticLogicPrompt(rank, rom, com),
    getDynamicLogicPrompt: getDynamicLogicPrompt,
    getRankInfo: (input: string | number) => {
        const key = typeof input === 'string' ? input : '삼류';
        return getRankInfo(key);
    },

    assets: {
        bgmMap: WUXIA_BGM_MAP,
        bgmAliases: WUXIA_BGM_ALIASES,
    },

    getMoodPrompts: () => MOOD_PROMPTS,

    // [6] Scalability Extensions
    loadGameData: loadWuxiaData,

    // [8] Universal Progression System
    progressionConfig: wuxiaProgression,

    // [9] Director Guide — WUXIA_IDENTITY / CORE_RULES에서 Director용 핵심만 압축
    getDirectorGuide: () => `[세계관]
이 세계는 중원 무림이다. 정파(무림맹), 사파(패천맹), 마교(천마신교)가 삼분하고 있다.
새외세력(북해빙궁, 남만야수궁)과 관부(황실/금의위)가 별도 존재.
무공 등급: 삼류 → 이류 → 일류 → 절정 → 초절정 → 화경 → 현경 → 생사경.
플레이어는 성장 중인 강호인이다.

[핵심 톤 & 테마]
- 장르: 정통무협(Orthodox). 진중함(Gravity) + 협(Chivalry) + 성장 + 브로맨스.
- 문체: 신무협(Neo-Wuxia) — 고풍스럽고 멋스러운 묘사 + 세련됨.
- 유머: 은혼(Gintama) 스타일 — 진지한 전개 사이에 나사 빠진 개그/쉬어가는 에피소드 삽입.

[줄거리 설계 원칙 (⭐ CRITICAL)]
1. **전투:일상 = 3:7**. 소소한 행복(수련 후 식사, 술자리, 비무/논검) 중심. 목숨이 오가는 혈투보다 자존심 승부/연애/오해 소동.
2. **Late Romance Rule**: 여인들은 쉽게 반하지 않는다. 호감도가 쌓이기 전까지 차갑거나 비즈니스적으로 대함. 초반 로맨스 이벤트 설계 금지.
3. **[하렘 질투 프로토콜]**: 여인들 간 질투/견제는 **코미디적이고 귀여운 반응만 허용**. 진짜 적대감, 다크한 감정, 최후통첩, 관계 파탄 **금지**. 밝고 유쾌한 톤 유지.
4. **비례성의 원칙**: 원인과 결과의 크기는 비례해야 한다. 사소한 행동을 거대한 음모로 연결하지 마라. 바늘 도둑은 바늘 도둑일 뿐.
5. **동료는 또 다른 주인공**: 동료들의 성장과 서사도 비중 있게 다룬다. 위기 시 전우애, 평소에는 티키타카.
6. **강자의 위엄**: 상위 경지 고수가 등장하면 압도적인 위엄과 주변의 경외를 묘사하여 성장 동기 부여.
7. **소재의 경량화**: 멸문지화, 전쟁 같은 무거운 주제 대신 비무대련, 축제, 라이벌 의식 같은 청춘 드라마 위주.
8. **기연 금지**: 길가다 S급 비급 줍기 같은 기적은 발생하지 않는다.

[팩션 행동규범 (⭐ CRITICAL)]
- **정파(명문세가)**: 체면과 명예를 목숨처럼 여긴다. 하수에게 이유 없이 시비를 걸지 않으며, 양아치처럼 굴지 않는다(점잖은 오만함). 무고한 사람 공격 금지.
- **사파**: 이익 추구, 비열함 허용. 하지만 나름의 규율(강자존) 존재.
- **마교**: 교리와 교주에 대한 광신. 독자적인 가치관.
- **초면 프로토콜**: 명시적 관계가 없으면 NPC는 주인공을 잡상인 취급. 초면에 웃거나 친절한 사람은 사기꾼뿐.

[성장 & 전투 규칙]
- 경지 차이 2단계 이상이면 하수가 이길 수 없다. 동급이라도 방심하면 즉사.
- 하루아침에 내공이 쌓이지 않는다. 내공 성장은 폐관수련/기연이 필요.
- 시련은 플레이어가 감당 가능한 수준이어야 한다. 너무 쉬운 승리도, 불가능한 벽도 지양.`,

    // [12] Director Examples — Wuxia 전용 NO SPOILERS 예시
    getDirectorExamples: () => ({
        good: '왕노야가 주인공의 검을 유심히 관찰한다',
        bad: '왕노야가 검이 마교 비급과 관련됨을 알아차린다',
    }),

    // [10] Regional Context — Director에게 전달할 지역/세력 정보 (기존 regional-context.ts에서 이전)
    getRegionalContext: (location: string): string => {
        const regions = (wuxiaLocations as any).regions;
        if (!regions || !location) {
            return `[Regional Landscape]\n위치 불명: "${location}"\n세계관: 정파/사파/마교가 삼분하는 무림 세계`;
        }

        // 1. Zone/Region 해석
        let regionName: string | null = null;
        let zoneName: string | null = null;

        // Zone 이름으로 역매칭
        for (const [rKey, rVal] of Object.entries(regions) as [string, any][]) {
            if (!rVal.zones) continue;
            for (const zKey of Object.keys(rVal.zones)) {
                if (location.includes(zKey)) { regionName = rKey; zoneName = zKey; break; }
            }
            if (regionName) break;
        }
        // Region 이름 직접 매칭
        if (!regionName) {
            for (const rKey of Object.keys(regions)) {
                if (location.includes(rKey)) { regionName = rKey; break; }
            }
        }
        // eng_code 매칭
        if (!regionName) {
            for (const [rKey, rVal] of Object.entries(regions) as [string, any][]) {
                if (rVal.eng_code && location.toLowerCase().includes(rVal.eng_code.toLowerCase())) {
                    regionName = rKey; break;
                }
            }
        }

        if (!regionName) {
            return `[Regional Landscape]\n위치 불명: "${location}"\n세계관: 정파/사파/마교가 삼분하는 무림 세계`;
        }

        const currentRegion = regions[regionName];
        const lines: string[] = [];
        lines.push(`[Regional Landscape]`);
        lines.push(`세계관: 정파(무림맹) / 사파(패천맹) / 마교(천마신교)가 삼분하는 무림. 새외세력(북해빙궁, 남만야수궁)과 관부(황실/금의위)가 별도 존재.`);
        lines.push(``);
        lines.push(`[현재 지역: ${regionName}]`);
        lines.push(`설명: ${currentRegion.description}`);

        // Zone별 세력 요약
        if (currentRegion.zones) {
            const zoneEntries: string[] = [];
            for (const [zKey, zVal] of Object.entries(currentRegion.zones) as [string, any][]) {
                const meta = zVal.metadata;
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

        // Zone 세력 상세 (factions data)
        if (zoneName) {
            const zoneData = currentRegion.zones?.[zoneName];
            const factionName = zoneData?.metadata?.faction;
            if (factionName && wuxiaFactions) {
                const factions = (wuxiaFactions as any).문파 || [];
                const faction = factions.find((f: any) => f.이름 === factionName);
                if (faction) {
                    lines.push(``);
                    lines.push(`[현재 Zone 세력: ${faction.이름}]`);
                    lines.push(`구분: ${faction.구분} | ${faction.성향 || ''}`);
                    lines.push(`설명: ${faction.설명}`);
                    if (faction.주요무공) lines.push(`무공: ${faction.주요무공}`);
                    if (faction.주요인물) {
                        const people = Object.entries(faction.주요인물).map(([name, role]) => `${name}(${role})`).join(', ');
                        lines.push(`주요인물: ${people}`);
                    }
                    if (faction.전투스타일) lines.push(`전투스타일: ${faction.전투스타일}`);
                    if (faction.relations && faction.relations.length > 0) {
                        const relStr = faction.relations.map((r: any) => `${r.대상}(${r.관계}: ${r.설명})`).join(', ');
                        lines.push(`외교: ${relStr}`);
                    }
                }
            }
        }

        // 인접 Region
        const adjacent = currentRegion.adjacent;
        if (adjacent && adjacent.length > 0) {
            lines.push(``);
            lines.push(`[인접 지역]`);
            for (const adj of adjacent) {
                const adjRegion = regions[adj.region];
                if (!adjRegion) continue;
                const mainFactions: string[] = [];
                if (adjRegion.zones) {
                    for (const [, zVal] of Object.entries(adjRegion.zones) as [string, any][]) {
                        if ((zVal as any).metadata?.faction) mainFactions.push((zVal as any).metadata.faction);
                    }
                }
                const factionStr = mainFactions.length > 0 ? mainFactions.join(', ') : '특별 세력 없음';
                lines.push(`  ${adj.region} (${adj.travel_days}일, ${adj.route}): ${factionStr}`);
            }
        }

        return lines.join('\n');
    },

    // [11] Post-Logic Location Hint
    getPostLogicLocationHint: () =>
        'Use standard Wuxia region names: 중원, 사천, 하북, 산동, 북해, 남만, 서역, 등.',

    resolveRegion: (location: string): string | null => {
        if (!location) return null;
        // locations.json Structure: { regions: { "하남": { zones: { "무림맹": ... } } } }
        const regions = wuxiaLocations.regions || {};

        for (const [regionName, regionData] of Object.entries(regions)) {
            const zones = (regionData as any).zones || {};
            // Check Zones
            for (const [zoneName, zoneData] of Object.entries(zones)) {
                // 1. Exact Zone Match (e.g. "무림맹")
                if (location.includes(zoneName)) return regionName;
                // 2. Spot Match
                const spots = (zoneData as any).spots || [];
                if (spots.some((spot: string) => location.includes(spot))) return regionName;
            }
            // 3. Fallback: Check if location string simply starts with Region name
            if (location.startsWith(regionName)) return regionName;
        }
        return null;
    },

    formatCharacter: (char: any, mode: string, state?: any): string => {
        const displayName = char.name || char.이름 || 'Unknown';
        let charInfo = `### [ACTIVE] ${displayName} (${char.role || char.title || 'Unknown'})`;

        if (char.relationshipInfo) {
            if (char.relationshipInfo.status) charInfo += `\n- Relationship Status: ${char.relationshipInfo.status}`;
            if (char.relationshipInfo.speechStyle) charInfo += `\n- Speech Style: ${char.relationshipInfo.speechStyle}`;
        }

        if (char.faction) charInfo += `\n- Faction: ${char.faction}`;

        if (char.martial_arts_realm) {
            const maVal = typeof char.martial_arts_realm === 'object'
                ? `${char.martial_arts_realm.name} (Lv ${char.martial_arts_realm.power_level || '?'})`
                : char.martial_arts_realm;
            charInfo += `\n- Martial Arts Rank: ${maVal}`;
        } else if (char['강함']?.['등급']) {
            charInfo += `\n- Rank: ${char['강함']['등급']}`;
            if (char['강함'].skills) {
                const skills = char['강함'].skills;
                const skillNames = Array.isArray(skills) ? skills.join(', ') : Object.keys(skills).join(', ');
                charInfo += `\n- Skills: ${skillNames}`;
            }
        }

        if (char.appearance) {
            const appVal = typeof char.appearance === 'string' ? char.appearance : JSON.stringify(char.appearance);
            charInfo += `\n- Appearance: ${appVal}`;
        } else if (char['외형']) {
            const appVal = typeof char['외형'] === 'string' ? char['외형'] : JSON.stringify(char['외형']);
            charInfo += `\n- Appearance: ${appVal}`;
        }

        // Status
        if (char.default_expression) charInfo += `\n- Status: ${char.default_expression}`;
        if (char.description) charInfo += `\n- Current State: ${char.description}`;

        if (char.cgs) {
            charInfo += `\n- [AVAILABLE CGs]:`;
            if (Array.isArray(char.cgs)) {
                char.cgs.forEach((cg: string) => charInfo += `\n  - ${cg}`);
            } else {
                Object.entries(char.cgs).forEach(([k, v]) => {
                    charInfo += `\n  - <CG>${k}</CG>: ${v}`;
                });
            }
        }

        return charInfo;
    },


    // [Refactored] Background Localization Logic
    resolveBackgroundName: (key: string, state: any) => {
        const region = WuxiaConfig.resolveRegion(state.currentLocation);
        if (region) {
            // 1. "공용_" -> Replace with "Region_" (e.g. 공용_특실 -> 하남_특실)
            if (key.startsWith('공용_')) {
                return `${region}_${key.substring(3)}`;
            }
            // 2. Generic Categories -> Prepend "Region_" (e.g. 객잔_객실 -> 하남_객잔_객실)
            // Categories: 객잔, 기루, 마을, 산, 강호, 의원, 상점 etc.
            // We filter by common prefixes that are NOT specific place names.
            const genericPrefixes = ['객잔', '기루', '마을', '산', '강호', '시장', '저잣거리', '빈객실', '감옥'];
            const startsWithGeneric = genericPrefixes.some(p => key.startsWith(p));

            if (startsWithGeneric) {
                return `${region}_${key}`;
            }
        }
        return key;
    }
};

console.log("[WuxiaConfig] Registering WuxiaConfig to GameRegistry...");
GameRegistry.register(WuxiaConfig);
console.log("[WuxiaConfig] Registration Complete.");
