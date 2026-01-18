
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull, Crown, RotateCcw, Home, BookOpen, ArrowRight } from 'lucide-react';
import { useVNAudio } from '../hooks/useVNAudio';

interface EndingModalProps {
    type: 'none' | 'bad' | 'good' | 'true';
    onRewind: () => void;
    onTitle: () => void;
    onEpilogue?: () => void;
    onContinue?: () => void;
}

const Button: React.FC<{
    className?: string,
    variant?: 'ghost' | 'default',
    onClick?: () => void,
    onMouseEnter?: () => void,
    children: React.ReactNode
}> = ({ className, variant, onClick, onMouseEnter, children }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onClick && onClick();
        }}
        onMouseEnter={onMouseEnter}
        className={`px-4 py-2 rounded-lg font-medium transition-all active:scale-95 ${className} ${variant === 'ghost' ? '' : ''}`}
    >
        {children}
    </button>
);

const EndingModal: React.FC<EndingModalProps> = ({ type, onRewind, onTitle, onEpilogue, onContinue }) => {
    // [Fix] Hook for SFX
    const { playSfx } = useVNAudio();

    if (type === 'none') return null;

    const isBad = type === 'bad';
    const isTrue = type === 'true';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className={`w-full max-w-2xl p-1 rounded-2xl bg-gradient-to-b ${isBad ? 'from-red-900/50 to-black' : isTrue ? 'from-purple-600/50 to-black' : 'from-yellow-600/50 to-black'}`}
                >
                    <div className="bg-black/80 rounded-xl p-8 text-center border border-white/10 shadow-2xl relative overflow-hidden">

                        {/* Background Effect */}
                        <div className={`absolute inset-0 opacity-10 ${isBad ? 'bg-red-500' : 'bg-yellow-500'} blur-3xl`} />

                        <div className="relative z-10 flex flex-col items-center">
                            {isBad ? (
                                <Skull className="w-24 h-24 text-red-500 mb-6 animate-pulse" />
                            ) : (
                                <Crown className={`w-24 h-24 mb-6 ${isTrue ? 'text-purple-400' : 'text-yellow-400'} animate-bounce`} />
                            )}

                            <h2 className={`text-4xl font-extrabold mb-2 ${isBad ? 'text-red-500' : isTrue ? 'text-purple-400' : 'text-yellow-400'}`}>
                                {isBad ? '나 락 (Abyss)' : isTrue ? '진 엔 딩 (True Ending)' : '대 단 원 (Finale)'}
                            </h2>

                            <p className="text-gray-300 text-lg mb-8 leading-relaxed max-w-md">
                                {isBad
                                    ? "당신의 여정이 비극으로 끝났습니다. 운명을 거스르시겠습니까?"
                                    : "길고 긴 여정 끝에 목표를 달성했습니다. 당신의 이름은 강호에 영원히 기억될 것입니다."}
                            </p>

                            <div className="grid grid-cols-1 gap-4 w-full max-w-md">
                                {isBad ? (
                                    <>
                                        <Button
                                            onClick={() => { playSfx('ui_click'); onRewind(); }}
                                            onMouseEnter={() => playSfx('ui_hover')}
                                            className="w-full h-14 text-lg bg-red-900/40 hover:bg-red-800/60 border border-red-500/50 text-red-100 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                                        >
                                            <RotateCcw className="w-5 h-5" />
                                            운명 역행 (직전 선택지로)
                                        </Button>
                                        <Button
                                            onClick={() => { playSfx('ui_click'); onTitle(); }}
                                            onMouseEnter={() => playSfx('ui_hover')}
                                            variant="ghost"
                                            className="w-full text-gray-400 hover:text-white"
                                        >
                                            <Home className="w-4 h-4 mr-2" />
                                            메인 화면으로
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        {onEpilogue && (
                                            <Button
                                                onClick={() => { playSfx('ui_confirm'); onEpilogue(); }}
                                                onMouseEnter={() => playSfx('ui_hover')}
                                                className={`w-full h-14 text-lg font-bold flex items-center justify-center gap-2
                                                    ${isTrue ? 'bg-purple-600 hover:bg-purple-500' : 'bg-yellow-600 hover:bg-yellow-500'} text-white shadow-lg`}
                                            >
                                                <BookOpen className="w-5 h-5" />
                                                에필로그 및 후일담 보기
                                            </Button>
                                        )}
                                        {onContinue && (
                                            <Button
                                                onClick={() => { playSfx('ui_confirm'); onContinue(); }}
                                                onMouseEnter={() => playSfx('ui_hover')}
                                                className="w-full h-12 text-md bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 flex items-center justify-center gap-2"
                                            >
                                                <ArrowRight className="w-5 h-5" />
                                                여정 계속하기 (샌드박스)
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => { playSfx('ui_click'); onTitle(); }}
                                            onMouseEnter={() => playSfx('ui_hover')}
                                            variant="ghost"
                                            className="w-full text-gray-400 hover:text-white mt-2"
                                        >
                                            <Home className="w-4 h-4 mr-2" />
                                            명예롭게 은퇴 (메인으로)
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default EndingModal;
