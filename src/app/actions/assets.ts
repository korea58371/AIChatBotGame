'use server';

import fs from 'fs';
import path from 'path';

import { revalidatePath } from 'next/cache';

export async function getAssetFiles() {
    const publicDir = path.join(process.cwd(), 'public');
    const charDir = path.join(publicDir, 'assets', 'characters');
    const bgDir = path.join(publicDir, 'assets', 'backgrounds');

    console.log(`[Server] Reading assets from: ${publicDir}`);

    const getFiles = (dir: string) => {
        try {
            if (!fs.existsSync(dir)) return [];
            const files = fs.readdirSync(dir)
                .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
                .map(file => path.parse(file).name);
            console.log(`[Server] Found files in ${path.basename(dir)}:`, files);
            return files;
        } catch (error) {
            console.error(`Error reading directory ${dir}:`, error);
            return [];
        }
    };

    revalidatePath('/'); // Force revalidation of the home page

    return {
        characters: getFiles(charDir),
        backgrounds: getFiles(bgDir)
    };
}
