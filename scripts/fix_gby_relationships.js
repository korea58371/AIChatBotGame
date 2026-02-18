/**
 * GBY 인간관계 일괄 수정 스크립트
 * 1. 구조 오류 수정 (민소희, 엘레나 로즈바이스)
 * 2. 약칭 정규화 (엘레나→엘레나 로즈바이스 등)
 * 3. 양방향 누락 역방향 추가
 */
const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '..', 'src', 'data', 'games', 'god_bless_you', 'jsons', 'characters', 'characters_main.json');
const supportPath = path.join(__dirname, '..', 'src', 'data', 'games', 'god_bless_you', 'jsons', 'characters', 'characters_supporting.json');

const main = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
const supporting = JSON.parse(fs.readFileSync(supportPath, 'utf8'));

let changes = 0;

// ============================================================
// STEP 1: Fix Structural Errors
// ============================================================

// 1-A: 민소희 — "백소미(이웃" + "레시피 공유)" → "백소미": "이웃 (레시피 공유)"
console.log('[Fix] 민소희 인간관계 키 수정');
delete main['민소희']['인간관계']['백소미(이웃'];
delete main['민소희']['인간관계']['레시피 공유)'];
main['민소희']['인간관계']['백소미'] = '이웃 (레시피 공유)';
changes++;

// 1-B: 엘레나 로즈바이스 — Remove description-as-key, add proper relations
console.log('[Fix] 엘레나 로즈바이스 인간관계 구조 수정');
const badKey = Object.keys(main['엘레나 로즈바이스']['인간관계']).find(k => k.length > 30);
if (badKey) delete main['엘레나 로즈바이스']['인간관계'][badKey];
// Add proper relationships based on the description text
main['엘레나 로즈바이스']['인간관계']['아나스타샤 이바노바'] = 'S급 외국인 용병 동료 (친분)';
main['엘레나 로즈바이스']['인간관계']['한수진'] = '마력 회로 연구 대상';
changes++;

// ============================================================
// STEP 2: Abbreviation Normalization
// ============================================================

const abbreviationMap = {
    '엘레나': '엘레나 로즈바이스',
    '하나코': '야마다 하나코',
    '미유키': '사이온지 미유키',
    '사쿠라코': '키사라기 사쿠라코',
    '아나스타샤': '아나스타샤 이바노바',
    '아미라': '아미라 알 라시드',
    '앨리스': '이아라',            // 이아라의 별칭
    '앨리스/이아라': '이아라',
    '사이온지/리메이링': null,      // Slash: split into two entries
    '백련화/리메이링': null,        // Slash: split into two entries
};

function normalizeRelations(charData, charName, allChars) {
    const relations = charData['인간관계'];
    if (!relations) return;

    const keysToProcess = Object.keys(relations);
    for (const key of keysToProcess) {
        // Handle slash keys (split into individual entries)
        if (key === '사이온지/리메이링') {
            const desc = relations[key];
            delete relations[key];
            relations['사이온지 미유키'] = desc;
            relations['리메이링'] = desc;
            console.log(`[Normalize] ${charName}: '${key}' → '사이온지 미유키' + '리메이링'`);
            changes++;
            continue;
        }
        if (key === '백련화/리메이링') {
            const desc = relations[key];
            delete relations[key];
            relations['백련화'] = desc;
            relations['리메이링'] = desc;
            console.log(`[Normalize] ${charName}: '${key}' → '백련화' + '리메이링'`);
            changes++;
            continue;
        }
        if (key === '앨리스/이아라') {
            const desc = relations[key];
            delete relations[key];
            relations['이아라'] = desc;
            console.log(`[Normalize] ${charName}: '${key}' → '이아라'`);
            changes++;
            continue;
        }

        // Simple abbreviation replacement
        if (abbreviationMap[key] && abbreviationMap[key] !== null) {
            const fullName = abbreviationMap[key];
            // Only replace if fullName exists in our data AND the full name isn't already a key
            if (allChars[fullName] && !relations[fullName]) {
                const desc = relations[key];
                delete relations[key];
                relations[fullName] = desc;
                console.log(`[Normalize] ${charName}: '${key}' → '${fullName}'`);
                changes++;
            }
        }
    }
}

const allChars = { ...main, ...supporting };

for (const [name, data] of Object.entries(main)) {
    normalizeRelations(data, name, allChars);
}
for (const [name, data] of Object.entries(supporting)) {
    normalizeRelations(data, name, allChars);
}

// ============================================================
// STEP 3: Add Bidirectional Relationships
// ============================================================

// Merge again after normalization
const allCharsUpdated = { ...main, ...supporting };

