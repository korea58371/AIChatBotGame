'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BackgroundLayerProps {
    url: string;
}

export default function BackgroundLayer({ url }: BackgroundLayerProps) {
    if (!url) return null;

    return (
        <div className="absolute inset-0 -z-10 bg-black">
            <AnimatePresence mode="popLayout">
                <motion.div
                    key={url}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.0 }}
                    className="absolute inset-0 w-full h-full"
                >
                    <img
                        src={url}
                        alt="Background"
                        className="w-full h-full object-cover"
                    />
                    {/* Dark Overlay for better text readability */}
                    <div className="absolute inset-0 bg-black/30" />
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
