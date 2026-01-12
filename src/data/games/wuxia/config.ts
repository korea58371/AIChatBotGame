import { GameRegistry, GameConfig } from '@/lib/registry/GameRegistry';
import WuxiaHUD from '@/components/visual_novel/ui/WuxiaHUD';
import { WUXIA_IDENTITY, WUXIA_BEHAVIOR_RULES, WUXIA_OUTPUT_FORMAT } from './constants';
import { WUXIA_BGM_MAP, WUXIA_BGM_ALIASES } from './bgm_mapping';
import { getSystemPromptTemplate, getRankInfo } from './prompts/system';
import { MOOD_PROMPTS_WUXIA } from '@/data/prompts/moods';

export const WuxiaConfig: GameConfig = {
    id: 'wuxia',
    name: '천하제일',

    identity: WUXIA_IDENTITY,
    behaviorRules: WUXIA_BEHAVIOR_RULES,
    outputFormat: WUXIA_OUTPUT_FORMAT,

    getSystemPromptTemplate: getSystemPromptTemplate,
    getRankInfo: (input: string | number) => {
        const key = typeof input === 'string' ? input : '삼류';
        return getRankInfo(key);
    },

    components: {
        HUD: WuxiaHUD
    },

    assets: {
        bgmMap: WUXIA_BGM_MAP,
        bgmAliases: WUXIA_BGM_ALIASES,
        backgroundMap: {}
    },

    getMoodPrompts: () => MOOD_PROMPTS_WUXIA
};

GameRegistry.register(WuxiaConfig);
