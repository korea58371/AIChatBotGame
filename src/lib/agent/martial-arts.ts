
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../model-config';
import { MartialArt } from '../store';
import { RelationshipManager } from '../relationship-manager'; // Context Helper

export interface MartialArtsOutput {
  new_arts?: MartialArt[];
  updated_arts?: { id: string, proficiency_delta: number }[];
  realm_progress_delta?: number; // %
  realm_update?: string; // New Realm Name
  stat_updates?: { hp?: number, mp?: number, neigong?: number, active_injuries?: string[] }; // Penalty/Growth
  audit_log?: string; // Why was it nerved/accepted?
  usageMetadata?: any;
  _debug_prompt?: string;
}

export class AgentMartialArts {
  private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

  private static readonly SYSTEM_PROMPT = `
You are the [Martial Arts Arbiter & Balancer] for a Wuxia game.
Your goal is to translate narrative combat/training into strict game data (Json).
You must also act as a REALITY AUDITOR to prevent "God Mode" (OP) exploits.

[Responsibilities]
1. **Skill Analysis**: Identify if the player learned or improved a martial art in the story.
2. **Growth Tracking**: Award 'Realm Progress' for training or enlightenment.
3. **Reality Audit (The "Yes, But..." Protocol)**:
   - If a player uses a move FAR beyond their Realm, you must NOT grant them the full power.
   - **Nerf**: Grant a "Flawed" or "Unstable" version of the skill.
   - **Punish**: Apply "Internal Injury" or "Qi Deviation" (Main Stat Drop).

[Growth Tracking (Neigong & Realm)]
1. **Neigong (Internal Energy in Years)**: 
   - You MUST award 'stat_updates.neigong' (float, e.g., 0.1, 0.5, 1.0) for:
     - Meditation/Training: +0.1 ~ +0.5 Years
     - Consuming Elixirs: +1.0 ~ +5.0 Years (depending on potency)
     - Enlightenment/Epiphany: +1.0 ~ +3.0 Years
     - Energy Transfer (from masters): +5.0+ Years
   - **This is separate from Realm Progress.** A player can gain years without changing Realm immediately, but Years are the prerequisite for Realm.
2. **Realm Progress (%)**:
   - Represents the "Proximity to Breakthrough" within the current realm.
   - +1~3% for training, +5~10% for combat/enlightenment.

[Realm Thresholds & Correction (AUTO-UPDATE)]
*You MUST check 'Current Stats(Neigong)' + 'New Neigong Gain' against these thresholds.
If the Total Neigong exceeds the requirement, you MUST output "realm_update": "New Realm Name".*

1. 삼류 (3rd Rate): 0~9.9 Years.
2. 이류 (2nd Rate): 10~19.9 Years. (Requires > 10 Years)
3. 일류 (1st Rate): 20~39.9 Years. (Requires > 20 Years)
4. 절정 (Peak): 40~59.9 Years. (Requires > 40 Years)
5. 초절정 (Super Peak): 60~119.9 Years. (Requires > 60 Years)
6. 화경 (Transcendence): 120+ Years.
7. 현경 (Legend): 200+ Years.

[Example Logic]
- Current: 3rd Rate, 9.5 Years.
- Action: "Consumes 10-Year Snow Ginseng."
- Result: Neigong +1.0 Year -> Total 10.5 Years.
- Threshold Check: 10.5 > 10.0 (2nd Rate Threshold).
- **OUTPUT**: { "stat_updates": { "neigong": 1.0 }, "realm_update": "이류 (2nd Rate)", "realm_progress_delta": 0 }
[Output Schema]
{
  "new_arts": [ { "id": "skill_id", "name": "Skill Name", "rank": "Rating", "type": "Type", "description": "Desc", "proficiency": 0, "effects": ["Effect 1"], "createdTurn": 0 } ],
  "updated_arts": [ { "id": "skill_id", "proficiency_delta": 5 } ],
  "realm_progress_delta": 0, // 0-100
  "realm_update": "Next Rank Name" | null,
  "stat_updates": { "hp": -10, "active_injuries": ["Internal Injury"], "neigong": 0.5 },
  "audit_log": "Player tried Sword Aura at 3rd Rate. Granted 'Fake Aura' and applied injury."
}

[Rules]
- **Realm Progress**: 
  - Routine training: +1~3%
  - Life/Death Combat: +3~8%
  - Enlightenment (Epiphany): +10~20%
- **Realm Correction (CRITICAL)**:
  - Check 'Current Stats (Neigong)'. If player has enough Energy (Years) for a higher realm, you MUST suggest a 'Realm Update'.
  - Example: If Player is '3rd Rate' but has 15 Years Energy -> Update to '2nd Rate'.

[OP Prevention]: 
  - If (Player = 3rd Rate) AND (Story = "Smashes mountain"):
    - Result: Skill = "Mountain Smashing (Delusion)", Effect = "Self-Stun", Injury = "Broken Arm".

[Naming Rules] (CRITICAL)
- **Style**: MUST use Wuxia-style names (Sino-Korean idioms or Poetic names). 
- **NO ENGLISH (ABSOLUTE RULE)**: Do NOT include English translations or parentheses with English. All 'description', 'effects', 'realm_update', 'audit_log' MUST be in KOREAN (한국어).
- **Significant Only**: Do NOT generate skills for trivial actions.

[Naming Pattern Registry] (Use these suffixes)
1. **Internal Energy (Neigong)**:
   - Roots: 신공(神功), 천공(天功), 마공(魔功), 기공(氣功), 허공(虛功), 심공(心功), 결(訣), 진결(眞訣), 심결(心結), 심법(心法), 행공(行功), 단공(段功), 일공(一功), 괴공(壞功), 사공(死功), 원공(元功)
   - Ex: 구음진결, 자하신공, 태극심법, 혼원공

2. **Swordsmanship (Sword)**:
   - Roots: 검(劍), 검법(劍法), 검식(劍式), 검결(劍訣), 검무(劍舞)
   - Ex: 독고구검, 태극검법, 낙화검식

3. **Fist/Palm (Unarmed)**:
   - Roots: 권(拳), 장(掌), 지(指), 수(手), 파(破), 인(印)
   - Ex: 일보신권, 태극권, 항룡십팔장, 탄지공

4. **Staff/Spear (Polearm)**:
   - Roots: 봉(棒), 탐(探), 곤(棍), 창(槍), 구(鉤)
   - Ex: 구천뇌봉, 타구봉법, 양가창법

5. **Movement (Lightness)**:
   - Roots: 보(步), 신법(身法), 행(行), 종(縱), 비(飛)
   - Ex: 답설무흔, 운룡대팔식, 수상비

[Valid Generation Examples]
- "독고구검" (O), "구천뇌봉" (O), "일보신권" (O)
- "Fire Punch" (X - English)
- "화염 펀치" (X - Modern)
- "걷기" (X - Trivial)
`;

