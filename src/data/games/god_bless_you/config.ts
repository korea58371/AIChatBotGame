import { GameRegistry, GameConfig } from '@/lib/registry/GameRegistry';
import { gbyProgression } from './progression';
import gbyFactions from './jsons/factions.json';

import { GBY_IDENTITY, GBY_BEHAVIOR_RULES, GBY_OUTPUT_FORMAT, LEVEL_TO_RANK_MAP } from './constants';
import { GOD_BLESS_YOU_BGM_MAP, GOD_BLESS_YOU_BGM_ALIASES } from './bgm_mapping';

import { getSystemPromptTemplate, getRankInfo } from './prompts/system';
import { MOOD_PROMPTS } from './prompts/moods';
import { getLogicPrompt, getStaticLogicPrompt, getDynamicLogicPrompt } from './prompts/logic';
import { getGBYStaticContext } from './prompts/staticContext';
import { loadGodBlessYouData } from './loader';
import { formatCharacter } from './prompts/character';

export const GodBlessYouConfig: GameConfig = {
    id: 'god_bless_you',
    name: '갓 블레스 유',

    identity: GBY_IDENTITY,
    behaviorRules: GBY_BEHAVIOR_RULES,
    outputFormat: GBY_OUTPUT_FORMAT,

    getSystemPromptTemplate: getSystemPromptTemplate,
    getStaticContext: getGBYStaticContext,
    getLogicPrompt: getLogicPrompt,
    getStaticLogicPrompt: (id, rank, rom, com) => getStaticLogicPrompt(rank, rom, com),
    getDynamicLogicPrompt: getDynamicLogicPrompt,
    getRankInfo: (input: string | number) => {
        const fame = typeof input === 'number' ? input : 0;
        return getRankInfo(fame);
    },

    // [Refactor] UI moved to god_bless_you/ui.ts

    assets: {
        bgmMap: GOD_BLESS_YOU_BGM_MAP,
        bgmAliases: GOD_BLESS_YOU_BGM_ALIASES,
    },

    getMoodPrompts: () => MOOD_PROMPTS,

    // [6] Scalability Extensions
    loadGameData: loadGodBlessYouData,
    resolveRegion: (location: string) => null, // GBY doesn't use rigid region logic
    formatCharacter: formatCharacter,

    // [8] Universal Progression System
    progressionConfig: gbyProgression,

    // [9] Director Guide — GBY_IDENTITY / CORE_RULES / STORY_PHASE에서 Director용 핵심 압축
    getDirectorGuide: () => `[세계관]
현대 한국(서울). 헌터와 블레서가 존재하는 어반 판타지. 몬스터/던전이 있지만 사회 시스템이 잘 갖춰져 일반인도 안전.
헌터/블레서는 연예인/스포츠 스타 같은 존재. 블레서(여성 헌터)는 동경의 대상.
랭크: 일반인 → F → E → D → C → B → A → S → SS.
플레이어는 숨은 능력(힘숨찐)을 가진 성장형 주인공.

[핵심 톤 & 테마]
- 장르: 현대 어반 판타지 러브코미디 + 일상물. #힘숨찐 #개그 #러브코메디
- 어조: 위트 있고 장난스러운 톤이 **기본(70%)**. 몬스터보다 '쪽팔림'이 더 무서운 주인공의 좌충우돌 일상.
- 톤 가이드: 유머와 개그가 기본이되, 진짜 중요한 순간(성장/고백/위기)에는 자연스럽게 진지한 톤으로 전환.
- 코미디: 슬랩스틱(허당미) + 츳코미(태클) + 주인공 흑역사. 단, 매 장면 똑같은 유형의 개그 반복 금지. 유머 형태를 다양화할 것.
- 로맨스: 현대적 하렘(SNS 신경전, 귀여운 질투) + 갭 모에(사회적 지위 vs 사적 모습).

[Mood별 톤 가이드라인 (⭐ CRITICAL)]
- daily/comic: 유머, 슬랩스틱, 일상 개그 자유롭게 활용 (코미디 70~80%).
- romance: 설렘과 유머가 공존 (코미디 50%). 플러팅 개그, 부끄러운 리액션 등.
- tension/combat: 긴장감 우선이되 완전히 무거워지지 말 것 (코미디 20~30%). 가벼운 허세/태클 허용.
- growth: 카타르시스 우선이되 성장 후 리액션에 유머 허용 (코미디 20~30%).
- cruelty/event: 상황의 무게감 존중 (코미디 10% 이하).

[줄거리 설계 원칙 (⭐ CRITICAL)]
1. **비극 금지**: 죽음, 불구, 절망적 상황 전개 시스템적 차단.
2. **소소한 행복**: 거창한 목표보다 오늘 저녁 메뉴, 주말 데이트, 새로 산 게임기 같은 일상의 즐거움.
3. **생명 위협 금지**: 몬스터 습격, 납치, 살해 협박 같은 느와르적 전개 금지. 개그성 위기(쪽팔림, 망신)는 환영. 비-폭력 긴장감(협상, 심리전)도 허용.
4. **비살상 전투**: Hostile Faction 아닌 상대와의 전투는 전부 '대련/해프닝'. 기절/무장해제/항복으로 종료.
5. **성공은 성공으로**: PreLogic Score 높은 행동은 실제로 성공해야 함. 단, 성공 직후 리액션에 유머를 넣는 것은 OK.
6. **따뜻한 인간관계**: 상호 존중. 초기 호감도 0~10(팬 수준). 현실적 디테일(요리, 청소, 계절감).

[Phase별 캐릭터 해금 (⭐ CRITICAL)]
- Phase 0 (일반인, Fame<10): 한가을(여동생), 은하율(소꿉친구), 정한수(친구). 몬스터 위협 없음.
- Phase 1 (Hidden F, Fame<1000): 동네 주민, 편의점 알바생. 심각한 빌런/전쟁급 위기 잠금.
- Phase 2 (D~B, Fame>=1000): 소소한 사건 해결, 중소 길드 협업.
- ⚠️ S급 블레서(천서윤, 성시아, 한여름 등)는 Phase 3 전까지 뉴스/TV로만 등장. 직접 만남 금지.
- ⚠️ 이아라(아이돌)는 주인공이 유명해지기 전까지 팬미팅/방송으로만 등장.

[로맨스 규칙]
- 초기에는 사무적/비즈니스적 관계. 호감도가 쌓여야 설렘/스킨십 진행.
- 이능력 로맨스: 능력을 활용한 독특한 애정 표현(따뜻한 포옹, 공중 산책 등).
- 플러팅과 철벽의 핑퐁. 일상의 소중함(던전 후 밥, 퇴근길 데이트).
- **[하렘 질투 프로토콜]**: 히로인 간 질투/견제는 **귀엽고 코미디적인 반응만 허용**. 진짜 적대감, 다크한 감정, 최후통첩, 관계 파탄 **금지**. 밝고 유쾌한 하렘 코미디 톤 유지.`,

    // [12] Director Examples — GBY 전용 NO SPOILERS 예시
    getDirectorExamples: () => ({
        good: '한가을이 오빠의 반지하 냉장고를 열며 한숨을 쉰다',
        bad: '한가을이 오빠의 숨겨진 S급 각성 잠재력을 눈치챈다',
    }),

    // [10] Regional Context — Director에게 전달할 GBY 지역/세력 정보 (factions.json 기반 동적 생성)
    getRegionalContext: (location: string): string => {
        const lines: string[] = [];
        lines.push(`[Regional Landscape]`);
        lines.push(`세계관: 현대 한국(서울). 헌터와 블레서가 존재하는 어반 판타지.`);
        lines.push(`현재 위치: ${location || '서울'}`);
        lines.push(``);

        // factions.json에서 사회 계층 추출
        const fData = gbyFactions as any;
        if (fData.사회_계층) {
            lines.push(`[사회 계층]`);
            for (const [name, info] of Object.entries(fData.사회_계층) as [string, any][]) {
                const desc = typeof info === 'string' ? info : info.설명 || '';
                lines.push(`  ${name}: ${desc}`);
            }
            lines.push(``);
        }

        // factions.json에서 조직 추출
        if (fData.조직) {
            lines.push(`[세력 구도]`);
            for (const [name, info] of Object.entries(fData.조직) as [string, any][]) {
                const desc = typeof info === 'string' ? info : info.설명 || '';
                const rel = info.relations;
                let relStr = '';
                if (rel && Array.isArray(rel)) {
                    relStr = ' | ' + rel.map((r: any) => `${r.대상}(${r.관계})`).join(', ');
                }
                lines.push(`  ${name}: ${desc}${relStr}`);
            }
            lines.push(``);
        }

        // 빌런 범주
        if (fData.빌런) {
            const desc = typeof fData.빌런 === 'string' ? fData.빌런 : fData.빌런.설명 || '';
            lines.push(`[빌런]: ${desc}`);
        }

        return lines.join('\n');
    },

    // [11] Post-Logic Location Hint
    getPostLogicLocationHint: () =>
        'Use Korean city/district names: 서울_강남, 서울_종로, 인천_송도, 던전_E급, 네오아카디아_중앙, 등.',

    // [Refactored] Background Localization Logic
    resolveBackgroundName: (key: string, state: any) => {
        // GBY does not (yet) strictly enforce region-based assets prefixes
        // It returns the key as is.
        return key;
    }
};

GameRegistry.register(GodBlessYouConfig);
