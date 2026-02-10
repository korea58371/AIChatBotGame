import { GameRegistry, GameConfig } from '@/lib/registry/GameRegistry';
// [Removed] UI Components for Server Compatibility

import { GBY_IDENTITY, GBY_BEHAVIOR_RULES, GBY_OUTPUT_FORMAT, LEVEL_TO_RANK_MAP } from './constants';
import { GOD_BLESS_YOU_BGM_MAP, GOD_BLESS_YOU_BGM_ALIASES } from './bgm_mapping';
import { backgroundMappings } from './backgroundMappings';
import { getSystemPromptTemplate, getRankInfo } from './prompts/system';
import { MOOD_PROMPTS } from './prompts/moods';
import { getLogicPrompt, getStaticLogicPrompt, getDynamicLogicPrompt } from './prompts/logic';
import { getGBYStaticContext } from './prompts/staticContext';
import { loadGodBlessYouData } from './loader';
import { formatCharacter } from './prompts/character';

export const GodBlessYouConfig: GameConfig = {
    id: 'god_bless_you',
    name: '갓 블레스 유',

    identity: GBY_IDENTITY,
    behaviorRules: GBY_BEHAVIOR_RULES,
    outputFormat: GBY_OUTPUT_FORMAT,

    getSystemPromptTemplate: getSystemPromptTemplate,
    getStaticContext: getGBYStaticContext,
    getLogicPrompt: getLogicPrompt,
    getStaticLogicPrompt: (id, rank, rom, com) => getStaticLogicPrompt(rank, rom, com),
    getDynamicLogicPrompt: getDynamicLogicPrompt,
    getRankInfo: (input: string | number) => {
        const fame = typeof input === 'number' ? input : 0;
        return getRankInfo(fame);
    },

    // [Refactor] UI moved to god_bless_you/ui.ts

    assets: {
        bgmMap: GOD_BLESS_YOU_BGM_MAP,
        bgmAliases: GOD_BLESS_YOU_BGM_ALIASES,
        backgroundMap: backgroundMappings
    },

    getMoodPrompts: () => MOOD_PROMPTS,

    // [6] Scalability Extensions
    loadGameData: loadGodBlessYouData,
    resolveRegion: (location: string) => null, // GBY doesn't use rigid region logic
    formatCharacter: formatCharacter,

    // [Refactored] Rank Logic
    getRankTitle: (level: number, language: string = 'ko') => {
        const entry = LEVEL_TO_RANK_MAP.find(m => level >= m.min && level <= m.max);
        if (entry) return entry.id;
        // Fallback for high levels
        if (level >= 90) return 'rank_ss';
        return 'rank_none';
    },

    // [Refactored] Background Localization Logic
    resolveBackgroundName: (key: string, state: any) => {
        // GBY does not (yet) strictly enforce region-based assets prefixes
        // It returns the key as is.
        return key;
    }
};

GameRegistry.register(GodBlessYouConfig);
