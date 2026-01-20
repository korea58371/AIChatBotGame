import { GameRegistry, GameConfig } from '@/lib/registry/GameRegistry';
// import WuxiaHUD from '@/components/visual_novel/ui/WuxiaHUD';
import { WUXIA_IDENTITY, WUXIA_BEHAVIOR_RULES, WUXIA_OUTPUT_FORMAT } from './constants';
import { WUXIA_BGM_MAP, WUXIA_BGM_ALIASES } from './bgm_mapping';
import { getSystemPromptTemplate, getRankInfo } from './prompts/system';
import { MOOD_PROMPTS } from './prompts/moods';
import { getLogicPrompt, getStaticLogicPrompt, getDynamicLogicPrompt } from './prompts/logic';
import { backgroundMappings } from './backgroundMappings';
import { getWuxiaStaticContext } from './prompts/staticContext';
import { loadWuxiaData } from './loader';
import wuxiaLocations from './jsons/locations.json';

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
        backgroundMap: backgroundMappings
    },

    getMoodPrompts: () => MOOD_PROMPTS,

    // [6] Scalability Extensions
    loadGameData: loadWuxiaData,

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

        return charInfo;
    },

    // [Refactored] Rank Logic
    getRankTitle: (level: number, language: string = 'ko') => {
        // Import locally or define locally to avoid circular dependency issues if constants are in PromptManager
        const LEVEL_TO_REALM_MAP = [
            { min: 1, max: 9, id: 'intro', title: '입문' },
            { min: 10, max: 29, id: 'third_rate', title: '삼류' },
            { min: 30, max: 49, id: 'second_rate', title: '이류' },
            { min: 50, max: 69, id: 'first_rate', title: '일류' },
            { min: 70, max: 89, id: 'peak', title: '절정' },
            { min: 90, max: 109, id: 'transcendent', title: '초절정' },
            { min: 110, max: 129, id: 'harmony', title: '화경' },
            { min: 130, max: 159, id: 'mystic', title: '현경' },
            { min: 160, max: 999, id: 'life_death', title: '생사경' }
        ];

        const entry = LEVEL_TO_REALM_MAP.find(m => level >= m.min && level <= m.max);
        // Translation logic is handled in PromptManager currently, but ideally should be here or delegated.
        // For now, return the localization key (id) or fallback title.
        // PromptManager will use translations[lang].wuxia.realms[id]
        if (entry) return entry.id;
        return 'unknown';
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
