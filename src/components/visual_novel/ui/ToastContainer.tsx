'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Toast {
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
}

interface ToastContainerProps {
    toasts: Toast[];
}

const ToastContainer = React.memo(function ToastContainer({ toasts }: ToastContainerProps) {
    return (
        <div className="fixed top-24 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className={`px-6 py-3 rounded-lg shadow-lg backdrop-blur-md border-l-4 text-white font-bold min-w-[200px]
                        ${toast.type === 'success' ? 'bg-green-900/80 border-green-500' :
                                toast.type === 'warning' ? 'bg-red-900/80 border-red-500' :
                                    'bg-blue-900/80 border-blue-500'}`}
                    >
                        {toast.message}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
});

export default ToastContainer;
