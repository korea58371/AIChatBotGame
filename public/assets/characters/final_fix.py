
import os
import shutil

assets_path = r"j:\AI\Game\AIChatBotGame\public\assets\characters"

# Correct Mappings based on characters.json English Names
# Current Folder -> Correct Target JSON ID
rename_map = {
    "KoHaNeul": "GoHaNeul",
    "SeoISu": "SeoYiSu",
    "YuHwaYoung": "YooHwaYoung",
    "HanGaeul": "HanGaEul"
}

def main():
    print("Starting Final Fix for Folder IDs...")
    
    if not os.path.exists(assets_path):
        print(f"Path not found: {assets_path}")
        return

    # list current folders
    current_folders = os.listdir(assets_path)
    
    for old_id, new_id in rename_map.items():
        old_dir = os.path.join(assets_path, old_id)
        new_dir = os.path.join(assets_path, new_id)
        
        if os.path.exists(old_dir):
            if os.path.exists(new_dir) and old_id != new_id:
                print(f"Warning: Target directory {new_id} already exists. Skipping rename of {old_id}.")
                continue
            
            print(f"Renaming Folder: {old_id} -> {new_id}")
            # Rename Folder
            os.rename(old_dir, new_dir)
            
            # Rename Files inside
            for filename in os.listdir(new_dir):
                if filename.startswith(old_id):
                    # Replace prefix
                    new_filename = filename.replace(old_id, new_id, 1) # Only first occurrence
                    old_file = os.path.join(new_dir, filename)
                    new_file = os.path.join(new_dir, new_filename)
                    print(f"  Renaming File: {filename} -> {new_filename}")
                    os.rename(old_file, new_file)
        else:
            if os.path.exists(new_dir):
                 print(f"Folder {new_id} already exists (Correct). Checking if files need update inside...")
                 # Check files inside just in case (e.g. folder correct but files not?)
                 for filename in os.listdir(new_dir):
                     # If file starts with OLD id (unlikely but possible if manually renamed folder but not files)
                     if filename.startswith(old_id):
                         new_filename = filename.replace(old_id, new_id, 1)
                         old_file = os.path.join(new_dir, filename)
                         new_file = os.path.join(new_dir, new_filename)
                         print(f"  Fixing File in correct folder: {filename} -> {new_filename}")
                         os.rename(old_file, new_file)
            else:
                print(f"Folder {old_id} not found. Skipping.")

    print("Final Fix Complete.")

if __name__ == "__main__":
    main()
