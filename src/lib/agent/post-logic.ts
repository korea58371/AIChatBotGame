
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../model-config';
import { RelationshipManager } from '../relationship-manager';

export interface PostLogicOutput {
  mood_update?: string;
  location_update?: string; // [NEW] Region_Place
  relationship_updates?: Record<string, number>; // ID: 변경량
  stat_updates?: Record<string, number>; // [NEW] Personality Stat Updates (morality, eloquence, etc.)
  new_memories?: string[];
  character_memories?: Record<string, string[]>; // [NEW] Character specific memories (Long-term ONLY)
  activeCharacters?: string[]; // [NEW] Active characters in scene
  inline_triggers?: { quote: string, tag: string }[]; // [NEW] Quotes to inject tags into
  summary_trigger?: boolean;
  dead_character_ids?: string[]; // [NEW] Characters confirmed dead this turn

  // [New] Injury Management
  resolved_injuries?: string[]; // Injuries to remove (Healed or Mutated)
  new_injuries?: string[];      // Injuries to add (New or Mutation Result)

  // [Narrative Systems]
  goal_updates?: { id: string, status: 'COMPLETED' | 'FAILED' | 'ACTIVE', updates?: string }[];
  new_goals?: { description: string, type: 'MAIN' | 'SUB' }[];
  tension_update?: number; // Delta

  usageMetadata?: any; // [Cost] 토큰 사용량
  _debug_prompt?: string; // [Debug] 실제 프롬프트
}

export class AgentPostLogic {
  private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

