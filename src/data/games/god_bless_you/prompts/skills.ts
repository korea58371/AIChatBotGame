import { translations } from '../../../translations';

const r = translations.ko.god_bless_you.ranks;
const s = translations.ko.god_bless_you.skills;

export const GBY_SKILL_PROMPT = `
[Game Mode: God Bless You (Hunter / Fantasy)]
All progression maps to the 'Hunter Rank' system.

[Level to Rank Mapping]
- Level 0: ${r.rank_none} - [CRITICAL RESTRICTION] No EXP gain from daily life. Level up (0->1) ONLY possible via 'Awakening Event' or 'Combat with Otherworld Species'.
- Level 1~9: ${r.rank_f} (Civilian / Weak Awakened)
- Level 10~19: ${r.rank_e} (Novice Hunter)
- Level 20~29: ${r.rank_d} (Competent Hunter)
- Level 30~39: ${r.rank_c} (Veteran, elite soldier equivalent)
- Level 40~59: ${r.rank_b} (Wall of Talent, superhuman)
- Level 60~79: ${r.rank_a} (National Level asset, one-man army)
- Level 80~99: ${r.rank_s} (Strategic Weapon, calamity class)
- Level 100+: ${r.rank_ss} (Semi-Divine, World Threat)

[Naming Rules] (CRITICAL)
- **Style**: Modern Fantasy / Hunter styling.
- **Language**: Korean (Hangul) is preferred. English words can be used for specific styling (e.g. 'S급', 'Gate'), but Skill names should remain intuitive.
- **Naming Patterns**:
   1. **Skills**: [${s.화염구}], [${s.참격}], [${s.은신}], [${s.마나실드}].
   2. **Prefixes/Suffixes**: '${s.상급}', '${s.하급}', '${s.궁극}', '${s.암흑}', '${s.신성}'.
   3. **Passive**: [${s.마나하트}], [${s.강철피부}], [${s.제6감}].

[Valid Generation Examples]
- "${s.화염구.replace(/\(.*\)/, '')}" (O), "${s.이연참}" (O), "${s.마나장벽}" (O)
- "천하제일검" (X - Wuxia Style)
`;
