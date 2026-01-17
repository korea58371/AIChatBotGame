import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Globe } from 'lucide-react';

const LANGUAGES = [
    { code: 'ko', label: '한국어', flagUrl: 'https://flagcdn.com/w40/kr.png' },
    { code: 'en', label: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
    { code: 'ja', label: '日本語', flagUrl: 'https://flagcdn.com/w40/jp.png' },
] as const;

interface LanguageSelectorProps {
    direction?: 'up' | 'down'; // 'up' for HUD, 'down' for Title Screen
    className?: string; // Additional classes for positioning
}

export default function LanguageSelector({ direction = 'down', className = '' }: LanguageSelectorProps) {
    const language = useGameStore(state => state.language) || 'ko';
    const setLanguage = useGameStore(state => state.setLanguage);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

    return (
        <div className={`relative z-[200] ${className}`} ref={containerRef}>
            {/* Main Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-12 h-12 flex items-center justify-center bg-gray-800/50 hover:bg-gray-700/80 rounded-full border border-white/10 hover:border-white/30 transition-all backdrop-blur-md group"
                title="Select Language"
            >
                {/* Flag Image */}
                <img
                    src={currentLang.flagUrl}
                    alt={currentLang.label}
                    className="w-6 h-4 object-cover rounded-sm shadow-sm filter brightness-90 group-hover:brightness-110 transition-all"
                />

                {/* Chevron - Conditionally hidden on small button to keep it clean like 'Settings', or kept small */}
                {/* To match standard icon buttons, maybe we just show the flag? Or a tiny chevron overlay? */}
                {/* Let's keep it clean: Just the flag, maybe tiny indicator? */}
                {/* User complained about alignment. A pure circle with centered flag is safest. */}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: direction === 'up' ? 10 : -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: direction === 'up' ? 10 : -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`absolute ${direction === 'up' ? 'bottom-full mb-3' : 'top-full mt-3'} right-0 w-48 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700 overflow-hidden ring-1 ring-black/5 origin-${direction === 'up' ? 'bottom-right' : 'top-right'}`}
                    >
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Globe size={12} /> Language
                            </span>
                        </div>
                        <div className="p-1">
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => {
                                        setLanguage(lang.code as any);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${language === lang.code
                                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={lang.flagUrl}
                                            alt={lang.label}
                                            className="w-5 h-3.5 object-cover rounded-sm shadow-sm opacity-90 group-hover:opacity-100"
                                        />
                                        <span className="text-sm font-medium">{lang.label}</span>
                                    </div>
                                    {language === lang.code && (
                                        <motion.div layoutId="activeCheck">
                                            <Check className="w-4 h-4" />
                                        </motion.div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
