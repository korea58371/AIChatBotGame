
import os

assets_path = r"j:\AI\Game\AIChatBotGame\public\assets\characters"
target = "HanGaEul"
current = "HanGaeul"

def main():
    root = os.path.join(assets_path, current)
    temp = os.path.join(assets_path, current + "_temp")
    final = os.path.join(assets_path, target)

    if os.path.exists(root):
        print(f"Renaming {current} -> {current}_temp")
        os.rename(root, temp)
        
        print(f"Renaming {current}_temp -> {target}")
        os.rename(temp, final)
        
        # Now fix files
        for filename in os.listdir(final):
            if filename.startswith(current):
                new_filename = filename.replace(current, target, 1)
                print(f"Renaming file {filename} -> {new_filename}")
                os.rename(os.path.join(final, filename), os.path.join(final, new_filename))
    else:
        # Check if it was already renamed to target but case is wrong? 
        # Windows might report 'HanGaEul' even if it's 'HanGaeul' on disk via listdir sometimes?
        # Let's check what listdir says.
        actual_name = next((f for f in os.listdir(assets_path) if f.lower() == target.lower()), None)
        print(f"Actual folder name: {actual_name}")
        
        if actual_name and actual_name != target:
             print(f"Correcting case from {actual_name} to {target}")
             os.rename(os.path.join(assets_path, actual_name), temp)
             os.rename(temp, final)

if __name__ == "__main__":
    main()
