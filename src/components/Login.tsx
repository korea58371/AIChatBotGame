'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2 } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async () => {
        setLoading(true);
        setMessage(null);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setMessage({ text: error.message, type: 'error' });
            setLoading(false);
        } else {
            router.push('/game');
        }
    };

    const handleSignUp = async () => {
        setLoading(true);
        setMessage(null);
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            setMessage({ text: error.message, type: 'error' });
        } else {
            setMessage({ text: 'Check your email for the confirmation link!', type: 'success' });
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

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded pl-10 p-2.5 text-white focus:outline-none focus:border-yellow-500"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {message && (
                    <div className={`text-sm p-2 rounded ${message.type === 'error' ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
                        {message.text}
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-2 rounded transition disabled:opacity-50 flex justify-center items-center"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Login'}
                    </button>
                    <button
                        onClick={handleSignUp}
                        disabled={loading}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded transition disabled:opacity-50"
                    >
                        Sign Up
                    </button>
                </div>
            </div>
        </div>
    );
}