  private static readonly SYSTEM_PROMPT = `
You are the [Post-Logic Analyst].
Your job is to read the generated story turn and identify IMPLICIT changes in the game state.
Focus on: Emotion (Mood), Relationships, Long-term Memories, PERSONALITY SHIFTS, GOALS, and TENSION.

[Memory Logic] (Strict Filtering)
- **Do NOT record trivial events.** (e.g. "We ate dinner", "He smiled at me", "I felt sad") -> These are handled by Relationship Score.
- **Record ONLY Long-term Significant Facts:**
  1. **Promises/Contracts:** "Promised to meet at the teahouse at noon", "Agreed to kill the Demon King".
  2. **Permanent Changes:** "Lost a left arm", "Acquired the Legendary Sword", "Housing burned down".
  3. **Skill/Growth:** "Learned the Flying Dragon Fist", "Realized the Dao of Empty Sky".
  4. **Major Secrets:** "Learned that the Player is actually the King", "Discovered the spy".
- **Format:** Keep it concise. "Promise: Meet at Teahouse", "Injury: Lost Left Eye".

[Goal Tracking]
- Identify if the player creates a new Goal ("I will become the Alliance Leader").
- Monitor [Active Goals] for progress, completion, or failure based on the story.

[Narrative Tension System] (-100 ~ +100)
- **Concept**: Tension is the "Probability of Crisis". High Tension = Danger imminent. Negative Tension = Guaranteed Peace (Cool-down).
- **ACCUMULATION (Time/Environment/Inaction):**
  - **Dangerous Place/Night:** +1 ~ +3 (Slow passive rise)
  - **Ignoring Flags:** +5 ~ +10 (User ignores warning clues)
  - **Active Provocation:** +10 ~ +20 (Spike, but survivable)
  - **Static Combat:** +1 (Very slow rise during stalemate)

- **RESOLUTION (The "Cool-down" Rule):**
  - If a Crisis/Combat is **Resolved** (Win/Escape/Negotiate/Avoid):
    - **Invert Current Tension**: Delta = -(Current Tension * 1.5). 
      - Example: Current 60 -> Resolved -> Delta -90 -> Result -30.
    - **Logic**: Higher tension solved = Longer peace period.
  
- **RECOVERY (Peace Period):**
  - If Tension is Negative (< 0):
    - **Natural Recovery:** +3 ~ +5 (Return to 0).
  - If Tension is Positive but Character is RESTING/SAFE (e.g. Inn, Home):
    - **Natural Decay:** -5 ~ -10 (Relaxation).

[Health & Status Logic]
- Detect implied HEALING or WORSENING of injuries.
- **Healing**: If player visits a doctor, rests, or uses medicine, identify which 'Active Injuries' are cured.
  - OUTPUT: "resolved_injuries": ["Broken Arm", "Internal Injury"]
- **Worsening/Mutation**: If player ignores an injury and strains themselves, REMOVE the old injury and ADD a worse one.
  - Example (Fracture -> Disabled): 
    - "resolved_injuries": ["Right Arm Fracture"]
    - "new_injuries": ["Right Arm Permanent Disability"]
- **New Injury**: If a new injury occurs implicit in the narrative (not combat), add it to 'new_injuries'.

[Rules]
- Personality Stats: morality, courage, energy, decision, lifestyle, openness, warmth, eloquence, leadership, humor, lust.
- Physical/Mental Stats: hp (Physical Condition), mp (Mental Focus/Energy).
[Rules]
- Personality Stats (-100 to 100):
   - morality: -100 (Fiend/No Conscience) <-> 100 (Saint/Paragon)
   - courage: -100 (Coward) <-> 100 (Heroic)
   - energy: -100 (Lethargic) <-> 100 (Energetic)
   - decision: -100 (Indecisive) <-> 100 (Decisive)
   - lifestyle: -100 (Chaotic) <-> 100 (Disciplined)
   - openness: -100 (Closed) <-> 100 (Open)
   - warmth: -100 (Cold) <-> 100 (Warm)
   - eloquence: -100 (Mute/Blunt) <-> 100 (Orator)
   - leadership: -100 (Follower) <-> 100 (Leader)
   - humor: -100 (Serious) <-> 100 (Jester)
   - lust: -100 (Ascetic) <-> 100 (Hedonist)

- Physical/Mental Stats: hp, mp, str, agi, int, vit, luk.

[Personality Update Guidelines] (Consistency & Inertia)
- **Principle:** Stats represent a developing character arc.
- **Diminishing Returns (Saturation):**
  - High stats (>80) do NOT increase from minor actions. A 'Saint' giving a coin gets +0 Morality.
  - To reach Extremes (90+), one must make **Sacrifices** or face **Major Risks**.
- **The "Hypocrisy" Check (Expectation Gap):**
  - If a character has EXTREME stats (>90), they are held to a higher standard.
  - Example: A 'Saint' (Morality 95) who gives food but *hesitates* or *complains* -> **Morality -5**.
    - Why? Because it breaks the image of perfection. A normal person would get +2, but a Saint fails expectations.
- **Inertia (Gravity):**
  - It is hard to build (Climb), easy to destroy (Fall).
  - One major crime can drop Morality 100 -> 50. But one good deed cannot fix Morality -100 -> -50.
  - **Out-of-Character:** A Saint (100) committing murder -> -60 (Major Corruption). A Villain (-100) saving a cat -> +5 (Rare kindness).

[Relationship Update Guidelines] (Relationship Inertia)
- **Principle:** Relationships take time to build. Do NOT allow instant massive jumps (e.g., Stranger -> Lover in one turn).
- **Update Magnitude Limits (per turn) [STRICT]:**
  - **Small (+1 ~ +2):** Compliments, agreement, pleasant small talk. (Standard)
  - **Medium (+3 ~ +5):** Gifts, significant favors, deep emotional moment.
  - **Large (+6 ~ +10):** Saving a life, major sacrifice. (Very Rare)
  - **FORBIDDEN (> +10):** Do NOT change score by more than 10 in a single turn. Relationships must not jump instantly.
- **Negative Limits:** 
  - **Mild (-1 ~ -3):** Disagreement, unwanted teasing, minor rudeness.
  - **Moderate (-4 ~ -9):** Insults, threats, major argument.
  - **Severe (-10 ~ -100):** Murder of loved ones, Catastrophic Betrayal. **(UNLIMITED NEGATIVE DROP)**.
    - If the player kills a parent or commits an unforgivable sin, result can be -50 or even -100 instantly.
- **Tier Gating:** 
  - Even if the vibe is 'Romantic', if the score is 0 (Stranger), only give +5 (Medium increase). Do not jump to 50.
  - Advance ONE tier at a time.

- **Diminishing Returns (Saturation):**
  - **High Tiers (Lvl 5+):** Routine compliments or small talk (+1) should eventually have 0 effect. Only meaningful events matter.
    - Example: A 'Lover' saying "I love you" is expected (0 or +1), not a major event (+10).
    - To gain score at high tiers, the player must show *new* devotion or shared hardship.
  - **Low Tiers (Lvl 0~2):** Small talk (+1~3) is effective for building initial rapport.

- **Relative Impact (Betrayal):**
  - **High Tiers:** A betrayal or rude remark hits HARDER. (e.g., Stranger being rude = -2, Lover being rude = -10).

- **Extreme Thresholds (Lock-in / Resilience):**
  - **Blind Devotion (Score > 90):** The character is deeply devoted. 
    - Minor offenses (-1 ~ -10) are ignored or interpreted positively (teasing). 
    - Only "Catastrophic Betrayal" (e.g., trying to kill them) can break this state (-50).
  - **Vendetta / Nemesis (Score < -90):** The character loathes the player.
    - Compliments or gifts (+1 ~ +10) are REJECTED or viewed as insults/traps (0 change).
    - Only a "Life Debt" or "World-Shaking Redemption" can unlock this state.

[Inline Event Triggers] (CRITICAL)
You must identify the EXACT sentence segment (quote) where a change happens and generate a tag for it.
- Usage: When the text describes an event that justifies a stat/relationship change.
- Allowed Tags: ONLY <Stat> and <Rel>.
- FORBIDDEN Tags: Do NOT generate tags for Location, Death, or Personality (e.g., <Location_Update>, <Dead>). These are handled by the JSON fields.
- Format:
  - quote: The exact substring from the AI's response (unique enough to find).
  - tag: <Stat hp='-5'> or <Rel char='Name' val='5'>

[Location Updates]
- Identify if the characters have moved to a NEW significant location.
- Format: "Region_Place" in KOREAN (e.g., "사천_성도", "하북_팽가", "중원_객잔", "북해_빙궁").
- Use standard Wuxia region names: 중원, 사천, 하북, 산동, 북해, 남만, 서역, 등.
- If no change, return null.

[Output Schema (JSON)]
{
  "mood_update": "tension" | "romance" | "daily" | null,
  "location_update": "Region_Place" | null,
  "relationship_updates": { "character_id": 5, "another_char": -2 },
  "stat_updates": { "morality": -2, "eloquence": 1, "hp": -5, "mp": 2 },
  "character_memories": { 
      "soso": ["Player praised my cooking", "Player asked about my past"], 
      "chilsung": ["Player defeated me", "Player gave me a healing potion"] 
  },
  "inline_triggers": [
      { "quote": "The bandit's blade grazed my arm!", "tag": "<Stat hp='-5'>" },
      { "quote": "She laughed at my joke.", "tag": "<Rel char='NamgungSeAh' val='5'>" }
  ],
  "tension_update": number, // Optional: Shift in tension (-100 to +100)
  "resolved_injuries": ["Broken Arm"], // Optional
  "new_injuries": ["Permanent Disability"], // Optional
  "new_goals": [{ "type": "MAIN" | "SUB", "description": "Goal description" }], // Optional
  "goal_updates": [{ "id": "goal_id", "status": "COMPLETED" | "FAILED" | "ACTIVE" }], // Optional
  "activeCharacters": ["soso", "chilsung"], 
  "summary_trigger": false,
  "goal_updates": [ { "id": "goal_1", "status": "COMPLETED" } ],
  "new_goals": [ { "description": "Survive the ambush", "type": "SUB" } ],
  "tension_update": 10,
  "dead_character_ids": ["bandit_leader"]
}
[Critically Important]
- **LANGUAGE**: All output strings (especially 'location_update', 'new_goals' description, 'character_memories') MUST be in KOREAN (한국어).
- For 'activeCharacters', list EVERY character ID that speaks or performs an action in the text.
- For 'character_memories', extract 1 key memory per active character if they had significant interaction with the player this turn.
- For 'dead_character_ids', list IDs of ANY character who died or was permanently incapacitated/killed in this turn.
- The 'quote' in 'inline_triggers' MUST be an EXACT substring of the 'AI' text.
`;

