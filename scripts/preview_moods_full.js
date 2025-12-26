const fs = require('fs');
const path = require('path');

// [PATHS]
const ROOT_DIR = path.join(__dirname, '../src/data/games/wuxia');
const CONSTANTS_PATH = path.join(ROOT_DIR, 'constants.ts');
const MOODS_PATH = path.join(__dirname, '../src/data/prompts/moods.ts');
const BACKGROUNDS_PATH = path.join(__dirname, '../src/data/games/wuxia/backgroundMappings.ts');
const OUTPUT_PATH = path.join(__dirname, 'mood_previews_full.md');

// [JSON PATHS]
const JSON_DIR = path.join(ROOT_DIR, 'jsons');
const PATHS = {
    terminology: path.join(JSON_DIR, 'wuxia_terminology.json'),
    skills: path.join(JSON_DIR, 'martial_arts_skills.json'),
    levels: path.join(JSON_DIR, 'martial_arts_levels.json'),
    factions: path.join(JSON_DIR, 'factions.json'),
    romance: path.join(JSON_DIR, 'wuxia_romance_guide.json'),
    combat: path.join(JSON_DIR, 'martial_arts_combat.json'),
    geography: path.join(JSON_DIR, 'world_geography.json'),
    weapons: path.join(JSON_DIR, 'weapons.json'),
    charMsg: path.join(JSON_DIR, 'characters/characters_main.json'),
    charSub: path.join(JSON_DIR, 'characters/characters_supporting.json'),
    charExtra: path.join(JSON_DIR, 'characters/characters_extra.json'),
    assets: path.join(__dirname, '../src/data/assets.json')
};

// [HELPER: Extract Constant]
function extractConstant(content, name) {
    const regex = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm');
    const match = content.match(regex);
    return match ? match[1] : `[ERROR: Could not extract ${name}]`;
}

// [HELPER: Extract Background Keys]
function extractBackgrounds(content) {
    const keys = [];
    const regex = /'([^']+)'\s*:\s*'[^']+'/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        keys.push(match[1]);
    }
    return keys;
}

// [HELPER: Load JSON]
function loadJson(key) {
    try {
        if (!fs.existsSync(PATHS[key])) return null;
        return JSON.parse(fs.readFileSync(PATHS[key], 'utf8'));
    } catch (e) {
        return null;
    }
}

