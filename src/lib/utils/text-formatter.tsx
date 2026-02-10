import React from 'react';

// Helper to format text (Bold support and Cleaning)
export const formatText = (text: string) => {
    if (!text) return null;
    // [Fix] Filter out Ending Tags (e.g. <GOOD ENDING>, <BAD ENDING>) to prevent leakage
    const cleanText = text.replace(/<[A-Z_]+ ENDING>/g, '').trim();

    const parts = cleanText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-yellow-400 font-extrabold">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};
