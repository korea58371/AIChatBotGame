export class LoreConverter {
    static convertTerminology(terminology: any): string {
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

                const processTerm = (item: string) => {
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
    }

    static convertSkills(skills: any): string {
        if (!skills || !skills.범주) return "";
        if (!skills || !skills.범주) return "";
        let output = "### Special Martial Arts Skills\n";
        // [Robustness] Ensure '범주' is an object
        if (typeof skills.범주 !== 'object') return output;

        Object.entries(skills.범주).sort((a: any, b: any) => a[0].localeCompare(b[0])).forEach(([catName, list]: any) => {
            output += `#### ${catName.replace(/_/g, ' ')}\n`;
            if (Array.isArray(list)) {
                list.forEach((skill: any) => {
                    const name = skill.split(':')[0].trim();
                    const desc = skill.split(':')[1]?.trim() || "";
                    output += `- **${name}**: ${desc}\n`;
                });
            }
            output += "\n";
        });
        output += "\n";
        return output;
    }

    // Deprecated alias for backward compatibility (if needed) but updated to only use skills logic if called roughly
    static convertSystems(terminology: any, skills: any): string {
        return this.convertSkills(skills);
    }

    static convertFactions(factionsData: any): string {
        // factionsData is expected to be { "문파": [ ... ] } or just the array
        let list: any[] = [];
        if (factionsData && Array.isArray(factionsData.문파)) {
            list = factionsData.문파;
        } else if (Array.isArray(factionsData)) {
            list = factionsData;
        } else {
            return "";
        }

        let output = "## [Great Factions of Wulin]\n\n";

        // Group by '구분' (Classification)
        const groups: { [key: string]: any[] } = {
            "🏳️ 정파 (Orthodox)": [],
            "🏴 사파 (Unorthodox)": [],
            "👿 마교 (Demonic)": [],
            "🏔️ 새외/기타 (Outer/Others)": []
        };

        list.forEach((f: any) => {
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

        const renderGroup = (title: string, factionList: any[]) => {
            if (factionList.length === 0) return "";
            // Sort by name
            factionList.sort((a, b) => (a.이름 || "").localeCompare(b.이름 || ""));

            let str = `### [${title}]\n`;
            factionList.forEach(f => {
                str += `#### ${f.이름}\n`;
                if (f.설명) str += `- **Desc**: ${f.설명}\n`;
                if (f.위치) str += `- **Loc**: ${f.위치}\n`; // Added Location
                if (f.성향) str += `- **Align**: ${f.성향}\n`;
                if (f.전투스타일) str += `- **Style**: ${f.전투스타일}\n`;

                // Key Figures
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
    }

    static convertMartialArtsLevels(levels: any): string {
        if (!levels) return "";

        let output = "### Power System & Realms\n";

        // [Robustness] Filter valid objects
        const realms = Object.values(levels)
            .filter((v: any) => v && typeof v === 'object' && v.명칭 && v.위상)
            .sort((a: any, b: any) => {
                const lvA = a.power_level || 0;
                const lvB = b.power_level || 0;
                return lvA - lvB;
            });

        realms.forEach((r: any) => {
            output += `- **${r.명칭}**: ${r.능력} (${r.위상})\n`;
        });
        output += "\n";
        return output;
    }

    static convertModernFactions(factionsData: any): string {
        if (!factionsData) return "";
        let output = "## [Key Organizations & Groups]\n\n";

        let factionList: any[] = [];
        if (Array.isArray(factionsData)) {
            factionList = factionsData;
        } else if (typeof factionsData === 'object') {
            Object.entries(factionsData).forEach(([key, value]: [string, any]) => {
                if (value.주요_인물 || value.설명 || value.content) {
                    factionList.push({ name: key, ...value });
                } else {
                    Object.entries(value).forEach(([fName, fData]: [string, any]) => {
                        factionList.push({ name: fName, ...fData });
                    });
                }
            });
        }

        if (factionList.length === 0) return "";

        factionList.sort((a, b) => (a.name || a.이름 || "").localeCompare(b.name || b.이름 || ""));

        factionList.forEach((f: any) => {
            const name = f.name || f.이름 || "Unknown Organization";
            const desc = f.content || f.설명 || "";
            output += `- **${name}**: ${desc}\n`;

            if (f.주요_인물) {
                const members = Array.isArray(f.주요_인물) ? f.주요_인물.join(', ') : f.주요_인물;
                output += `  - **Key Figures**: ${members}\n`;
            }
        });

        return output + "\n";
    }

    static convertModernGeography(geoData: any): string {
        if (!geoData) return "";
        let output = "## [Key Background Locations]\n\n";

        let locationList: any[] = [];
        if (Array.isArray(geoData)) {
            locationList = geoData;
        } else if (typeof geoData === 'object') {
            Object.entries(geoData).forEach(([key, value]: [string, any]) => {
                if (typeof value === 'string') return;
                if (value.명칭 || value.특징 || value.content) {
                    locationList.push({ name: key, ...value });
                } else {
                    Object.entries(value).forEach(([lName, lData]: [string, any]) => {
                        locationList.push({ name: lName, ...lData });
                    });
                }
            });
        }

        if (locationList.length === 0) return "";

        locationList.sort((a, b) => (a.name || a.명칭 || "").localeCompare(b.name || b.명칭 || ""));

        locationList.forEach((l: any) => {
            const name = l.name || l.명칭 || "Unknown Location";
            const desc = l.content || l.특징 || "";
            output += `- **${name}**: ${desc}\n`;
        });

        return output + "\n";
    }

    // Helper for recursive formatting (Ported from preview script)
    private static formatValue(value: any, depth: number = 0): string {
        const indent = "  ".repeat(depth);
        if (typeof value === 'string') return `${value}`;
        if (Array.isArray(value)) {
            return value.map(item => `\n${indent}- ${LoreConverter.formatValue(item, depth + 1)}`).join('');
        }
        if (typeof value === 'object' && value !== null) {
            return Object.entries(value).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) =>
                `\n${indent}- **${k.replace(/_/g, ' ')}**: ${LoreConverter.formatValue(v, depth + 1)}`
            ).join('');
        }
        return `${value}`;
    }

    // Helper to extract characters from Array or Dictionary
    private static extractChars(source: any): any[] {
        if (!source) return [];
        if (Array.isArray(source)) return source;
        return Object.entries(source).map(([name, data]) => ({ name, ...(data as any) }));
    }

    static convertCharacters(charactersDetail: any, mood: string = 'general'): string {
        if (!charactersDetail || typeof charactersDetail !== 'object') return "";

        let output = "## [Major Characters (Wu-Long-Yuk-Bong)]\n\n";

        // Aggregate all character lists
        let allChars: any[] = [];
        // Support both direct arrays and Dictionary structures
        if (charactersDetail.characters_main) allChars = allChars.concat(this.extractChars(charactersDetail.characters_main));

        // [MOOD FILTER] In 'erotic' or 'romance' mood, strictly valid only for Main Characters (Wu-Long-Yuk-Bong)
        if (mood !== 'erotic' && mood !== 'romance') {
            if (charactersDetail.characters_supporting) allChars = allChars.concat(this.extractChars(charactersDetail.characters_supporting));
            if (charactersDetail.characters_extra) allChars = allChars.concat(this.extractChars(charactersDetail.characters_extra));
        }

        // Fallback
        if (allChars.length === 0 && Array.isArray(charactersDetail)) {
            allChars = charactersDetail;
        }

        // Sort by Name
        allChars.sort((a, b) => {
            const nameA = a.name || a.basic_profile?.이름 || "";
            const nameB = b.name || b.basic_profile?.이름 || "";
            return nameA.localeCompare(nameB);
        });

        allChars.forEach((char: any) => {
            const name = char.name || char.basic_profile?.이름 || "Unknown";

            // Schema Compatibility: Handle both English and Korean keys
            // Preview Script Logic: char.profile (Eng) vs char.basic_profile (Legacy)
            const p = char.profile || char.basic_profile || {};
            const app = char.외형 || char.appearance || {};
            const pers = char.personality || {};
            const power = char.강함 || char.basic_profile?.martial_arts_realm || {}; // Hoisted or nested
            const pref = char.preferences || {};
            const social = char.social || {};
            // [Robustness] Handle potential nulls
            const secret = char.secret || char.secret_data || {};

            // [FIX] Combined Relationship Keys (Eng + Kr)
            const relationships = char.relationships || char.인간관계 || null;

            output += `### ${name} (${char.title || p.신분 || 'Unknown'})\n`;

            // Info & Rank
            let infoParts = [];
            if (p.나이) infoParts.push(p.나이);
            if (p.소속) infoParts.push(p.소속);

            // Rank Parsing
            let rankInfo = '?';
            if (power.등급) rankInfo = power.등급;
            else if (power.name) rankInfo = `${power.name} (Lv.${power.power_level})`;
            else if (typeof power === 'string') rankInfo = power;

            if (power.description) rankInfo += ` (${power.description})`;

            output += `- **정보**: ${infoParts.join(', ')} / **경지**: ${rankInfo}\n`;

            // Body
            if (p.BWH || p.BHW) output += `- **Body**: ${p.BWH || p.BHW}\n`;

            // Appearance
            let appStr = "";
            const hair = app.머리색 || app.hair_color || app.머리카락;
            const eyes = app.눈색 || app.eye_color || app.눈;

            if (hair) appStr += `${hair}, `;
            if (eyes) appStr += `${eyes}`;
            if (app.전체적_인상) appStr += `, (${app.전체적_인상})`;

            if (appStr) output += `- **외형**: ${appStr.replace(/, $/, '')}\n`;

            // Personality
            const surface = pers['표면적 성격'] || pers.surface || pers['표면적 성격 (대외용)'] || '';
            const inner = pers['내면/애정 성격'] || pers.inner || '';

            // Mood-based Personality Display
            if (mood === 'romance') {
                // In romance, emphasize Inner personality
                if (surface) output += `- **Personality**: [Surface] ${surface}\n`;
                if (inner) output += `- **Personality (Inner)**: ${inner}\n`;
            } else {
                // Standard display
                if (surface) output += `- **Personality**: [Surface] ${surface} ${inner ? `/ [Inner] ${inner}` : ''}\n`;
            }

            // Social
            if (social && Object.keys(social).length > 0) {
                const socialRoles = Object.entries(social).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}(${v})`).join(' / ');
                output += `- **Social**: ${socialRoles}\n`;
            }

            // Relations (Mood: Daily or Romance)
            // [FIX] Use the resolved 'relationships' variable which covers both keys
            if ((mood === 'daily' || mood === 'romance') && relationships) {
                // [Robustness] Ensure it's an object
                if (typeof relationships === 'object') {
                    const rels = Object.entries(relationships)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([k, v]) => `${k}: ${v}`).join(' / ');
                    output += `- **Relations**: ${rels.slice(0, 150)}${rels.length > 150 ? '...' : ''}\n`;
                }
            }

            // Skills (Summary or Detailed based on mood)
            if (power.skills) {
                if ((mood === 'combat' || mood === 'tension') && typeof power.skills === 'object' && !Array.isArray(power.skills)) {
                    output += `- **무공 (상세)**:\n`;
                    Object.entries(power.skills).sort((a: any, b: any) => a[0].localeCompare(b[0])).forEach(([sName, sDesc]) => {
                        output += `  - **${sName}**: ${sDesc}\n`;
                    });
                } else {
                    let skillList = "";
                    if (Array.isArray(power.skills)) {
                        skillList = power.skills.sort().join(', ');
                    } else if (typeof power.skills === 'object') {
                        skillList = Object.keys(power.skills).sort().join(', ');
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

    static convertRomance(romance: any): string {
        if (!romance) return "";
        let output = "## [Romance & Interaction Guidelines]\n";

        // Use recursive formatter for deep objects appropriately
        if (romance.핵심_스타일) {
            output += `\n### Core Style\n${this.formatValue(romance.핵심_스타일)}`;
        }
        if (romance.대화_핑퐁_가이드) {
            output += `\n### Dialogue Flow\n${this.formatValue(romance.대화_핑퐁_가이드)}`;
        }
        if (romance.호감도별_반응) {
            output += `\n### Affection Levels\n${this.formatValue(romance.호감도별_반응)}`;
        }
        if (romance.스킨십_가이드) {
            output += `\n### Skinship\n${this.formatValue(romance.스킨십_가이드)}`;
        }
        output += "\n";
        return output;
    }

    static convertCombat(combat: any): string {
        if (!combat) return "";
        let output = "## [Combat & Tension Rules]\n";

        if (combat.전투_서술_원칙) {
            output += `\n### Combat Principles\n${this.formatValue(combat.전투_서술_원칙)}`;
        }
        if (combat.부상_및_사망) {
            output += `\n### Injury & Death\n${this.formatValue(combat.부상_및_사망)}`;
        }
        if (combat.경지_격차_연출) {
            output += `\n### Power Gap Display\n${this.formatValue(combat.경지_격차_연출)}`;
        }
        output += "\n";
        return output;
    }



    static convertWorldGeography(geo: any): string {
        if (!geo) return "";
        let output = "## [World Geography & Regions]\n\n";

        if (geo.중원_지역) {
            // [FIX] Sort Regions
            const sortedRegions = Object.values(geo.중원_지역).sort((a: any, b: any) => {
                return (a.명칭 || "").localeCompare(b.명칭 || "");
            });

            sortedRegions.forEach((region: any) => {
                if (!region.성_목록) return;
                const provinces = region.성_목록
                    .sort((a: any, b: any) => (a.명칭 || "").localeCompare(b.명칭 || "")) // Sort Provinces
                    .map((p: any) => {
                        const factions = (p.주요_세력 && Array.isArray(p.주요_세력)) ? ` (${p.주요_세력.sort().map((f: any) => typeof f === 'string' ? f.split('(')[0].trim() : String(f)).join(', ')})` : '';
                        const pName = typeof p.명칭 === 'string' ? p.명칭.split('(')[0].trim() : String(p.명칭 || "Unknown");
                        return `${pName}${factions}`;
                    }).join(' / ');
                const rName = typeof region.명칭 === 'string' ? region.명칭.split('(')[0].trim() : String(region.명칭 || "Unknown");
                output += `- **${rName}**: ${provinces}\n`;
            });
        }

        if (geo.관외_지역 && geo.관외_지역.세력_목록) {
            // Sort outer factions
            const sortedOuter = [...geo.관외_지역.세력_목록].sort((a: any, b: any) => (a.명칭 || "").localeCompare(b.명칭 || ""));
            output += `- **Outer Realms**: ${sortedOuter.map((f: any) => typeof f.명칭 === 'string' ? f.명칭.split('(')[0].trim() : String(f.명칭 || "")).join(', ')}\n`;
        }
        output += "\n";
        return output;
    }

    static convertItems(weapons: any, elixirs: any): string {
        let output = "## [Legendary Items & Systems]\n\n";

        if (weapons) {
            output += "### Notable Weapons\n";
            // [Robustness] Ensure '범주' is an object
            if (weapons.범주 && typeof weapons.범주 === 'object') {
                Object.entries(weapons.범주).sort((a: any, b: any) => a[0].localeCompare(b[0])).forEach(([catName, list]: any) => {
                    const categoryName = typeof catName === 'string' ? catName.replace(/_/g, ' ') : 'Category';
                    if (Array.isArray(list)) {
                        const names = list.map((w: any) => {
                            const str = typeof w === 'string' ? w : w.name;
                            return str.split(':')[0].trim();
                        });
                        output += `- **${categoryName}**: ${names.join(', ')}\n`;
                    }
                });
            } else if (typeof weapons === 'object') {
                // [GBY/Generic] Flatten object structure
                Object.entries(weapons).forEach(([key, value]: [string, any]) => {
                    // Check if it's a category
                    if (typeof value === 'object' && value !== null) {
                        const items = Object.entries(value).map(([k, v]: any) => {
                            const desc = typeof v === 'object' ? (v.설명 || v.desc || JSON.stringify(v)) : v;
                            return `${k}(${desc})`;
                        }).join(', ');
                        output += `- **${key}**: ${items}\n`;
                    } else {
                        output += `- **${key}**: ${value}\n`;
                    }
                });
            }
        }

        if (elixirs) {
            output += "### Elixirs\n";
            if (elixirs.legendary_natural_treasures) {
                const balanced = elixirs.legendary_natural_treasures.balanced_holy_items?.list || [];
                const extreme = elixirs.legendary_natural_treasures.extreme_element_items?.list || [];
                const all = [...balanced, ...extreme].map((e: any) => e.name.split('(')[0].trim());
                output += `- **Legendary**: ${all.sort().join(', ')}\n`; // Sort Elixirs
            } else if (typeof elixirs === 'object') {
                // [GBY/Generic]
                Object.entries(elixirs).forEach(([key, value]: [string, any]) => {
                    if (typeof value === 'object' && value !== null) {
                        const subItems = Object.entries(value).map(([k, v]: any) => `${k}`).join(', ');
                        output += `- **${key}**: ${subItems}\n`;
                    } else {
                        output += `- **${key}**: ${value}\n`;
                    }
                });
            }
        }
        output += "\n";
        return output;
    }

    static convertToMarkdown(lore: any, possessorText: string = "", mood: string = "general"): string {
        if (!lore) return "";

        // [MAIN CONVERTER]
        let output = "## [2. KNOWLEDGE BASE (LORE)]\n\n";

        // 1. [Power System & Realms] (Physics) - HIGH PRIORITY
        if (lore.martial_arts_levels) {
            output += LoreConverter.convertMartialArtsLevels(lore.martial_arts_levels) + "\n\n";
        } else if (lore.modern_levels) {
            output += LoreConverter.convertMartialArtsLevels(lore.modern_levels) + "\n\n";
        }

        // 2. [Special Martial Arts & Terminology] (Dictionary)
        if (lore.martial_arts_skills) {
            output += LoreConverter.convertSkills(lore.martial_arts_skills) + "\n\n";
        } else if (lore.modern_skills) {
            output += LoreConverter.convertSkills(lore.modern_skills) + "\n\n";
        }

        if (lore.wuxia_terminology) {
            output += LoreConverter.convertTerminology(lore.wuxia_terminology) + "\n\n";
        } else if (lore.modern_terminology) {
            output += LoreConverter.convertTerminology(lore.modern_terminology) + "\n\n";
        }

        if (lore.weapons) {
            output += LoreConverter.convertWeapons(lore.weapons) + "\n\n";
        } else if (lore.modern_weapons) {
            output += LoreConverter.convertWeapons(lore.modern_weapons) + "\n\n";
        }

        // 3. [Great Factions & Geography] (Environment)
        if (lore.factionsDetail) {
            output += LoreConverter.convertFactions(lore.factionsDetail) + "\n\n";
        } else if (lore.modern_factions) {
            output += LoreConverter.convertModernFactions(lore.modern_factions) + "\n\n";
        }

        if (lore.geography_guide) {
            output += LoreConverter.convertWorldGeography(lore.geography_guide) + "\n\n";
        } else if (lore.world_geography) {
            output += LoreConverter.convertWorldGeography(lore.world_geography) + "\n\n";
        } else if (lore.modern_geography) {
            output += LoreConverter.convertModernGeography(lore.modern_geography) + "\n\n";
        }

        // 4. [Characters & Scenario] (Result)
        if (possessorText) {
            output += possessorText + "\n\n";
        }
        if (lore.charactersDetail) {
            output += LoreConverter.convertCharacters(lore.charactersDetail, mood) + "\n\n";
        }

        if (lore.romance_guide) {
            output += LoreConverter.convertRomance(lore.romance_guide) + "\n\n";
        } else if (lore.modern_romance_guide) {
            output += LoreConverter.convertRomance(lore.modern_romance_guide) + "\n\n";
        }

        if (lore.combat_guide) {
            output += LoreConverter.convertCombat(lore.combat_guide) + "\n\n";
        } else if (lore.modern_combat) {
            output += LoreConverter.convertCombat(lore.modern_combat) + "\n\n";
        }

        if (lore.elixirs) {
            output += LoreConverter.convertElixirs(lore.elixirs) + "\n\n";
        } else if (lore.modern_elixirs) {
            output += LoreConverter.convertElixirs(lore.modern_elixirs) + "\n\n";
        }

        return output;
    }

    // New Helper for Weapons
    static convertWeapons(weapons: any): string {
        return LoreConverter.convertItems(weapons, null);
    }

    // Helper for convertToMarkdown to handle elixirs (new, extracted from convertItems)
    static convertElixirs(elixirs: any): string {
        let output = "";
        if (elixirs) {
            output += "### Elixirs\n";
            if (elixirs.legendary_natural_treasures) {
                const balanced = elixirs.legendary_natural_treasures.balanced_holy_items?.list || [];
                const extreme = elixirs.legendary_natural_treasures.extreme_element_items?.list || [];
                const all = [...balanced, ...extreme].map((e: any) => e.name.split('(')[0].trim());
                output += `- **Legendary**: ${all.sort().join(', ')}\n`;
            } else if (typeof elixirs === 'object') {
                // [GBY/Generic]
                Object.entries(elixirs).forEach(([key, value]: [string, any]) => {
                    if (typeof value === 'object' && value !== null) {
                        const subItems = Object.entries(value).map(([k, v]: any) => `${k}`).join(', ');
                        output += `- **${key}**: ${subItems}\n`;
                    } else {
                        output += `- **${key}**: ${value}\n`;
                    }
                });
            }
        }
        return output;
    }
}
