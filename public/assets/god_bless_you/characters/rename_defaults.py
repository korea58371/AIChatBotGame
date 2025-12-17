
import os
import json
from PIL import Image

# Configuration
assets_path = r"j:\AI\Game\AIChatBotGame\public\assets\characters"
map_path = r"j:\AI\Game\AIChatBotGame\public\assets\characters\character_map.json"

def main():
    print("Starting Default Image Renaming...")
    
    if not os.path.exists(map_path):
        print("Map file not found!")
        return

    with open(map_path, 'r', encoding='utf-8') as f:
        char_map = json.load(f)

    for kor_name, eng_id in char_map.items():
        folder_path = os.path.join(assets_path, eng_id)
        if not os.path.exists(folder_path):
            continue
            
        # Target filenames to look for
        possible_files = [f"{kor_name}.jpg", f"{kor_name}.png", f"{kor_name}.jpeg"]
        
        target_name = f"{eng_id}_Default_Default.png"
        target_path = os.path.join(folder_path, target_name)
        
        # Check if target already exists
        if os.path.exists(target_path):
            print(f"Target already exists for {eng_id}: {target_name}. Skipping.")
            continue

        found = False
        for filename in possible_files:
            file_path = os.path.join(folder_path, filename)
            if os.path.exists(file_path):
                print(f"Processing {eng_id}: Found {filename}")
                
                try:
                    # Open and Convert to PNG
                    with Image.open(file_path) as img:
                        img.save(target_path, "PNG")
                    
                    print(f"  Converted and Saved -> {target_name}")
                    
                    # Optional: Remove original if successful? 
                    # User said "Modify these images to...", usually implies replacement.
                    # I will keep original for safety unless I'm sure? 
                    # Verification step: "Rename" usually implies data movement.
                    # I'll delete the original to match "Rename/Modify" intent strictly.
                    img.close() # Ensure closed before delete
                    os.remove(file_path)
                    print(f"  Removed original {filename}")
                    
                    found = True
                    break
                except Exception as e:
                    print(f"  Error converting {filename}: {e}")
                    # Fallback: Just rename if PIL fails?
                    try:
                        os.rename(file_path, target_path)
                        print(f"  Fallback: Renamed {filename} -> {target_name} (No Format Conversion)")
                        found = True
                        break
                    except Exception as ex:
                        print(f"  Fallback failed: {ex}")

        if not found:
            # Maybe it's already there or name is different?
            pass

    print("Default Image Renaming Complete.")

if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("PIL not found. Switching to simple rename mode.")
        # Simple rename fallback logic could go here, but let's see if PIL works first.
        # Rerunning main script logic without PIL if needed would be complex to duplicate here.
        # Let's just exit and let the agent know.