// Map to determine reverse relationship descriptions
function getReverseDescription(fromName, toName, forwardDesc) {
    // Generate contextually appropriate reverse descriptions
    const reverseMap = {
        // Main ↔ Main
        '천서윤|한수진': '관리 대상 (S급 길드 마스터)',
        '천서윤|오지민': '협력 파트너 (S급 길드)',
        '유화영|한수진': '행정 파트너',
        '데스피나|신세아': '사교계 위장 라이벌',
        '데스피나|홍유리': '뒷세계 거래',
        '백련화|천서윤': '제자/후배',
        '신세아|천서윤': '재벌/길드 라이벌',
        '도예린|클레어': '라이벌 (기술 교류)',
        '비올라|키리': '적대 또는 협력 (이익에 따름)',
        '주아인|은하율': '운동 라이벌',
        '윤슬비|한수진': '자료 요청 대상',
        '아미라 알 라시드|신세아': '쇼핑 친구',
        '키사라기 사쿠라코|백련화': '검술 교류',
        '김민지|이아라': '라이벌/합방',
        '고하늘|도예린': '거래처',
        '클레어|키리': '라이벌',
        '클레어|민소희': '가사 공유',
        '백소미|이화연': '재료 납품',
        '차도희|신유라': '라이벌',
        '한여름|송민주': '눈치 봄',
        '권세나|도예린': '정비 의뢰',
        '권세나|강지수': '추격전',
        '장미래|신세아': '변호사',
        '장미래|오지민': '공방/협상',
        '류소연|천서윤': '경쟁/협조',
        '류소연|오지민': '행정 처리',
        '한봄|백소미': '간식 조달',
        '이화연|한여름': '날씨 도움',
        '타나카 아이|키리': '닌자 라이벌',
        '사토 아야|마세영': '가난 동지',
        '야마다 하나코|오지민': '술자리 동지',
        '백마리|장미래': '법률 자문',
        '서이수|왕웨이': 'VIP 고객',
        '서이수|송채윤': '뒷거래 파트너',
        '신유라|한봄': '동료',
        '신유라|한가을': '학생/양호실 이용자',
        '리메이링|백련화': '라이벌',
        '리메이링|왕웨이': '대립',
        '링링|한봄': '보호 대상',
        '링링|왕웨이': '동향',
        '제시카|천서윤': '국가 간 라이벌',
        '고수아|한여름': '날씨 공유',
        // Supporting ↔ Supporting
        '최시우|윤아름': '돈으로 유혹하는 남자 (거부)',
        '박채린|최시우': '호구/물주',
        // Supporting → Main
        '이지연|한가을': '의붓 어머니 (과보호)',
        '김채은|한가을': '동기 (라이벌 자처)',
        '박봄|한가을': '절친 (베프)',
    };

    const key = `${fromName}|${toName}`;
    if (reverseMap[key]) return reverseMap[key];

    // Fallback: mirror the forward description
    return forwardDesc;
}

let addedCount = 0;
for (const [name, data] of Object.entries(allCharsUpdated)) {
    const relations = data['인간관계'] || {};
    for (const [target, desc] of Object.entries(relations)) {
        if (!allCharsUpdated[target]) continue; // Skip non-existent targets (주인공, 네온, etc.)

        const targetRelations = allCharsUpdated[target]['인간관계'] || {};
        if (!targetRelations[name]) {
            // Add reverse relationship
            if (!allCharsUpdated[target]['인간관계']) {
                allCharsUpdated[target]['인간관계'] = {};
            }
            const reverseDesc = getReverseDescription(name, target, desc);
            allCharsUpdated[target]['인간관계'][name] = reverseDesc;

            // Also update the source (main or supporting)
            if (main[target]) {
                if (!main[target]['인간관계']) main[target]['인간관계'] = {};
                main[target]['인간관계'][name] = reverseDesc;
            } else if (supporting[target]) {
                if (!supporting[target]['인간관계']) supporting[target]['인간관계'] = {};
                supporting[target]['인간관계'][name] = reverseDesc;
            }

            console.log(`[BiDir] Added: ${target} → ${name}: "${reverseDesc}"`);
            addedCount++;
            changes++;
        }
    }
}

// ============================================================
// STEP 4: Write Back
// ============================================================

fs.writeFileSync(mainPath, JSON.stringify(main, null, 4), 'utf8');
fs.writeFileSync(supportPath, JSON.stringify(supporting, null, 4), 'utf8');

console.log(`\n=== 완료 ===`);
console.log(`총 변경: ${changes}건`);
console.log(`역방향 추가: ${addedCount}건`);
console.log(`파일 저장: characters_main.json, characters_supporting.json`);
