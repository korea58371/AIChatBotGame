import json
import os
import re

# JSON path
json_path = r"j:\AI\Game\AIChatBotGame\src\data\prompts\characters.json"
# Assets path
assets_path = r"j:\AI\Game\AIChatBotGame\public\assets\characters"

def to_camel_case(text):
    if not text: return ""
    # Remove titles like "Dr."
    text = text.replace("Dr.", "").strip()
    # Replace hyphens/spaces with empty string, but try to preserve Capitalization if possible
    # Actually, simpler: Split by non-alphanumeric, capitalize first letter of each part? 
    # But usually names like "Han Ga-eul" -> "HanGaEul" or "HanGaeul".
    # User's current folders look like "HanGaeul" or "HanYeoReum".
    # Let's just strip non-alpha and see what we get, or start with just stripping spaces/hyphens.
    clean = re.sub(r'[^a-zA-Z]', '', text)
    return clean

# Special manual overrides if the simple "remove non-alpha" logic fails
# or if the JSON Name is widely different from the ID.
id_overrides = {
    "백설희": "Despina", # JSON name might be Despina?
}

def main():
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    char_map = {} # Korean -> Suggested English ID
    
    print(f"{'Korean Name':<10} | {'JSON English':<20} | {'Suggested ID':<15}")
    print("-" * 55)

    for char in data:
        korean_name = char.get('name')
        english_name = char.get('englishName', '')
        
        # If no English name, maybe defined in a fallback or just skip
        if not english_name:
             # Try to guess or just mark
             pass

        # Generate ID
        # 1. Simple strip
        suggested_id = to_camel_case(english_name)
        
        # 2. Fix capitalization if needed? 
        # "Han Ga-eul" -> "HanGaeul". 
        # "Seong Si-a" -> "SeongSia" or "SeongSiA"?
        # Let's try to Capitalize parts split by ' ' or '-'
        parts = re.split(r'[ -]', english_name.replace("Dr.", "").strip())
        camel_parts = [p.capitalize() for p in parts if p]
        camel_id = "".join(camel_parts)
        
        char_map[korean_name] = {
            "json_eng": english_name,
            "id": camel_id
        }
        print(f"{korean_name:<10} | {english_name:<20} | {camel_id:<15}")

    print("\n--- Folder Check ---")
    current_folders = [f for f in os.listdir(assets_path) if os.path.isdir(os.path.join(assets_path, f))]
    
    # Check for discrepancies
    for kor, info in char_map.items():
        expected_id = info['id']
        json_eng = info['json_eng']
        
        # Fuzzy check: do we have a folder that matches 'expected_id' exactly?
        if expected_id in current_folders:
            print(f"✅ Match: {kor} -> {expected_id}")
            continue
            
        # If not, do we have something close?
        found = False
        for folder in current_folders:
            if folder.lower() == expected_id.lower():
                print(f"⚠️ Case Mismatch: {kor} -> JSON: {expected_id} vs Folder: {folder}")
                found = True
                break
        
        if not found:
             print(f"❌ Missing/Different: {kor} -> JSON says '{json_eng}' implies '{expected_id}'. Folder not found.")

if __name__ == "__main__":
    main()
