import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { stopGlobalAudio } from '../hooks/useVNAudio';
import { createClient } from '@/lib/supabase';
import { deleteAccount } from '@/app/actions/auth';
import {
    Zap, Star, Volume2, User, LogOut, AlertTriangle, X,
    Settings as SettingsIcon, Monitor, Music, Cloud, Save
} from 'lucide-react';
import { MODEL_CONFIG } from '@/lib/model-config';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    t: any;
    session: any;
    onResetGame: () => void;
    coins?: number;
}

type TabType = 'sound' | 'ai' | 'account' | 'system';

export default function SettingsModal({ isOpen, onClose, t, session, onResetGame, coins = 0 }: SettingsModalProps) {
    const supabase = createClient();
    const router = useRouter();
    const storyModel = useGameStore(state => state.storyModel);
    const setStoryModel = useGameStore(state => state.setStoryModel);

    // [Fix] Local Session Fallback (If prop is missing/stale)
    const [localSession, setLocalSession] = useState<any>(null);
    const activeSession = session || localSession;

    const [activeTab, setActiveTab] = useState<TabType>('sound');

    useEffect(() => {
        // [Debug] Check what session we have
        if (isOpen) {
            console.log("SettingsModal Open. Prop Session:", !!session, "Active:", !!activeSession?.user);
        }

        if (isOpen && !session) {
            const fetchSession = async () => {
                const { data: { session: fetchedSession } } = await supabase.auth.getSession();
                console.log("SettingsModal Fetched Session:", !!fetchedSession);
                if (fetchedSession) {
                    setLocalSession(fetchedSession);
                }
            };
            fetchSession();
        }
    }, [isOpen, session]);

    // Volume State
    const bgmVolume = useGameStore(state => state.bgmVolume);
    const setBgmVolume = useGameStore(state => state.setBgmVolume);
    const sfxVolume = useGameStore(state => state.sfxVolume);
    const setSfxVolume = useGameStore(state => state.setSfxVolume);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, y: 10, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.95, y: 10, opacity: 0 }}
                    className="w-full max-w-5xl bg-[#FAFAFA] rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh] md:h-[700px] font-sans"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-100 shrink-0">
                        <div>
                            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                                <SettingsIcon className="w-6 h-6 text-indigo-600" />
                                {(t as any).settings || "Settings"}
                            </h2>
                            <p className="text-sm text-gray-500 font-medium mt-1">
                                게임 환경 및 계정 관리
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                        {/* Sidebar Navigation */}
                        <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-100 flex flex-row md:flex-col py-4 md:py-6 px-4 gap-2 shadow-sm z-10 shrink-0 overflow-x-auto md:overflow-visible no-scrollbar">
                            <TabButton
                                active={activeTab === 'sound'}
                                onClick={() => setActiveTab('sound')}
                                icon={<Music className="w-5 h-5" />}
                                label="사운드"
                                desc="Volume"
                                colorClass="bg-pink-50 text-pink-900 border-pink-200"
                            />
                            <TabButton
                                active={activeTab === 'ai'}
                                onClick={() => setActiveTab('ai')}
                                icon={<Monitor className="w-5 h-5" />}
                                label="AI 설정"
                                desc="AI Model"
                                colorClass="bg-blue-50 text-blue-900 border-blue-200"
                            />
                            <TabButton
                                active={activeTab === 'account'}
                                onClick={() => setActiveTab('account')}
                                icon={<User className="w-5 h-5" />}
                                label="계정"
                                desc="Account"
                                colorClass="bg-purple-50 text-purple-900 border-purple-200"
                            />
                            <TabButton
                                active={activeTab === 'system'}
                                onClick={() => setActiveTab('system')}
                                icon={<AlertTriangle className="w-5 h-5" />}
                                label="시스템"
                                desc="System"
                                colorClass="bg-red-50 text-red-900 border-red-200"
                            />
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F8F9FC]">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="h-full"
                                >
                                    {activeTab === 'sound' && (
                                        <div className="space-y-8">
                                            <SectionHeader title={(t as any).sound || "Sound"} desc="배경음악 및 효과음 볼륨을 조절하세요." />
                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                                                <VolumeSlider label="BGM Volume" value={bgmVolume} onChange={setBgmVolume} color="blue" />
                                                <VolumeSlider label="SFX Volume" value={sfxVolume} onChange={setSfxVolume} color="indigo" />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'ai' && (
                                        <div className="space-y-8">
                                            <SectionHeader title="AI Model Settings" desc="스토리 생성에 사용할 AI 모델을 선택하세요." />
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <ModelCard
                                                    selected={storyModel === MODEL_CONFIG.STORY}
                                                    onClick={() => setStoryModel(MODEL_CONFIG.STORY)}
                                                    name="Gemini 3 Flash"
                                                    desc="빠르고 효율적인 기본 모델"
                                                    icon={<Zap className="w-6 h-6" />}
                                                    color="blue"
                                                />
                                                <ModelCard
                                                    selected={storyModel === 'gemini-3-pro-preview'}
                                                    onClick={() => setStoryModel('gemini-3-pro-preview')}
                                                    name="Gemini 3 Pro"
                                                    desc="높은 창의력과 품질"
                                                    icon={<Star className="w-6 h-6" />}
                                                    color="purple"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-400 bg-gray-50 p-4 rounded-xl text-center">
                                                * Pro 모델 사용 시 토큰 소모량이 증가할 수 있습니다.
                                            </p>
                                        </div>
                                    )}

                                    {activeTab === 'account' && (
                                        <div className="space-y-8">
                                            <SectionHeader title={(t as any).accountInfo || "Account Info"} desc="계정 정보를 확인하고 관리합니다." />
                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                                {/* Header & Status */}
                                                <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
                                                    <span className="text-gray-500 text-sm font-bold uppercase tracking-wider">
                                                        {!activeSession?.user ? "Status" : (activeSession.user.is_anonymous ? "Guest ID" : "Email")}
                                                    </span>
                                                    <span className="text-gray-900 font-bold font-mono text-lg">
                                                        {!activeSession?.user
                                                            ? "Not Logged In"
                                                            : (activeSession.user.is_anonymous
                                                                ? `Guest#${activeSession.user.id.slice(0, 8)}`
                                                                : activeSession.user.email)}
                                                    </span>
                                                </div>

                                                {/* Coin Display - Only if Logged In (Guest or User) */}
                                                {activeSession?.user && (
                                                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
                                                        <span className="text-gray-500 text-sm font-bold uppercase tracking-wider">{(t as any).coins || "Coins"}</span>
                                                        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100/50 shadow-sm shrink-0">
                                                            <span className="text-xs">💰</span>
                                                            <span className="font-mono text-lg font-bold">{(coins || 0).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Cloud Save Section */}
                                                {activeSession?.user && (
                                                    <CloudSaveSection />
                                                )}

                                                {/* Action Buttons */}
                                                {!activeSession?.user ? (
                                                    <button
                                                        onClick={() => router.push('/')}
                                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
                                                    >
                                                        Login / Sign Up
                                                    </button>
                                                ) : activeSession.user.is_anonymous ? (
                                                    <div className="flex flex-col gap-3">
                                                        {/* Guest Actions */}
                                                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 mb-2">
                                                            <p className="text-xs text-yellow-700 mb-2 font-medium">
                                                                * 게스트 계정은 브라우저 쿠키 삭제 시 정보가 유실될 수 있습니다. 계정을 연동하여 데이터를 보호하세요.
                                                            </p>
                                                            <button
                                                                onClick={async () => {
                                                                    const { error } = await supabase.auth.signInWithOAuth({
                                                                        provider: 'google',
                                                                        options: {
                                                                            redirectTo: `${window.location.origin}/auth/callback?next=/`,
                                                                            queryParams: {
                                                                                access_type: 'offline',
                                                                                prompt: 'consent',
                                                                            },
                                                                        },
                                                                    });
                                                                    if (error) {
                                                                        console.error("Link Account Error:", error);
                                                                        alert("계정 연동 중 오류가 발생했습니다: " + error.message);
                                                                    }
                                                                }}
                                                                className="w-full py-3 bg-white border border-yellow-200 text-yellow-700 rounded-lg font-bold hover:bg-yellow-100 transition-colors text-sm"
                                                            >
                                                                <div className="flex items-center justify-center gap-2">
                                                                    {/* Chrome icon isn't imported, so just text or use existing icons if available. 
                                                                        Actually, let's keep it simple with text as requested, or add icon if imported.
                                                                        SettingsModal imports: Zap, Star, Volume2, User, LogOut, AlertTriangle, X, Settings, Monitor, Music, Cloud, Save.
                                                                        No Chrome/Google icon. Text is fine.
                                                                    */}
                                                                    <span>계정 연동하기 (구글)</span>
                                                                </div>
                                                            </button>
                                                        </div>

                                                        <button
                                                            onClick={async () => {
                                                                await supabase.auth.signOut();
                                                                router.push('/');
                                                            }}
                                                            className="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-bold transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <LogOut className="w-4 h-4" />
                                                            게스트 종료 (Logout)
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-3">
                                                        {/* User Actions */}
                                                        <button
                                                            onClick={async () => {
                                                                await supabase.auth.signOut();
                                                                router.push('/');
                                                            }}
                                                            className="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-bold transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <LogOut className="w-4 h-4" />
                                                            {(t as any).logout || "Logout"}
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm((t as any).confirmWithdrawal || "정말로 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.")) {
                                                                    try {
                                                                        const { data: { session } } = await supabase.auth.getSession();
                                                                        const token = session?.access_token;

                                                                        const res = await fetch('/api/auth/delete', {
                                                                            method: 'POST',
                                                                            headers: {
                                                                                'Authorization': `Bearer ${token}`
                                                                            }
                                                                        });

                                                                        if (res.ok) {
                                                                            // Wipe Local Data
                                                                            await supabase.auth.signOut();
                                                                            localStorage.clear();
                                                                            // IndexedDB clearing handled by store reset or manual
                                                                            useGameStore.getState().resetGame();

                                                                            router.push('/');
                                                                        } else {
                                                                            const err = await res.json();
                                                                            alert("Failed: " + err.error);
                                                                        }
                                                                    } catch (e) {
                                                                        console.error(e);
                                                                        alert("Error during withdrawal");
                                                                    }
                                                                }
                                                            }}
                                                            className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold transition-colors border border-red-100 text-sm"
                                                        >
                                                            {(t as any).withdrawal || "Withdrawal"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'system' && (
                                        <div className="space-y-8">
                                            <SectionHeader title="System" desc="게임 초기화 및 종료" />

                                            <button
                                                onClick={() => {
                                                    // [Fix] Force Stop Audio + Reset Store State
                                                    stopGlobalAudio();
                                                    useGameStore.getState().setBgm(null);
                                                    router.push('/');
                                                }}
                                                className="w-full py-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl text-gray-700 font-bold flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow-md"
                                            >
                                                <LogOut className="w-5 h-5 text-gray-500" />
                                                <span>{(t as any).exitToTitle || "메인 화면으로 나가기"}</span>
                                            </button>

                                            <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                                                <h4 className="text-red-700 font-bold flex items-center gap-2 mb-2">
                                                    <AlertTriangle className="w-5 h-5" />
                                                    Danger Zone
                                                </h4>
                                                <p className="text-red-600/80 text-sm mb-4">
                                                    {(t as any).resetConfirm || "현재 진행 상황을 모두 초기화합니다."}
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        onResetGame();
                                                        onClose();
                                                    }}
                                                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 transition-all"
                                                >
                                                    {(t as any).resetGame || "Reset Game"}
                                                </button>
                                            </div>

                                            {/* Debug Section */}
                                            <div className="pt-4 border-t border-gray-100">
                                                <button
                                                    onClick={async () => {
                                                        const { data, error } = await supabase.auth.getSession();
                                                        alert(`Session: ${data.session ? 'Found' : 'Missing'}\nError: ${error?.message || 'None'}\nUser: ${data.session?.user?.email}`);
                                                    }}
                                                    className="text-xs text-gray-400 underline hover:text-gray-600"
                                                >
                                                    Debug Session
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence >
    );
}

// Sub-components
function TabButton({ active, onClick, icon, label, desc, colorClass }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border w-full md:w-auto ${active
                ? `${colorClass} shadow-sm scale-[1.02]`
                : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
        >
            <div className={`p-2 rounded-lg ${active ? 'bg-white/50' : 'bg-gray-100'} transition-colors`}>
                {icon}
            </div>
            <div className="hidden md:block">
                <div className="font-bold text-sm leading-tight">{label}</div>
                <div className="text-[11px] opacity-70 font-medium mt-0.5">{desc}</div>
            </div>
        </button>
    );
}

function SectionHeader({ title, desc }: { title: string, desc: string }) {
    return (
        <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{desc}</p>
        </div>
    );
}

function VolumeSlider({ label, value, onChange, color }: any) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-700">{label}</span>
                <span className={`text-${color}-600`}>{Math.round(value * 100)}%</span>
            </div>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className={`w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-${color}-600 hover:accent-${color}-500 transition-colors`}
            />
        </div>
    );
}

