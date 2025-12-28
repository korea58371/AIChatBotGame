import json
import os

CHARS_PATH = r"j:\AI\Game\AIChatBotGame\src\data\games\god_bless_you\jsons\characters.json"

def main():
    with open(CHARS_PATH, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    targets = ["백마리", "마세영", "고하늘", "천서윤", "이아라"]
    
    print("Found Lines:")
    for i, line in enumerate(lines):
        for t in targets:
            if f'"{t}"' in line:
                print(f"{t}: Line {i+1}")

if __name__ == "__main__":
    main()