// [COMPLETE LORE CONVERTER LOGIC]
const LoreConverter = {
    convertTerminology: (terminology) => {
        if (!terminology) return "";
        let output = "## [Wuxia Language & Terminology Guidelines]\n\n";

        // 1. Guidelines & Rules (가이드라인_및_규칙)
        const guide = terminology.가이드라인_및_규칙 || terminology.guidelines;
        if (guide) {
            output += "### Guidelines\n";
            if (guide.핵심_원칙 || guide.core_principle) {
                output += `> ${guide.핵심_원칙 || guide.core_principle}\n\n`;
            }
            const prohibited = guide.금지_용어 || guide.prohibited_terms;
            if (prohibited) {
                output += "**Language Corrections (Strictly enforced)**:\n";
                const objects = prohibited.현대_사물 || prohibited.modern_objects;
                const concepts = prohibited.현대_개념 || prohibited.modern_concepts;

                const processTerm = (item) => {
                    if (item.includes('->')) {
                        const [bad, good] = item.split('->').map(s => s.trim());
                        return `❌ ${bad} → ⭕ ${good}`;
                    }
                    return item;
                };

                if (objects) output += `- **Objects**: ${objects.map(processTerm).join(' / ')}\n`;
                if (concepts) output += `- **Concepts**: ${concepts.map(processTerm).join(' / ')}\n`;
                output += "\n";
            }
        }

        // 2. Titles & Honorifics (호칭_및_경어)
        const titles = terminology.호칭_및_경어;
        if (titles) {
            output += "### Titles & Honorifics\n";
            if (titles.일반_호칭) {
                if (titles.일반_호칭.여성) output += `- **Female**: ${titles.일반_호칭.여성.join(', ')}\n`;
                if (titles.일반_호칭.남성) output += `- **Male**: ${titles.일반_호칭.남성.join(', ')}\n`;
            }
            output += "\n";
        }

        // 3. Measurement System (측량_및_단위)
        const meas = terminology.측량_및_단위 || terminology.measurement_system;
        if (meas) {
            output += "### Measurement System\n";
            if (meas.시간_단위) output += `- **Time**: ${meas.시간_단위.join(', ')}\n`;
            if (meas.길이_거리) output += `- **Distance**: ${meas.길이_거리.join(', ')}\n`;
            if (meas.무게) output += `- **Weight**: ${meas.무게.join(', ')}\n`;
            output += "\n";
        }
        return output;
    },

    convertSkills: (skills) => {
        if (!skills || !skills.범주) return "";
        let output = "## [Special Martial Arts Skills]\n";
        Object.entries(skills.범주).forEach(([catName, list]) => {
            output += `#### ${catName.replace(/_/g, ' ')}\n`;
            if (Array.isArray(list)) {
                list.forEach((skill) => {
                    if (typeof skill === 'string') {
                        const name = skill.split(':')[0].trim();
                        const desc = skill.split(':')[1]?.trim() || "";
                        output += `- **${name}**: ${desc}\n`;
                    }
                });
            }
            output += "\n";
        });
        output += "\n";
        return output;
    },

    // Deprecated wrapper
    convertSystems: (terminology, skills) => {
        return LoreConverter.convertSkills(skills);
    },

    convertFactions: (factionsData) => {
        let list = [];
        if (factionsData && Array.isArray(factionsData.문파)) {
            list = factionsData.문파;
        } else if (Array.isArray(factionsData)) {
            list = factionsData;
        } else {
            return "";
        }

        let output = "## [Great Factions of Wulin]\n\n";
        const groups = {
            "🏳️ 정파 (Orthodox)": [],
            "🏴 사파 (Unorthodox)": [],
            "👿 마교 (Demonic)": [],
            "🏔️ 새외/기타 (Outer/Others)": []
        };

        list.forEach((f) => {
            const type = f.구분 || "";
            const name = f.이름 || "";
            if (type.includes("정파") || type.includes("구파일방") || type.includes("오대세가") || type.includes("명문")) {
                groups["🏳️ 정파 (Orthodox)"].push(f);
            } else if (type.includes("사파") || type.includes("녹림") || type.includes("하오문") || name.includes("사파")) {
                groups["🏴 사파 (Unorthodox)"].push(f);
            } else if (type.includes("마교") || name.includes("마교") || name.includes("혈교")) {
                groups["👿 마교 (Demonic)"].push(f);
            } else {
                groups["🏔️ 새외/기타 (Outer/Others)"].push(f);
            }
        });

        const renderGroup = (title, factionList) => {
            if (factionList.length === 0) return "";
            factionList.sort((a, b) => (a.이름 || "").localeCompare(b.이름 || ""));
            let str = `### [${title}]\n`;
            factionList.forEach(f => {
                str += `#### ${f.이름}\n`;
                if (f.설명) str += `- **Desc**: ${f.설명}\n`;
                if (f.위치) str += `- **Loc**: ${f.위치}\n`;
                if (f.성향) str += `- **Align**: ${f.성향}\n`;
                if (f.전투스타일) str += `- **Style**: ${f.전투스타일}\n`;

                if (f.주요인물) {
                    const figures = Object.entries(f.주요인물).map(([k, v]) => `${k}(${v})`).join(', ');
                    str += `- **Key Figures**: ${figures}\n`;
                }

                if (f.주요무공) str += `- **Arts**: ${f.주요무공}\n`;
                str += "\n";
            });
            return str;
        };

        output += renderGroup("🏳️ 정파 (Orthodox)", groups["🏳️ 정파 (Orthodox)"]);
        output += renderGroup("🏴 사파 (Unorthodox)", groups["🏴 사파 (Unorthodox)"]);
        output += renderGroup("👿 마교 (Demonic)", groups["👿 마교 (Demonic)"]);
        output += renderGroup("🏔️ 새외/기타 (Outer/Others)", groups["🏔️ 새외/기타 (Outer/Others)"]);
        return output;
    },

    convertLevels: (levels) => {
        if (!levels) return "";
        let output = "### Power System & Realms\n";
        const realms = Object.values(levels)
            .filter((v) => v.명칭 && v.위상)
            .sort((a, b) => (a.power_level || 0) - (b.power_level || 0));

        realms.forEach((r) => {
            output += `- **${r.명칭}**: ${r.능력} (${r.위상})\n`;
        });
        output += "\n";
        return output;
    },

    convertGeography: (geo) => {
        if (!geo) return "";
        let output = "## [World Geography]\n\n";

        // Regions
        if (geo.regions) {
            Object.entries(geo.regions).forEach(([regionName, data]) => {
                output += `### ${regionName}\n`;
                if (data.description) output += `> ${data.description}\n`;
                if (data.locations) {
                    data.locations.forEach(loc => {
                        output += `- **${loc.name}**: ${loc.desc || ''}\n`;
                    });
                }
                output += "\n";
            });
        }
        return output;
    },

    convertRomance: (romance) => {
        if (!romance) return "";

        // Recursive formatter for nested objects
        const formatValue = (val, depth = 0) => {
            const indent = "  ".repeat(depth);
            if (typeof val === 'string') return `${val}`;
            if (Array.isArray(val)) {
                return val.map(item => {
                    if (typeof item === 'object') return formatValue(item, depth + 1);
                    return `\n${indent}- ${item}`;
                }).join('');
            }
            if (typeof val === 'object' && val !== null) {
                return Object.entries(val).map(([k, v]) => {
                    // Start new line for object properties
                    return `\n${indent}- **${k}**: ${formatValue(v, depth + 1)}`;
                }).join('');
            }
            return `${val}`;
        };

        let output = "## [Romance Guide]\n";
        Object.entries(romance).forEach(([key, val]) => {
            output += `### ${key}\n`;
            // If the top-level value is directly a string (e.g. description)
            if (typeof val === 'string') {
                output += `> ${val}\n`;
            } else {
                // For arrays or objects, use the recursive formatter
                output += formatValue(val) + "\n";
            }
            output += "\n";
        });
        return output;
    },

    convertCombat: (combat) => {
        if (!combat) return "";

        let output = "## [Combat Guide]\n";
        if (combat.principles) output += `> ${combat.principles}\n\n`;

        Object.entries(combat).forEach(([key, val]) => {
            if (key === 'principles') return; // Already handled
            output += `### ${key}\n`;
            output += LoreConverter.formatValue(val) + "\n\n";
        });

        return output;
    },

    convertWeapons: (weapons) => {
        if (!weapons) return "";
        let output = "## [Legendary Weapons]\n";
        Object.entries(weapons).forEach(([name, desc]) => {
            output += `- **${name}**: ${desc}\n`;
        });
        output += "\n";
        return output;
    },

    formatValue: (val, depth = 0) => {
        const indent = "  ".repeat(depth);
        if (typeof val === 'string') return `${val}`;
        if (Array.isArray(val)) {
            return val.map(item => {
                // If item is an object, recurse; otherwise, format as a list item
                if (typeof item === 'object' && item !== null) {
                    return LoreConverter.formatValue(item, depth + 1);
                }
                return `\n${indent}- ${item}`;
            }).join('');
        }
        if (typeof val === 'object' && val !== null) {
            return Object.entries(val).map(([k, v]) => {
                return `\n${indent}- **${k}**: ${LoreConverter.formatValue(v, depth + 1)}`;
            }).join('');
        }
        return `${val}`;
    },

    convertCharacters: (main, sub, extra, mood = 'daily') => {
        let output = "## [Major Characters (Wu-Long-Yuk-Bong)]\n\n";

        let allChars = [];

        // Helper to extract char objects from Dictionary
        const extractChars = (source) => {
            if (!source) return [];
            if (Array.isArray(source)) return source; // Fallback if array
            return Object.entries(source).map(([name, data]) => ({ name, ...data }));
        };

        allChars = allChars.concat(extractChars(main));
        console.log(`Debug: Mood=${mood}, MainCount=${extractChars(main).length}`);

        if (mood !== 'erotic' && mood !== 'romance') {
            const subCount = extractChars(sub).length;
            const extraCount = extractChars(extra).length;
            console.log(`Debug: Including Sub(${subCount}) and Extra(${extraCount})`);
            allChars = allChars.concat(extractChars(sub));
            allChars = allChars.concat(extractChars(extra));
        } else {
            console.log("Debug: Main only for erotic/romance mood.");
        }

        if (allChars.length === 0) return "";

        // Sort by Name
        allChars.sort((a, b) => a.name.localeCompare(b.name));

        allChars.forEach((char) => {
            const name = char.name || char.basic_profile?.이름 || "Unknown";
            const p = char.profile || char.basic_profile || {};
            const app = char.외형 || char.appearance || {};
            const pers = char.personality || {};
            const power = char.강함 || char.basic_profile?.martial_arts_realm || {};
            const pref = char.preferences || {};
            const social = char.social || {};
            const secret = char.secret || char.secret_data || {};

            output += `### ${name} (${char.title || p.신분 || 'Unknown'})\n`;

            // Info (Age, Affiliation, Identity)
            let infoParts = [];
            if (p.나이) infoParts.push(p.나이);
            if (p.소속) infoParts.push(p.소속);

            // Rank (Realm)
            let rankInfo = power.등급 || power.martial_arts_realm || '?';
            if (power.name) rankInfo = `${power.name} (Lv.${power.power_level})`;
            if (power.description) rankInfo += ` (${power.description})`;

            output += `- **정보**: ${infoParts.join(', ')} / **경지**: ${rankInfo}\n`;

            // Body
            if (p.BWH) output += `- **Body**: ${p.신체 || '', p.BWH}\n`;

            // Appearance
            let appStr = "";
            if (app.머리색 || app.hair_color) appStr += `${app.머리색 || app.hair_color}, `;
            if (app.눈색 || app.eye_color) appStr += `${app.눈색 || app.eye_color}`;
            if (appStr) output += `- **외형**: ${appStr}\n`;

            // Personality
            const surface = pers['표면적 성격'] || pers.surface || pers['표면적 성격 (대외용)'] || '';
            const inner = pers['내면/애정 성격'] || pers.inner || '';

            // Mood-based Personality Display
            if (mood === 'romance') {
                if (surface) output += `- **Personality**: [Surface] ${surface}\n`;
                if (inner) output += `- **Personality (Inner)**: ${inner}\n`;
            } else {
                if (surface) output += `- **Personality**: [Surface] ${surface} ${inner ? `/ [Inner] ${inner}` : ''}\n`;
            }

            // Social
            if (social && Object.keys(social).length > 0) {
                const socialRoles = Object.entries(social).map(([k, v]) => `${k}(${v})`).join(' / ');
                output += `- **Social**: ${socialRoles}\n`;
            }

            // Relations (Mood: Daily or Romance)
            if ((mood === 'daily' || mood === 'romance') && char.relationships) {
                const rels = Object.entries(char.relationships)
                    .map(([k, v]) => `${k}: ${v}`).join(' / ');
                output += `- **Relations**: ${rels.slice(0, 150)}${rels.length > 150 ? '...' : ''}\n`;
            }

            // Skills (Summary or Detailed based on mood)
            if (power.skills) {
                if ((mood === 'combat' || mood === 'tension') && typeof power.skills === 'object' && !Array.isArray(power.skills)) {
                    output += `- **무공 (상세)**:\n`;
                    Object.entries(power.skills).forEach(([sName, sDesc]) => {
                        output += `  - **${sName}**: ${sDesc}\n`;
                    });
                } else {
                    let skillList = "";
                    if (Array.isArray(power.skills)) {
                        skillList = power.skills.join(', ');
                    } else if (typeof power.skills === 'object') {
                        skillList = Object.keys(power.skills).join(', ');
                    }
                    if (skillList) output += `- **무공**: ${skillList}\n`;
                }
            }

            // Secret (Erotic mood = Full details, Others = Warning only)
            if (mood === 'erotic') {
                if (secret && Object.keys(secret).length > 0) {
                    output += `- **Secret (Erotic)**:\n`;
                    output += LoreConverter.formatValue(secret, 1) + "\n";
                }
            } else {
                if (secret && (secret.내용 || secret.content)) {
                    output += `- **Secret**: <${secret.주의 || 'Warning'}> ${secret.내용 || secret.content}\n`;
                }
            }

            // Likes
            if (pref.like || pref['좋아하는 것']) output += `- **취향**: ${pref.like || pref['좋아하는 것']}\n`;

            output += "\n";
        });

        return output;
    }
};

