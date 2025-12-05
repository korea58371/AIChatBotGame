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
            const code = params.get('code');
            if (code) {
                // Use window.location.href for a hard redirect to the route handler
                window.location.href = `/auth/callback?code=${code}`;
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
