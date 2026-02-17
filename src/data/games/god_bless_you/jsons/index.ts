import combat from './combat.json';
import elixirs from './elixirs.json';
import factions from './factions.json';
import levels from './levels.json';
import romance_guide from './romance_guide.json';
import skills from './skills.json';
import terminology from './terminology.json';
import weapons from './weapons.json';
import world_geography from './world_geography.json';
import locations from './locations.json';

// GBY Lore Module
// locations is included to enable shared engine features:
// - pre-logic/post-logic/choices: minimap context (lore.locations.regions)
// - casting: resolveLocationHierarchy (lore.locations.regions)
// - prompt-manager: location metadata injection (owner/faction)

export const GodBlessYouLore = {
    locations,
    combat,       // was: modern_combat
    elixirs,      // was: modern_elixirs
    factions,     // was: modern_factions
    levels,       // was: modern_levels
    romance_guide,// was: modern_romance_guide
    skills,       // was: modern_skills
    terminology,  // was: modern_terminology
    weapons,      // was: modern_weapons
    world_geography // was: modern_world_geography
};
