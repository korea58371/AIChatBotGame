const fs = require('fs');
const path = require('path');

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const WUXIA_DATA_DIR = path.join(PROJECT_ROOT, 'src/data/games/wuxia');
const WUXIA_JSONS_DIR = path.join(WUXIA_DATA_DIR, 'jsons');

// Load Data
const charactersMainPath = path.join(WUXIA_JSONS_DIR, 'characters/characters_main.json');
const factionsPath = path.join(WUXIA_JSONS_DIR, 'factions.json');
const supportingCharsPath = path.join(WUXIA_JSONS_DIR, 'characters/characters_supporting.json');
const charMapPath = path.join(WUXIA_DATA_DIR, 'character_map.json');

const charactersMain = JSON.parse(fs.readFileSync(charactersMainPath, 'utf8'));
const factionsData = JSON.parse(fs.readFileSync(factionsPath, 'utf8'));
const supportingChars = JSON.parse(fs.readFileSync(supportingCharsPath, 'utf8'));
const charMap = JSON.parse(fs.readFileSync(charMapPath, 'utf8'));

const wikiData = {};

// Helper: Normalize Name (remove Hanja)
const normalizeName = (name) => name.split('(')[0].trim();

// Helper: Create Section
const createSection = (title, content) => ({ title, content });

// Helper: Process Character Data (Generic for Main/Supporting)
const processCharacter = (charData, isMain = false) => {
    const profile = charData.basic_profile;
    const name = normalizeName(profile.이름);

    // Determine ID
    let engId = charMap[name];
    if (!engId) {
        // Try finding by partial match or manual mapping for known heroes
        const nameKey = name.replace(/\s/g, '');
        if (charMap[nameKey]) engId = charMap[nameKey];
    }

    // Formatting Image Key - Ensure NULL if invalid, never empty string
    const imageKey = engId ? `${engId}_Default` : null;

    const sections = [];

    // 1. 개요 (Overview) - Narrative Style
    let intro = "";
    if (charData.header_title) {
        intro += `> **"${charData.header_title}"**\n\n`;
    }
    intro += `천하제일의 등장인물. ${profile.소속}의 ${profile.신분}이자, 작중 주요 인물 중 하나다.`;
    if (profile.별명) intro += ` 강호에서는 **'${profile.별명}'**이라는 이명으로도 잘 알려져 있다.`;
    intro += `\n\n`;

    // Add Social/Role description if avail - interwoven
    if (charData.social) {
        Object.entries(charData.social).forEach(([k, v]) => {
            intro += `${v} `;
        });
        intro += `\n`;
    }
    sections.push(createSection("1. 개요", intro));

    // 2. 상세 (Details - Appearance & Personality)
    let detailContent = "";

    // 2.1 Appearance - Refined to Paragraphs (No ### Headers)
    if (charData.appearance) {
        detailContent += "**[외모]**\n";
        const app = charData.appearance;

        let appText = "";

        // Merge Hair & Eyes into one sentence if possible
        if (app.머리색 && app.눈색) {
            appText += `${app.머리색} ${app.눈색} `;
        } else {
            if (app.머리색) appText += `${app.머리색} `;
            if (app.눈색) appText += `${app.눈색} `;
        }

        if (app["얼굴형/인상"]) appText += `${app["얼굴형/인상"]} `;
        if (app.체형) appText += `${app.체형} `;

        // Outfit - specific paragraph
        if (app.outfit_style) {
            appText += `\n\n**복장**\n${app.outfit_style}`;
        }

        detailContent += `${appText}\n\n`;
    }

    // 2.2 Personality - Refined to Paragraphs (No ### Headers)
    if (charData.personality) {
        detailContent += "**[성격]**\n";
        const per = charData.personality;

        // Narrative Construction for Personality
        let perText = "";
        if (per["표면적 성격"]) perText += `평소에는 **${per["표면적 성격"]}**의 성향을 띠고 있다. `;
        if (per["표면적 성격 (대외용)"]) perText += `하지만 대외적으로는 **${per["표면적 성격 (대외용)"]}**한 모습을 보여주기도 한다.\n\n`;

        if (per.traits) {
            // Traits woven into text
            perText += "주요 특징으로는 다음과 같은 점들이 있다. ";
            const traitSentences = per.traits.map(t => {
                return t.endsWith('.') ? t : t + '.';
            });
            perText += traitSentences.join(' ');
            perText += "\n\n";
        }
        // Removed Protagonist-centric reactions to avoid "future spoiler" feel
        // if (per["친해졌을 때 (동료/친구)"]) ...
        // if (per["애정 관계일 때 (연인)"]) ...
        detailContent += `${perText}\n`;
    }
    sections.push(createSection("2. 상세", detailContent));

    // 3. 인간관계 (Relationships)
    if (charData.relationships) {
        let relContent = "주인공을 중심으로 한 인간관계는 다음과 같다.\n\n";
        Object.entries(charData.relationships).forEach(([k, v]) => {
            // sanitize "will betray" or future tense
            let val = v.replace(/할 예정이다/g, "할 수도 있다는 암시가 있다")
                .replace(/하게 된다/g, "하는 전개를 보인다");
            relContent += `- **${k}**: ${val}\n`;
        });
        sections.push(createSection("3. 인간관계", relContent));
    }

    // 4. 여담 (Trivia/TMI)
    if (charData.preferences) {
        let tmiContent = "";
        const pref = charData.preferences;

        // Narrative Style TMI
        tmiContent += `작중에서 드러난 취향을 살펴보면, `;
        if (pref["좋아하는 것"]) {
            tmiContent += `**${pref["좋아하는 것"]}** 등을 좋아한다고 한다. `;
        }
        if (pref["싫어하는 것"]) {
            tmiContent += `반대로 **${pref["싫어하는 것"]}**에 대해서는 뚜렷한 거부감을 보인다.`;
        }

        sections.push(createSection("4. 여담", tmiContent));
    }

    // 5. 기타 (Secrets/Spoilers) -> Converted to "Novel Knowledge"
    if (charData.secret) {
        let secretContent = ":::spoiler [ 펼치기 / 접기 ]\n";
        // Rename Header to imply knowledge, not future action
        secretContent += `**[원작 설정 / 비설]**\n\n`;

        // Check content and sanitize if it sounds like a script direction
        let coreSecret = charData.secret.내용 || charData.secret;

        // Tone down future tense actions to "Setting" or "Backstory"
        // e.g. "Will kill player" -> "Harbors a hidden intent against..."
        // Simple heuristic: keep it as is but wrap in context of 'Setting'

        secretContent += `${coreSecret}\n`;
        secretContent += ":::\n";
        sections.push(createSection("5. 기타 (스포일러)", secretContent));
    }

    // Infobox Construction
    const infobox = [
        { label: "이름", value: name },
        { label: "성별", value: profile.성별 || (isMain ? "여성" : "불명") },
        { label: "나이", value: profile.나이 || "불명" },
        { label: "소속", value: profile.소속 || "불명" },
        { label: "신분", value: profile.신분 || "불명" },
        { label: "경지", value: profile.martial_arts_realm?.name || "불명" }
    ];

    if (profile.신체) infobox.push({ label: "체격", value: profile.신체 });

    wikiData[name] = {
        category: "AIChatBotGame/등장인물",
        name: engId ? `${name} (${engId})` : name,
        image: imageKey,
        role: isMain ? "주연" : (profile.신분 || "조연"),
        infobox: infobox,
        sections: sections
    };
};

