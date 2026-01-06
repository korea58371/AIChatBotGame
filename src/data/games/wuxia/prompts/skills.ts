import { translations } from '../../../translations';

const r = translations.ko.wuxia.realms;

export const WUXIA_SKILL_PROMPT = `
[Game Mode: Wuxia (Cheonha Jeil)]
All progression maps to the 'Murim' Realm system.

[Unified Realm & Rank System]
(These Korean terms are the ONLY allowed string values for the 'rank' field. Do NOT use 'S-Rank', 'Level 1', etc.)

- **${r.intro}**: [Level 1~5] Basic breathing or stance techniques.
- **${r.third_rate}**: [Level 6~9] Common martial arts. Trace internal energy.
- **${r.second_rate}**: [Level 10~19] Proficient. Detectable Qi.
- **${r.first_rate}**: [Level 20~29] Expert. Manifests internal force.
- **${r.peak}**: [Level 30~59] Master. Flawless Qi control.
- **${r.transcendent}**: [Level 60~79] Grandmaster. Breaking limits.
- **${r.harmony}**: [Level 80~99] Mythical. Youth regained.
- **${r.mystic}**: [Level 100+] Natural State. God-tier.

[Naming Rules] (CRITICAL)
- **Style**: MUST use Wuxia-style names (Sino-Korean idioms or Poetic names). 
- **NO ENGLISH (ABSOLUTE RULE)**: Do NOT include English translations. All 'description', 'effects', 'audit_log' MUST be in KOREAN (한국어).
- **Naming Pattern Registry**:
   1. **Internal Energy (Neigong)**: Roots: 신공, 천공, 마공, 기공, 심법. Ex: 자하신공, 태극심법.
   2. **Sword**: Roots: 검법, 검식, 비검. Ex: 독고구검, 낙화검식.
   3. **Fist/Palm**: Roots: 권, 장, 수, 파. Ex: 태극권, 항룡십팔장.
   4. **Movement**: Roots: 보, 신법, 행. Ex: 답설무흔, 수상비.

[Valid Generation Examples]
- **Positive (Formal)**:
  - "유술을 사용하여 적을 매쳤다" -> Create Skill "유술" (O)
  - "제왕군림보를 수련하였다" -> Create Skill "제왕군림보" (O)
  - "보법을 밟아 피했다" -> Create Skill "보법" (or specific name if mentioned)
- **Negative (Generic/Descriptive)**:
  - "적을 잡아 바닥에 패대기쳤다" -> NO SKILL (Generic Action) (X)
  - "강대한 기운으로 적을 옭아맸다" -> NO SKILL (Simple Qi Application) (X)
  - "검을 휘둘러 막았다" -> NO SKILL (Basic Action) (X)
- **Naming Checks**:
  - "Fire Punch" (X - English)
  - "화염 펀치" (X - Modern)
`;
