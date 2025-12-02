'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import { Key, Play } from 'lucide-react';

export default function Home() {
    const [keyInput, setKeyInput] = useState('');
    const { apiKey, setApiKey } = useGameStore();
    const router = useRouter();

    useEffect(() => {
        if (apiKey) {
            setKeyInput(apiKey);
        }
    }, [apiKey]);

    const handleStart = () => {
        if (keyInput.trim()) {
            setApiKey(keyInput.trim());
            router.push('/game');
        } else {
            alert('Please enter a valid API Key.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
                <h1 className="text-4xl font-bold text-center mb-2 text-yellow-500">Hunter's Destiny</h1>
                <p className="text-center text-gray-400 mb-8">A Visual Novel Chat Adventure</p>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <Key size={16} /> Gemini API Key
                        </label>
                        <input
                            type="password"
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            placeholder="Enter your Google Gemini API Key"
                            className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white focus:outline-none focus:border-yellow-500 transition"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Your key is stored locally in your browser.
                        </p>
                    </div>

                    <button
                        onClick={handleStart}
                        className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition transform hover:scale-105"
                    >
                        <Play size={20} /> Start Game
                    </button>
                </div>
            </div>
        </div>
    );
}
