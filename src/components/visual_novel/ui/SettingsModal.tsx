import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { createClient } from '@/lib/supabase';
import { deleteAccount } from '@/app/actions/auth';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    t: any;
    session: any;
    onResetGame: () => void;
}

export default function SettingsModal({ isOpen, onClose, t, session, onResetGame }: SettingsModalProps) {
    const supabase = createClient();

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/95 z-[80] flex items-center justify-center p-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-gray-900 w-full max-w-lg rounded-xl flex flex-col border border-gray-600 shadow-2xl overflow-hidden"
                    >
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                            <h2 className="text-2xl font-bold text-white">{(t as any).settings || "Settings"}</h2>
                            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Language Settings */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-gray-300 border-b border-gray-700 pb-2">Language</h3>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => useGameStore.getState().setLanguage('ko')}
                                        className={`flex-1 py-3 rounded-lg font-bold transition-all ${(useGameStore.getState().language || 'ko') === 'ko'
                                            ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                            }`}
                                    >
                                        한국어
                                    </button>
                                    <button
                                        onClick={() => useGameStore.getState().setLanguage('en')}
                                        className={`flex-1 py-3 rounded-lg font-bold transition-all ${useGameStore.getState().language === 'en'
                                            ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                            }`}
                                    >
                                        English
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 text-center">
                                    * 언어 변경 시 UI 텍스트가 즉시 반영됩니다.
                                </p>
                            </div>

                            {/* Account Settings */}
                            <div className="space-y-4 pt-4 border-t border-gray-700">
                                <h3 className="text-lg font-bold text-gray-300 border-b border-gray-700 pb-2">{(t as any).accountInfo || "Account Info"}</h3>
                                <div className="bg-black/40 p-4 rounded-lg border border-gray-700">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-gray-400 text-sm">{(t as any).email || "Email"}</span>
                                        <span className="text-white font-mono">{session?.user?.email || (t as any).guest || "Guest"}</span>
                                    </div>
                                    {session?.user ? (
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={async () => {
                                                    if (confirm((t as any).confirmWithdrawal || "Are you sure you want to delete your account?")) {
                                                        const res = await deleteAccount();
                                                        if (res.success) {
                                                            alert((t as any).withdrawalComplete || "Account deleted.");
                                                            window.location.href = '/login';
                                                        } else {
                                                            alert(`${(t as any).withdrawalError || "Error"}: ${res.error}`);
                                                        }
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-red-900/50 hover:bg-red-900 border border-red-700 rounded text-red-200 text-sm transition-colors"
                                            >
                                                {(t as any).withdrawal || "Withdrawal"}
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    await supabase.auth.signOut();
                                                    window.location.href = '/login';
                                                }}
                                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm transition-colors"
                                            >
                                                {(t as any).logout || "Logout"}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <button
                                                onClick={() => window.location.href = '/login'}
                                                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black text-sm font-bold rounded transition-colors"
                                            >
                                                Login / Sign Up
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Reset Game */}
                            <div className="space-y-4 pt-4 border-t border-gray-700">
                                <h3 className="text-lg font-bold text-red-400 border-b border-gray-700 pb-2">Danger Zone</h3>
                                <p className="text-gray-400 text-sm">
                                    {(t as any).resetConfirm || "Are you sure you want to reset the game? All progress will be lost."}
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                                    >
                                        {(t as any).cancel || "Cancel"}
                                    </button>
                                    <button
                                        onClick={() => {
                                            onResetGame();
                                            onClose();
                                        }}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-bold text-white shadow-lg"
                                    >
                                        {(t as any).resetGame || "Reset Game"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
