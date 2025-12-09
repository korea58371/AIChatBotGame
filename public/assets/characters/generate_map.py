
import json
import os
import re

json_path = r"j:\AI\Game\AIChatBotGame\src\data\prompts\characters.json"
output_path = r"j:\AI\Game\AIChatBotGame\public\assets\characters\character_map.json"

def to_camel_case(text):
    if not text: return ""
    text = text.replace("Dr.", "").strip()
    parts = re.split(r'[ -/]', text)
    camel_parts = [p.capitalize() for p in parts if p]
    return "".join(camel_parts)

def main():
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    char_map = {}
    
    for char in data:
        korean_name = char.get('name')
        english_name = char.get('englishName', '')
        
        if korean_name and english_name:
            # Generate ID consistent with our folder renaming
            char_id = to_camel_case(english_name)
            char_map[korean_name] = char_id
            print(f"Mapped {korean_name} -> {char_id}")
    
    # Write to file
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(char_map, f, indent=4, ensure_ascii=False)
    
    print(f"Successfully generated {output_path}")

if __name__ == "__main__":
    main()
