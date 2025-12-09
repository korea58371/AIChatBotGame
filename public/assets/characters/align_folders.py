
import os

assets_path = r"j:\AI\Game\AIChatBotGame\public\assets\characters"

# Explicit Legacy -> Canonical mapping
# Based on identified mismatches
rename_map = {
    "KangJiSu": "KangJiSoo",
    "Elena": "ElenaRoseweiss",
    "YunSeulBi": "YoonSeulBi",
    "Anastasia": "AnastasiaIvanova",
    "Sakurako": "KisaragiSakurako",
    "SeolA": "SeolAh",
    "SongChaeYun": "SongChaeYoon"
}

def main():
    print("Starting Folder Alignment...")
    
    current_folders = os.listdir(assets_path)
    
    for old_id, new_id in rename_map.items():
        old_dir = os.path.join(assets_path, old_id)
        new_dir = os.path.join(assets_path, new_id)
        
        if os.path.exists(old_dir):
            if os.path.exists(new_dir) and old_id != new_id:
                print(f"Warning: Target {new_id} already exists. Skipping {old_id}.")
                continue
            
            print(f"Renaming {old_id} -> {new_id}")
            os.rename(old_dir, new_dir)
            
            # Rename internal files
            for filename in os.listdir(new_dir):
                if filename.startswith(old_id):
                    new_filename = filename.replace(old_id, new_id, 1)
                    old_file = os.path.join(new_dir, filename)
                    new_file = os.path.join(new_dir, new_filename)
                    print(f"  Renaming File: {filename} -> {new_filename}")
                    os.rename(old_file, new_file)
        else:
            print(f"Legacy folder {old_id} not found. Skipping.")

    print("Alignment Complete.")

if __name__ == "__main__":
    main()
