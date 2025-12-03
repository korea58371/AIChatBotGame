'use server';

import fs from 'fs';
import path from 'path';

export async function getAssetFiles() {
    const publicDir = path.join(process.cwd(), 'public');
    const charDir = path.join(publicDir, 'assets', 'characters');
    const bgDir = path.join(publicDir, 'assets', 'backgrounds');

    const getFiles = (dir: string) => {
        try {
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir)
                .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
                .map(file => path.parse(file).name);
        } catch (error) {
            console.error(`Error reading directory ${dir}:`, error);
            return [];
        }
    };

    return {
        characters: getFiles(charDir),
        backgrounds: getFiles(bgDir)
    };
}
