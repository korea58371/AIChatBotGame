
import json
import re
import os

# Target file
file_path = 'src/data/games/wuxia/jsons/characters/characters_main.json'
abs_path = os.path.abspath(file_path)

print(f"Processing: {abs_path}")

try:
    with open(abs_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
except Exception as e:
    print(f"Error reading file: {e}")
    exit(1)

def clean_text(text):
    if not isinstance(text, str):
        return text
    
    original = text
    
    # 1. Remove Pure English Parentheses: " (Silver Blonde)", "(Peak)"
    # Matches: Space(opt) + ( + English/Space/Symbols + )
    # Requires at least one English char to be matched by the main class, but avoiding Korean/Numbers if mixed.
    # Pattern explanation:
    # \s* : optional leading space
    # \( : opening paren
    # [a-zA-Z0-9\s,\.\-\/\!\?~]+ : content (English, numbers, common symbols)
    # \) : closing paren
    # But we want to avoid removing "(19세)" or "(D컵)".
    # So we ensure the content does NOT contain Korean.
    # The regex below matches strings that consist ONLY of ASCII printable characters inside parens.
    
    # Regex to find parens with ONLY ascii characters (letters, numbers, punctuation, space)
    # And then remove them.
    # Note: This removes "(19)" too. Is that ok? "나이": "19세" usually. "19" in parens might be valid.
    # But "power_level": 4, "name": "절정 (Peak)".
    # Let's risk it for now, or refine to require at least one a-zA-Z.
    
    # Pattern A: Parenthesis containing at least one a-zA-Z, and NO non-ascii.
    text = re.sub(r'\s*\([ -~]*[a-zA-Z]+[ -~]*\)', '', text)
    
    # 2. Handle Mixed: "연화린 (延花凛 / Yeon Hwa-rin)" -> "연화린 (延花凛)"
    # Remove " / English..." inside partial
    # Look for " / " followed by English/Spaces/Hyphens before a closing paren.
    text = re.sub(r'\s*/\s*[a-zA-Z\-\s]+(?=\))', '', text)
    
    # 3. Handle "English" inside parens that wasn't caught?
    # e.g. " (Silver Blonde)" -> Caught by #1.
    
    # Cleanup double spaces created by removal
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def recursive_clean(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            obj[k] = recursive_clean(v)
    elif isinstance(obj, list):
        for i in range(len(obj)):
            obj[i] = recursive_clean(obj[i])
    elif isinstance(obj, str):
        obj = clean_text(obj)
    return obj

cleaned_data = recursive_clean(data)

try:
    with open(abs_path, 'w', encoding='utf-8') as f:
        json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
    print("Successfully cleaned and saved file.")
except Exception as e:
    print(f"Error writing file: {e}")
    exit(1)
