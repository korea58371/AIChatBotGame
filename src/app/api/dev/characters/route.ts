import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Only allow in development
const isDev = process.env.NODE_ENV === 'development';

const GAMES_DIR = path.join(process.cwd(), 'src/data/games');

function getGamePath(gameId: string) {
    // Basic validation to prevent directory traversal
    const allowedGames = ['god_bless_you', 'wuxia'];
    if (!allowedGames.includes(gameId)) return null;
    return path.join(GAMES_DIR, gameId, 'jsons/characters');
}

export async function GET(request: Request) {
    if (!isDev) {
        return NextResponse.json({ error: 'Development only' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const gameId = searchParams.get('gameId') || 'god_bless_you'; // Default for backward compatibility if needed

        const basePath = getGamePath(gameId);
        if (!basePath) {
            return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
        }

        const mainFile = path.join(basePath, 'characters_main.json');
        const supportingFile = path.join(basePath, 'characters_supporting.json');

        // Check if files exist before reading
        let mainData = {};
        let supportingData = {};

        if (fs.existsSync(mainFile)) {
            mainData = JSON.parse(fs.readFileSync(mainFile, 'utf-8'));
            // [Fix] Inject 'is_main' flag for simulator consistency
            Object.values(mainData).forEach((char: any) => {
                if (char && typeof char === 'object') {
                    char.is_main = true;
                }
            });
        }
        if (fs.existsSync(supportingFile)) {
            supportingData = JSON.parse(fs.readFileSync(supportingFile, 'utf-8'));
        }

        return NextResponse.json({
            main: mainData,
            supporting: supportingData
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to read files', details: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (!isDev) {
        return NextResponse.json({ error: 'Development only' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { type, data, gameId } = body;

        if (!data) {
            return NextResponse.json({ error: 'No data provided' }, { status: 400 });
        }

        const basePath = getGamePath(gameId || 'god_bless_you');
        if (!basePath) {
            return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
        }

        let targetFile = '';
        if (type === 'main') {
            targetFile = path.join(basePath, 'characters_main.json');
        } else if (type === 'supporting') {
            targetFile = path.join(basePath, 'characters_supporting.json');
        } else {
            return NextResponse.json({ error: 'Invalid type. Must be "main" or "supporting"' }, { status: 400 });
        }

        // Write the updated JSON back to the file
        // We expect 'data' to be the entire JSON object for that file, 
        // to simplify replacement and avoid merge issues here.
        // The client should send the full modified object.
        fs.writeFileSync(targetFile, JSON.stringify(data, null, 4), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to write file', details: String(error) }, { status: 500 });
    }
}
