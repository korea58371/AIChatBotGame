'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Mail, Loader2, Chrome } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
    const supabase = createClient();

    const handleMagicLink = async () => {
        if (!email) {
            setMessage({ text: "Please enter your email address.", type: 'error' });
            return;
        }
        setLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // Redirect to the game page after clicking the link
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            setMessage({ text: error.message, type: 'error' });
        } else {
            setMessage({ text: 'Check your email for the magic link!', type: 'success' });
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    access_type: 'offline',
                },
            },
        });

        if (error) {
            setMessage({ text: error.message, type: 'error' });
            setLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.signInAnonymously();

        if (error) {
            setMessage({ text: error.message, type: 'error' });
            setLoading(false);
        } else {
            // Force redirect to game
            window.location.href = '/game';
        }
    };

    return (
        <div className="w-full max-w-sm bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h2 className="text-2xl font-bold text-center text-white mb-6">Hunter's Login</h2>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-gray-500" size={18} />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded pl-10 p-2.5 text-white focus:outline-none focus:border-yellow-500"
                            placeholder="hunter@example.com"
                        />
                    </div>
                </div>

                {message && (
                    <div className={`text-sm p-2 rounded ${message.type === 'error' ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
                        {message.text}
                    </div>
                )}

                <button
                    onClick={handleMagicLink}
                    disabled={loading}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded transition disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Send Magic Link'}
                </button>

                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-gray-800 text-gray-400">Or continue with</span>
                    </div>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 rounded transition disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : (
                        <>
                            <Chrome size={18} className="text-blue-600" />
                            <span>Sign in with Google</span>
                        </>
                    )}
                </button>

                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-gray-800 text-gray-400">Or</span>
                    </div>
                </div>

                <button
                    onClick={handleGuestLogin}
                    disabled={loading}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded transition disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Play as Guest'}
                </button>

                <p className="text-xs text-center text-gray-500 mt-4">
                    Guest accounts are saved on this device.
                </p>
            </div>
        </div>
    );
}
