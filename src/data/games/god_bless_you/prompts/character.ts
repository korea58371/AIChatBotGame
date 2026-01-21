
export function formatCharacter(c: any, mode: string, state?: any): string {
    const lines: string[] = [`### ${c.name || c.이름 || 'Unknown'}`];

    // 0. Phase & Condition (Critical for Narrative Pacing)
    if (c.appearancePhase !== undefined) lines.push(`- Phase: ${c.appearancePhase}`);
    if (c.spawnRules?.condition) lines.push(`- Condition: ${c.spawnRules.condition}`);

    // 0.1 Explicit Rank Display
    const charRank = c['강함']?.['등급'] || c.profile?.['등급'];
    if (charRank) lines.push(`- Rank: ${charRank}`);

    // 1. Basic Info
    if (c.title) lines.push(`- Title: ${c.title}`);
    if (c['활동지역']) lines.push(`- Activity Region: ${c['활동지역']}`);

    // [MODE: COMBAT]
    if (mode === 'COMBAT') {
        if (c['강함'] && c['강함'].skills) {
            lines.push(`- Skill: ${c['강함'].skills}`);
        } else if (c.skill) {
            lines.push(`- Skill: ${c.skill}`);
        }

        // Combat Stats from Ranks
        if (c.profile && c.profile['등급']) lines.push(`- Rank: ${c.profile['등급']}`);

        // [SPEECH STYLE]
        const speechInfoComb = getSpeechStyle(c);
        if (speechInfoComb) {
            if (speechInfoComb.style) lines.push(`- Speech Style: ${speechInfoComb.style}`);
            if (speechInfoComb.ending !== 'Unknown') lines.push(`- Ending Style: ${speechInfoComb.ending}`);
            if (speechInfoComb.callSign) lines.push(`- Call Sign: ${speechInfoComb.callSign}`);
        }

        // Job/Class
        const socialData = c.social || c.job;
        if (socialData) {
            if (typeof socialData === 'string') lines.push(`- Job/Social: ${socialData}`);
            else {
                Object.entries(socialData).forEach(([k, v]) => {
                    if (typeof v === 'string') lines.push(`- ${k}: ${v}`);
                });
            }
        }
        return lines.join('\n');
    }

    // [MODE: ROMANCE]
    if (mode === 'ROMANCE') {
        // Appearance (Full)
        if (c['외형']) {
            lines.push(`- Appearance:`);
            Object.entries(c['외형']).forEach(([k, v]) => {
                lines.push(`  - ${k}: ${v}`);
            });
        } else if (c.description) {
            lines.push(`- Appearance: ${c.description}`);
        }

        // Secret Data
        if (c.secret) {
            const sData = typeof c.secret === 'string' ? c.secret : JSON.stringify(c.secret, null, 2);
            lines.push(`- [SECRET DATA]:\n${sData}`);
        } else if (c.secret_data) {
            lines.push(`- [SECRET DATA]:`);
            Object.entries(c.secret_data).forEach(([k, v]) => {
                lines.push(`  - ${k}: ${JSON.stringify(v)}`);
            });
        }

        // [SPEECH STYLE]
        const speechInfoRom = getSpeechStyle(c);
        if (speechInfoRom) {
            if (speechInfoRom.style) lines.push(`- Speech Style: ${speechInfoRom.style}`);
            if (speechInfoRom.ending !== 'Unknown') lines.push(`- Ending Style: ${speechInfoRom.ending}`);
        }

        // Personality (Full + Inner)
        if (c.personality) {
            if (typeof c.personality === 'string') {
                lines.push(`- Personality: ${c.personality}`);
            } else {
                lines.push(`- Personality:`);
                Object.entries(c.personality).forEach(([k, v]) => {
                    lines.push(`  - ${k}: ${v}`);
                });
            }
        }

        if (c.preferences) lines.push(`- Preferences: ${JSON.stringify(c.preferences)}`);

        return lines.join('\n');
    }

    // [MODE: DEFAULT]
    if (c['강함'] && c['강함'].skills) {
        lines.push(`- Skill: ${c['강함'].skills}`);
    } else if (c.skill) {
        lines.push(`- Skill: ${c.skill}`);
    }

    // 2. Profile (KV List)
    if (c.profile) {
        lines.push(`- Profile:`);
        Object.entries(c.profile).forEach(([k, v]) => {
            lines.push(`  - ${k}: ${v}`);
        });
    }

    // 3. Appearance
    const app = c.appearance || c['외형'];
    if (app) {
        lines.push(`- Appearance:`);
        Object.entries(app).forEach(([k, v]) => {
            lines.push(`  - ${k}: ${v}`);
        });
    } else if (c.description) {
        lines.push(`- Appearance: ${c.description}`);
    }

    // 4. Job/Social
    const jobData = c.job || c.social;
    if (jobData) {
        lines.push(`- Job/Social:`);
        Object.entries(jobData).forEach(([k, v]) => {
            lines.push(`  - ${k}: ${v}`);
        });
    }

    // [SPEECH STYLE]
    const speechInfoDef = getSpeechStyle(c);
    if (speechInfoDef) {
        if (speechInfoDef.style) lines.push(`- Speech Style: ${speechInfoDef.style}`);
        if (speechInfoDef.ending !== 'Unknown') lines.push(`- Ending Style: ${speechInfoDef.ending}`);
        if (speechInfoDef.callSign) lines.push(`- Call Sign: ${speechInfoDef.callSign}`);
    }

    // 5. Personality
    if (c.personality) {
        if (typeof c.personality === 'string') {
            lines.push(`- Personality: ${c.personality}`);
        } else {
            lines.push(`- Personality:`);
            Object.entries(c.personality).forEach(([k, v]) => {
                lines.push(`  - ${k}: ${v}`);
            });
        }
    }

    // 6. Preferences
    if (c.preferences) {
        lines.push(`- Preferences:`);
        Object.entries(c.preferences).forEach(([k, v]) => {
            lines.push(`  - ${k}: ${v}`);
        });
    }

    // 7. Secret (KV List - Hidden)
    if (c.secret) {
        lines.push(`- [HIDDEN TRUTH (GM ONLY)]:`);
        if (typeof c.secret === 'string') {
            lines.push(`  ${c.secret}`);
        } else {
            Object.entries(c.secret).forEach(([k, v]) => {
                lines.push(`  - ${k}: ${v}`);
            });
        }
        lines.push(`  - **CRITICAL**: Do NOT reveal hidden truths.`);
    }

    // 8. Relations
    if (c.relationship) {
        lines.push(`- Relationships: ${c.relationship}`);
    }

    // 9. EVENT CGs (Important for visual immersion)
    if (c.cgs) {
        lines.push(`- [AVAILABLE CGs]:`);
        if (Array.isArray(c.cgs)) {
            c.cgs.forEach((cg: string) => lines.push(`  - ${cg}`));
        } else {
            Object.entries(c.cgs).forEach(([k, v]) => {
                lines.push(`  - <CG>${k}</CG>: ${v}`);
            });
        }
    }

    return lines.join('\n');
}

