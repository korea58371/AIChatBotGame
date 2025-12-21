
import fs from 'fs';
import { PromptManager } from './src/lib/prompt-manager';

async function main() {
    const mockLore = {
        charactersDetail: {
            characters_main: [
                {
                    basic_profile: { 이름: "테스트캐릭터", 나이: "20", 소속: "테스트파", 신분: "테스트" },
                    relationships: { "타겟A": "관계설명1", "타겟B": "관계설명2" },
                    preferences: { "좋아하는 것": "테스트" }
                }
            ]
        }
    };

    const mockState: any = {
        activeGameId: 'wuxia',
        lore: mockLore,
        constants: {
            FAMOUS_CHARACTERS: "Famous Chars...",
            WUXIA_SYSTEM_PROMPT_CONSTANTS: "Strict Rules..."
        },
        availableBackgrounds: ["객잔_1층", "객잔_2층"]
    };

    const staticContext = await PromptManager.getSharedStaticContext(mockState);

    // Read the current preview file to preserve dynamic part?
    // Or just write the static part + a placeholder for dynamic.
    const output = staticContext + "\n\n## 2. DYNAMIC SYSTEM PROMPT (Placeholder)\n...";

    fs.writeFileSync('_PROMPT_PREVIEW.md', output, 'utf8');
    console.log("Generated _PROMPT_PREVIEW.md");
}

main();
