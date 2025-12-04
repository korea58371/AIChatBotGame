'use client';

import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';

export default function Home() {
    const router = useRouter();

    const handleStart = () => {
        router.push('/game');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
                <h1 className="text-4xl font-bold text-center mb-2 text-yellow-500">Hunter's Destiny</h1>
                <p className="text-center text-gray-400 mb-8">A Visual Novel Chat Adventure</p>

                <div className="space-y-6">
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
