import os
import json
import shutil

ASSETS_DIR = r"j:\AI\Game\AIChatBotGame\public\assets\wuxia\ExtraCharacters"
MAP_FILE = r"j:\AI\Game\AIChatBotGame\src\data\games\wuxia\extra_map.json"

def classify_gender(name):
    name_lower = name.lower()
    
    # Explicit Female
    if any(k in name_lower for k in ['여', '녀', '처녀', '소녀', '주모', '기생', '기녀', '마담', '부인', '고모', '할멈', '자매', '딸', '어미', '공주', '비', '후']):
        return "여"
    
    # Explicit Male (or assume Male for generic generic martial roles)
    # Most Wuxia generic roles (Bandit, Guard, Waiter, Monk) are male unless specified.
    return "남"

def main():
    with open(MAP_FILE, 'r', encoding='utf-8') as f:
        extra_map = json.load(f)

    new_map = {}
    renamed_count = 0

    # Process existing map entries
    # We iterate the MAP to preserve the logic of what matches what.
    # Note: Multiple keys might point to same file, but here keys are usually 1:1 or specific variants.
    
    # Get all files first to verify existence
    existing_files = set(os.listdir(ASSETS_DIR))

    for key, filename in extra_map.items():
        if filename not in existing_files:
            print(f"Warning: File {filename} not found in assets. Skipping.")
            continue

        name_part = os.path.splitext(filename)[0]
        ext = os.path.splitext(filename)[1]

        # Determine gender from KEY or FILENAME
        # Use Key for logic as it often has more context (e.g. "점소이(남자)")
        gender = classify_gender(key)
        
        # New Filename: Name_Gender.png (avoid double tagging if already present)
        # Check if already tagged
        if name_part.endswith("_남") or name_part.endswith("_여"):
             new_filename = filename
             new_key = key # Already done?
        else:
            new_filename = f"{name_part}_{gender}{ext}"
        
        # Check if key needs update
        # We want key to be "Name(Gender)" or "Name(Gender, Detail)"
        # Regex to insert gender?
        # If key has '(', insert inside? e.g. "점소이(비굴한)" -> "점소이(남, 비굴한)"
        # If key has no '(', add it. "점소이" -> "점소이(남)"
        
        new_key = key
        # Skip if key already has gender info
        if "(남" not in key and "(여" not in key and "남자" not in key and "여자" not in key:
            if "(" in key:
                # "점소이(비굴한)" -> "점소이(남, 비굴한)"
                prefix, suffix = key.split("(", 1)
                suffix = suffix.rstrip(")")
                new_key = f"{prefix}({gender}, {suffix})"
            else:
                # "점소이" -> "점소이(남)"
                new_key = f"{key}({gender})"
        
        # Perform Rename
        old_path = os.path.join(ASSETS_DIR, filename)
        new_path = os.path.join(ASSETS_DIR, new_filename)
        
        # Handle case where new_filename exists (collision?)
        # Since input filenames are unique, new ones should be too unless mapped blindly.
        
        if old_path != new_path:
            try:
                if os.path.exists(new_path) and new_path != old_path:
                    # If target exists, we might be merging or it was already renamed provided input list had dupes?
                    # The map values are unique files usually.
                    pass
                else:
                    os.rename(old_path, new_path)
                    print(f"Renamed: {filename} -> {new_filename}")
            except Exception as e:
                print(f"Error renaming {filename}: {e}")
                new_filename = filename # Revert logic for map

        new_map[new_key] = new_filename
        renamed_count += 1

    # Save new map
    with open(MAP_FILE, 'w', encoding='utf-8') as f:
        json.dump(new_map, f, ensure_ascii=False, indent=4)
    
    print(f"Finished. Processed {renamed_count} items.")

if __name__ == "__main__":
    main()
