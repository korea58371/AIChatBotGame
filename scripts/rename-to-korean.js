/**
 * 캐릭터 이미지 파일/폴더 한글화 스크립트 v2
 * 영문 폴더명/파일명을 한글로 일괄 변환
 * 
 * Usage: node scripts/rename-to-korean.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// ==========================================
// 1. 영문 감정 키워드 → 한글 매핑
// ==========================================
const emotionMap = {
    // Level-based
    'Joy_Lv1': '기쁨1', 'Joy_Lv2': '기쁨2', 'Joy_Lv3': '기쁨3',
    'Anger_Lv1': '화남1', 'Anger_Lv2': '화남2', 'Anger_Lv3': '화남3',
    'Sadness_Lv1': '슬픔1', 'Sadness_Lv2': '슬픔2', 'Sadness_Lv3': '슬픔3',
    'Shy_Lv1': '부끄1', 'Shy_Lv2': '부끄2', 'Shy_Lv3': '부끄3',
    'CuteAngry_Lv1': '앙탈1', 'CuteAngry_Lv2': '앙탈2', 'CuteAngry_Lv3': '앙탈3',

    // Independent
    'Relieved': '안도', 'Relief': '안도',
    'Pouting': '삐짐',

    // Comic
    'CatFace': '고양이', 'Catface': '고양이',
    'DarkShadow': '음침', 'Dark_Shadow': '음침',
    'Dizzy': '어지러움',
    'Dumbfounded': '멍함',
    'Panic': '당황', 'Panic_Comic': '당황',
    'Shock': '충격', 'Shocked': '충격',
    'Sparkle': '반짝',

    // Standard
    'Default': '기본',
    'Determined': '결의',
    'Disdain': '경멸',
    'Disgust': '혐오',
    'Cold': '냉담',
    'Drunk': '취함',
    'Expectant': '기대',
    'Smug': '여유',
    'Exhausted': '지침',
    'Prank': '장난',
    'HeartEyes': '하트', 'Heart_Eyes': '하트',
    'Pain': '고통',
    'Seductive': '유혹',
    'Sleepy': '졸림',
    'Surprise': '놀람',
    'Thinking': '고민',
    'Yandere': '광기',

    // Extra emotions found in actual files
    'Confident': '자신감', 'Confident2': '자신감2',
    'Excited': '흥분',
    'GentleSmile': '미소',
    'Hurt': '고통',
    'LoveStruck': '설렘',
    'Panting': '숨참',
    'Praying': '기도',
    'Scared': '공포',
    'Worried': '걱정',
    'Annoyed': '짜증',
    'Smug2': '여유2',

    // Special compound
    'Default_Sparkle': '기본_반짝',
    'Swimsuit_Default': '수영복_기본',
};

// ==========================================
// 2. character_map.json 로드
// ==========================================
function loadCharMap(gameDir) {
    const mapPath = path.join(gameDir, 'character_map.json');
    if (!fs.existsSync(mapPath)) return {};
    return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
}

function buildReverseMap(charMap) {
    // {"민소희": "MinSoHee"} → {"MinSoHee": "민소희"}
    const reverse = {};
    for (const [korean, english] of Object.entries(charMap)) {
        if (korean === english) continue; // Already Korean→Korean
        if (korean === '주인공') continue;
        reverse[english] = korean;
    }
    return reverse;
}

// ==========================================
// 3. Rename Logic
// ==========================================
function renameCharacterFiles(assetsDir, gameDataDir) {
    const charsDir = path.join(assetsDir, 'characters');
    if (!fs.existsSync(charsDir)) {
        console.log(`  [SKIP] ${charsDir} 경로 없음`);
        return;
    }

    const charMap = loadCharMap(gameDataDir);
    const reverseMap = buildReverseMap(charMap);

    const folders = fs.readdirSync(charsDir);
    let renamedFolders = 0, skippedFolders = 0;
    const unmappedEmotions = new Set();

    for (const folder of folders) {
        const folderPath = path.join(charsDir, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        // Determine Korean name for this folder
        let koreanName = reverseMap[folder] || null;

        // If not found, try partial matching (e.g., folder="Amira" matches reverse key "AmiraAlRashid")
        if (!koreanName) {
            for (const [engKey, korVal] of Object.entries(reverseMap)) {
                if (engKey.startsWith(folder) || folder.startsWith(engKey)) {
                    koreanName = korVal;
                    break;
                }
            }
        }

        const targetName = koreanName || folder; // Keep original if no mapping

        // Rename files inside first
        renameFilesInFolder(folderPath, folder, targetName, unmappedEmotions);

        // Rename folder (only if Korean name is different)
        if (koreanName && koreanName !== folder) {
            const newFolderPath = path.join(charsDir, koreanName);
            if (fs.existsSync(newFolderPath)) {
                console.log(`  [WARN] 대상 폴더 이미 존재: ${newFolderPath}`);
            } else {
                console.log(`  [FOLDER] ${folder} → ${koreanName}`);
                if (!DRY_RUN) fs.renameSync(folderPath, newFolderPath);
                renamedFolders++;
            }
        } else {
            skippedFolders++;
        }
    }

    if (unmappedEmotions.size > 0) {
        console.log(`  [UNMAPPED EMOTIONS] ${[...unmappedEmotions].join(', ')}`);
    }
    console.log(`  결과: 폴더 ${renamedFolders}개 renamed, ${skippedFolders}개 스킵`);
}

function renameFilesInFolder(folderPath, oldCharId, newCharId, unmappedEmotions) {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        if (!file.endsWith('.png')) continue;

        const base = file.replace('.png', '');

        // Handle "(1)" duplicate suffix
        const dupeMatch = base.match(/^(.+?)(\s*\(\d+\))$/);
        let mainPart = dupeMatch ? dupeMatch[1] : base;
        let dupeSuffix = dupeMatch ? dupeMatch[2] : '';

        // Try to split off the character prefix
        // We try the full folder name first, then case-insensitive, then partial
        let emotionPart = null;

        if (mainPart.startsWith(oldCharId + '_')) {
            emotionPart = mainPart.substring(oldCharId.length + 1);
        } else if (mainPart.toLowerCase().startsWith(oldCharId.toLowerCase() + '_')) {
            emotionPart = mainPart.substring(oldCharId.length + 1);
        } else {
            // Try finding underscore and using everything before it as prefix
            // This handles cases like "Elena_Determined" in folder "ElenaRoseweiss"
            // or "SongChaeYun_Default" in folder "SongChaeYoon"
            const underscoreIdx = mainPart.indexOf('_');
            if (underscoreIdx > 0) {
                const filePrefixLower = mainPart.substring(0, underscoreIdx).toLowerCase();
                const folderLower = oldCharId.toLowerCase();
                // Check if file prefix is a prefix of folder name or vice versa
                if (folderLower.startsWith(filePrefixLower) || filePrefixLower.startsWith(folderLower.substring(0, Math.min(folderLower.length, filePrefixLower.length)))) {
                    emotionPart = mainPart.substring(underscoreIdx + 1);
                }
            }
        }

        if (emotionPart === null) {
            // No underscore or cannot determine - treat whole thing as just the name
            if (mainPart.toLowerCase() === oldCharId.toLowerCase()) {
                // File is just the character name, no emotion
                emotionPart = '';
            } else {
                console.log(`    [SKIP] ${file} - 파싱 불가`);
                continue;
            }
        }

        // Map emotion to Korean
        let koreanEmotion = emotionMap[emotionPart];
        if (!koreanEmotion && emotionPart) {
            unmappedEmotions.add(emotionPart);
            koreanEmotion = emotionPart; // Keep as-is if no mapping
        }
        if (!emotionPart) koreanEmotion = '';

        // Construct new filename
        const newBase = koreanEmotion
            ? `${newCharId}_${koreanEmotion}${dupeSuffix}`
            : `${newCharId}${dupeSuffix}`;
        const newFile = `${newBase}.png`;

        if (file === newFile) continue;

        const oldPath = path.join(folderPath, file);
        const newPath = path.join(folderPath, newFile);

        if (fs.existsSync(newPath)) {
            console.log(`    [WARN] 파일 이미 존재: ${newFile}`);
            continue;
        }

        console.log(`    [FILE] ${file} → ${newFile}`);
        if (!DRY_RUN) fs.renameSync(oldPath, newPath);
    }
}

// ==========================================
// 4. Main
// ==========================================
console.log(`\n=== 캐릭터 이미지 한글화 ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===\n`);

const baseDir = path.resolve(__dirname, '..');

// GBY
console.log('[God Bless You]');
renameCharacterFiles(
    path.join(baseDir, 'public/assets/god_bless_you'),
    path.join(baseDir, 'src/data/games/god_bless_you')
);

// Wuxia
console.log('\n[Wuxia]');
renameCharacterFiles(
    path.join(baseDir, 'public/assets/wuxia'),
    path.join(baseDir, 'src/data/games/wuxia')
);

console.log(`\n=== 완료 ${DRY_RUN ? '(DRY RUN - 실제 변경 없음)' : ''} ===`);
