import body_constitutions from './body_constitutions.json';
import disease_constitutions from './disease_constitutions.json';
import elixirs from './elixirs.json';
import factions_summary from './factions.json';
import fate_stars from './fate_stars.json';
import honorifics_system from './honorifics_system.json';
import imperial_court from './imperial_court.json';
import locations from './locations.json';
import martial_arts_levels from './martial_arts_levels.json';
import martial_arts_skills from './martial_arts_skills.json';
import measurement_system from './measurement_system.json';
import organization_system from './organization_system.json';
import weapons from './weapons.json';
import world_geography from './world_geography.json';

import * as FactionsDetail from './factions/index';
import * as CharactersDetail from './characters/index';

export const WuxiaLore = {
    body_constitutions,
    disease_constitutions,
    elixirs,
    factions_summary,
    fate_stars,
    honorifics_system,
    imperial_court,
    locations,
    martial_arts_levels,
    martial_arts_skills,
    measurement_system,
    organization_system,
    weapons,
    world_geography,
    factionsDetail: FactionsDetail,
    charactersDetail: CharactersDetail
};
