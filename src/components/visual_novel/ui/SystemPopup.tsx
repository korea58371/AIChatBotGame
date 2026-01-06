import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SystemPopupProps {
    isOpen: boolean;
    content: string;
    onAdvance: () => void;
}

const SystemPopup: React.FC<SystemPopupProps> = ({ isOpen, content, onAdvance }) => {
    // Helper to format text with bolding
    const formatText = (text: string) => {
        if (!text) return "";
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={idx} className="text-yellow-400">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex items-center justify-center z-[70] bg-black/60 backdrop-blur-sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAdvance();
                    }}
                >
                    <div className="bg-gradient-to-b from-gray-900 to-black border-2 border-yellow-500 rounded-lg p-8 max-w-4xl w-full shadow-[0_0_50px_rgba(234,179,8,0.3)] text-center relative overflow-hidden">
                        {/* Decorative Elements */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />

                        <h2 className="text-2xl font-bold text-yellow-400 mb-6 tracking-widest uppercase border-b border-gray-700 pb-4">
                            SYSTEM NOTIFICATION
                        </h2>

                        <div className="text-xl text-white leading-relaxed font-medium whitespace-pre-wrap">
                            {formatText(content)}
                        </div>

                        <div className="mt-8 text-sm text-gray-500 animate-pulse">
                            Click to continue
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SystemPopup;
