import os

ASSETS_DIR = r"j:\AI\Game\AIChatBotGame\public\assets\wuxia\backgrounds"
MAPPING_FILE = r"j:\AI\Game\AIChatBotGame\src\data\games\wuxia\backgroundMappings.ts"

def main():
    # 1. Find all Gemini_Generated files
    if not os.path.exists(ASSETS_DIR):
        print(f"Directory not found: {ASSETS_DIR}")
        return

    files = [f for f in os.listdir(ASSETS_DIR) if f.startswith("Gemini_Generated_Image_") and f.lower().endswith(".jpg")]
    files.sort() # Ensure deterministic order

    if not files:
        print("No matches found.")
        return

    print(f"Found {len(files)} generated images.")

    new_mappings = []
    
    # 2. Rename and Prepare Mapping
    start_index = 1
    # Check existing files to avoid collision? 
    # Let's assume Wuxia_Scene_XX doesn't exist or we overwrite if it's the same flow 
    # (actually better to find next available index if we want to be safe, but simple overwrite is likely desired for a fresh batch)
    
    for i, filename in enumerate(files):
        idx = start_index + i
        new_name = f"Wuxia_Scene_{idx:02d}.jpg"
        
        old_path = os.path.join(ASSETS_DIR, filename)
        new_path = os.path.join(ASSETS_DIR, new_name)
        
        try:
            os.rename(old_path, new_path)
            print(f"Renamed: {filename} -> {new_name}")
            
            # Key Format: 무협_풍경_01
            key = f"무협_풍경_{idx:02d}"
            new_mappings.append(f"    '{key}': '{new_name}',")
        except Exception as e:
            print(f"Error renaming {filename}: {e}")

    # 3. Read Mapping File
    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # 4. Insert New Mappings
    # We look for the closing brace `};` and insert before it.
    if "};" in content:
        # Find last occurrence?
        split_idx = content.rfind("};")
        
        prefix = content[:split_idx]
        suffix = content[split_idx:]
        
        # Add a specific section comment
        insertion = "\n    // [Auto-Registered] New Gemini Backgrounds\n" + "\n".join(new_mappings) + "\n"
        
        new_content = prefix + insertion + suffix
        
        with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print("Updated backgroundMappings.ts")
    else:
        print("Could not find closing brace in mapping file.")

if __name__ == "__main__":
    main()
