import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InventoryItem {
    id: string;
    name: string;
    description: string;
    quantity: number;
}

interface InventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventory: InventoryItem[];
    t: any; // Translations object
}

const InventoryModal: React.FC<InventoryModalProps> = ({ isOpen, onClose, inventory, t }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-gray-900 w-full max-w-2xl h-[60vh] rounded-xl flex flex-col border border-yellow-600">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-xl">
                            <h2 className="text-xl font-bold text-yellow-400">{t.inventory}</h2>
                            <button onClick={onClose} className="text-gray-400 hover:text-white">{t.close}</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4">
                            {inventory.length === 0 ? (
                                <div className="col-span-2 text-center text-gray-500 italic mt-10">{t.empty}</div>
                            ) : (
                                inventory.map((item, idx) => (
                                    <div key={idx} className="bg-gray-800 p-4 rounded border border-gray-600 flex flex-col">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-bold text-white">{item.name}</span>
                                            <span className="text-yellow-500">x{item.quantity}</span>
                                        </div>
                                        <p className="text-sm text-gray-400">{item.description}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default InventoryModal;
