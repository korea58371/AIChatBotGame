'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Mail, Loader2 } from 'lucide-react';

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

                <p className="text-xs text-center text-gray-500 mt-4">
                    No password needed. We'll send a login link to your email.
                </p>
            </div>
        </div>
    );
}
