import modern_combat from './modern_combat.json';
import modern_elixirs from './modern_elixirs.json';
import modern_factions from './modern_factions.json';
import modern_levels from './modern_levels.json';
import modern_romance_guide from './modern_romance_guide.json';
import modern_skills from './modern_skills.json';
import modern_terminology from './modern_terminology.json';
import modern_weapons from './modern_weapons.json';
import modern_world_geography from './modern_world_geography.json';

// GBY doesn't have split files for characters/factions like Wuxia yet, 
// so we don't need complex re-exports for now. 
// Just exporting the modern data modules.

export const GodBlessYouLore = {
    modern_combat,
    modern_elixirs,
    modern_factions,
    modern_levels,
    modern_romance_guide,
    modern_skills,
    modern_terminology,
    modern_weapons,
    modern_world_geography
};
