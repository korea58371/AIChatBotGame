
// Dynamic Skill Prompt Generator for God Bless You
// Controls information visibility based on Story Phase to prevent spoilers/hallucinations.

export const getDynamicSkillPrompt = (phaseStr: string, skills: string[]): string => {
   // Phase Parsing (e.g. "Phase 1: 시궁창..." -> 1)
   let phase = 0;
   if (phaseStr.includes('Phase 0')) phase = 0;
   else if (phaseStr.includes('Phase 1')) phase = 1;
   else if (phaseStr.includes('Phase 2')) phase = 2;
   else if (phaseStr.includes('Phase 3')) phase = 3;

   // Detect if '처세술' is learned (It's F-rank default, usually always there)
   // But we check specific skill strings just in case
   const hasSurvival = true; // Assuming protagonist always has it in this mode

   let skillDesc = "";

   // [Phase 0: Unawakened - No Skills]
   if (phase < 1) {
      skillDesc = "없음 (일반인)";
   }
   // [Phase 1: Survival Only]
   // Strictly hide ALL 'Copy' related info.
   else if (phase === 1) {
      skillDesc = `
1. **[F급: 처세술 (The Art of Survival)]**
   - **효과**: 상대의 기분을 파악(눈치)하고, 자존심을 버려 비위를 맞추는 능력.
   - **전투력**: **0 (Zero)**. 물리적 위력이나 마법적 강제력(세뇌 등)이 **전혀 없음**.
   - **작동 원리**: 플레이어가 **[비굴한 선택지]**(무릎 꿇기, 구두 핥기 등)를 고를 때만 성공 확률 보정.
   - **페널티**: 과도한 아첨은 '간신배' 평판을 얻어 오히려 역효과를 냄.
`.trim();
   }

   // [Phase 2: Partial Unlock]
   // Unlock 'Copy' concept but with heavy penalties and 'Degraded' status.
   else if (phase === 2) {
      skillDesc = `
1. **[F급: 처세술 (The Art of Survival)]**
   - 효과: 비굴한 아첨으로 생존율 증가. (전투력 없음)

2. **[HIDDEN: 그림자 흉내 (Copy) - 잠금 해제됨]**
   - **상태**: [열화 버전 (Degraded)] - 효율 10% 미만.
   - **효과**: [깊은 유대(호감도 Max)]를 맺은 대상의 능력을 흉내냄.
   - **페널티**: 사용 시 극심한 두통, 코피, 체력 고갈. (장시간 사용 불가)
   - **현재 복제 가능 목록**: (호감도 높은 대상의 스킬만 가능)
`.trim();
   }

   // [Phase 3+: Synergy & Mastery]
   // Full Unlock
   else {
      skillDesc = `
1. **[S급: 처세술 (Master of Socialing)]**
   - 효과: 상대의 심리를 장악하고 원하는 방향으로 유도함. (군중 제어 가능)

2. **[고유 권능: 거울의 군주 (Mirror Monarch)]**
   - **효과**: 대상의 능력을 100% 효율로 복제 및 저장.
   - **시너지**: 서로 다른 스킬을 융합하여 상위 스킬(S급 이상) 창조 가능.
   - **조건**: 대상과의 [영혼의 유대] 필요.
`.trim();
   }

   return skillDesc;
};
