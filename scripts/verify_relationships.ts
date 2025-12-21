
// @ts-nocheck
import { LoreConverter } from '../src/lib/lore-converter';

const mockCharacter = {
    basic_profile: {
        이름: "TestChar",
        나이: "20",
        소속: "TestClan",
        신분: "TestRank",
        martial_arts_realm: { name: "1st Rate", power_level: 9 }
    },
    relationships: {
        "FriendA": "Best Friend",
        "EnemyB": "Mortal Enemy (Killed father)"
    }
};

const charactersDetail = {
    characters_main: [mockCharacter]
};

console.log("Testing LoreConverter relationship output:");
console.log("---------------------------------------------------");
const output = LoreConverter.convertCharacters(charactersDetail);
console.log(output);
console.log("---------------------------------------------------");


if (output.includes("FriendA: Best Friend") && output.includes("EnemyB: Mortal Enemy")) {
    console.log("SUCCESS: Relationships found in output.");
} else {
    console.log("FAILURE: Relationships NOT found. Raw output:");
    console.log(output);
}