// [HELPER: Extract Moods]
function extractMoodPrompts(content) {
    const startRegex = /export const MOOD_PROMPTS_WUXIA = \{/;
    const startMatch = content.match(startRegex);
    if (!startMatch) return {};

    const startIndex = startMatch.index + startMatch[0].length;
    let braceCount = 1;
    let endIndex = startIndex;

    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') braceCount--;
        if (braceCount === 0) {
            endIndex = i;
            break;
        }
    }

    const objStr = content.substring(startIndex, endIndex);

    const prompts = {};
    let cursor = 0;

    while (cursor < objStr.length) {
        // Find key (word followed by colon)
        const keyMatch = objStr.substr(cursor).match(/([a-z]+):/);
        if (!keyMatch) break;

        const key = keyMatch[1];
        const keyIndex = objStr.indexOf(key + ':', cursor);

        // Find start backtick
        const startBacktick = objStr.indexOf('`', keyIndex);
        if (startBacktick === -1) break;

        // Find end backtick
        // Note: We assume no escaped backticks for simplicity, or handle basic ones
        const endBacktick = objStr.indexOf('`', startBacktick + 1);
        if (endBacktick === -1) break;

        const value = objStr.substring(startBacktick + 1, endBacktick);
        prompts[key] = value;

        cursor = endBacktick + 1;
    }

    console.log("DEBUG: Total Prompts Found:", Object.keys(prompts).length);
    return prompts;
}