function ModelCard({ selected, onClick, name, desc, icon, color }: any) {
    const activeClass = selected
        ? `bg-${color}-50 border-${color}-200 ring-1 ring-${color}-100 shadow-sm`
        : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm';

    return (
        <button
            onClick={onClick}
            className={`flex items-start gap-4 p-5 rounded-2xl border transition-all text-left group ${activeClass}`}
        >
            <div className={`p-3 rounded-xl ${selected ? `bg-${color}-100 text-${color}-600` : 'bg-gray-50 text-gray-400 group-hover:text-gray-600'} transition-colors`}>
                {icon}
            </div>
            <div>
                <div className={`font-bold text-base ${selected ? `text-${color}-900` : 'text-gray-900'}`}>{name}</div>
                <div className="text-xs text-gray-500 mt-1 font-medium">{desc}</div>
            </div>
        </button>
    );
}

function CloudSaveSection() {
    const lastCloudSave = useGameStore(state => state.lastCloudSave);
    const saveToCloud = useGameStore(state => state.saveToCloud);
    const turnCount = useGameStore(state => state.turnCount);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        await saveToCloud();
        setTimeout(() => setIsSyncing(false), 800);
    };

    return (
        <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
            <span className="text-gray-500 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Cloud Save
            </span>
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <div className="text-xs text-gray-400 font-bold mb-0.5">Last Sync</div>
                    <div className="text-sm font-mono text-gray-700">
                        {lastCloudSave ? new Date(lastCloudSave).toLocaleString() : 'Never'}
                    </div>
                </div>
                <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    title="Save Now"
                >
                    {isSyncing ? <Monitor className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
}
