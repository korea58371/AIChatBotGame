
import { createBrowserClient } from '@supabase/ssr';

let supabase: ReturnType<typeof createBrowserClient> | undefined;

export const createClient = () => {
    if (!supabase) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.warn("Supabase credentials missing. Client not initialized.");
            return undefined;
        }

        supabase = createBrowserClient(
            supabaseUrl,
            supabaseKey
        );
    }
    return supabase;
};
