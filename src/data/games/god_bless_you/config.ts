import { GameRegistry, GameConfig } from '@/lib/registry/GameRegistry';
import ModernHUD from '@/components/visual_novel/ui/ModernHUD';
import { GBY_IDENTITY, GBY_BEHAVIOR_RULES, GBY_OUTPUT_FORMAT, LEVEL_TO_RANK_MAP } from './constants';
import { GOD_BLESS_YOU_BGM_MAP, GOD_BLESS_YOU_BGM_ALIASES } from './bgm_mapping';
import { backgroundMappings } from './backgroundMappings';
import { getSystemPromptTemplate, getRankInfo } from './prompts/system';
import { MOOD_PROMPTS_GBY } from '@/data/prompts/moods';

export const GodBlessYouConfig: GameConfig = {
    id: 'god_bless_you',
    name: '갓 블레스 유',

    identity: GBY_IDENTITY,
    behaviorRules: GBY_BEHAVIOR_RULES,
    outputFormat: GBY_OUTPUT_FORMAT,

    getSystemPromptTemplate: getSystemPromptTemplate,
    getRankInfo: (input: string | number) => {
        const fame = typeof input === 'number' ? input : 0;
        return getRankInfo(fame);
    },

    components: {
        HUD: ModernHUD
    },

    assets: {
        bgmMap: GOD_BLESS_YOU_BGM_MAP,
        bgmAliases: GOD_BLESS_YOU_BGM_ALIASES,
        backgroundMap: backgroundMappings
    },

    getMoodPrompts: () => MOOD_PROMPTS_GBY
};

GameRegistry.register(GodBlessYouConfig);
