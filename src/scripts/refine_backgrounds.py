import os
import re

ASSETS_DIR = r"j:\AI\Game\AIChatBotGame\public\assets\wuxia\backgrounds"
MAPPING_FILE = r"j:\AI\Game\AIChatBotGame\src\data\games\wuxia\backgroundMappings.ts"

# Source (Korean) -> Target (English)
# Includes previous batch + new batch to maintain complete mapping
RENAME_MAP = {
    # Batch 1
    "강호_평야.jpg": "Jianghu_Plains.jpg",
    "강호_평야2.jpg": "Jianghu_Plains2.jpg",
    "강호_폐가마을.jpg": "Jianghu_RuinedVillage.jpg",
    "강호_협곡입구.jpg": "Jianghu_CanyonEntrance.jpg",
    "강호_황무지.jpg": "Jianghu_Wasteland.jpg",
    "마을_금은방.jpg": "Village_JewelryStore.jpg",
    "마을_대장간.jpg": "Village_Blacksmith.jpg",
    "마을_대장간2.jpg": "Village_Blacksmith2.jpg",
    "마을_도박장.jpg": "Village_GamblingHouse.jpg",
    "마을_허름한객잔.jpg": "Village_ShabbyInn.jpg",
    "사찰.jpg": "Temple.jpg",
    "사파본거지.jpg": "Unorthodox_Base.jpg",
    "산_기암절벽.jpg": "Mountain_RockyCliff.jpg",
    "산_동굴.jpg": "Mountain_Cave.jpg",
    "산_동굴2.jpg": "Mountain_Cave2.jpg",
    "산_동굴입구.jpg": "Mountain_CaveEntrance.jpg",
    "산_불길한산길.jpg": "Mountain_OminousPath.jpg",
    "산_사찰.jpg": "Mountain_Temple.jpg",
    "산_사찰2.jpg": "Mountain_Temple2.jpg",
    "산_사파본거지.jpg": "Mountain_UnorthodoxBase.jpg",
    "산_산적거주지.jpg": "Mountain_BanditCamp.jpg",
    "산_습격길.jpg": "Mountain_AmbushPath.jpg",
    "산_협곡입구.jpg": "Mountain_CanyonEntrance.jpg",
    "살막본거지.jpg": "AssassinGuild_Base.jpg",
    "스산한마을.jpg": "Desolate_Village.jpg",
    "작은마을.jpg": "Small_Village.jpg",
    "작은마을2.jpg": "Small_Village2.jpg",
    "초가마을.jpg": "Thatched_Village.jpg",
    "큰마을.jpg": "Large_Village.jpg",
    "폐가.jpg": "Abandoned_House.jpg",
    "황무지2.jpg": "Wasteland2.jpg",
    
    # Batch 2 (New)
    "마을_지하투기장.jpg": "Village_UndergroundArena.jpg",
    "마을_허름한객잔2.jpg": "Village_ShabbyInn2.jpg",
    "황실_장군부.jpg": "Imperial_GeneralMansion.jpg",
    "흑사파본거지.jpg": "BlackSnakeSect_Base.jpg"
}

def main():
    if not os.path.exists(ASSETS_DIR):
        print("Assets directory not found.")
        return

    # 1. Rename Files
    generated_mappings = []
    
    for kor_name, eng_name in RENAME_MAP.items():
        src = os.path.join(ASSETS_DIR, kor_name)
        dst = os.path.join(ASSETS_DIR, eng_name)
        
        # Check if src exists (Rename)
        if os.path.exists(src):
            try:
                os.rename(src, dst)
                print(f"Renamed: {kor_name} -> {eng_name}")
            except Exception as e:
                print(f"Error renaming {kor_name}: {e}")
        elif os.path.exists(dst):
            # Already renamed, just allow it
            pass
        else:
            # Both missing - strictly speaking this means file is gone, 
            # but maybe we only want to map if the target exists?
            # For now, we assume the intention is to map it regardless if we think we have it,
            # or skip if neither exists.
            # Let's Skip if neither exists to avoid broken links, unless it's just not visible to script for some reason.
            # But user said they exist.
            print(f"Warning: File {kor_name} not found and {eng_name} not found.")
            pass

        # Always add to mapping if it WAS in our rename list (assuming it exists or will exist)
        # Or better: check existence of dst?
        if os.path.exists(dst):
            key = kor_name.replace('.jpg', '')
            generated_mappings.append(f"    '{key}': '{eng_name}',")

    # 2. Handle Residual Wuxia_Scene_XX
    existing_files = os.listdir(ASSETS_DIR)
    for f in existing_files:
        if f.startswith("Wuxia_Scene_") and f.endswith(".jpg"):
            match = re.search(r"Wuxia_Scene_(\d+).jpg", f)
            if match:
                num = match.group(1)
                key = f"무협_풍경_{num}"
                generated_mappings.append(f"    '{key}': '{f}',")

    # Sort mappings
    generated_mappings.sort()

    # 3. Update Mapping File
    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    start_marker = "// [Auto-Registered] New Gemini Backgrounds"
    
    if start_marker in content:
        start_idx = content.find(start_marker)
        end_idx = content.rfind("};")
        
        if start_idx != -1 and end_idx != -1:
            prefix = content[:start_idx]
            suffix = content[end_idx:]
            
            new_block = "// [Auto-Registered] New Gemini Backgrounds\n" + "\n".join(generated_mappings) + "\n"
            new_content = prefix + new_block + suffix
            
            with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Updated backgroundMappings.ts successfully.")
        else:
            print("Could not parse mapping file structure.")
    else:
        print("Marker missing. Cannot update safely without manual intervention (or previous run failed).")

if __name__ == "__main__":
    main()
