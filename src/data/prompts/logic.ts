import { GameRegistry } from '@/lib/registry/GameRegistry';

// [REFAC] Delegate to GameRegistry
export const getLogicPrompt = (
    prunedStats: any,
    lastUserMessage: string,
    lastAiResponse: string,
    logicContext: string,
    worldData: any,
    activeGameId: string = 'god_bless_you',
    availableEvents: any[] = [],
    rankCriteria: any = null
) => {
    const config = GameRegistry.get(activeGameId);
    if (!config) {
        console.error(`[Prompts] Game config not found for id: ${activeGameId}`);
        const defaultConfig = GameRegistry.get('god_bless_you');
        if (defaultConfig) {
            return defaultConfig.getLogicPrompt(prunedStats, lastUserMessage, lastAiResponse, logicContext, worldData, availableEvents, rankCriteria);
        }
        throw new Error(`[Prompts] Critical: No game config found for ${activeGameId} and no fallback available.`);
    }

    return config.getLogicPrompt(prunedStats, lastUserMessage, lastAiResponse, logicContext, worldData, availableEvents, rankCriteria);
};

export const getStaticLogicPrompt = (activeGameId: string = 'god_bless_you', rankCriteria: any = null, romanceGuide: any = null, combatGuide: any = null) => {
    const config = GameRegistry.get(activeGameId);
    if (config && config.getStaticLogicPrompt) {
        return config.getStaticLogicPrompt(activeGameId, rankCriteria, romanceGuide, combatGuide);
    }
    // Fallback
    const defaultConfig = GameRegistry.get('god_bless_you');
    if (defaultConfig && defaultConfig.getStaticLogicPrompt) {
        return defaultConfig.getStaticLogicPrompt('god_bless_you', rankCriteria, romanceGuide, combatGuide);
    }
    return "";
};

export const getDynamicLogicPrompt = (
    prunedStats: any,
    lastUserMessage: string,
    lastAiResponse: string,
    logicContext: string,
    worldData: any,
    availableEvents: any[] = []
) => {
    // Note: getDynamicLogicPrompt signature in registry might need activeGameId or we extract it from prunedStats or similar.
    // However, the original function argument list didn't include activeGameId explicitly, it was usually in prunedStats or passed implicitly?
    // Looking at gemini.ts: 
    // const prompt = getDynamicLogicPrompt(prunedStats, ..., worldData, validEvents);
    // It doesn't pass activeGameId.
    // But we need activeGameId to select the right prompt.
    // 'prunedStats' in gemini.ts comes from 'gameState'. 'gameState' has 'activeGameId'.

    // We try to extract activeGameId from prunedStats if possible, or we need to change signature.
    // But changing signature breaks compatibility.
    // Let's assume prunedStats or a global check? 
    // In gemini.ts, `gameState` is passed to `generateGameLogic`, and `prunedStats` is derived from it.
    // `prunedStats` usually contains game data.
    // Wait, gemini.ts does NOT pass activeGameId to `getDynamicLogicPrompt`.

    // Hack: We can try to cast prunedStats to any and check activeGameId if it was preserved?
    // In gemini.ts: `const { ... prunedStats } = gameState;`
    // It destructures `activeGameId`? No, it's not in the excluded list I saw in Step 148.
    // Excluded: worldData, lore, wikiData, etc.
    // So `activeGameId` should be in `prunedStats`.

    const gameId = prunedStats.activeGameId || 'god_bless_you';

    const config = GameRegistry.get(gameId);
    if (config && config.getDynamicLogicPrompt) {
        return config.getDynamicLogicPrompt(prunedStats, lastUserMessage, lastAiResponse, logicContext, worldData, availableEvents);
    }
    const defaultConfig = GameRegistry.get('god_bless_you');
    if (defaultConfig && defaultConfig.getDynamicLogicPrompt) {
        return defaultConfig.getDynamicLogicPrompt(prunedStats, lastUserMessage, lastAiResponse, logicContext, worldData, availableEvents);
    }
    return "";
};