// [MAIN]
try {
    console.log("Reading source files...");
    const constantsContent = fs.readFileSync(CONSTANTS_PATH, 'utf8');
    // ...
    // ensure closing brace is handled
    const moodsContent = fs.readFileSync(MOODS_PATH, 'utf8');

    // 1. Extract Constants
    const identity = extractConstant(constantsContent, 'WUXIA_IDENTITY');
    const rules = extractConstant(constantsContent, 'WUXIA_BEHAVIOR_RULES');
    const possessorPersona = extractConstant(constantsContent, 'WUXIA_PROTAGONIST_PERSONA'); // Extract Persona
    const format = extractConstant(constantsContent, 'WUXIA_OUTPUT_FORMAT');
    const famousChars = extractConstant(constantsContent, 'FAMOUS_CHARACTERS');
    const allowedEmotions = extractConstant(constantsContent, 'WUXIA_ALLOWED_EMOTIONS');

    // 2. Load JSON Data
    const charMain = loadJson('charMsg');
    const charSub = loadJson('charSub');
    const charExtra = loadJson('charExtra');

    // Load Assets for Extra Images
    console.log("- Loading Assets...");
    const assetsData = loadJson('assets');
    const extraImages = assetsData?.wuxia?.extraCharacters || [];
    const extraImagesList = extraImages.join(', ');

    const loreData = {
        term: loadJson('terminology'),
        skills: loadJson('skills'),
        levels: loadJson('levels'),
        factions: loadJson('factions'),
        geo: loadJson('geography'),
        romance: loadJson('romance'),
        combat: loadJson('combat'),
        weapons: loadJson('weapons'),
        charMain: charMain,
        charSub: charSub,
        charExtra: charExtra,
        extraImagesList: extraImagesList
    };

    // 4. Assemble Variable Maps (Real Backgrounds)
    let backgroundList = "";
    try {
        const bgContent = fs.readFileSync(BACKGROUNDS_PATH, 'utf8');
        const bgKeys = extractBackgrounds(bgContent);

        // Group by Prefix (e.g. "객잔_")
        const groups = {};
        bgKeys.forEach(key => {
            const parts = key.split('_');
            const prefix = parts[0];
            const detail = parts.slice(1).join('_');

            if (!groups[prefix]) groups[prefix] = [];
            if (detail) groups[prefix].push(detail);
            else groups[prefix].push('[기본]');
        });

        const sortedPrefixes = Object.keys(groups).sort();
        backgroundList = sortedPrefixes.map(prefix => {
            const details = groups[prefix].sort().join(', ');
            return `- [${prefix}] ${details}`;
        }).join('\n');

    } catch (e) {
        backgroundList = "(Error loading backgrounds)";
    }

    const moodPrompts = extractMoodPrompts(moodsContent);
    // const moodPrompts = { daily: "MOCK DAILY CONTENT" };

    // [OUTPUT DIRECTORY]
    const PREVIEW_DIR = path.join(__dirname, 'previews');
    if (!fs.existsSync(PREVIEW_DIR)) {
        fs.mkdirSync(PREVIEW_DIR);
    }

    console.log(`Generating individual mood previews in: ${PREVIEW_DIR}`);

    Object.entries(moodPrompts).forEach(([mood, moodText]) => {
        try {
            // [CONDITIONAL] Focus Moods (Erotic/Romance) hide heavy lore
            const isFocusMood = (mood === 'erotic' || mood === 'romance');

            let loreText = "";

            // 1. [Power System & Realms] (Physics) - HIGH PRIORITY
            loreText += LoreConverter.convertLevels(loreData.levels) + "\n\n";

            // 2. [Special Martial Arts & Terminology] (Dictionary)
            if (!isFocusMood) {
                loreText += LoreConverter.convertSkills(loreData.skills) + "\n\n";
                // Terminology also goes here (previously it was in Rules)
                if (mood !== 'combat' && mood !== 'tension') {
                    loreText += LoreConverter.convertTerminology(loreData.term) + "\n\n";
                }
            }
            loreText += LoreConverter.convertWeapons(loreData.weapons) + "\n\n";


            // 3. [Great Factions & Geography] (Environment)
            if (!isFocusMood) {
                loreText += LoreConverter.convertFactions(loreData.factions) + "\n\n";
            }
            loreText += LoreConverter.convertGeography(loreData.geo) + "\n\n";

            // 4. [Characters & Scenario] (Result)
            // Inject Possessor Persona here
            loreText += possessorPersona + "\n\n";

            // Generate Character Lore
            const charLore = LoreConverter.convertCharacters(loreData.charMain, loreData.charSub, loreData.charExtra, mood);
            loreText += charLore + "\n\n";

            // Append other guides (Romance/Combat) if needed in Lore or Rules?
            // PromptManager puts them in Behavior Rules usually, or `LoreConverter.convertToMarkdown` puts them after characters.
            // Let's stick to `LoreConverter` which puts them after characters.
            if (mood !== 'combat') {
                loreText += LoreConverter.convertRomance(loreData.romance) + "\n\n";
            }
            if (!isFocusMood) {
                loreText += LoreConverter.convertCombat(loreData.combat) + "\n\n";
            }

            // Behavior Rules (Now cleaned of Persona)
            let resolvedRules = rules
                .replace(/\${CORE_RULES}/g, extractConstant(constantsContent, 'CORE_RULES'));
            // .replace(/\${WUXIA_PROTAGONIST_PERSONA}/g, ...); // Removed from template, so no replace needed strict sense, but good to ensure.

            let resolvedFormat = format
                .replace(/\${WUXIA_ALLOWED_EMOTIONS}/g, allowedEmotions);

            const fileContent = `# [MOOD: ${mood.toUpperCase()}]
### CACHE KEY: PROMPT_CACHE_wuxia_${mood}_v1.0
Generated: ${new Date().toISOString()}


${identity}

${moodText}

## [2. KNOWLEDGE BASE (LORE)]
${loreText}

${!isFocusMood ? `## [NPC Database (Famous Figures)]\n${famousChars}` : ''}

## [Available Backgrounds]
${backgroundList}

## [Available Extra Images]
${loreData.extraImagesList}

${resolvedRules}

## [Available Backgrounds] (Based on Region)
${backgroundList}

${resolvedFormat}
`;

            const fileName = `preview_wuxia_${mood}.md`;
            fs.writeFileSync(path.join(PREVIEW_DIR, fileName), fileContent, 'utf8');
            console.log(`- Created ${fileName}`);
        } catch (err) {
            console.error(`ERROR processing mood ${mood}:`, err);
        }
    });
    // This closing brace closes forEach.
    // I need to modify the START of the loop.
    // Easier: replace the whole loop block?
    // ReplacementContent must act on target content.
    // I'll do a focused replace on loop body start.

    console.log("\nAll preview files generated successfully.");

} catch (e) {
    console.error("FATAL ERROR:", e);
    process.exit(1);
}
