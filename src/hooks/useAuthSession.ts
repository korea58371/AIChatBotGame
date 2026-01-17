import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useGameStore } from '@/lib/store';
import { createClient } from '@/lib/supabase';

interface AuthSessionResult {
    user: User | null;
    session: Session | null;
    loading: boolean;
    coins: number;
    refreshSession: () => Promise<void>;
}

export function useAuthSession(): AuthSessionResult {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [coins, setCoins] = useState(0);

    // Singleton client
    const supabase = createClient();

    const fetchCoins = async (userId: string) => {
        if (!supabase) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('coins')
            .eq('id', userId)
            .single();
        if (data) setCoins(data.coins);
    };

    const refreshSession = async () => {
        if (!supabase) return;
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session) {
            setSession(session);
            setUser(session.user);
            useGameStore.getState().setSessionUser(session.user);
            fetchCoins(session.user.id);
        }
    };

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            if (!supabase) {
                setLoading(false);
                return;
            }

            // 1. Bridge Check (Store Memory)
            const bridgedUser = useGameStore.getState().sessionUser;
            if (bridgedUser) {
                console.log("[Auth-Hook] Found bridged user:", bridgedUser.id);
                if (mounted) {
                    setUser(bridgedUser);
                    // Mock session for UI if needed, though usually just User is enough
                    // constructing a partial session to satisfy types if needed downstream
                    setSession({
                        user: bridgedUser,
                        access_token: '',
                        refresh_token: '',
                        expires_in: 0,
                        token_type: 'bearer',
                        user_metadata: bridgedUser.user_metadata,
                        app_metadata: bridgedUser.app_metadata
                    } as Session);

                    setLoading(false);
                    fetchCoins(bridgedUser.id);
                }
            }

            // 2. Async Verification (GetSession Race)
            // We run this ensuring it communicates with store if it finds something NEW
            try {
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise<{ data: { session: null }, error: any }>((resolve) => {
                    setTimeout(() => resolve({ data: { session: null }, error: 'timeout' }), 5000);
                });

                const { data: sessionData, error: sessionError } = await Promise.race([sessionPromise, timeoutPromise]);

                let activeSession = sessionData.session;

                // 2b. Fallback: getUser (Cookie Check)
                if (!activeSession && (!bridgedUser)) {
                    // Only try fallback if we don't have a bridged user (or if we want to verify session validity)
                    // Actually, we should always try to verify if sessionData failed.
                    console.log("[Auth-Hook] getSession empty/error, trying getUser...");
                    const { data: userResult } = await supabase.auth.getUser();
                    if (userResult?.user) {
                        console.log("[Auth-Hook] getUser success (Cookie valid)");
                        activeSession = {
                            user: userResult.user,
                            access_token: '',
                            refresh_token: '',
                            expires_in: 0,
                            token_type: 'bearer',
                            user_metadata: userResult.user.user_metadata,
                            app_metadata: userResult.user.app_metadata
                        } as Session;
                    }
                }

                if (mounted) {
                    if (activeSession) {
                        setSession(activeSession);
                        setUser(activeSession.user);
                        useGameStore.getState().setSessionUser(activeSession.user); // Sync Store
                        fetchCoins(activeSession.user.id);
                        setLoading(false);
                    } else if (sessionError === 'timeout' && !bridgedUser) {
                        console.warn("[Auth-Hook] Timeout and no bridge.");
                        setLoading(false);
                    } else if (!bridgedUser) {
                        // Only set loading false if we really found nothing and have no bridge
                        setLoading(false);
                    }
                }

            } catch (e) {
                console.error("[Auth-Hook] Error:", e);
                if (mounted && !bridgedUser) setLoading(false);
            }
        };

        initAuth();

        // 3. Listener (Keep alive)
        if (!supabase) return;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, currentSession: any) => {
            console.log("[Auth-Hook] onAuthStateChange:", event);
            if (!mounted) return;

            if (currentSession?.user) {
                setSession(currentSession);
                setUser(currentSession.user);
                useGameStore.getState().setSessionUser(currentSession.user);
                fetchCoins(currentSession.user.id);
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setCoins(0);
                useGameStore.getState().setSessionUser(null);
                setLoading(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };

    }, []);

    return { user, session, loading, coins, refreshSession };
}
