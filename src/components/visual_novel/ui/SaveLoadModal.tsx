import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SaveSlot {
    id: number;
    date: string;
    summary: string;
}

interface SaveLoadModalProps {
    isOpen: boolean;
    onClose: () => void;
    saveSlots: SaveSlot[];
    onSave: (id: number) => void;
    onLoad: (id: number) => void;
    onDelete: (id: number) => void;
    t: any; // Translations object
}

const SaveLoadModal: React.FC<SaveLoadModalProps> = ({ isOpen, onClose, saveSlots, onSave, onLoad, onDelete, t }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-gradient-to-b from-[#2a2a2a] via-[#1a1a1a] to-[#0d0d0d] rounded-xl border border-[#333] shadow-2xl p-6 w-full max-w-4xl h-[80vh] flex flex-col relative overflow-hidden"
                    >
                        {/* Decorative Top Line */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
                        <div className="p-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-[#252525]">
                            <h2 className="text-2xl font-bold font-serif text-[#D4AF37] tracking-wider">◆ {t.saveLoad}</h2>
                            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
                        </div>
                        <div className="p-4 md:p-8 grid gap-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            {saveSlots.map((slot) => {
                                const isEmpty = slot.date === 'Empty' || slot.date === 'Error';
                                const isError = slot.date === 'Error';

                                return (
                                    <div key={slot.id} className="bg-[#252525] p-4 rounded-lg border border-white/5 hover:border-[#D4AF37]/50 transition-all duration-300 flex flex-col md:flex-row justify-between items-center gap-4 group shadow-lg">
                                        <div className="w-full">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[#D4AF37] font-serif font-bold text-lg">Slot {slot.id}</span>
                                                {isError && <span className="text-red-500 text-xs font-bold">[ERROR]</span>}
                                            </div>
                                            <div className="text-xs text-gray-500 font-mono mb-1">{isEmpty ? t.emptySlot : slot.date}</div>
                                            <div className={`text-sm italic line-clamp-2 min-h-[2.5em] ${isEmpty ? 'text-gray-600' : 'text-gray-300'}`}>
                                                {slot.summary === 'No summary' ? t.noSummary : slot.summary}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto shrink-0">
                                            <button
                                                onClick={() => onSave(slot.id)}
                                                className="flex-1 md:flex-none px-4 py-2 bg-[#252525] border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#1e1e1e] rounded font-bold transition-all text-sm uppercase tracking-wide"
                                            >
                                                {t.save}
                                            </button>
                                            <button
                                                onClick={() => onLoad(slot.id)}
                                                disabled={isEmpty}
                                                className={`flex-1 md:flex-none px-4 py-2 rounded font-bold transition-all text-sm uppercase tracking-wide ${isEmpty
                                                    ? 'bg-[#1a1a1a] border border-white/5 text-gray-600 cursor-not-allowed'
                                                    : 'bg-[#D4AF37] text-[#1e1e1e] hover:bg-[#b38f2d] hover:shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                                                    }`}
                                            >
                                                {t.load}
                                            </button>
                                            <button
                                                onClick={() => onDelete(slot.id)}
                                                disabled={slot.date === 'Empty'}
                                                className={`flex-1 md:flex-none px-3 py-2 rounded font-bold transition-all text-sm uppercase tracking-wide ${slot.date === 'Empty'
                                                    ? 'bg-[#1a1a1a] border border-white/5 text-gray-700 cursor-not-allowed'
                                                    : 'bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40 hover:text-red-400'
                                                    }`}
                                            >
                                                {t.delete}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SaveLoadModal;