  static async analyze(
    userMessage: string,
    aiResponse: string,
    currentMood: string,
    validCharacters: string[],
    playerName: string,
    currentStats: any,
    activeRelationships: any,
    gameState: any, // [NEW] Full State access for Maps
    language: 'ko' | 'en' | null = 'ko'
  ): Promise<PostLogicOutput> {
    // [DEBUG] Log Inputs
    // console.log(`[AgentPostLogic] Input Length: ${storyText.length}, Mood: ${currentMood}`);

    const apiKey = this.apiKey;
    if (!apiKey) return {};

    const genAI = new GoogleGenerativeAI(apiKey);

    // [Context Caching]
    // Split Static (System Instruction) and Dynamic (User Message)
    const staticSystemPrompt = this.SYSTEM_PROMPT;

    const model = genAI.getGenerativeModel({
      model: MODEL_CONFIG.LOGIC, // Standard Logic/Flash Model
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction: staticSystemPrompt // [CACHE ENABLED] Pass static prompt here
    });

    // [Mini-Map Injection for Validation]
    let locationContext = "";
    const currentLocation = gameState.currentLocation || "Unknown";
    const locationsData = gameState.lore?.locations;

    if (locationsData && locationsData.regions && currentLocation) {
      // Simply list ALL Region Names + Current Zone Spots
      const regionsList = Object.keys(locationsData.regions);
      let currentZoneSpots: string[] = [];
      let currentRegionName = "Unknown";

      // Find current zone spots
      for (const [rName, rData] of Object.entries(locationsData.regions) as [string, any][]) {
        if (rData.zones && rData.zones[currentLocation]) {
          currentRegionName = rName;
          currentZoneSpots = rData.zones[currentLocation].spots || [];
          break;
        }
        if (rName === currentLocation) {
          currentRegionName = rName;
        }
      }

      locationContext = `
[World Map Data]
- Valid Major Regions (for long travel): ${regionsList.join(', ')}
- Current Location: ${currentLocation} (Region: ${currentRegionName})
- Valid Local Spots (for local move): ${currentZoneSpots.join(', ')}
`;
    }

    const dynamicPrompt = `
[Context Data]
Current Mood: ${currentMood}
Player Name: ${playerName}
Valid Character IDs (Target Whitelist): ${JSON.stringify(validCharacters)}
Current Stats: ${JSON.stringify(currentStats)}
Current Relationships: ${JSON.stringify(activeRelationships)}
Current Tension: ${gameState.tensionLevel || 0}/100
Active Goals: ${JSON.stringify(gameState.goals ? gameState.goals.filter((g: any) => g.status === 'ACTIVE') : [])}
${locationContext}

[Relationship Tiers Guide]
${RelationshipManager.getPromptContext()}
Check if the AI's portrayal matches these tiers. If not, suggest a mood update.

[Input Story Turn]
User Input: "${userMessage}"
AI Story:
"""
${aiResponse}
"""

[Instruction]
Analyze the [Input Story Turn] based on the rules in the System Prompt.
Generate the JSON output.
`;

    try {
      const result = await model.generateContent(dynamicPrompt);
      const response = result.response;
      const text = response.text();

      // Usage Metadata for Cost Calculation
      const usage = response.usageMetadata;

      try {
        const json = JSON.parse(text);

        // [Validation] Ensure inline_triggers exist
        if (!json.inline_triggers) json.inline_triggers = [];

        // [Safety Clamp & Diminishing Returns] Check Relationship Inertia
        if (json.relationship_updates) {
          const currentRels = activeRelationships || {};

          for (const key in json.relationship_updates) {
            let val = json.relationship_updates[key];

            // Validate value type
            if (typeof val !== 'number') continue;

            // [Damping Logic]
            // Principle: Building trust gets harder as it gets higher. Destroying it is always fast.
            const currentScore = currentRels[key] || 0;

            // Only apply damping to POSITIVE growth
            if (val > 0) {
              let factor = 1.0;

              // Tier Thresholds for Damping
              if (currentScore >= 90) factor = 0.1;       // Lvl 9 (Soulmate): Requires life-altering events
              else if (currentScore >= 70) factor = 0.3;  // Lvl 7+ (Admired): Very hard to progress
              else if (currentScore >= 50) factor = 0.5;  // Lvl 5+ (Close Friend): Harder
              else if (currentScore >= 30) factor = 0.8;  // Lvl 3+ (Companion): Slightly resistant

              // Apply factor
              const dampened = val * factor;

              // Rounding Strategy:
              // - Normal Rounding allows +1 to become 0 (which is desired for trivial acts at high tiers)
              // - Ensure at least 1 point if the original event was HUGE (> 5) and factor didn't kill it completely?
              //   Math.round handles this well. 0.3 * 5 = 1.5 -> 2. 0.1 * 5 = 0.5 -> 1.
              val = Math.round(dampened);
            }

            // [Hard Clamp] Absolute Turn Limit
            // Positive growth is CAPPED at +10 (Slow trust).
            // Negative drop is UNLIMITED (Fast betrayal).
            if (val > 10) val = 10;
            // if (val < -10) val = -10; // REMOVED: Allow catastrophic drops

            json.relationship_updates[key] = val;
          }
        }

        return {
          ...json,
          usageMetadata: usage,
          _debug_prompt: dynamicPrompt // Log only dynamic part for valid debug (Static is cached)
        };
      } catch (e) {
        console.error("[AgentPostLogic] JSON Parse Error:", e);
        console.error("Raw Text:", text);
        return {
          mood_update: undefined,
          summary_trigger: false,
          usageMetadata: usage,
          _debug_prompt: dynamicPrompt
        };
      }

    } catch (error) {
      console.error("[AgentPostLogic] API Error:", error);
      return { mood_update: undefined, summary_trigger: false };
    }
  }
}
