'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Login from '@/components/Login';
import { Loader2 } from 'lucide-react';

export default function Home() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const checkUser = async () => {
            // Check if there is an auth code in the URL (Supabase sometimes redirects to root)
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            if (code) {
                // Use window.location.href for a hard redirect to the route handler
                window.location.href = `/auth/callback?code=${code}`;
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                router.push('/game');
            } else {
                setLoading(false);
            }
        };
        checkUser();
    }, [router, supabase]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-yellow-500">
                <Loader2 className="animate-spin" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="flex flex-col items-center w-full max-w-md">
                <h1 className="text-5xl font-bold text-center mb-2 text-yellow-500 tracking-tighter">Hunter's Destiny</h1>
                <p className="text-center text-gray-400 mb-8 text-lg">A Visual Novel Chat Adventure</p>

                <Login />
            </div>
        </div>
    );
}
