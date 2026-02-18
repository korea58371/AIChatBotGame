/**
 * Wuxia 인간관계 양방향 역방향 자동 추가 스크립트
 */
const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, '..', 'src', 'data', 'games', 'wuxia', 'jsons', 'characters');
const mainPath = path.join(basePath, 'characters_main.json');
const supportPath = path.join(basePath, 'characters_supporting.json');
const enemyPath = path.join(basePath, 'characters_enemy.json');

const main = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
const supporting = JSON.parse(fs.readFileSync(supportPath, 'utf8'));
const enemy = JSON.parse(fs.readFileSync(enemyPath, 'utf8'));

let changes = 0;

// Map of contextual reverse relationship descriptions
const reverseMap = {
    // Main ↔ Main
    '연화린|백소유': '신뢰(무림 동료)',
    '백소유|천예령': '경계 (타락, 구원 대상)',
    '화영|남궁세아': '경쟁 (실력 인정)',
    '화영|연화린': '후배 (호감)',
    '모용예린|남궁세아': '도구 (이용당함 인지 못함)',
    '주예서|남궁세아': '흥미 대상',
    '천예령|흑룡': '제자 (도구)',
    '한설희|백소유': '친분 (생명 존중 공감)',
    '홍유비|남궁세아': '거래 (VIP 고객)',
    '공손란|남궁세아': '잔소리꾼 (사숙)',
    '비연|홍유비': '전 고용인 (도구)',
    '비연|천예령': '동족혐오 (위험한 기운)',
    '설하은|남궁세아': '부러움 대상',
    '설하은|연화린': '두려움 대상 (차가운 인상)',
    '야율|당소율': '친구 (벌레/맹수 교감)',
    '야율|팽소소': '힘의 대결 (팔씨름)',
    '팽소소|남궁세아': '부하 (충성)',
    '도무아|설하은': '주목 대상 (기피)',
    '도무아|당소율': '흥미 대상 (독/주술)',
    '금채월|남궁세아': '물주 (큰손 고객)',
    // Supporting ↔ Supporting
    '독고천|천위강': '적대 (무림맹주)',
    '독고천|남궁천': '협력 (오대세가)',
    '금만수|금채월': '아버지 (보물)',
    '모용휘|제갈연주': '라이벌 (지략 대결)',
    '팽무도|팽대광': '아버지 (한심한 아들)',
    '현명|청풍': '제자',
    '현무|청풍': '제자',
    '운검|유선': '사형',
    '정허|혜광': '동료',
    '공손월|공손란': '여동생',
    '홍칠|왕곡추': '부하',
    '홍칠|소칠': '동료',
    '당명|당문식': '식구/당가 사람',
    '남궁휘|남궁천': '식구/남궁가 사람',
    '남궁휘|남궁진': '동생',
    '혜심|연성': '사제',
    '청운|화영': '사형',
    '청운|청풍': '제자',
    '유성|청풍': '제자',
    '왕초|칠성': '부하',
    '모용구|모용휘': '장로/부친',
    '조명|조윤': '부하',
    '조명|금만수': '고용인',
    '한철|박철': '술친구',
    '왕노야|금만수': '친구 (빈둥빈둥)',
    '왕노야|조윤': '관할 백성',
    '박철|남궁세아': '가신 (충성)',
    '소칠|왕곡추': '부하 (잔소리에 시달림)',
    '연성|주진양': '후배 (귀여운 누나)',
    '명심|약선': '제자 (의술)',
    '김포|금만수': '고용인',
    '김포|조윤': '부하',
    '개눈|홍유비': '부하 (절대 복종)',
    '개눈|칠성': '라이벌 (거지)',
    '초련|약선': '제자',
    '초련|한설희': '후배 (치료술 사형)',
    '돌쇠|남궁세아': '가신 (충성)',
    '왕곡추|홍유비': '짝사랑꾼 (거절함)',
    '고준|독고천': '손자 (그만한 그릇)',
    '고준|남궁세아': '동료 (정의)',
    '약선|당문식': '악우 (독 vs 약 라이벌)',
    '매향|고칠성': '부하',
    '고칠성|장무극': '부하 (복종)',
    '삼칠|홍유비': '부하 (정보 거래)',
    '삼칠|소칠': '친구 (정보원)',
    '유선|화영': '사형 (질투/애증)',
    '유선|청풍': '제자',
    '진명|고준': '동료 (협객)',
    '구철|독고미': '동생 (밥)',
    '유환|사천패': '아들 (충성)',
    '장소|사천패': '자식',
    '제갈공|제갈연주': '아버지 (지적 유희 파트너)',
    '제갈공|독고천': '참모/견제 대상',
    '운중자|공손란': '후배 (사조님 모심)',
    '곽윤|청풍': '라이벌 (화산파)',
    '운현|당문식': '원수 (지역 이권)',
    '홍거|칠성': '스승 (제자 갈굼)',
    '수왕|장무극': '동맹 (하위)',
    '모산도인|도무아': '사부 (걸작)',
    '상관무|금채월': '라이벌 (상권)',
    '황보숭|주예서': '부하 (지휘사)',
    '제갈현|제갈공': '식구',
    '제갈현|제갈연주': '사촌 동생 (과잉보호)',
    '진금영|곽윤': '제자',
    '백학|현오': '술친구 (답답함)',
    '천응|백학': '동료 (말 많은 샌님)',
    // Enemy ↔ Enemy
    '장무극|천위강': '라이벌 (혈교)',
    '흑풍|천위강': '부하',
    '흑풍|혈비': '부하',
    '혈수|사천패': '흥미 (강자)',
    '백골|사천패': '아들',
    '적호|악천': '부하 (공포)',
    '단우혈|천위강': '천마 (흥미/라이벌)',
    '단우혈|독고천': '가소로운 적',
    // Enemy → Supporting
    '도끼|고칠성': '부하',
    '조삼|고칠성': '부하 (공포)',
    '마광철|고칠성': '부하',
    '철우|고칠성': '부하 (절대 충성)',
    '사마혁|왕일도': '이용 대상',
    '당비|당보': '라이벌 (질투냄)',
    '당비|당문식': '당가 사람',
    '단검|사천패': '자식',
    '단검|구철': '동생 (보호)',
};

