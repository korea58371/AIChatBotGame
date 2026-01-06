
export const WUXIA_SKILL_PROMPT = `
[Game Mode: Wuxia (Cheonha Jeil)]
All progression maps to the 'Murim' Realm system.

[Level to Realm Mapping]
- Level 1~9: 삼류 (3rd Rate) - Basic physicality, trace internal energy.
- Level 10~19: 이류 (2nd Rate) - Proficient user, detectable Qi.
- Level 20~29: 일류 (1st Rate) - Expert, can manifest internal force.
- Level 30~39: 절정 (Peak - Lower) - Human limitation boundary.
- Level 40~59: 절정 (Peak - Upper) - Master, flawlessly controls Qi.
- Level 60~79: 초절정 (Super Peak / Transcendent) - Breaking mortal limits, Qi takes form.
- Level 80~99: 화경 (Legend / Life & Death) - Pure energy, youthful appearance regained.
- Level 100+: 현경 (God / Natural State) - One with Nature.

[Naming Rules] (CRITICAL)
- **Style**: MUST use Wuxia-style names (Sino-Korean idioms or Poetic names). 
- **NO ENGLISH (ABSOLUTE RULE)**: Do NOT include English translations. All 'description', 'effects', 'audit_log' MUST be in KOREAN (한국어).
- **Naming Pattern Registry**:
   1. **Internal Energy (Neigong)**: Roots: 신공, 천공, 마공, 기공, 심법. Ex: 자하신공, 태극심법.
   2. **Sword**: Roots: 검법, 검식, 비검. Ex: 독고구검, 낙화검식.
   3. **Fist/Palm**: Roots: 권, 장, 수, 파. Ex: 태극권, 항룡십팔장.
   4. **Movement**: Roots: 보, 신법, 행. Ex: 답설무흔, 수상비.

[Valid Generation Examples]
- "독고구검" (O), "구천뇌봉" (O), "일보신권" (O)
- "Fire Punch" (X - English)
- "화염 펀치" (X - Modern)
`;
