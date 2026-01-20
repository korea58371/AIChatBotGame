import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Only allow in development
const isDev = process.env.NODE_ENV === 'development';

const GAMES_DIR = path.join(process.cwd(), 'src/data/games');

function getGamePath(gameId: string) {
    // Basic validation
    const allowedGames = ['god_bless_you', 'wuxia'];
    if (!allowedGames.includes(gameId)) return null;
    return path.join(GAMES_DIR, gameId, 'jsons');
}

export async function GET(request: Request) {
    if (!isDev) {
        return NextResponse.json({ error: 'Development only' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const gameId = searchParams.get('gameId') || 'wuxia'; // Default to wuxia for locations

        const basePath = getGamePath(gameId);
        if (!basePath) {
            return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
        }

        const locationFile = path.join(basePath, 'locations.json');

        if (!fs.existsSync(locationFile)) {
            return NextResponse.json({ error: 'Locations file not found' }, { status: 404 });
        }

        const locationData = JSON.parse(fs.readFileSync(locationFile, 'utf-8'));

        return NextResponse.json(locationData);
    } catch (error) {
        console.error('Error reading location data:', error);
        return NextResponse.json({ error: 'Failed to read location data' }, { status: 500 });
    }
}
