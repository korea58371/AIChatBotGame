import json
import os
import re

# Paths
BASE_DIR = r"j:\AI\Game\AIChatBotGame\src\data\games\god_bless_you\jsons"
CHARS_PATH = os.path.join(BASE_DIR, "characters.json")

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def main():
    if not os.path.exists(CHARS_PATH):
        print("File not found.")
        return

    chars = load_json(CHARS_PATH)
    count = 0
    
    # Regex to find the appended SPEC string
    # "- **[SPEC]**: 마나 성질 .*"
    spec_pattern = re.compile(r"\n- \*\*\[SPEC\]\*\*: 마나 성질.*", re.DOTALL)

    for name, char in chars.items():
        strength = char.get("강함", {})
        original_skills = strength.get("skills", "")
        
        if "[SPEC]" in original_skills:
            # Clean it
            # We split by "\n- **[SPEC]" just in case regex is tricky with newlines
            clean_skills = original_skills.split("\n- **[SPEC]")[0]
            char["강함"]["skills"] = clean_skills.strip()
            count += 1

    save_json(CHARS_PATH, chars)
    print(f"Reverted {count} characters.")

if __name__ == "__main__":
    main()
