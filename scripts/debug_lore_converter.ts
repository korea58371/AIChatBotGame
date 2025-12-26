
import { LoreConverter } from '../src/lib/lore-converter.ts';

const mockLore = {
    "charactersDetail": {
        "characters_main": {
            "공손란": {
                "personality": {
                    "내면/애정 성격": "T",
                    "표면적 성격": "T"
                },
                "preferences": {
                    "dislike": "D",
                    "like": "L"
                },
                "profile": {
                    "BWH": "68-50-70",
                    "나이": "14",
                    "소속": "곤륜파",
                    "신분": "검선"
                },
                "social": {
                    "선생님": "전수자"
                },
                "강함": {
                    "description": "Desc",
                    "skills": {
                        "낙화유수": "Desc",
                        "삼매진화": "Desc"
                    },
                    "등급": "현경"
                },
                "외형": {
                    "outfit_style": "Style"
                },
                "인간관계": {
                    "남궁세아": "잔소리"
                }
            }
        }
    }
};

try {
    console.log("Attempting conversion...");
    const output = LoreConverter.convertToMarkdown(mockLore, "User Persona Info");
    console.log("Conversion Success!");
    console.log("--- OUTPUT START ---");
    console.log(output);
    console.log("--- OUTPUT END ---");
} catch (e) {
    console.error("Conversion Failed!");
    console.error(e);
}