function addBidirectional(allChars, sources) {
    for (const [name, data] of Object.entries(allChars)) {
        const relations = data['인간관계'] || {};
        for (const [target, desc] of Object.entries(relations)) {
            if (!allChars[target]) continue;

            const targetRelations = allChars[target]['인간관계'] || {};
            if (!targetRelations[name]) {
                if (!allChars[target]['인간관계']) allChars[target]['인간관계'] = {};

                const key = `${name}|${target}`;
                const reverseDesc = reverseMap[key] || desc; // Fallback to same desc

                allChars[target]['인간관계'][name] = reverseDesc;

                // Write to correct source file
                for (const src of sources) {
                    if (src.data[target]) {
                        if (!src.data[target]['인간관계']) src.data[target]['인간관계'] = {};
                        src.data[target]['인간관계'][name] = reverseDesc;
                        break;
                    }
                }

                console.log(`[BiDir] ${target} -> ${name}: "${reverseDesc}"`);
                changes++;
            }
        }
    }
}

const allChars = { ...main, ...supporting, ...enemy };
const sources = [
    { data: main, name: 'main' },
    { data: supporting, name: 'supporting' },
    { data: enemy, name: 'enemy' }
];

addBidirectional(allChars, sources);

// Write back
fs.writeFileSync(mainPath, JSON.stringify(main, null, 4), 'utf8');
fs.writeFileSync(supportPath, JSON.stringify(supporting, null, 4), 'utf8');
fs.writeFileSync(enemyPath, JSON.stringify(enemy, null, 4), 'utf8');

console.log(`\n=== 완료 ===`);
console.log(`역방향 추가: ${changes}건`);
