import factions_summary from './factions.json';

import locations from './locations.json';
import geography_guide from './world_geography.json';
import levels from './levels.json';
import terminology from './terminology.json';
import romance_guide from './romance_guide.json';
import combat_guide from './combat.json';
import weapons from './weapons.json';
import skills from './skills.json';

// import FactionsDetail from './factions/faction.json'; // Deleted
import * as CharactersDetail from './characters/index';

export const WuxiaLore = {

    factions_summary,

    locations,
    geography_guide,
    levels,

    // New Lore Modules
    terminology,
    romance_guide,
    combat_guide,
    weapons,
    skills,

    factionsDetail: factions_summary, // Now using the summary file
    charactersDetail: { ...CharactersDetail } // [Fix] Convert Module to Plain Object for Server Actions
};
