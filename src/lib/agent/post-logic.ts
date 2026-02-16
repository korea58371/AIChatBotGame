
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_CONFIG } from '../ai/model-config';
import { RelationshipManager } from '../engine/relationship-manager';
import { normalizeWuxiaInjury } from '@/lib/utils/injury-cleaner';
import { translations } from '../../data/translations';

// [Helper] JSON 정제 함수 (Markdown 제거)
function cleanJsonText(text: string): string {
  // \`\`\`json ... \`\`\` 또는 { ... } 패턴 추출
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

// [Helper] 문자열 정규화 (인용구 매칭용)
function normalizeString(str: string): string {
  return str.replace(/[^\w가-힣]/g, ""); // 공백, 특수문자 제거
}

export interface PostLogicOutput {
  _analysis?: string; // [NEW] CoT Internal Thought (Reasoning Step)
  mood_update?: string;
  location_update?: string; // [NEW] Region_Place
  relationship_updates?: Record<string, number>; // ID: 변경량
  stat_updates?: Record<string, number>; // [NEW] Personality Stat Updates (morality, eloquence, etc.)
  new_memories?: string[];
  // [REMOVED] character_memories moved to AgentMemory agent
  character_relationships?: Record<string, Record<string, string>>; // [NEW] NPC-to-NPC Relationship Updates
  activeCharacters?: string[]; // [NEW] Active characters in scene
  inline_triggers?: { quote: string, tag: string }[]; // [NEW] Quotes to inject tags into
  summary_trigger?: boolean;
  dead_character_ids?: string[]; // [NEW] Characters confirmed dead this turn
  factionChange?: string; // [NEW] Faction Change (e.g. "Mount Hua Sect")
  playerRank?: string; // [NEW] Title/Rank Change (e.g. "First Rate Warrior")
  ending_trigger?: 'GOOD' | 'BAD' | 'TRUE' | null; // [NEW] Explicit Ending Trigger

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
  _debug_system_prompt?: string; // [Debug] 시스템 프롬프트 (Static)
}




export class AgentPostLogic {
  private static apiKey: string | undefined = process.env.GEMINI_API_KEY;

  static getSystemPrompt(language: 'ko' | 'en' = 'ko'): string {
    const t = translations[language]?.systemPrompt || translations['ko'].systemPrompt;

    return `
You are the [Post-Logic Analyst].
Your job is to read the generated story turn and identify IMPLICIT changes in the game state.
Focus on: Emotion (Mood), Relationships, Long-term Memories, PERSONALITY SHIFTS, and GOALS.

[Memory Logic] (Strict Filtering)
- **Do NOT record trivial events.** (e.g. "We ate dinner", "He smiled at me", "I felt sad", "Walked together", "Had a small chat") -> These are handled by Relationship Score.
- **Record ONLY Long-term Significant Facts:**
  1. **Promises/Contracts:** ${t.약속_예시}.
  2. **Permanent Changes:** ${t.영구적_변화_예시}.
  3. **Skill/Growth:** ${t.스킬_성장_예시}.
  4. **Major Secrets:** ${t.주요_비밀_예시}.
  5. **Life-Changing Events:** ${t.인생_변화_예시}.
- **Format:** Keep it concise. "Promise: Meet at Teahouse", "Injury: Lost Left Eye".
- **CRITICAL:** If the event is just a conversation without a major outcome, DO NOT RECORD IT.

[Mood Update Guidelines (STRICT)]
- **Principle**: The default mood is **'daily'** or **'growth'** (training).
- **Escalation Threshold**:
  - Do NOT switch to 'tension' or 'combat' unless there was **ACTUAL VIOLENCE** or **DEATH THREATS** in the story.
  - Minor arguments, sparring, or "feeling uneasy" -> Stay 'daily'.
- **De-Escalation**:
  - If a fight ended or the threat left -> Immediately update to 'daily'.
  - If unsure -> Update to 'daily'.

[Goal Tracking]
- **MANDATORY CHECK**: Review the [Active Goals] list provided in the context context.
- For EACH active goal:
  1. Does the current story complete this goal? -> Set status: "COMPLETED"
  2. Does the current story make this goal impossible, OR has the narrative direction shifted away from it (Opportunity Lost)? -> Set status: "FAILED"
- **CRITICAL**: Use the **EXACT ID** from the [Active Goals] list. Do NOT invent new IDs.
- Identify if the player creates a NEW Goal (${t.목표_생성_예시}) -> Add to 'new_goals'.


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
  - **NO DOT RULE**: Do NOT deduct HP for "pain", "bleeding", or "throbbing" of existing injuries. Current HP represents the state *with* the injury. Only new hits reduce HP.

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

- **Healing (Auto-Resolve Protocol)**: 
  - **Principle**: "No news is good news." If the narrative **DOES NOT mention** an active injury, assume it has healed or become negligible.
  - **Action**: actively check 'active_injuries'.
  - **Auto-Resolve Rule**: 
    - For every injury in 'active_injuries':
    - If the text implies the player is moving fine, fighting well, or simply **does not mention pain/handicap** -> **RESOLVE IT**.
    - **EXCEPTION (Permanent/Major)**: Do NOT auto-resolve "Permanent Injuries" (e.g., "Severed Arm", "Blindness", "Dantian Destroyed", "영구", "절단", "불구"). These require explicit miraculous events to heal.
    - **EXCEPTION (Major Story Arc)**: If the injury is the *central theme* of the current arc (e.g., "Poisoned by the Sect Leader"), do not resolve until explicitly cured.
  - **Validation**: If you are 50% sure it might be healed, **HEAL IT**. It is better to remove a debuff than to annoy the player with a stuck status.
  - OUTPUT: "resolved_injuries": ["Bruise", "Internal Injury"]
  - **STRICT RULE**: If the text says "The pain is gone" or "I feel better", verify strictly that you output the **EXACT KOREAN STRING** from 'active_injuries' to 'resolved_injuries'.

- **Narrative Truth > Context Inertia (CRITICAL)**:
  - **Problem**: You see "Internal Injury" in the Context, so you write "My chest still hurts" even if the story implies recovery.
  - **Correction**: **TRUST THE NARRATIVE.** If the logic/story implication is "He is better", you MUST removing the injury from the list.
  - **Do NOT** maintain an injury just because it is in the list. The list is the PAST. The story is the PRESENT.

- **Worsening/Mutation**: 
  - **Restrictive Rule**: Only worsen an injury if the narrative describes a **CRITICAL FAILURE** or a **DIRECT HIT** to the wound.
  - **Do NOT** worsen injuries for standard combat or movement (Exertion is just pain).
  - Example (Fracture -> Disabled): 
    - "resolved_injuries": ["Right Arm Fracture"]
    - "new_injuries": [${t.치명적_부상_예시}]

- **Narrative Healing Override (HIGHEST PRIORITY)**:
  - **Thinking Process**: Before generating JSON, ask yourself: 
    1. "Does the text say 'Complete Recovery' (완치), 'All better' (다 나았다), 'Pain is gone' (통증이 사라졌다), or 'Washed away' (씻은 듯이)?"
    2. "Are there any active injuries in the context?"
  - **ACTION**: If BOTH are true, you **MUST** output all 'active_injuries' into 'resolved_injuries'.
  - **Strict Mapping**: 
    - Text: "몸이 씻은 듯이 나았다." -> JSON: "resolved_injuries": ["Internal Injury", "Fracture"] (ALL of them).
  - **HP Safeguard**: In a healing/recovery scene, **NEVER** set 'hp' to 0 unless the narrative explicitly describes death.
  - **Training Safety**: Training can reduce HP/MP, but **NEVER** below 1.

- **Death Safeguard (HP = 0)**:
  - **Rule**: You are FORBIDDEN from outputting 'hp: 0' or reducing HP to 0 UNLESS the narrative explicitly describes "Death", "Mortal Wound", or "Collapse with no pulse".
  - If the player is just "fainting" or "exhausted", set HP to 1.

- **New Injury Logic (STRICT)**:
  - **Target**: **ONLY** record injuries for the **Player ({playerName})**. Do not record injuries for NPCs here.
  - **Threshold**: Only record **SIGNIFICANT** physical damage. 
    - **INCLUDE**: Cuts, Fractures, Internal Injuries, Poison, Burns, Deep Wounds, "Backlash" (Ju-hwa-ip-ma).
    - **EXCLUDE**: Scratches, Bruises, Muscle Aches, Fatigue, "Feeling weak", "Stiffness", "Numbness".
    - **FORBIDDEN (Mental)**: Do NOT record psychological states as injuries. (e.g., "Psychological Atrophy", "Mental Shock", "Fear", "Tension"). These belong in 'mood' or 'personality', NOT 'active_injuries'.
  - **Format**: Be descriptive but concise. ${t.부상_설명_예시}.
  - **Ambiguity Rule**: If you are not 100% sure it is a lasting injury, **IGNORE IT**.
  - **Language Rule**: Output **ONLY** in the target language (Korean). **absolutley DO NOT** include the English name in parentheses.
    - Bad: "골절 (Fracture)", "화상 (Burn)"
    - Good: "골절", "화상", "내상 (경미)"

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

[Cultivation (Neigong) Logic] (STRICT GROWTH PACING)
- **MP vs Neigong (CRITICAL DISTINCTION)**:
  - **MP (Internal Energy Pool)**: Expendable energy used for skills. Recovers via rest/meditation.
  - **Neigong (Years of Cultivation)**: The *capital*, *capacity*, and *depth* of power (1 Year, 10 Years, 60 Years).
- **Rules for Neigong Gain (VERY SLOW)**:
  - **Routine Training**: Meditation, walking, sword practice, or breathing exercises do **NOT** increase Neigong Years. (They only restore MP).
  - **Combat**: Winning a fight grants *Experience* or *Skill Proficiency*, but **NEVER** increases Neigong Years.
  - **Time Skip (REQUIRED)**: Generates +1 Year only if the narrative says "Several months passed" or "Secluded training for a year".
  - **Elixirs/Epiphanies**: Only grant major Neigong Years (+5, +10) for *Rare Elixirs* (consumed) or *Heaven-shaking Epiphanies*.
- **FORBIDDEN (Consumption)**: 
  - **NEVER** decrease 'neigong' (Years) for using skills or fighting. Skill usage ONLY consumes 'mp'.
  - **EXCEPTION**: Neigong (Years) is ONLY lost via "Crippling Injury", "Dantian Destruction", or "Transferring Power to another".
- **FORBIDDEN (Gain)**: Do NOT grant 'neigong' (Years) for simple rest, travel, or winning a duel. Only grant 'mp' recovery and 'exp'.

[Anti-Double Count Rule (CRITICAL for Rank Ups)]
- **Scenario**: The system forces a "Rank Up" event, and the narrative describes it ("You feel a surge of power as you break through to the next realm!").
- **Constraint**: This narrative is a *result* of a stat change, not a *cause*.
- **ACTION**: If the text describes a breakthrough/rank-up:
  - **DO NOT** output 'playerRank' update (It's already done).
  - **DO NOT** award extra 'neigong' or 'level' (The surge is visual/textual only).
  - **Exception**: Only award stats if an *external* item was consumed *during* the breakthrough (e.g., "You ate a pill while breaking through").

[State Cleanup & Deduplication] (MANDATORY HOUSEKEEPING)
- **Problem**: The 'active_injuries' list may contain DUPLICATES or DIFFERENT LANGUAGES for the same injury.
  - Example: ["Chronic Hunger", "만성적인 허기", "Acute Hunger"] -> These are the SAME thing.
- **Deduplication Rule**:
  - If you see synonyms or translated duplicates in 'active_injuries', you MUST RESOLVE the "redundant" ones immediately.
  - **Target**: Keep the MOST DESCRIPTIVE Korean version. Remove English or vague versions.
  - **Action**: Add the redundant strings to 'resolved_injuries'.
  - **Example**:
    - Input: ["Broken Leg", "다리 골절"]
    - Output: "resolved_injuries": ["Broken Leg"] (Keep "다리 골절")
- **Semantic Consolidation**:
  - If a new injury covers an old one (e.g. "Internal Injury" -> "Severe Internal Injury"), REMOVE the old one.
  - Output: "resolved_injuries": ["Internal Injury"]



[Physical/Resource Stats] (VALID KEYS ONLY)
- hp, mp, gold, fame.
- **CRITICAL**: Do NOT invent other stats (e.g. "stamina", "karma", "stress", "str", "agi"). Use ONLY the keys defined above.

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
  - Private events = 0% Fame (Unless clues are left).
- **Instruction**: Even if the text does not explicitly say "Fame increased", you MUST update the 'fame' stat if the achievements warrant it.


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

  - **Vendetta / Nemesis (Score < -90):** The character loathes the player.
    - Compliments or gifts (+1 ~ +10) are REJECTED or viewed as insults/traps (0 change).
    - Only a "Life Debt" or "World-Shaking Redemption" can unlock this state.

[Explicit Relationship & Speech Style Updates] (CRITICAL)
- Unlike 'Relationship Score' (which is numeric), this tracks the **DEFINED STATUS** and **SPEECH STYLE**.
- **When to update:** ONLY when the narrative EXPLICITLY changes these.
- **Fields:**
  - **status**: The defined social role. (${t.관계_상태_예시}).
  - **speech_style**: The tone of voice used towards the player. (${t.말투_예시}).
- **Language**: MUST be in **KOREAN** (한국어).
- **Trigger Examples**:
  - "Let's drop the honorifics." -> speech_style: "반말" (Informal)
  - "I will accept you as my disciple." -> status: "제자" (Disciple), speech_style: "하대" (Low form) or "권위적" (Authoritative).
  - "We are no longer friends." -> status: "남" (Stranger) or "적" (Enemy).
  - "Please, call me older brother." -> status: "의형제" (Sworn Brother).
- **Format**:
  "relationship_info_updates": {
       "소소": { "status": "연인", "speech_style": "반말" },
       "남궁세아": { "speech_style": "존댓말" }
  }
- **⚠️ CRITICAL**: Character IDs MUST be the Korean name (한글 이름) exactly as they appear in the character data. NEVER use English IDs (e.g. "soso", "han_seol"). Always use "소소", "한설희", "남궁세아", etc.

[NPC-to-NPC Relationship Updates] (PERSISTENT MEMORY)
- **Goal**: Track how NPCs feel about EACH OTHER (not just the player).
- **Trigger**: When NPCs interact significantly (Introduction, Fight, Friendship, Betrayal).
- **Consistnecy**: If A meets B for the first time, record "Acquaintance". If they fight, "Enemy".
- **Format**: "character_relationships": { "SubjectName(한글)": { "TargetName(한글)": "Status Description" } }
- **⚠️ CRITICAL**: Use KOREAN NAMES as keys. NEVER use English IDs.
- **Example**:
  "character_relationships": {
      "한설희": { 
          "남궁세아": "언니라고 부르며 따름 (Follows as big sister)",
          "소소": "경계함 (Wary)"
      }
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
- **Format**: ${t.지역_업데이트_설명}.
- **CRITICAL**: ${t.지역_업데이트_설명}.
  - Example: ${t.지역_예시}.
- Use standard Wuxia region names: 중원, 사천, 하북, 산동, 북해, 남만, 서역, 등.
- If no change, return null.

[Faction Updates]
- **factionChange**: If the narrative explicitly states the player has joined or left a faction/sect (${t.소속_변경_설명}).
- **Constraint**: Only valid if explicitly confirmed in the text. Do not guess.

[Protocol: Relationship Inertia (Realistic Bonding)]
**CRITICAL**: Trust is built slowly. Love takes time.
1. **First Meeting Cap**: If activeRelationships[id] is 0 or undefined (Stranger):
   - **MAX GAIN**: +5 (Friendly/Interested).
   - **FORBIDDEN**: Do NOT jump to +20 (Lover/Trusted) in one turn.
2. **Per Turn Cap**: 
   - Normal Max Change: +/- 10.
   - Exception: Life Saving Act (+20), Betrayal (-30).
3. **Anti-Inflation**: If the story is just "polite conversation", gain is +1 or +2. NOT +10.

[Ending Detection] (CRITICAL - STRICT)
- **Concept**: Detect if the story has reached a definitive conclusion.
- **BAD ENDING**:
  - Condition: The Protagonist ({playerName}) **DIES** or is **PERMANENTLY CRIPPLED** beyond recovery (e.g., Execution, Suicide, Head chopped off).
  - **Constraints (MUST FOLLOW)**:
    - **Do NOT trigger if**:
      - It is just a **THREAT** (e.g. "I will kill you").
      - It is a **JOKE** or **SARCASM** (e.g. "You're dead meat!", "Go to hell").
      - It is a **HYPOTHETICAL** scenario (e.g. "If you do that, you will die").
      - It is a **NEAR MISS** (e.g. "You almost died").
      - The character just "faints" or "loses consciousness" (unless explicitly stated as death).
    - **NARRATIVE FACT**: The death/failure MUST be described as an **EVENT THAT ALREADY HAPPENED** in the narration, not just spoken in dialogue.
  - Action: Set "ending_trigger": "BAD".
- **GOOD ENDING**:
  - Condition: The Protagonist achieves a **MAJOR LIFELONG GOAL** (e.g., Becoming Sect Leader, Defeating the Final Boss, Retiring peacefully after revenge).
  - Action: Set "ending_trigger": "GOOD".
  - Constraint: Must be a satisfying conclusion to the current narrative arc.
- **TRUE ENDING**:
- Condition: Achieving a secret or perfect conclusion.
  - Action: Set "ending_trigger": "TRUE".

[Summary Trigger Logic] (Memory Consolidation)
- **Goal**: Decide if the current turn is a good time to summarize recent events into long-term memory.
- **Trigger Conditions (Set "summary_trigger": true)**:
  1. **Scene Change**: The characters moved to a new location.
  2. **Major Event**: A Goal was Completed/Failed, or a Rank Up occurred.
  3. **Time Skip**: significant time passed.
  4. **Conversation End**: A long dialogue scene has concluded.
  5. **New Chapter**: A new major character was introduced or a faction change occurred.
- **Constraint**: Do not trigger on every turn. Only when a "segment" of the story closes.


[Output Schema (JSON)]
{
  "_analysis": "Step 1: Player HP is low but no critical hits... Step 2: 소소 is present...",
  "mood_update": "tension",
  "location_update": "Region_Place",
  "relationship_updates": { "소소": 5, "한설희": -2 },
  "stat_updates": { "hp": -5, "mp": 2, "fame": 10 },
  "character_relationships": {
      "소소": { "칠성": "불편한 관계 (Uncomfortable)" }
  },
  "inline_triggers": [
      { "quote": ${t.인라인_인용_예시}, "tag": "<Stat hp='-5'>" },
      { "quote": ${t.인라인_태그_예시}, "tag": "<Rel char='남궁세아' val='5'>" }
  ],
  "resolved_injuries": ["Broken Arm"],
  "new_injuries": ["Permanent Disability"],
  "new_goals": [{ "type": "MAIN", "description": "Goal description" }],
  "goal_updates": [{ "id": "goal_id", "status": "COMPLETED" }],
  "activeCharacters": ["소소", "칠성"], 
  "summary_trigger": false,
  "dead_character_ids": ["산적두목"],
  "factionChange": "화산파"
}

[Critically Important]
- **Internal Analysis (CoT)**: Before generating the JSON, briefly analyze the situation in the "_analysis" field to ensure all constraints (Health, Relationship caps) are met. Use English for analysis.
- **LANGUAGE**: All output strings (especially 'location_update', 'new_goals' description, 'factionChange', 'playerRank') MUST be in KOREAN (한국어). Only JSON keys must remain in English.
- **⚠️ CHARACTER IDs**: ALL character identifiers (in 'relationship_updates', 'activeCharacters', 'dead_character_ids', 'character_relationships', inline_triggers char attr) MUST use the character's KOREAN NAME (한글 이름). NEVER use English IDs like "soso" or "han_seol".
- **Active Characters Rules**:
  1. List EVERY character name (한글) that is **CURRENTLY PRESENT** at the **END** of the turn.
  2. **Leaving**: If a character explicitly LEAVES, EXITS, or DISAPPEARS, **DO NOT** include them.
  3. **Dead**: If a character is listed in 'dead_character_ids', they **MUST NOT** appear in 'activeCharacters'.
- **Dead Characters**: List names (한글) of ANY character who died or was permanently incapacitated/killed in this turn.
- 'quote' in 'inline_triggers' MUST be an EXACT substring of the 'AI' text.

[Relationship Tiers Guide]
${RelationshipManager.getPromptContext()}
`;
  }


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
    let staticSystemPrompt = this.getSystemPrompt(language || 'ko');

    // [God Mode Protocol]
    const isGodMode = gameState.isGodMode || gameState.playerName === "김현준갓모드";
    if (isGodMode) {
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
[World Map Data] (Geographical Constraints)
- **Current Region**: ${currentRegionName}
- **Current Location**: ${currentLocation}
- **Valid Local Spots** (Movable): ${currentZoneSpots.join(', ')}

- **Distant Regions** (Locked): ${regionsList.filter(r => r !== currentRegionName).join(', ')}
  - **TELEPORTATION PREVENTION RULE**: You CANNOT update location to a Distant Region unless the narrative EXPLICITLY describes a **LONG JOURNEY COMPLETED** (e.g. "After days of travel, you arrived in X").
  - **Travel takes time**: If the player *starts* a journey or says "Let's go to [Region]", do **NOT** update the location immediately.
  - Instead, describe the departure or the journey on the road. The location update should happen only when they **ARRIVE**.
  - If the story is just a conversation, combat, or local event, you MUST **STAY IN ${currentRegionName}**.
  - If unsure, do NOT output 'location_update'.
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
1. Analyze the [Input Story Turn].
2. **[Healing Check]**: Does the text say "완치", "다 나았다", "통증이 사라졌다"? 
   - IF YES -> You MUST output 'resolved_injuries': [ALL Active Injuries].
   - **Do NOT** let the "Active Injuries" list bias you. Trust the Text.
3. Generate the JSON output.
`;

    try {
      const result = await model.generateContent(dynamicPrompt);
      const response = result.response;
      const text = response.text();

      // Usage Metadata for Cost Calculation
      const usage = response.usageMetadata;

      try {
        const json = JSON.parse(cleanJsonText(text));

        if (json.new_injuries && Array.isArray(json.new_injuries)) {
          // Map then Set to deduplicate
          json.new_injuries = Array.from(new Set(json.new_injuries.map(normalizeWuxiaInjury)));
        }
        if (json.resolved_injuries && Array.isArray(json.resolved_injuries)) {
          json.resolved_injuries = Array.from(new Set(json.resolved_injuries.map(normalizeWuxiaInjury)));
        }

        // [Validation] Ensure inline_triggers exist
        if (!json.inline_triggers) json.inline_triggers = [];

        // [Sanitization & Normalization]
        const aiResponseNormalized = normalizeString(aiResponse);
        json.inline_triggers = json.inline_triggers.filter((trigger: { quote: string, tag: string }) => {
          if (!trigger.tag) return false;
          if (!trigger.quote) return false;

          // Only allow <Stat> and <Rel>
          const isStat = trigger.tag.startsWith('<Stat');
          const isRel = trigger.tag.startsWith('<Rel');
          if (!isStat && !isRel) return false;

          // Quote Matching (Normalized)
          const quoteNorm = normalizeString(trigger.quote);
          return aiResponse.includes(trigger.quote) || aiResponseNormalized.includes(quoteNorm);
        });

        // [Sanitization] Filter stat_updates keys
        if (json.stat_updates) {
          const ALLOWED_STATS = new Set([
            // Core
            'hp', 'mp', 'gold', 'str', 'agi', 'int', 'vit', 'luk', 'fame', 'neigong', 'exp', 'level',
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

        // [Safety Guard] Prevent AI from overriding System (Cultivation) Ranks
        // The AI often hallucinates "Hwagyeong" from "Rebirth" descriptions.
        // Cultivation Ranks must ONLY be updated by 'processRealmProgression' in VisualNovelUI.
        if (json.playerRank) {
          const CULTIVATION_RANKS = new Set(['삼류', '이류', '일류', '절정', '초절정', '화경', '현경', '생사경']);
          if (CULTIVATION_RANKS.has(json.playerRank)) {
            console.warn(`[AgentPostLogic] BLOCKED implicit Cultivation Rank update: ${json.playerRank}. This is System-Managed.`);
            delete json.playerRank;
          }
        }

        // [Relationship Logic: God Mode & Dead Zone Prevention]
        if (json.relationship_updates) {
          const currentRels = activeRelationships || {};

          for (const key in json.relationship_updates) {
            let val = json.relationship_updates[key];
            if (typeof val !== 'number') continue;

            // God Mode가 아닐 때만 밸런스 조정 로직 수행
            if (!isGodMode) {
              const currentScore = currentRels[key] || 0;

              // 양수(+) 변화일 때만 감쇠 적용
              if (val > 0) {
                let factor = 1.0;
                // 프롬프트의 지시는 무시하고, 코드에서 확실하게 제어
                const absScore = Math.abs(currentScore);
                if (absScore >= 90) factor = 0.2;
                else if (absScore >= 70) factor = 0.5;
                else if (absScore >= 50) factor = 0.8;

                const dampened = val * factor;

                // [Dead Zone Fix] 0점 방지: 의도된 상승이라면 최소 1점 보장
                val = Math.max(1, Math.round(dampened));
              }

              // Hard Clamp (최대 10점 제한)
              if (val > 10) val = 10;
            }

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

        // [Debug] Log Analysis if Ending Triggered
        if (json.ending_trigger) {
          console.warn(`[AgentPostLogic] Ending Triggered: ${json.ending_trigger}`);
          if (json._analysis) {
            console.warn(`[AgentPostLogic] Analysis: ${json._analysis}`);
          }
        }

        // [Persistence Guard] Character Keep-Alive
        // If a character was active in the previous turn and is mentioned in the current text,
        // FORCE them to stay active (Prevents AI accidental drop).
        if (gameState && gameState.activeCharacters) {
          const verifyActive = new Set(json.activeCharacters || []);
          const prevActive = gameState.activeCharacters;
          const storyText = aiResponse;
          const deadIds = new Set(json.dead_character_ids || []);

          prevActive.forEach((charId: string) => {
            if (verifyActive.has(charId) || deadIds.has(charId)) return;

            const charData = gameState.characterData?.[charId];
            if (charData) {
              const namesToCheck = [charData.name, charData.이름, ...(charData.aliases || [])].filter(Boolean);
              // 이름이나 별호 중 하나라도 포함되면 유지
              const isMentioned = namesToCheck.some((n: string) => storyText.includes(n));

              if (isMentioned) {
                verifyActive.add(charId);
                console.log(`[AgentPostLogic] Persistence Guard: Forced '${namesToCheck[0]}' (${charId}) to stay active.`);
              }
            }
          });
          json.activeCharacters = Array.from(verifyActive);
        }

        return {
          ...json,
          usageMetadata: usage,
          _debug_prompt: dynamicPrompt, // Log only dynamic part for valid debug (Static is cached)
          _debug_system_prompt: staticSystemPrompt // [Debug] Expose System Prompt
        };
      } catch (e) {
        console.error("[AgentPostLogic] JSON Parse Error:", e);
        console.error("Raw Text:", text);
        return {
          mood_update: undefined,
          summary_trigger: false,
          usageMetadata: usage,
          _debug_prompt: dynamicPrompt,
          _debug_system_prompt: staticSystemPrompt
        };
      }

    } catch (error) {
      console.error("[AgentPostLogic] API Error:", error);
      return { mood_update: undefined, summary_trigger: false };
    }
  }
}
