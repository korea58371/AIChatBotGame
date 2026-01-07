
/**
 * Checks if the given character name corresponds to a hidden protagonist who has an image override.
 * Handles '주인공', '나', 'Me', player name, and the override name itself.
 */
export const isHiddenProtagonist = (charName: string, playerName: string, protagonistImageOverride?: string): boolean => {
    if (!protagonistImageOverride) return false;
    return charName === '주인공' ||
        charName === '나' ||
        charName === 'Me' ||
        charName === playerName ||
        charName === protagonistImageOverride;
};