function getSpeechStyle(char: any): { style: string, ending: string, callSign: string } | null {
    // 1. Explicit Relationship Info
    if (char.relationshipInfo) {
        const { speechStyle, endingStyle, callSign } = char.relationshipInfo;
        if (speechStyle || endingStyle || callSign) {
            return {
                style: speechStyle || 'Unknown',
                ending: endingStyle || 'Unknown',
                callSign: callSign || ''
            };
        }
    }

    // 2. Legacy Tone
    if (char.tone) {
        return { style: char.tone, ending: 'Unknown', callSign: '' };
    }

    // 3. Inference from Personality/Description
    const searchTarget = JSON.stringify({
        p: char.personality,
        d: char.description,
        pf: char.profile,
        sys: char.system_logic
    });

    // Heuristic Keys
    if (searchTarget.includes('존댓말') || searchTarget.includes('경어') || searchTarget.includes('예의')) {
        return { style: '존댓말 (Polite/Honorific)', ending: '~해요 / ~습니다', callSign: '' };
    }
    if (searchTarget.includes('반말') || searchTarget.includes('하대') || searchTarget.includes('거만')) {
        return { style: '반말 (Casual/Authoritative)', ending: '~해라 / ~다', callSign: '' };
    }
    if (searchTarget.includes('사투리')) {
        return { style: '사투리 (Dialect)', ending: 'Unknown', callSign: '' };
    }

    return null;
}
