
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
  factionChange?: string; // [NEW] Faction Change (e.g. "Mount Hua Sect")
  playerRank?: string; // [NEW] Title/Rank Change (e.g. "First Rate Warrior")

  // [NEW] Relationship Info Updates (Status & Speech)
  relationship_info_updates?: Record<string, { status?: string, speech_style?: string }>;


  // [New] Injury Management
  resolved_injuries?: string[]; // Injuries to remove (Healed or Mutated)
  new_injuries?: string[];      // Injuries to add (New or Mutation Result)

  // [Narrative Systems]
  goal_updates?: { id: string, status: 'COMPLETED' | 'FAILED' | 'ACTIVE', updates?: string }[];
  new_goals?: { description: string, type: 'MAIN' | 'SUB' }[];


  usageMetadata?: any; // [Cost] 토큰 사용량
  _debug_prompt?: string; // [Debug] 실제 프롬프트
}

export class AgentPostLogic {
  private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

  private static readonly SYSTEM_PROMPT = `
You are the [Post-Logic Analyst].
Your job is to read the generated story turn and identify IMPLICIT changes in the game state.
Focus on: Emotion (Mood), Relationships, Long-term Memories, PERSONALITY SHIFTS, and GOALS.

[Memory Logic] (Strict Filtering)
- **Do NOT record trivial events.** (e.g. "We ate dinner", "He smiled at me", "I felt sad", "Walked together", "Had a small chat") -> These are handled by Relationship Score.
- **Record ONLY Long-term Significant Facts:**
  1. **Promises/Contracts:** "Promised to meet at the teahouse at noon", "Agreed to kill the Demon King".
  2. **Permanent Changes:** "Lost a left arm", "Acquired the Legendary Sword", "Housing burned down".
  3. **Skill/Growth:** "Learned the Flying Dragon Fist", "Realized the Dao of Empty Sky".
  4. **Major Secrets:** "Learned that the Player is actually the King", "Discovered the spy".
  5. **Life-Changing Events:** "Saved from death", "Betrayed by best friend".
- **Format:** Keep it concise. "Promise: Meet at Teahouse", "Injury: Lost Left Eye".
- **CRITICAL:** If the event is just a conversation without a major outcome, DO NOT RECORD IT.

[Goal Tracking]
- **MANDATORY CHECK**: Review the [Active Goals] list provided in the context context.
- For EACH active goal:
  1. Does the current story complete this goal? -> Set status: "COMPLETED"
  2. Does the current story make this goal impossible, OR has the narrative direction shifted away from it (Opportunity Lost)? -> Set status: "FAILED"
- **CRITICAL**: Use the **EXACT ID** from the [Active Goals] list. Do NOT invent new IDs.
- Identify if the player creates a NEW Goal ("I will become the Alliance Leader") -> Add to 'new_goals'.


[Health & Status Logic] (TOP PRIORITY)
- **GLOBAL TARGETING RULE (CRITICAL)**: 
  - All 'stat_updates' (HP, MP, active_injuries) MUST apply **ONLY** to the **Protagonist ({playerName})**.
  - **COMPANION PROTECTION**: If a companion (e.g., Soso, Namgung) gets hurt, coughs blood, or dies, **DO NOT** reduce the Player's HP. **DO NOT** add injuries to the Player.
  - **Reasoning**: The Player is the User. The UI HUD tracks the USER'S status.

- **Status Quo Check (CRITICAL)**:
  - If the narrative describes pain, symptoms, or effects of an injury that is ALREADY in 'active_injuries':
  - **ACTION**: IGNORE IT. Do not output anything. 
  - **Reasoning**: This is a *description* of current state, not a *change* in state.
  - **Exception**: Only record if the text EXPLICITLY says the injury "worsened", "tore open", "deepened", or a "new" injury occurred.

- **Injury Consolidation (NO STACKING)**:
  - **Rule**: You MUST NOT have multiple injuries of the same type at different severities (e.g., both "Internal Injury" and "Severe Internal Injury").
  - **Action**: If a new injury is a *worsened* version of an existing one, you **MUST** add the OLD injury to 'resolved_injuries'.
  - **Specific Case [Internal Injury (내상)]**:
    - If Player has "Internal Injury" and gets "Internal Energy Backlash" -> **Result**: Remove "Internal Injury", Add "Severe Internal Injury (Dantian Damage)".
    - **NEVER** keep both. Consolidate them into the single most severe description.

- [HYPERBOLE & AMBIGUITY FILTER] (STRICT):
  - **Ignore Exaggeration**: Do NOT record injuries from figures of speech, sarcasm, or humor.
    - Example: "I'm so hungry my internal energy is flowing backwards!" -> **IGNORE** (Joke).
    - Example: "My head is going to explode!" -> **IGNORE** (Stress).
  - **Ignore Ambiguous Pain**: If the text says "It hurts" or "I feel pain" WITHOUT a specific physical cause (cut, blow, poison), it is likely just fatigue or status. **DO NOT** record it as an injury.
  - **Literal Only**: Only record injuries if they are **PHYSICALLY DESCRIBED** as happening to the **Player ({playerName})**.
    - Valid: "Blood trickled down your arm", "You felt a rib crack", "The poison entered your veins".
    - Invalid: "You felt tired", "Your pride was hurt", "You felt a phantom pain".

- **Healing**: If player visits a doctor, rests, or uses medicine, identify which 'Active Injuries' are cured OR **significantly relieved**.
  - **Rule**: "Noticeable relief", "Pain reduced", "Meridians Reconstructed", "Washed away" counts as RESOLVED.
  - **CRITICAL**: You MUST check [Context Data] -> [Current Stats] -> 'active_injuries' list.
  - **CRITICAL**: You MUST use the **EXACT STRING** from that list. Do NOT invent synonyms.
  - **Match Strategy**:
    - [BAD]: List=["Broken Arm"], Output="Fracture" (FAIL: Mismatch)
    - [BAD]: List=["Internal Injury"], Output="Pain" (FAIL: Mismatch)
    - [GOOD]: List=["Broken Arm"], Output="Broken Arm" (SUCCESS)
  - OUTPUT: "resolved_injuries": ["Broken Arm"]
  - **STRICT RULE**: If the injury name does not EXACTLY match (or is not a very close variation of) the string in 'active_injuries', DO NOT include it.
  - **STRICT RULE**: If you cannot find a matching injury to heal, return an empty list or null. DO NOT invent a new name to heal.
- **Worsening/Mutation**: If player ignores an injury and strains themselves, REMOVE the old injury and ADD a worse one.
  - Example (Fracture -> Disabled): 
    - "resolved_injuries": ["Right Arm Fracture"]
    - "new_injuries": ["Right Arm Permanent Disability"]
- **New Injury Logic (STRICT)**:
  - **Target**: **ONLY** record injuries for the **Player ({playerName})**. Do not record injuries for NPCs here.
  - **Threshold**: Only record **SIGNIFICANT** physical damage. 
    - **INCLUDE**: Cuts, Fractures, Internal Injuries, Poison, Burns, Deep Wounds.
    - **EXCLUDE**: Scratches, Bruises, Muscle Aches, Fatigue, "Feeling weak".
  - **Format**: Be descriptive but concise. "Left Arm Fracture", "Internal Injury (Mild)", "Poisoned (Snake)".
  - **Ambiguity Rule**: If you are not 100% sure it is a lasting injury, **IGNORE IT**.

- **Recovery Logic (HP & MP)**:
  - **1. Natural Recovery (Passing Time / Travel)**: 
     - If describing travel or idle time: **MP +5~10**, **HP +5**.
  - **2. Rest (Sleep / Inn / Camp)**:
     - If describing a good night's sleep or rest: **MP +20~30**, **HP +20~30**.
     - **Action**: Auto-Resolve "Minor Injuries" (Bruise, Scratch, Muscle Pain).
  - **3. Meditation (Un-gi-jo-sik / 찜질 / Breathing)**:
     - **MAJOR RECOVERY EVENT**.
     - If player explicitly meditates or circulates Qi:
     - **MP**: **+80 ~ +100** (Recover to near Max).
     - **HP**: **+50 ~ +80** (Significantly heal wounds).
     - **Action**: Often resolves mild internal injuries or fatigue.
  - **Constraint**: Do NOT naturally heal severe physical trauma (Fractures, Severed Limbs) without medical treatment.

[Cultivation (Neigong) Logic]
- **MP vs Neigong (CRITICAL DISTINCTION)**:
  - **MP (Internal Energy Pool)**: Expendable energy used for skills. Recovers via rest/meditation (as above).
  - **Neigong (Years of Cultivation)**: The *capacity* and *depth* of power (1 Year, 10 Years, 60 Years/1 Cycle).
- **Rules for Neigong Gain**:
  - **Daily Routine**: Meditation, walking, or breathing exercises do **NOT** increase Neigong Years. (They only restore MP).
  - **Elixirs**: Gaining Neigong from elixirs takes time to absorb. 
  - **Major Breakthroughs**: Only grant Neigong Years (+1, +5, etc.) for *Epiphanies*, *Rare Elixirs*, or *Transfers*.
- **FORBIDDEN**: Do NOT grant 'neigong' (Years) for simple rest or travel. Only grant 'mp' recovery.

[Personality Stats Guidelines]
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

- Physical/Mental Stats: hp, mp, str, agi, int, vit, luk, fame.

- **CRITICAL**: Do NOT invent other stats (e.g. "stamina", "karma", "stress"). Use ONLY the keys defined above.

[Reputation (Fame) Logic]
- **Concept**: How widely known the player is in Jianghu. 
- **Trigger**: Gain Fame when you *impact the world* or *influence others*, properly scaled by their status.
- **Scaling Rules (Per Event)**:
  - **Minor (Local)**: Helping a villager, beating a thug. (+1 ~ +10)
  - **Notable (City)**: Defeating a 3rd/2nd rate warrior, solving a local mystery. (+20 ~ +50)
  - **Major (Province)**: Defeating a 1st Rate Expert, Saving a Town, Public Duel victory. (+100 ~ +300)
  - **Legendary (Jianghu)**: Defeating a Peak Master, Changing the fate of a Sect. (+1000+)
- **Witness Factor**:
  - Public events = 100% Fame.
  - Private events (features only dead witnesses) = 0% Fame (Unless clues are left).
- **Instruction**: Even if the text does not explicitly say "Fame increased", you MUST update the 'fame' stat if the achievements warrant it.

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

[Explicit Relationship & Speech Style Updates] (CRITICAL)
- Unlike 'Relationship Score' (which is numeric), this tracks the **DEFINED STATUS** and **SPEECH STYLE**.
- **When to update:** ONLY when the narrative EXPLICITLY changes these.
- **Fields:**
  - **status**: The defined social role. (e.g., "Friend", "Lover", "Disciple", "Master", "Enemy", "Stranger", "Business Partner").
  - **speech_style**: The tone of voice used towards the player. (e.g., "Polite", "Informal", "Archaic", "Honorific", "Cold").
- **Language**: MUST be in **KOREAN** (한국어).
- **Trigger Examples**:
  - "Let's drop the honorifics." -> speech_style: "반말" (Informal)
  - "I will accept you as my disciple." -> status: "제자" (Disciple), speech_style: "하대" (Low form) or "권위적" (Authoritative).
  - "We are no longer friends." -> status: "남" (Stranger) or "적" (Enemy).
  - "Please, call me older brother." -> status: "의형제" (Sworn Brother).
- **Format**:
  "relationship_info_updates": {
       "soso": { "status": "연인", "speech_style": "반말" },
       "namgung_se_ah": { "speech_style": "존댓말" }
  }

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
- **Format:** "Region_Place" in KOREAN (e.g., "사천_성도", "하북_팽가", "중원_객잔", "북해_빙궁").
- **CRITICAL**: For generic locations (Mountain Path, Forest, Inn, Market) that exist within a specific region, YOU MUST PREFIX the region name.
  - Example: If moving from 'Shaanxi_MountHua' to a mountain path, output '섬서_산길' (Shaanxi_Mountain Path), NOT just '산길'.
- Use standard Wuxia region names: 중원, 사천, 하북, 산동, 북해, 남만, 서역, 등.
- If no change, return null.

[Faction & Rank Updates]
- **factionChange**: If the narrative explicitly states the player has joined or left a faction/sect (e.g. "You have formally become a disciple of Mount Hua").
- **playerRank**: If the narrative explicitly awards a new title or martial rank (e.g. "You have reached the level of a First Rate Warrior" or "People now call you the Sword Demon").
- **Constraint**: Only valid if explicitly confirmed in the text. Do not guess.


[Output Schema (JSON)]
{
  "mood_update": "tension" | "romance" | "daily" | null,
  "location_update": "Region_Place" | null,
  "relationship_updates": { "character_id": 5, "another_char": -2 },
  "stat_updates": { "morality": -2, "eloquence": 1, "hp": -5, "mp": 2, "fame": 10 },
  "character_memories": { 
      "soso": ["Player praised my cooking", "Player asked about my past"], 
      "chilsung": ["Player defeated me", "Player gave me a healing potion"] 
  },
  "inline_triggers": [
      { "quote": "The bandit's blade grazed my arm!", "tag": "<Stat hp='-5'>" },
      { "quote": "She laughed at my joke.", "tag": "<Rel char='NamgungSeAh' val='5'>" }
  ],

  "resolved_injuries": ["Broken Arm"], // Optional
  "new_injuries": ["Permanent Disability"], // Optional
  "new_goals": [{ "type": "MAIN" | "SUB", "description": "Goal description" }], // Optional
  "goal_updates": [{ "id": "goal_id", "status": "COMPLETED" | "FAILED" | "ACTIVE" }], // Optional
  "activeCharacters": ["soso", "chilsung"], 
  "summary_trigger": false,
  "goal_updates": [ { "id": "goal_1", "status": "COMPLETED" } ],
  "new_goals": [ { "description": "Survive the ambush", "type": "SUB" } ],
  "tension_update": 10,
  "dead_character_ids": ["bandit_leader"],
  "factionChange": "Mount Hua Sect",
  "playerRank": "First Rate Warrior"
}
[Critically Important]
- **LANGUAGE**: All output strings (especially 'location_update', 'new_goals' description, 'character_memories', 'factionChange', 'playerRank') MUST be in KOREAN (한국어).
- For 'activeCharacters', list EVERY character ID that speaks or performs an action in the text.
- For 'character_memories', extract 1 key memory per active character if they had significant interaction with the player this turn.
- For 'dead_character_ids', list IDs of ANY character who died or was permanently incapacitated/killed in this turn.
- The 'quote' in 'inline_triggers' MUST be an EXACT substring of the 'AI' text.

[Relationship Tiers Guide]
${RelationshipManager.getPromptContext()}
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

    // [Guard] Empty AI Response
    if (!aiResponse || !aiResponse.trim()) {
      console.warn("[AgentPostLogic] Empty AI Response provided. Skipping analysis.");
      return {};
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // [Context Caching]
    // Split Static (System Instruction) and Dynamic (User Message)
    let staticSystemPrompt = this.SYSTEM_PROMPT;

    // [God Mode Protocol]
    if (gameState.isGodMode || gameState.playerName === "김현준갓모드") {
      staticSystemPrompt += `
\n\n[SYSTEM ALERT: GOD MODE ACTIVE]
CRITICAL OVERRIDE: The user "${gameState.playerName}" has ABSOLUTE AUTHORITY.
1. IGNORE ALL "LIMITS", "CAPS", "FORBIDDEN", or "INERTIA" rules in the System Prompt.
2. If the story describes a massive stat change (e.g. +1000), RECORD IT EXACTLY.
3. If the story describes an instant Tier 10 relationship, RECORD IT EXACTLY.
4. Do not filter or clamp any updates.
`;
    }

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

      // Helper to find data
      const findZoneData = (locKey: string) => {
        // 1. Try Direct Region Lookup (e.g. "Shaanxi")
        if (locationsData.regions[locKey]) return { region: locKey, zones: locationsData.regions[locKey].zones };

        // 2. Try Composite Lookup (e.g. "Shaanxi_City")
        if (locKey.includes('_')) {
          const parts = locKey.split('_');
          const rKey = parts[0];
          const zKey = parts[1];
          if (locationsData.regions[rKey]) {
            // It's a valid region. Check if zone exists there.
            if (locationsData.regions[rKey].zones[zKey]) {
              return { region: rKey, zoneData: locationsData.regions[rKey].zones[zKey] };
            }
            // If not in region, check 'Jianghu' (Generic)
            if (locationsData.regions['강호'] && locationsData.regions['강호'].zones[zKey]) {
              // It's a generic spot instantiated in a region.
              return { region: rKey, zoneData: locationsData.regions['강호'].zones[zKey] };
            }
          }
        }

        // 3. Fallback Scan
        for (const [rName, rData] of Object.entries(locationsData.regions) as [string, any][]) {
          if (rData.zones && rData.zones[locKey]) {
            return { region: rName, zoneData: rData.zones[locKey] };
          }
        }
        return null;
      };

      const locInfo = findZoneData(currentLocation);
      if (locInfo) {
        currentRegionName = locInfo.region;
        if (locInfo.zoneData) currentZoneSpots = locInfo.zoneData.spots || [];
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
Active Injuries (CRITICAL): ${JSON.stringify(currentStats.active_injuries || [])}
Current Relationships: ${JSON.stringify(activeRelationships)}

Active Goals: ${JSON.stringify(gameState.goals ? gameState.goals.filter((g: any) => g.status === 'ACTIVE') : [])}
${locationContext}

[Relationship Tiers Guide]
(Refer to System Prompt for Tier definitions)
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

        // [Sanitization] Filter inline_triggers allowed tags ONLY
        json.inline_triggers = json.inline_triggers.filter((trigger: { quote: string, tag: string }) => {
          if (!trigger.tag) return false;
          // Only allow <Stat> and <Rel>
          const isStat = trigger.tag.startsWith('<Stat');
          const isRel = trigger.tag.startsWith('<Rel');
          return isStat || isRel;
        });

        // [Sanitization] Filter stat_updates keys
        if (json.stat_updates) {
          const ALLOWED_STATS = new Set([
            // Core
            'hp', 'mp', 'str', 'agi', 'int', 'vit', 'luk', 'fame', 'neigong',
            // Personality
            'morality', 'courage', 'energy', 'decision', 'lifestyle',
            'openness', 'warmth', 'eloquence', 'leadership', 'humor', 'lust'
          ]);

          const filteredStats: Record<string, number> = {};
          for (const key in json.stat_updates) {
            const lowerKey = key.toLowerCase();
            if (ALLOWED_STATS.has(lowerKey)) {
              filteredStats[lowerKey] = json.stat_updates[key];
            } else {
              console.warn(`[AgentPostLogic] Filtered unknown stat key: ${key}`);
            }
          }
          json.stat_updates = filteredStats;
        }

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

        // [Canonicalize Location Update]
        // If the AI output "Jungwon_Luoyang" but the map says Luoyang is in "Henan", FIX IT.
        if (json.location_update && typeof json.location_update === 'string') {
          const rawLoc = json.location_update;
          if (rawLoc.includes('_')) {
            const [rawRegion, rawZone] = rawLoc.split('_');

            // Reuse findZoneData logic or simplified lookup
            // We need to find where 'rawZone' actually lives.
            let foundRegion = null;

            // 1. Check if the rawRegion is already correct
            if (locationsData?.regions?.[rawRegion]?.zones?.[rawZone]) {
              foundRegion = rawRegion;
            } else {
              // 2. Scan all regions to find the zone
              if (locationsData?.regions) {
                for (const [rName, rData] of Object.entries(locationsData.regions) as [string, any][]) {
                  if (rData.zones && rData.zones[rawZone]) {
                    foundRegion = rName;
                    break;
                  }
                }
              }
            }

            // 3. Correction
            if (foundRegion && foundRegion !== rawRegion) {
              console.log(`[AgentPostLogic] Correcting Location Region: ${rawLoc} -> ${foundRegion}_${rawZone}`);
              json.location_update = `${foundRegion}_${rawZone}`;
            }
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
