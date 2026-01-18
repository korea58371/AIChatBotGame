
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Home } from 'lucide-react';
import { useVNAudio } from '../hooks/useVNAudio';

interface TheEndScreenProps {
    onTitle: () => void;
    playerRank?: string;
}

const TheEndScreen: React.FC<TheEndScreenProps> = ({ onTitle, playerRank }) => {
    // [Fix] Hook for SFX
    const { playSfx } = useVNAudio();

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2 }}
                className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black text-white pointer-events-auto"
            >
                <div className="absolute inset-0 z-0 overflow-hidden">
                    {/* Starfield / Particles Effect */}
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute bg-white rounded-full opacity-0"
                            initial={{
                                x: Math.random() * window.innerWidth,
                                y: Math.random() * window.innerHeight,
                                scale: Math.random() * 0.5 + 0.5,
                            }}
                            animate={{
                                opacity: [0, 0.8, 0],
                                scale: [0, 1.5, 0],
                            }}
                            transition={{
                                duration: Math.random() * 3 + 2,
                                repeat: Infinity,
                                delay: Math.random() * 2
                            }}
                            style={{
                                width: Math.random() * 4 + 1,
                                height: Math.random() * 4 + 1
                            }}
                        />
                    ))}
                </div>

                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1, duration: 1.5 }}
                    className="z-10 text-center"
                >
                    <h1 className="text-6xl md:text-8xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 mb-8 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                        The End
                    </h1>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2.5, duration: 1 }}
                        className="text-gray-400 font-light text-lg mb-12 tracking-widest"
                    >
                        - 당신의 이야기는 여기서 끝납니다 -
                    </motion.div>

                    {playerRank && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 3 }}
                            className="mb-12 p-4 border-t border-b border-white/10"
                        >
                            <span className="text-gray-500 text-sm block mb-1">Final Rank</span>
                            <span className="text-2xl font-bold text-yellow-500">{playerRank}</span>
                        </motion.div>
                    )}

                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 4 }}
                        onClick={() => { playSfx('ui_confirm'); onTitle(); }}
                        onMouseEnter={() => playSfx('ui_hover')}
                        className="group flex items-center gap-2 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all hover:scale-105 active:scale-95"
                    >
                        <Home className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                        <span className="text-gray-300 group-hover:text-white transition-colors">메인 화면으로</span>
                    </motion.button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default TheEndScreen;
