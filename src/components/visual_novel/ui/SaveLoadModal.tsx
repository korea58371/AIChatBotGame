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
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-gray-900 w-full max-w-2xl rounded-xl flex flex-col border border-blue-500 shadow-2xl overflow-hidden"
                    >
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                            <h2 className="text-2xl font-bold text-blue-400">{t.saveLoad}</h2>
                            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
                        </div>
                        <div className="p-8 grid gap-4">
                            {saveSlots.map((slot) => (
                                <div key={slot.id} className="bg-black/40 p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                                    <div>
                                        <div className="text-lg font-bold text-white mb-1">Slot {slot.id}</div>
                                        <div className="text-sm text-gray-400">{slot.date === 'Empty' ? t.emptySlot : slot.date}</div>
                                        <div className="text-sm text-gray-500 italic line-clamp-2">{slot.summary === 'No summary' ? t.noSummary : slot.summary}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => onSave(slot.id)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold text-white transition-colors"
                                        >
                                            {t.save}
                                        </button>
                                        <button
                                            onClick={() => onLoad(slot.id)}
                                            disabled={slot.date === 'Empty' || slot.date === 'Error'}
                                            className={`px-4 py-2 rounded font-bold text-white transition-colors ${slot.date === 'Empty' || slot.date === 'Error' ? 'bg-gray-700 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                                        >
                                            {t.load}
                                        </button>
                                        <button
                                            onClick={() => onDelete(slot.id)}
                                            disabled={slot.date === 'Empty'}
                                            className={`px-4 py-2 rounded font-bold text-white transition-colors ${slot.date === 'Empty' ? 'bg-gray-700 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                                        >
                                            {t.delete}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SaveLoadModal;
