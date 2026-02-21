'use client';

import { useEffect, useState } from 'react';
import TitleScreen from '@/components/TitleScreen';
import { Loader2 } from 'lucide-react';

export default function Home() {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuthCode = async () => {
            // Check if there is an auth code in the URL (Supabase sometimes redirects to root)
            const params = new URLSearchParams(window.location.search);

            // [Fix] 결제 결과 redirect가 루트로 온 경우, /game으로 포워딩
            const impSuccess = params.get('imp_success');
            if (impSuccess !== null) {
                window.location.href = `/game?${params.toString()}`;
                return;
            }

            const code = params.get('code');
            if (code) {
                // Use window.location.href for a hard redirect to the route handler
                // Forward ALL search params (including error, error_description which Supabase might send)
                // And ensure we don't double-redirect if already on callback (though this is home page)
                window.location.href = `/auth/callback?${params.toString()}`;
                return;
            }
            setLoading(false);
        };
        checkAuthCode();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-yellow-500">
                <Loader2 className="animate-spin" size={48} />
            </div>
        );
    }

    return <TitleScreen />;
}
