
import { createBrowserClient } from '@supabase/ssr';

let supabase: ReturnType<typeof createBrowserClient> | undefined;

export const createClient = () => {
    if (!supabase) {
        supabase = createBrowserClient(
            'https://ifrxsdeikirjxthzoxye.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmcnhzZGVpa2lyanh0aHpveHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MzIzNzAsImV4cCI6MjA4MDQwODM3MH0.2e4gOKKFHfIvRY-kA7GWW6KNcg-rBIthijZ3Xnrpxoc'
        );
    }
    return supabase;
};
