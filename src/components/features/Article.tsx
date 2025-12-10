import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, MoreHorizontal, MessageCircle, Heart } from 'lucide-react';

interface ArticleProps {
    title: string;
    source: string; // e.g. "Naver News", "Dispatch"
    content: string;
    onClose?: () => void;
}

export default function Article({ title, source, content, onClose }: ArticleProps) {
    return (
        <div
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center font-sans p-4"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full max-w-[580px] h-[950px] bg-white rounded-[4rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()} // Prevent click through to background
            >
                {/* Mobile Browser Header */}
                <div className="bg-white border-b border-gray-200 p-5 flex items-center justify-between sticky top-0 z-10 shrink-0">
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="text-gray-800" size={28} />
                    </button>
                    <div className="font-bold text-gray-900 truncate max-w-[250px] text-lg">{source}</div>
                    <div className="flex gap-5">
                        <Share2 className="text-gray-800" size={28} />
                    </div>
                </div>

                {/* Content Scroll View */}
                <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                    {/* Dummy Ad Space */}
                    <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-gray-400 text-base mb-8 shrink-0">
                        ADVERTISEMENT
                    </div>

                    <div className="px-10 pb-20">
                        <div className="text-lg text-gray-500 mb-3 mt-5">{source} &gt; Entertainment</div>
                        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-8">
                            {title}
                        </h1>

                        <div className="flex items-center gap-4 mb-10 border-b border-gray-100 pb-8">
                            <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                            <div className="text-base text-gray-500">
                                <span className="text-gray-900 font-bold">Editor Park</span> · 2 hours ago
                            </div>
                        </div>

                        {/* Article Body */}
                        <div className="text-gray-800 text-2xl leading-loose whitespace-pre-wrap">
                            {content}
                        </div>

                        {/* Engagement Stats */}
                        <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex gap-8">
                                <div className="flex items-center gap-2 text-gray-500 text-xl">
                                    <Heart size={28} className="text-red-500 fill-current" /> 1.2k
                                </div>
                                <div className="flex items-center gap-2 text-gray-500 text-xl">
                                    <MessageCircle size={28} /> 342
                                </div>
                            </div>
                            <MoreHorizontal size={28} className="text-gray-400" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
