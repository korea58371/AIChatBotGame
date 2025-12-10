import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mic, Video, Volume2 } from 'lucide-react';

interface PhoneCallProps {
    caller: string;
    status: string; // e.g. "통화중 00:15", "연결중..."
    content: string; // The voice/dialogue content
}

export default function PhoneCall({ caller, status, content }: PhoneCallProps) {
    // Pulse animation for the call button or avatar
    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full h-full max-w-md bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-between py-12 px-6"
            >
                {/* Top: Header */}
                <div className="flex flex-col items-center gap-4 mt-8">
                    <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-5xl mb-4 border-2 border-gray-600">
                        👤
                    </div>
                    <h2 className="text-3xl font-light text-white tracking-widest">{caller}</h2>
                    <p className="text-gray-400 text-sm animate-pulse">{status}</p>
                </div>

                {/* Middle: Content Visualizer / Captions */}
                <div className="w-full bg-white/5 rounded-2xl p-6 backdrop-blur-md mb-8">
                    <div className="text-center text-white/90 text-lg leading-relaxed font-serif italic">
                        "{content}"
                    </div>
                </div>

                {/* Bottom: Controls */}
                <div className="grid grid-cols-3 gap-8 mb-12">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-white">
                            <Mic size={24} />
                        </div>
                        <span className="text-xs text-gray-500">음소거</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-white">
                            <Volume2 size={24} />
                        </div>
                        <span className="text-xs text-gray-500">스피커</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-red-500/90 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                            <Phone size={24} className="transform rotate-[135deg]" />
                        </div>
                        <span className="text-xs text-gray-500">종료</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
