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

        // Handle both dictionary and array styles if needed, but WuxiaLore seems to use individual exports grouped
        // Or if it's a map. Let's assume values of the object.
        const factions = Object.values(factionsDetail);

        factions.forEach((faction: any) => {
            if (!faction || typeof faction !== 'object' || !faction.faction_profile) return;

            const profile = faction.faction_profile;
            const chars = faction.characteristics;
            const martial = faction.martial_arts_library;
            const rules = faction.rules_and_protocols;

            output += `### ${profile.name || 'Unknown Faction'}\n`;
            // [Fix] Include Type/Alignment for correct AI context
            if (profile.type) {
                output += `- **Type**: ${profile.type}\n`;
            }
            if (profile.political_stance) {
                output += `- **Stance**: ${profile.political_stance}\n`;
            }
            if (profile.ideology) {
                output += `- **Ideology**: ${profile.ideology.core || ''} (${profile.ideology.goal || ''})\n`;
            }
            if (chars && chars.combat_style) {
                output += `- **Combat**: ${chars.combat_style.summary || ''}\n`;
            }

            // Martial Arts Summary - Capture ALL lists
            if (martial) {
                output += `- **Martial Arts**: `;
                const arts: string[] = [];

                // Ultimate
                if (martial.signature_ultimate) {
                    arts.push(`[Ultimate] ${martial.signature_ultimate.name.split('(')[0].trim()}`);
                }

                // Iterate ALL other keys in martial object to find lists
                Object.keys(martial).forEach(key => {
                    if (key === 'signature_ultimate') return;
                    try {
                        const section = martial[key];
                        // If it has a 'list' array
                        if (section && Array.isArray(section.list) && section.list.length > 0) {
                            section.list.forEach((art: string) => {
                                if (typeof art === 'string') arts.push(art.split('(')[0].trim());
                            });
                        }
                    } catch (e) { }
                });
                output += arts.join(', ') + "\n";
            }

            // Rules
            if (rules && rules.core_tenets) {
                output += `- **Rules**: ${rules.core_tenets.map((r: string) => r).slice(0, 3).join(' / ')}\n`;
            }

            // Narrative Role
            if (faction.narrative_role) {
                if (Array.isArray(faction.narrative_role.role)) {
                    output += `- **Role**: ${faction.narrative_role.role.join(' ')}\n`;
                } else if (Array.isArray(faction.narrative_role)) {
                    output += `- **Role**: ${faction.narrative_role[0]}\n`;
                }
            }

            output += "\n";
        });

        return output;
    }

    static convertMartialArtsLevels(levels: any): string {
        if (!levels || !levels.realm_hierarchy) return "";

        let output = "### Power System & Realms\n"; // Changed to h3 to fit under systems if needed, but keeping separate for now
        const realms = Object.values(levels.realm_hierarchy);

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
                const roles = Object.entries(social).map(([k, v]) => `${k}: ${v}`).join(' / ');
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

            output += "\n";
        });

        return output;
    }

    static convertWorldGeography(geo: any): string {
        if (!geo) return "";
        let output = "## [World Geography & Regions]\n\n";

        if (geo.regions) {
            Object.values(geo.regions).forEach((region: any) => {
                const provinces = region.provinces.map((p: any) => {
                    const factions = p.factions ? ` (${p.factions.map((f: string) => f.split('(')[0].trim()).join(', ')})` : '';
                    return `${p.name.split('(')[0].trim()}${factions}`;
                }).join(' / ');
                output += `- **${region.name.split('(')[0].trim()}**: ${provinces}\n`;
            });
        }

        if (geo.outer_realms && geo.outer_realms.factions) {
            output += `- **Outer Realms**: ${geo.outer_realms.factions.map((f: any) => f.name.split('(')[0].trim()).join(', ')}\n`;
        }
        output += "\n";
        return output;
    }

    static convertItems(weapons: any, elixirs: any): string {
        let output = "## [Legendary Items & Systems]\n\n";

        if (weapons && weapons.weapon_categories) {
            output += "### Notable Weapons\n";
            Object.values(weapons.weapon_categories).forEach((cat: any) => {
                if (cat.list) {
                    const names = cat.list.map((w: any) => (typeof w === 'string' ? w : w.name).split('(')[0].trim());
                    output += `- **${cat.summary ? cat.summary.split('.')[0] : 'Category'}**: ${names.slice(0, 5).join(', ')}\n`;
                }
            });
        }

        if (elixirs) {
            output += "### Elixirs\n";
            if (elixirs.legendary_natural_treasures) {
                const balanced = elixirs.legendary_natural_treasures.balanced_holy_items?.list || [];
                const extreme = elixirs.legendary_natural_treasures.extreme_element_items?.list || [];
                const all = [...balanced, ...extreme].map((e: any) => e.name.split('(')[0].trim());
                output += `- **Legendary**: ${all.join(', ')}\n`;
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