console.log('Processing Main Characters (High Detail)...');
charactersMain.forEach(char => processCharacter(char, true));

console.log('Processing Supporting Characters...');
supportingChars.forEach(char => {
    // Check if duplicate (Main has precedence)
    const name = normalizeName(char.basic_profile.이름);
    if (wikiData[name]) {
        console.log(`Skipping supporting entry for ${name} (Already exists as Main)`);
        return;
    }
    processCharacter(char, false);
});

// 3. Process Factions
console.log('Processing Factions...');
factionsData.factions.forEach(group => {
    group.factions.forEach(faction => {
        const name = normalizeName(faction.name);

        const sections = [
            {
                title: "1. 개요",
                content: faction.description || "정보가 없습니다."
            },
            {
                title: "2. 무공 특성",
                content: faction.martial_arts_style || "정보가 없습니다."
            }
        ];

        if (faction.key_figures && faction.key_figures.length > 0) {
            sections.push({
                title: "3. 주요 인물",
                content: faction.key_figures.map(f => `- ${f}`).join('\n')
            });
        }

        // Add Heroines if available from faction data
        if (faction.key_heroines && faction.key_heroines.length > 0) {
            sections.push({
                title: "4. 소속 영식/영애",
                content: faction.key_heroines.map(f => `- ${f}`).join('\n')
            });
        }

        wikiData[name] = {
            category: "AIChatBotGame/문파",
            name: name,
            image: null, // No logos yet
            role: faction.type || "문파",
            infobox: [
                { label: "문파명", value: name },
                { label: "분류", value: faction.type || "불명" },
                { label: "위치", value: faction.location || "불명" },
                { label: "소속 연합", value: group.group_name || "독립" }
            ],
            sections: sections
        };
    });
});

// Output
const outputPath = path.join(WUXIA_DATA_DIR, 'wiki_data.json');
fs.writeFileSync(outputPath, JSON.stringify(wikiData, null, 4), 'utf8');
console.log(`Wiki data generated at: ${outputPath}`);
