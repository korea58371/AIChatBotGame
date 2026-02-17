/**
 * Migration Script: Enrich character tags for casting trigger accuracy
 * Run: node scripts/enrich_character_tags.js
 */
const fs = require('fs');
const path = require('path');

// Tag enrichment mapping based on character roles, abilities, and narrative triggers
// Format: Character Name → Additional tags to ADD (existing tags are preserved)
const MAIN_TAG_ENRICHMENT = {
    // === 이미 풍부한 태그 (수정만) ===
    "강지수": ["수사", "체포", "경찰", "추적", "범죄", "심문"],  // 기존: 관리국, 요원, B급, 사격, 군인, 블레서

    // === 태그가 "블레서"만 있는 22명 최우선 보강 ===
    "엘레나 로즈바이스": ["용병", "마법사", "S급", "전투", "기사도", "독일", "원소마법", "블레서"],
    "서유나": ["음악", "바이올린", "버프", "치유", "우울", "A급", "블레서"],
    "윤슬비": ["도서관", "정보", "분석", "날씨", "비", "C급", "블레서"],
    "아나스타샤 이바노바": ["용병", "얼음", "마법사", "S급", "러시아", "술", "전투", "블레서"],
    "아미라 알 라시드": ["왕족", "사막", "모래", "A급", "아라비아", "돈", "블레서"],
    "키사라기 사쿠라코": ["야쿠자", "암살", "반사회", "S급", "일본", "그림자", "검", "블레서"],
    "김민지": ["해커", "드론", "S급", "히키코모리", "게임", "프로게이머", "정보", "블레서"],
    "설아": ["야생", "늑대", "변신", "S급", "사냥", "던전", "블레서"],
    "고하늘": ["포터", "운반", "아공간", "D급", "던전", "거래", "블레서"],
    "오지민": ["관리국", "국장", "지배", "명령", "B급", "행정", "블레서"],
    "백소미": ["요리", "식재료", "몬스터요리", "B급", "던전", "음식", "블레서"],
    "송민주": ["암시장", "거래", "정보", "밀수", "항공", "브로커", "A급", "블레서"],
    "차도희": ["법률", "변호사", "소송", "정신계", "S급", "재판", "블레서"],
    "한여름": ["방송", "기상캐스터", "미디어", "뉴스", "날씨", "태양", "S급", "블레서"],
    "류소연": ["비서", "분석", "관리", "지휘", "A급", "전략", "블레서"],
    "한봄": ["치유", "조련사", "동물", "C급", "사계절길드", "힐러", "블레서"],
    "이화연": ["식물", "독", "약초", "무용", "B급", "화염", "블레서"],
    "사이온지 미유키": ["일본", "검술", "S급", "발도술", "교토", "명문가", "전투", "블레서"],
    "타나카 아이": ["아이돌", "닌자", "매료", "A급", "갸루", "일본", "블레서"],
    "사토 아야": ["중2병", "화염", "마법", "B급", "가난", "오타쿠", "블레서"],
    "야마다 하나코": ["암살", "스텔스", "야쿠자", "C급", "잠입", "추적", "블레서"],
    "서이수": ["타투", "마법진", "버프", "저주", "B급", "뒷골목", "정보", "블레서"],

    // === 기존 태그가 있지만 트리거 누락 보강 ===
    "천서윤": ["오림푸스", "길드장", "S급", "얼음", "전투", "리더", "축복", "블레서"],
    "유화영": ["관리국", "요원", "B급", "수사", "화학", "잠입", "첩보", "블레서"],
    "이아라": ["방송", "스트리머", "아이돌", "미디어", "인터뷰", "S급", "인기", "블레서"],
    "은하율": ["아카데미", "학생", "C급", "소환사", "동물", "훈련", "블레서"],
    "한수진": ["연구원", "과학자", "D급", "연구", "분석", "관리국", "블레서"],
    "데스피나": ["이면세계", "마왕", "SS급", "어둠", "적대", "지배", "블레서"],
    "백련화": ["아카데미", "교관", "A급", "검술", "훈련", "격투", "블레서"],
    "키리": ["닌자", "A급", "쿠노이치", "일본", "전투", "잠입", "블레서"],
    "신세아": ["재벌", "미래길드", "S급", "돈", "사교계", "럭셔리", "블레서"],
    "성시아": ["성녀청", "사제", "S급", "치유", "축복", "부상", "병원", "블레서"],
    "도예린": ["대장장이", "제작", "아티팩트", "B급", "수리", "장비", "블레서"],
    "비올라": ["네오아카디아", "적대", "A급", "첩보", "잠입", "이중스파이", "블레서"],
    "한가을": ["여동생", "브라콘", "학생", "D급", "주거지", "가족", "블레서"],
    "홍유리": ["정보상", "여우", "A급", "정보", "구미호", "카지노", "도박", "블레서"],
    "클레어": ["교황청", "성기사", "A급", "전투메이드", "무기", "종교", "블레서"],
    "마세영": ["아카데미", "학생", "C급", "탱커", "방패", "가난", "던전", "블레서"],
    "권세나": ["폭주족", "배달", "A급", "운전", "추격", "바이크", "블레서"],
    "송채윤": ["연구원", "과학자", "D급", "연금술", "포션", "약", "제조", "블레서"],
    "장미래": ["미래길드", "비서", "B급", "운전", "보좌", "예지", "점술", "블레서"],
    "백마리": ["서큐버스", "악마", "A급", "유혹", "정기", "교도소", "감옥", "블레서"],
    "신유라": ["성녀청", "사제", "A급", "치유", "청순", "해부", "외과", "부상", "블레서"],
    "리메이링": ["중국", "무술", "S급", "격투", "쿵푸", "블레서"],
    "링링": ["중국", "해커", "A급", "정보", "사이버", "블레서"],
    "왕웨이": ["중국", "범죄", "S급", "조직", "삼합회", "밀거래", "블레서"],
    "제시카": ["미국", "군인", "S급", "총기", "전투", "영어", "블레서"],
    "강하은": ["부산", "바다", "B급", "서핑", "전투", "블레서"],
    "고수아": ["제주", "자연", "A급", "동물", "농업", "블레서"],
};

