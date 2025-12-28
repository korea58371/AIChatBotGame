import json
import os

# Paths
BASE_DIR = r"j:\AI\Game\AIChatBotGame\src\data\games\god_bless_you\jsons"
CHARS_PATH = os.path.join(BASE_DIR, "characters.json")
LEVELS_PATH = os.path.join(BASE_DIR, "modern_levels.json")

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def main():
    if not os.path.exists(CHARS_PATH) or not os.path.exists(LEVELS_PATH):
        print("Files not found.")
        return

    chars = load_json(CHARS_PATH)
    levels = load_json(LEVELS_PATH)

    # Prepare Level Map
    # Map "S급" key to its description
    level_map = {}
    for key, data in levels.items():
        # key: "S급", "A급" etc. or "S급_국가전력"
        short_key = key.split('_')[0] # "S급"
        level_map[short_key] = data

    count = 0
    for name, char in chars.items():
        strength = char.get("강함", {})
        rank = strength.get("등급", "") # e.g. "S급", "A급"
        
        # Normalize Rank
        target_rank = ""
        if "S급" in rank: target_rank = "S급"
        elif "A급" in rank: target_rank = "A급"
        elif "B급" in rank: target_rank = "B급"
        elif "C급" in rank: target_rank = "C급"
        elif "D급" in rank: target_rank = "D급"
        elif "E급" in rank: target_rank = "E급"
        elif "F급" in rank: target_rank = "F급"
        
        if target_rank and target_rank in level_map:
            lvl_info = level_map[target_rank]
            
            # Construct Enhancement String
            # We want to add Mana Nature and Combat Power context
            mana_nature = lvl_info.get("마나_성질", "").split('(')[0].strip() # "고체"
            combat_power = lvl_info.get("전투력", "")
            
            original_skills = strength.get("skills", "")
            
            # Avoid duplicating if already applied
            if "[System: Mana" in original_skills:
                continue
                
            # Formatting: 
            # Original Skill. 
            # [System Analysis: Rank S | Mana: Solid | Feat: City Erasure]
            
            # Extract simple feats
            feat = combat_power.split('.')[0]
            
            enhanced_desc = f"{original_skills}\n- **[SPEC]**: 마나 성질 [{mana_nature}]. 위력 [{feat}]."
            
            char["강함"]["skills"] = enhanced_desc
            count += 1
            print(f"Updated {name} ({target_rank})")

    save_json(CHARS_PATH, chars)
    print(f"Successfully aligned {count} characters to modern_levels.json")

if __name__ == "__main__":
    main()
