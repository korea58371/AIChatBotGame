import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getCharacterImage } from '@/lib/utils/image-mapper';
import { resolveBackground } from '@/lib/engine/background-manager';

interface TVNewsProps {
    anchor: string;
    background?: string; // Background key
    content: string;
}

export default function TVNews({ anchor, background, content }: TVNewsProps) {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Resolve Images
    const anchorImage = getCharacterImage(anchor, 'Default');
    const bgUrl = background ? resolveBackground(background) : null;

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-black/80 font-sans relative overflow-hidden">
            {/* TV Screen Container */}
            <style>{`
                .tv-news-container {
                    aspect-ratio: 16/9;
                }
                @media (orientation: portrait) {
                    .tv-news-container {
                        aspect-ratio: 1/1;
                    }
                }
            `}</style>
            <div className="tv-news-container relative w-[98%] max-w-[90vw] bg-black border-[16px] border-gray-900 rounded-lg shadow-2xl overflow-hidden">

                {/* Background Layer */}
                {bgUrl ? (
                    <img
                        src={bgUrl}
                        alt="News Background"
                        className="absolute inset-0 w-full h-full object-cover opacity-70"
                    />
                ) : (
                    <div className="absolute inset-0 w-full h-full bg-slate-800 flex items-center justify-center">
                        <span className="text-white text-opacity-10 text-9xl font-bold tracking-widest animate-pulse">BREAKING NEWS</span>
                    </div>
                )}

                {/* Character Layer (Anchor/Interviewee) */}
                {anchorImage && !anchorImage.includes("Unknown") && (
                    <motion.img
                        key={anchor}
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        src={anchorImage}
                        alt={anchor}
                        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-[80%] object-contain z-10 drop-shadow-2xl"
                    />
                )}

                {/* Scanlines Effect */}
                <div className="absolute inset-0 pointer-events-none z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] bg-repeat"></div>

                {/* UI Overlays */}
                <div className="absolute inset-0 z-30 flex flex-col justify-between p-8">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                        <div className="bg-red-600 text-white px-4 py-1 font-bold animate-pulse text-lg shadow-lg uppercase tracking-wider">
                            LIVE REPORT
                        </div>
                        <div className="flex flex-col items-end text-white drop-shadow-md font-mono">
                            <div className="text-xl font-bold text-yellow-400">YTN NEWS</div>
                            <div className="text-sm opacity-80">{currentTime.toLocaleTimeString()}</div>
                        </div>
                    </div>

                    {/* Lower Thirds (Caption) */}
                    <div className="mt-auto relative top-6">
                        <div className="bg-yellow-500 text-black px-4 py-1 inline-block font-bold text-sm mb-0 shadow-lg transform -skew-x-12 translate-x-4">
                            BREAKING NEWS
                        </div>
                        <div className="bg-blue-900/90 backdrop-blur-md border-t-4 border-yellow-500 text-white p-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-20">
                                <div className="w-16 h-16 rounded-full border-4 border-white"></div>
                            </div>
                            <h2 className="text-lg font-bold text-yellow-300 mb-1 flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                                {anchor}
                            </h2>
                            <p className="text-2xl font-bold leading-relaxed whitespace-pre-wrap drop-shadow-lg">
                                "{content}"
                            </p>
                        </div>
                        {/* Scrolling Ticker */}
                        <div className="bg-black text-white py-2 overflow-hidden whitespace-nowrap border-t border-gray-700 mt-0">
                            <motion.div
                                className="inline-block text-sm font-mono tracking-wide text-yellow-400"
                                animate={{ x: ["100%", "-100%"] }}
                                transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                            >
                                [속보] 서울 상공에 미확인 비행물체 출현... 시민 대피령 발령  |  올림푸스 길드 주가 5% 급락  |  정부, "블레서 특별법" 입법 예고  |  [날씨] 내일 전국적으로 마나 비 예상...
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
