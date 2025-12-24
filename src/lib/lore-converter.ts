export class LoreConverter {
    static convertSystems(honorifics: any, measurements: any, skills: any): string {
        let output = "## [World Rules & Systems]\n\n";

        // 1. Time & Measurements
        if (measurements) {
            output += "### Measurement System\n";
            if (measurements.time_system && measurements.time_system.basic_concept) {
                const t = measurements.time_system;
                output += `- **Time**: ${t.basic_concept.unit} = ${t.basic_concept.value_metric}. `;
                if (t.sub_units) {
                    const subs = Object.entries(t.sub_units).map(([k, v]: any) => `${k} (${v.value_metric})`).join(', ');
                    output += `Sub-units: ${subs}.\n`;
                }
            }
            if (measurements.physical_measurements) {
                const m = measurements.physical_measurements;
                if (m.length) output += `- **Length**: ${m.length.map((u: any) => `${u.unit} (${u.value_metric})`).join(', ')}\n`;
                if (m.weight) output += `- **Weight**: ${m.weight.map((u: any) => `${u.unit} (${u.value_metric})`).join(', ')}\n`;
            }
            output += "\n";
        }

        // 2. Honorifics
        if (honorifics) {
            output += "### Honorifics & Address\n";
            const sections: string[] = [];

            // Social
            if (honorifics.social_titles) {
                const social = [
                    ...honorifics.social_titles.male || [],
                    ...honorifics.social_titles.female || []
                ].map((h: any) => h.term.split('(')[0].trim());
                if (social.length) sections.push(`Social: ${social.join(', ')}`);
            }
            // Sect
            if (honorifics.sect_system) {
                const sect = [
                    ...honorifics.sect_system.hierarchy_positions || [],
                    ...honorifics.sect_system.peer_relations?.terms || [],
                    ...honorifics.sect_system.master_lineage?.terms || []
                ].map((h: any) => h.term.split('(')[0].trim());
                if (sect.length) sections.push(`Sect: ${sect.join(', ')}`);
            }
            output += `- **Terms**: ${sections.join(' / ')}\n\n`;
        }

        // 3. Special Martial Skills
        if (skills && skills.skills_database) {
            output += "### Special Martial Arts Skills\n";
            Object.values(skills.skills_database).forEach((cat: any) => {
                cat.forEach((skill: any) => {
                    output += `- **${skill.name.split('(')[0].trim()}**: ${skill.mechanic} [Type: ${skill.type}]\n`;
                });
            });
            output += "\n";
        }

        return output;
    }

    static convertFactions(factionsDetail: any): string {
        if (!factionsDetail || typeof factionsDetail !== 'object') return "";

        let output = "## [Great Factions of Wulin]\n\n";

        const groups: { [key: string]: any[] } = {
            "🏳️ 정파 (Orthodox Sects)": [],
            "🏴 사파 (Unorthodox Sects)": [],
            "⚖️ 정사지간 (Neutral/Mixed)": [],
            "🏔️ 세외무림 (Outer Realms)": [],
            "👿 마교/혈교 (Demonic Cults)": [],
            "❓ 기타 (Others)": []
        };

        // [FIX] Sort Factions by Name for Deterministic Order (Cache Stability)
        const sortedFactions = Object.values(factionsDetail).sort((a: any, b: any) => {
            const nameA = a.faction_profile?.name || "";
            const nameB = b.faction_profile?.name || "";
            return nameA.localeCompare(nameB);
        });

        sortedFactions.forEach((faction: any) => {
            if (!faction || typeof faction !== 'object' || !faction.faction_profile) return;

            const sub = (faction.sub_domain || "").replace(/\s+/g, '');
            const align = (faction.faction_profile.status?.alignment || faction.faction_profile.heritage?.alignment || "").replace(/\s+/g, '');
            const name = faction.faction_profile.name || "";

            // Classification Logic
            if (sub.includes("정파") || sub.includes("구파일방") || sub.includes("일방") || align.includes("정파")) {
                groups["🏳️ 정파 (Orthodox Sects)"].push(faction);
            } else if (sub.includes("마교") || sub.includes("혈교") || sub.includes("신교") || name.includes("마교") || name.includes("혈교")) {
                groups["👿 마교/혈교 (Demonic Cults)"].push(faction);
            } else if (sub.includes("세외") || sub.includes("새외") || sub.includes("북해") || sub.includes("남만")) {
                groups["🏔️ 세외무림 (Outer Realms)"].push(faction);
            } else if (sub.includes("사파") || sub.includes("녹림") || sub.includes("하오문") || align.includes("사파")) {
                groups["🏴 사파 (Unorthodox Sects)"].push(faction);
            } else if (sub.includes("중립") || align.includes("중립")) {
                groups["⚖️ 정사지간 (Neutral/Mixed)"].push(faction);
            } else {
                groups["❓ 기타 (Others)"].push(faction);
            }
        });

        // Render groups
        const renderGroup = (title: string, list: any[]) => {
            if (list.length === 0) return "";
            let groupStr = `### [${title}]\n`;
            // List is already sorted because we iterated sortedFactions
            list.forEach(faction => {
                groupStr += this.formatFactionDetail(faction);
            });
            return groupStr + "\n";
        };

        output += renderGroup("🏳️ 정파 (Orthodox Sects)", groups["🏳️ 정파 (Orthodox Sects)"]);
        output += renderGroup("🏴 사파 (Unorthodox Sects)", groups["🏴 사파 (Unorthodox Sects)"]);
        output += renderGroup("⚖️ 정사지간 (Neutral/Mixed)", groups["⚖️ 정사지간 (Neutral/Mixed)"]);
        output += renderGroup("🏔️ 세외무림 (Outer Realms)", groups["🏔️ 세외무림 (Outer Realms)"]);
        output += renderGroup("👿 마교/혈교 (Demonic Cults)", groups["👿 마교/혈교 (Demonic Cults)"]);
        output += renderGroup("❓ 기타 (Others)", groups["❓ 기타 (Others)"]);

        return output;
    }

    static formatFactionDetail(faction: any): string {
        let output = "";
        const profile = faction.faction_profile;
        const chars = faction.characteristics;
        const martial = faction.martial_arts_library;
        const rules = faction.rules_and_protocols;

        output += `#### ${profile.name || 'Unknown Faction'}\n`;

        if (profile.type) output += `- **Type**: ${profile.type}\n`;
        if (profile.political_stance) output += `- **Stance**: ${profile.political_stance}\n`;
        if (profile.ideology) output += `- **Ideology**: ${profile.ideology.core || ''} (${profile.ideology.goal || ''})\n`;
        if (chars && chars.combat_style) output += `- **Combat**: ${chars.combat_style.summary || ''}\n`;

        // Martial Arts Summary
        if (martial) {
            output += `- **Martial Arts**: `;
            const arts: string[] = [];

            if (martial.signature_ultimate) {
                arts.push(`[절기] ${martial.signature_ultimate.name.split('(')[0].trim()}`);
            }

            // [FIX] Sort keys for deterministic output
            Object.keys(martial).sort().forEach(key => {
                if (key === 'signature_ultimate') return;
                try {
                    const section = martial[key];
                    if (section && Array.isArray(section.list) && section.list.length > 0) {
                        section.list.forEach((art: string) => {
                            if (typeof art === 'string') arts.push(art.split('(')[0].trim());
                        });
                    }
                } catch (e) { }
            });
            output += arts.join(', ') + "\n";
        }

        if (rules && rules.core_tenets) {
            output += `- **Rules**: ${rules.core_tenets.map((r: string) => r).slice(0, 3).join(' / ')}\n`;
        }

        if (faction.narrative_role) {
            if (Array.isArray(faction.narrative_role.role)) {
                output += `- **Role**: ${faction.narrative_role.role.join(' ')}\n`;
            } else if (Array.isArray(faction.narrative_role)) {
                output += `- **Role**: ${faction.narrative_role[0]}\n`;
            }
        }
        output += "\n";
        return output;
    }

    static convertMartialArtsLevels(levels: any): string {
        if (!levels || !levels.realm_hierarchy) return "";

        let output = "### Power System & Realms\n";
        // [FIX] Sort Realms by Power Level (or Name if level missing) to ensure order
        const realms = Object.values(levels.realm_hierarchy).sort((a: any, b: any) => {
            const lvA = a.power_level || 0;
            const lvB = b.power_level || 0;
            return lvA - lvB;
        });

        // Compact list
        realms.forEach((r: any) => {
            output += `- **${r.name}**: ${r.capability} (${r.status})\n`;
        });
        output += "\n";
        return output;
    }

    static convertCharacters(charactersDetail: any): string {
        if (!charactersDetail || typeof charactersDetail !== 'object') return "";

        let output = "## [Major Characters (Wu-Long-Yuk-Bong)]\n\n";

        // Aggregate all character lists
        let allChars: any[] = [];
        // [FIX] Use correct property names from characters/index.ts exports
        if (charactersDetail.characters_main) allChars = [...allChars, ...charactersDetail.characters_main];
        if (charactersDetail.characters_supporting) allChars = [...allChars, ...charactersDetail.characters_supporting];
        if (charactersDetail.characters_extra) allChars = [...allChars, ...charactersDetail.characters_extra];

        // Fallback if they are not categorized or array is passed directly
        if (allChars.length === 0 && Array.isArray(charactersDetail)) {
            allChars = charactersDetail;
        }

        // [FIX] Sort Characters by Name ensures deterministic string regardless of load order
        allChars.sort((a: any, b: any) => {
            const nameA = a.basic_profile?.이름 || "";
            const nameB = b.basic_profile?.이름 || "";
            return nameA.localeCompare(nameB);
        });

        allChars.forEach((char: any) => {
            if (!char || !char.basic_profile) return;
            const p = char.basic_profile;
            const app = char.appearance;
            const pers = char.personality;
            const realm = p.martial_arts_realm;
            const social = char.social;

            output += `### ${p.이름 || 'Unknown'}\n`;

            // [Stats] Added Power Level/Realm which is critical for Wuxia
            let info = `- **Info**: ${p.나이 || '?'}, ${p.소속 || '?'}, ${p.신분 || '?'}`;
            if (realm) {
                info += ` / **Rank**: ${realm.name} (Lv.${realm.power_level})`;
            }
            output += `${info}\n`;

            if (p.BWH) output += `- **Body**: ${p.신체 || ''}, ${p.BWH}\n`;

            // Social Roles
            if (social) {
                const roles = Object.entries(social)
                    .sort((a, b) => a[0].localeCompare(b[0])) // Sort keys
                    .map(([k, v]) => `${k}: ${v}`).join(' / ');
                output += `- **Social Role**: ${roles}\n`;
            }

            if (app) {
                output += `- **Appearance**: ${app.머리색?.split('.')[0] || ''}, ${app.눈색?.split('.')[0] || ''}, ${app.체형?.split('.')[0] || ''}\n`;
            }

            if (pers && pers.traits) {
                // Squeeze traits into one line
                const traits = pers.traits.map((t: string) => t.replace(/\*\*/g, '')).slice(0, 4).join(' / ');
                output += `- **Personality**: ${pers['표면적 성격 (대외용)'] || ''} - ${traits}\n`;
            }

            // Important Preferences
            if (char.preferences) {
                output += `- **Likes**: ${char.preferences['좋아하는 것']}\n`;
            }

            // Relationships
            if (char.relationships) {
                const rels = Object.entries(char.relationships)
                    .sort((a, b) => a[0].localeCompare(b[0])) // Sort keys
                    .map(([name, desc]) => `${name}: ${desc}`)
                    .join(' / ');
                output += `- **Relationships**: ${rels}\n`;
            }

            output += "\n";
        });

        return output;
    }

    static convertWorldGeography(geo: any): string {
        if (!geo) return "";
        let output = "## [World Geography & Regions]\n\n";

        if (geo.regions) {
            // [FIX] Sort Regions
            const sortedRegions = Object.values(geo.regions).sort((a: any, b: any) => {
                return (a.name || "").localeCompare(b.name || "");
            });

            sortedRegions.forEach((region: any) => {
                const provinces = region.provinces
                    .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "")) // Sort Provinces
                    .map((p: any) => {
                        const factions = p.factions ? ` (${p.factions.sort().map((f: string) => f.split('(')[0].trim()).join(', ')})` : '';
                        return `${p.name.split('(')[0].trim()}${factions}`;
                    }).join(' / ');
                output += `- **${region.name.split('(')[0].trim()}**: ${provinces}\n`;
            });
        }

        if (geo.outer_realms && geo.outer_realms.factions) {
            // Sort outer factions
            const sortedOuter = [...geo.outer_realms.factions].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
            output += `- **Outer Realms**: ${sortedOuter.map((f: any) => f.name.split('(')[0].trim()).join(', ')}\n`;
        }
        output += "\n";
        return output;
    }

    static convertItems(weapons: any, elixirs: any): string {
        let output = "## [Legendary Items & Systems]\n\n";

        if (weapons && weapons.weapon_categories) {
            output += "### Notable Weapons\n";
            // [FIX] Sort Categories
            const sortedCats = Object.values(weapons.weapon_categories).sort((a: any, b: any) => {
                const s = a.summary || "";
                return s.localeCompare(b.summary || "");
            });

            sortedCats.forEach((cat: any) => {
                if (cat.list) {
                    const names = cat.list.map((w: any) => (typeof w === 'string' ? w : w.name).split('(')[0].trim());
                    output += `- **${cat.summary ? cat.summary.split('.')[0] : 'Category'}**: ${names.sort().slice(0, 5).join(', ')}\n`; // Sort items
                }
            });
        }

        if (elixirs) {
            output += "### Elixirs\n";
            if (elixirs.legendary_natural_treasures) {
                const balanced = elixirs.legendary_natural_treasures.balanced_holy_items?.list || [];
                const extreme = elixirs.legendary_natural_treasures.extreme_element_items?.list || [];
                const all = [...balanced, ...extreme].map((e: any) => e.name.split('(')[0].trim());
                output += `- **Legendary**: ${all.sort().join(', ')}\n`; // Sort Elixirs
            }
        }
        output += "\n";
        return output;
    }

    static convertToMarkdown(lore: any): string {
        if (!lore) return "";

        let md = "# [WORLD KNOWLEDGE BASE (Optimized)]\n";

        // 1. World Rules & Systems (Top Priority context)
        md += this.convertSystems(lore.honorifics_system, lore.measurement_system, lore.martial_arts_skills);

        // 2. Geography
        if (lore.world_geography) {
            md += this.convertWorldGeography(lore.world_geography);
        }

        // 3. Power Levels (Merged system section or separate)
        if (lore.martial_arts_levels) {
            md += this.convertMartialArtsLevels(lore.martial_arts_levels);
        }

        // 4. Factions
        if (lore.factionsDetail) {
            md += this.convertFactions(lore.factionsDetail);
        }

        // 5. Characters
        if (lore.charactersDetail) {
            md += this.convertCharacters(lore.charactersDetail);
        }

        // 6. Items
        md += this.convertItems(lore.weapons, lore.elixirs);

        return md;
    }
}
