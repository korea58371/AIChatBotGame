'use server'

import { createClient } from '@supabase/supabase-js';

// Credentials (copied from lib/supabase.ts to ensure server-side compatibility)
const SUPABASE_URL = 'https://ifrxsdeikirjxthzoxye.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmcnhzZGVpa2lyanh0aHpveHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MzIzNzAsImV4cCI6MjA4MDQwODM3MH0.2e4gOKKFHfIvRY-kA7GWW6KNcg-rBIthijZ3Xnrpxoc';

// Log Type Definition
export interface GameplayLog {
    session_id: string;      // Unique Session ID (UUID)
    game_mode: string;       // 'wuxia' | 'god_bless_you'
    turn_count: number;
    event_id?: string;       // ID of the event triggered (if any)
    choice_selected?: string;// Text of the choice made
    player_rank?: string;    // Current Rank (e.g., 'Third Rate')
    location?: string;       // Current Location
    timestamp: string;       // ISO String
    meta?: any;              // JSON for extra stats (Coin, HP, MP, etc.)
}

export async function submitGameplayLog(logData: GameplayLog) {
    // [Server-Side Fix] Use direct supabase-js client instead of ssr browser client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
        const { error } = await supabase
            .from('gameplay_logs')
            .insert([
                {
                    session_id: logData.session_id,
                    game_mode: logData.game_mode,
                    turn_count: logData.turn_count,
                    event_id: logData.event_id,
                    choice_selected: logData.choice_selected,
                    player_rank: logData.player_rank,
                    location: logData.location,
                    timestamp: logData.timestamp || new Date().toISOString(),
                    meta: logData.meta
                }
            ]);

        if (error) {
            console.error("[Logger] Failed to insert log:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e: any) {
        console.error("[Logger] Exception:", e);
        return { success: false, error: e.message };
    }
}
