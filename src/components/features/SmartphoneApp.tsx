import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Phone, Video, Send } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import { getCharacterImage } from '@/lib/image-mapper';

interface SmartphoneProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SmartphoneApp({ isOpen, onClose }: SmartphoneProps) {
    const { textMessageHistory, characterData } = useGameStore();
    const [activeTab, setActiveTab] = useState<'list' | 'chat'>('list');
    const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

    // Get sorted list of contacts (most recent message first)
    const contacts = Object.keys(textMessageHistory).sort((a, b) => {
        const lastA = textMessageHistory[a][textMessageHistory[a].length - 1].timestamp;
        const lastB = textMessageHistory[b][textMessageHistory[b].length - 1].timestamp;
        return lastB - lastA;
    });

    const handleSelectContact = (partner: string) => {
        setSelectedPartner(partner);
        setActiveTab('chat');
    };

    const handleBack = () => {
        setActiveTab('list');
        setSelectedPartner(null);
    };

    const getPartnerName = (partnerId: string) => {
        const list = Array.isArray(characterData) ? characterData : Object.values(characterData);
        const char = list.find((c: any) => c.englishName === partnerId || c.name === partnerId);
        return char ? char.name : partnerId;
    };

    const getPartnerImage = (partnerId: string) => {
        return getCharacterImage(partnerId, 'Default');
    };

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                className="w-[380px] h-[800px] bg-black rounded-[3rem] border-[8px] border-gray-800 shadow-2xl overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Dynamic Island / Notch */}
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-28 h-7 bg-black rounded-full z-20 flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-900/50"></div>
                </div>

                {/* Status Bar */}
                <div className="h-10 bg-white flex items-center justify-between px-6 pt-2 text-xs font-bold text-gray-900">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="flex gap-1.5">
                        <span>5G</span>
                        <span>100%</span>
                    </div>
                </div>

                {/* App View */}
                <div className="h-[calc(100%-40px)] bg-white flex flex-col relative">

                    {/* LIST VIEW */}
                    <AnimatePresence mode="popLayout">
                        {activeTab === 'list' && (
                            <motion.div
                                initial={{ x: -300, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -300, opacity: 0 }}
                                className="absolute inset-0 flex flex-col bg-white"
                            >
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                    <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                                    <button onClick={onClose}><X size={24} className="text-gray-400" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {contacts.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-gray-400">
                                            No messages yet
                                        </div>
                                    ) : (
                                        contacts.map(partner => {
                                            const msgs = textMessageHistory[partner];
                                            const lastMsg = msgs[msgs.length - 1];
                                            return (
                                                <button
                                                    key={partner}
                                                    onClick={() => handleSelectContact(partner)}
                                                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-gray-50 border-b border-gray-100 transition-colors text-left"
                                                >
                                                    <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-100">
                                                        <img src={getPartnerImage(partner)} alt={partner} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-baseline mb-0.5">
                                                            <span className="font-bold text-gray-900 truncate">{getPartnerName(partner)}</span>
                                                            <span className="text-xs text-gray-400 shrink-0">
                                                                {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-500 text-sm truncate pr-4">
                                                            {lastMsg.content}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* CHAT VIEW */}
                    <AnimatePresence mode="popLayout">
                        {activeTab === 'chat' && selectedPartner && (
                            <motion.div
                                initial={{ x: 300, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 300, opacity: 0 }}
                                className="absolute inset-0 flex flex-col bg-slate-50"
                            >
                                <div className="bg-white/80 backdrop-blur-md px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0 z-10 sticky top-0">
                                    <button onClick={handleBack} className="text-blue-500 flex items-center gap-1 font-medium">
                                        <ChevronLeft size={24} />
                                        <span className="text-lg">Back</span>
                                    </button>
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 mb-1">
                                            <img src={getPartnerImage(selectedPartner)} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-900">{getPartnerName(selectedPartner)}</span>
                                    </div>
                                    <div className="w-16 flex justify-end gap-3 text-blue-500">
                                        <Phone size={20} />
                                        <Video size={24} />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                                    {textMessageHistory[selectedPartner].map((msg, idx) => {
                                        const isMe = msg.sender === '주인공' || msg.sender === 'Me'; // Adjust based on your logic
                                        // Usually AI sends as Character, so msg.sender === selectedPartner
                                        // Unless we allow player to reply (not yet implemented in history save)
                                        return (
                                            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
                                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-base shadow-sm ${isMe
                                                        ? 'bg-blue-500 text-white rounded-br-sm'
                                                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Fake Input */}
                                <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 border border-gray-300">
                                        +
                                    </div>
                                    <div className="flex-1 bg-white border border-gray-300 rounded-full h-9 px-4 text-sm flex items-center text-gray-400">
                                        iMessage
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                        <Send size={16} />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Home Indicator */}
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-1/3 h-1.5 bg-black rounded-full opacity-20"></div>
            </motion.div>
        </div>
    );
}
