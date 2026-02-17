import modern_combat from './modern_combat.json';
import modern_elixirs from './modern_elixirs.json';
import modern_factions from './modern_factions.json';
import modern_levels from './modern_levels.json';
import modern_romance_guide from './modern_romance_guide.json';
import modern_skills from './modern_skills.json';
import modern_terminology from './modern_terminology.json';
import modern_weapons from './modern_weapons.json';
import modern_world_geography from './modern_world_geography.json';
import locations from './locations.json';

// GBY Lore Module
// locations is included to enable shared engine features:
// - pre-logic/post-logic/choices: minimap context (lore.locations.regions)
// - casting: resolveLocationHierarchy (lore.locations.regions)
// - prompt-manager: location metadata injection (owner/faction)

export const GodBlessYouLore = {
    locations,
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