const SUPPORTING_TAG_ENRICHMENT = {
    "정한수": ["친구", "일반인", "남자", "주거지", "학생"],
    "윤아름": ["편의점", "알바", "일반인", "활발", "주거지"],
    "최시우": ["라이벌", "블레서", "B급", "전투", "아카데미"],
    "박채린": ["선배", "모델", "패션", "A급", "강남", "블레서"],
    "이지연": ["선배", "재벌", "사교계", "돈", "럭셔리", "블레서"],
    "김채은": ["아카데미", "학생", "후배", "힐러", "C급", "블레서"],
    "박봄": ["아카데미", "학생", "후배", "명랑", "D급", "블레서"],
};

function enrichTags(filePath, mapping) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    let updated = 0;
    let skipped = [];

    for (const [name, charData] of Object.entries(data)) {
        if (mapping[name]) {
            // REPLACE tags entirely with enriched set (already includes 블레서)
            if (!charData.system_logic) charData.system_logic = {};
            charData.system_logic.tags = mapping[name];
            updated++;
        } else {
            skipped.push(name);
        }
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');

    console.log(`✅ ${path.basename(filePath)}: ${updated} characters enriched`);
    if (skipped.length > 0) {
        console.log(`⚠️ Skipped (no mapping): ${skipped.join(', ')}`);
    }
}

const mainPath = path.join(__dirname, '../src/data/games/god_bless_you/jsons/characters/characters_main.json');
const supportPath = path.join(__dirname, '../src/data/games/god_bless_you/jsons/characters/characters_supporting.json');

console.log('=== Enriching Character Tags ===\n');
enrichTags(mainPath, MAIN_TAG_ENRICHMENT);
enrichTags(supportPath, SUPPORTING_TAG_ENRICHMENT);

// Verification: count tags per character
console.log('\n=== Tag Count Verification ===');
const mainData = JSON.parse(fs.readFileSync(mainPath, 'utf-8'));
const singles = [];
for (const [name, charData] of Object.entries(mainData)) {
    const tags = charData.system_logic?.tags || [];
    if (tags.length <= 1) singles.push(`${name} (${tags.length})`);
}
if (singles.length === 0) {
    console.log('✅ All main characters have 2+ tags!');
} else {
    console.log(`⚠️ Characters with ≤1 tag: ${singles.join(', ')}`);
}
console.log('\n=== Done ===');
