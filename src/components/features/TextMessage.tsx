import React from 'react';
import { motion } from 'framer-motion';
import { getCharacterImage } from '@/lib/utils/image-mapper';
import { ChevronLeft, MoreVertical, Phone, Video } from 'lucide-react';

interface TextMessageProps {
    sender: string;
    header: string; // e.g. "지금", "어제", "부재중"
    content: string;
    onClose?: () => void;
}

export default function TextMessage({ sender, header, content, onClose }: TextMessageProps) {
    const avatarUrl = getCharacterImage(sender, 'Default');

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                className="w-full max-w-[580px] h-[950px] bg-white rounded-[4rem] shadow-2xl border-[14px] border-gray-900 overflow-hidden relative flex flex-col font-sans"
            >
                {/* Status Bar (Fake) */}
                <div className="bg-gray-100 h-12 flex items-center justify-between px-8 text-sm font-bold text-gray-800 shrink-0">
                    <span>12:30</span>
                    <div className="flex gap-2">
                        <span>5G</span>
                        <span>100%</span>
                    </div>
                </div>

                {/* Messenger Header */}
                <div className="bg-gray-100 px-8 py-5 border-b border-gray-200 flex items-center justify-between shrink-0">
                    <button onClick={onClose} className="text-blue-500 flex items-center -ml-2">
                        <ChevronLeft size={32} />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-xl text-gray-900">{sender}</span>
                        <span className="text-sm text-gray-500">{header}</span>
                    </div>
                    <div className="flex items-center gap-5 text-blue-500">
                        <Phone size={28} />
                        <Video size={32} />
                    </div>
                </div>

                {/* Message Body */}
                <div className="flex-1 bg-slate-50 overflow-y-auto p-8 flex flex-col gap-8 custom-scrollbar">
                    <div className="text-center text-base text-gray-400 my-2">
                        {header}
                    </div>

                    {/* Received Message */}
                    <div className="flex items-end gap-4">
                        <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-white shadow-sm">
                            {!avatarUrl || avatarUrl.includes("Unknown") ? (
                                <span className="w-full h-full flex items-center justify-center text-3xl">👤</span>
                            ) : (
                                <img src={avatarUrl} alt={sender} className="w-full h-full object-cover" />
                            )}
                        </div>
                        <div className="flex flex-col gap-1 max-w-[75%]">
                            <div className="bg-white p-6 rounded-3xl rounded-tl-none border border-gray-100 shadow-sm text-gray-800 text-2xl leading-relaxed whitespace-pre-wrap">
                                {content}
                            </div>
                        </div>
                        <span className="text-sm text-gray-400 mb-1">12:30</span>
                    </div>
                </div>

                {/* Input Area (Visual Only) */}
                <div className="p-6 bg-white border-t border-gray-100 shrink-0 mb-8">
                    <div className="flex items-center gap-4">
                        <button className="text-gray-400">
                            <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-2xl pb-1">+</div>
                        </button>
                        <div className="flex-1 h-14 bg-gray-100 rounded-full px-6 text-lg flex items-center text-gray-400">
                            iMessage
                        </div>
                        <button className="text-blue-500 font-bold text-lg">
                            Send
                        </button>
                    </div>
                </div>

                {/* Home Indicator */}
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 w-1/3 h-2 bg-gray-900 rounded-full opacity-20"></div>
            </motion.div>
        </div>
    );
}
