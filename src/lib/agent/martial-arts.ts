
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

[Realms (Reference)]
1. 삼류 (3rd Rate): Muscles only. No Qi release.
2. 이류 (2nd Rate): Qi flow inside body.
3. 일류 (1st Rate): Qi on weapon (Sword Aura basic).
4. 절정 (Peak): Sword Aura (Qi projection).
5. 초절정 (Super Peak): Sword Glare (Solid Qi).
6. 화경 (Transcendence): Mind Sword basic.
7. 현경 (Legend): Nature unity.

[Output Schema]
{
  "new_arts": [ { "id": "skill_id", "name": "Skill Name", "rank": "Rating", "type": "Type", "description": "Desc", "proficiency": 0, "effects": ["Effect 1"], "createdTurn": 0 } ],
  "updated_arts": [ { "id": "skill_id", "proficiency_delta": 5 } ],
  "realm_progress_delta": 0, // 0-100
  "realm_update": "Next Rank Name" | null,
  "stat_updates": { "hp": -10, "active_injuries": ["Internal Injury"] },
  "audit_log": "Player tried Sword Aura at 3rd Rate. Granted 'Fake Aura' and applied injury."
}

[Rules]
- **Realm Progress**: 
  - Routine training: +1~5%
  - Life/Death Combat: +5~10%
  - Enlightenment (Epiphany): +20~50%
- **OP Prevention**: 
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
