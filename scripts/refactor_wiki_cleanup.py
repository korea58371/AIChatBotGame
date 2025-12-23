import json
import os

file_path = "j:/AI/Game/AIChatBotGame/src/data/games/wuxia/wiki_data.json"

def refactor_data():
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"JSON Decode Error: {e}")
        return

    changes_made = 0
    characters_with_null_image = []

    for key, entry in data.items():
        # 1. Parse 'role' into list
        if "role" in entry:
            original_role = entry["role"]
            if isinstance(original_role, str):
                # Split by " / " or just wrap single string in list
                if " / " in original_role:
                    entry["role"] = original_role.split(" / ")
                else:
                    entry["role"] = [original_role]
                changes_made += 1
        
        # 2. Standardize 'infobox' "Unknown" to "불명"
        if "infobox" in entry:
            for item in entry["infobox"]:
                if item.get("value") == "Unknown":
                    item["value"] = "불명"
                    changes_made += 1
        
        # 3. Check for Null Images in Characters
        if entry.get("category") == "AIChatBotGame/등장인물":
            if entry.get("image") is None:
                characters_with_null_image.append(entry.get("name"))

    print(f"Total changes made: {changes_made}")
    print(f"Characters with null image: {characters_with_null_image}")

    # Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print("Successfully saved wiki_data.json")

if __name__ == "__main__":
    refactor_data()
