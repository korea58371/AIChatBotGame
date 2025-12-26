import factions_summary from './factions.json';



import locations from './locations.json';
import geography_guide from './world_geography.json';
import martial_arts_levels from './martial_arts_levels.json';
import wuxia_terminology from './wuxia_terminology.json';
import romance_guide from './wuxia_romance_guide.json';
import combat_guide from './martial_arts_combat.json';
import weapons from './weapons.json';
import martial_arts_skills from './martial_arts_skills.json';

// import FactionsDetail from './factions/faction.json'; // Deleted
import * as CharactersDetail from './characters/index';

export const WuxiaLore = {

    factions_summary,

    locations,
    geography_guide,
    martial_arts_levels,

    // New Lore Modules
    wuxia_terminology,
    romance_guide,
    combat_guide,
    weapons,
    martial_arts_skills,

    factionsDetail: factions_summary, // Now using the summary file
    charactersDetail: CharactersDetail
};