  static async analyze(
    userInput: string,
    storyText: string,
    playerRealm: string,
    playerStats: any,
    turnCount: number
  ): Promise<MartialArtsOutput> {
    const apiKey = this.apiKey;
    if (!apiKey) return {};

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_CONFIG.LOGIC, // Use Logic model for balancing
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction: this.SYSTEM_PROMPT
    });

    const prompt = `
[Context]
Current Realm: ${playerRealm}
Current Stats: ${JSON.stringify(playerStats)}
Current Turn: ${turnCount}

[Input Story]
User Action: "${userInput}"
Narrative:
"""
${storyText}
"""

[Instruction]
Analyze the narrative for martial arts changes.
If the player attempts a skill beyond [${playerRealm}], apply the "Yes, But..." protocol.
Generate the JSON output.
`;
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      try {
        const json = JSON.parse(text);

        // [Safety Guard for Growth]
        // Prevent "Indiscriminate Vertical Rise" (무분별한 수직상승 방지)
        if (json.realm_progress_delta && typeof json.realm_progress_delta === 'number') {
          const originalDelta = json.realm_progress_delta;
          const MAX_GROWTH_CAP = 20; // Max 20% per turn (Event hardcore limit)

          if (originalDelta > MAX_GROWTH_CAP) {
            json.realm_progress_delta = MAX_GROWTH_CAP;
            json.audit_log = (json.audit_log || "") + ` [System] Growth capped from ${originalDelta}% to ${MAX_GROWTH_CAP}%.`;
          }

          // [Sanity Check] If Realm Update is requested, check if it makes sense
          // But we trust the Agent's decision on 'Epiphany' causing a breakthrough, 
          // provided the growth was sufficient or they were already at 99%.
          // We'll leave Realm Update logic to the Agent, but we MUST control the numeric delta.
        }

        return {
          ...json,
          usageMetadata: response.usageMetadata,
          _debug_prompt: prompt
        };
      } catch (e) {
        console.error("[AgentMartialArts] JSON Parse Error", e);
        return {};
      }
    } catch (e) {
      console.error("[AgentMartialArts] API Error", e);
      return {};
    }
  }
}
