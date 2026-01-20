import { GameRegistry } from '@/lib/registry/GameRegistry';

// [REFAC] Delegate to GameRegistry
export const getMoodPrompts = (activeGameId: string = 'god_bless_you') => {
  const config = GameRegistry.get(activeGameId);
  if (config) {
    return config.getMoodPrompts();
  }

  console.error(`[Prompts] Game config not found for id: ${activeGameId}`);
  // Fallback to GBY if possible, or return empty object
  const defaultConfig = GameRegistry.get('god_bless_you');
  if (defaultConfig) {
    return defaultConfig.getMoodPrompts();
  }

  return {};
};

// Type definition re-export for consumers
// Note: This assumes GBY keys are the superset/standard. 
// If games diverge significantly, this type might need to be looser (Record<string, string>).
// For now, keeping it compatible with existing consumers.
import { MOOD_PROMPTS as GBY_MOODS } from '@/data/games/god_bless_you/prompts/moods';
export type MoodType = keyof typeof GBY_MOODS;
