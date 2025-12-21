import os
import json

ASSETS_DIR = r"j:\AI\Game\AIChatBotGame\public\assets\wuxia\ExtraCharacters"
MAP_FILE = r"j:\AI\Game\AIChatBotGame\src\data\games\wuxia\extra_map.json"

# List of files that were incorrectly classified as Female due to weak keyword matching
# We will rename them to _남 and update the map.
TARGETS = [
    "점소이_비굴한_여.png",
    "사파무인_비열한_여.png",
    "정파무사_후지기수_여.png",
    "냉정한후지기수_여.png",
    "후지기수_다혈질_여.png"
]

def main():
    with open(MAP_FILE, 'r', encoding='utf-8') as f:
        extra_map = json.load(f)

    new_map = extra_map.copy()
    
    for filename in TARGETS:
        old_path = os.path.join(ASSETS_DIR, filename)
        
        # New name: replace _여 with _남
        new_filename = filename.replace("_여.", "_남.")
        new_path = os.path.join(ASSETS_DIR, new_filename)
        
        # Rename file
        if os.path.exists(old_path):
            try:
                os.rename(old_path, new_path)
                print(f"Repaired File: {filename} -> {new_filename}")
            except Exception as e:
                print(f"Failed to rename {filename}: {e}")
                continue
        else:
            print(f"File not found: {filename}, maybe already fixed or logic error?")
            # Check if new exists
            if os.path.exists(new_path):
                print(f"Target {new_filename} already exists. Updating map only.")
            else:
                continue

        # Update Map
        # Find key with this value
        found_key = None
        for k, v in list(extra_map.items()):
            if v == filename:
                found_key = k
                break
        
        if found_key:
            # Create new key: replace (여 with (남
            new_key = found_key.replace("(여", "(남")
            # If key didn't have (여 (e.g. logic error in previous script kept it weird?), just force insert
            if "(여" not in found_key:
                # Fallback replacement
                pass 
                
            del new_map[found_key]
            new_map[new_key] = new_filename
            print(f"Updated Map: {found_key} -> {new_key}")

    with open(MAP_FILE, 'w', encoding='utf-8') as f:
        json.dump(new_map, f, ensure_ascii=False, indent=4)
        
    print("Repair Complete.")

if __name__ == "__main__":
    main()
