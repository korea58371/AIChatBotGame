const fs = require('fs');
const path = require('path');

// BOM(Byte Order Mark) 문자 (EF BB BF)
const BOM_BUFFER = Buffer.from([0xEF, 0xBB, 0xBF]);

// 검사할 대상 파일 목록 (프로젝트 루트 기준 상대 경로)
const TARGET_FILES = [
    'src/data/games/wuxia/jsons/characters/characters_main.json',
    'src/data/games/wuxia/jsons/characters/characters_supporting.json',
    // 추후 다른 파일이 문제가 되면 여기에 추가하면 됩니다.
];

function removeBomFromFile(filePath) {
    const fullPath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
        console.warn(`[WARN] File not found: ${filePath}`);
        return;
    }

    try {
        const buffer = fs.readFileSync(fullPath);

        // BOM 확인
        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            console.log(`[BOM DETECTED] Removing BOM from: ${filePath}`);

            // BOM(3바이트)을 제외한 나머지 내용을 씁니다
            const newBuffer = buffer.subarray(3);
            fs.writeFileSync(fullPath, newBuffer);

            console.log(`[SUCCESS] BOM removed: ${filePath}`);
        } else {
            console.log(`[CLEAN] No BOM detected: ${filePath}`);
        }
    } catch (err) {
        console.error(`[ERROR] Failed to process ${filePath}:`, err);
    }
}

console.log('Scanning for BOM in targeted JSON files...');
TARGET_FILES.forEach(file => removeBomFromFile(file));
console.log('Scan complete.');
