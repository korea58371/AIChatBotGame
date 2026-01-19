'use client';

import React, { useState } from 'react';
import { Sidebar, FileText, Download, Ticket, ShieldAlert } from 'lucide-react';
import { generateCouponsAction } from '@/app/actions/admin_coupon';

export default function CouponAdminPage() {
    const [prefix, setPrefix] = useState('TUMBL');
    const [count, setCount] = useState(1);
    const [rewardType, setRewardType] = useState('adventurer');
    const [customJson, setCustomJson] = useState('{"tokens": 100, "fate_points": 0}');
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

    const handleGenerate = async () => {
        if (!confirm(`${count}개의쿠폰을 생성하시겠습니까?`)) return;

        setLoading(true);
        addLog(`Generating ${count} coupons (Prefix: ${prefix})...`);

        try {
            // Determine Rewards
            let rewards = {};
            if (rewardType === 'adventurer') rewards = { tokens: 1500, fate_points: 500 };
            else if (rewardType === 'noble') rewards = { tokens: 6000, fate_points: 2000 };
            else if (rewardType === 'vip') rewards = { tokens: 10000, fate_points: 5000 };
            else if (rewardType === 'custom') {
                try {
                    rewards = JSON.parse(customJson);
                } catch (e) {
                    alert("Invalid JSON");
                    setLoading(false);
                    return;
                }
            }

            // Call Server Action
            const result = await generateCouponsAction({
                prefix: prefix.toUpperCase(),
                count: Number(count),
                type: 'fixed_reward',
                rewards
            });

            if (result.success && result.codes) {
                addLog(`Success! ${result.codes.length} keys generated.`);

                // Create CSV
                const csvContent = "Coupon Code,Type,Rewards\n" +
                    result.codes.map(c => `${c},fixed_reward,"${JSON.stringify(rewards).replace(/"/g, '""')}"`).join("\n");

                // Download
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `coupons_${prefix}_${count}_${Date.now()}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                addLog(`CSV Download initiated.`);
            } else {
                addLog(`Error: ${result.message}`);
                alert(`Error: ${result.message}`);
            }

        } catch (e: any) {
            console.error(e);
            addLog(`Exception: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                        <Ticket className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Coupon Manager</h1>
                        <p className="text-gray-500">Beta Key & Reward Issuance Dashboard</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left: Form */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-gray-400" />
                                Configuration
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Prefix</label>
                                    <input
                                        type="text"
                                        value={prefix}
                                        onChange={e => setPrefix(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
                                        placeholder="e.g. TUMBL, FRIEND"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Quantity</label>
                                    <input
                                        type="number"
                                        value={count}
                                        onChange={e => setCount(Number(e.target.value))}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        min={1}
                                        max={10000}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Reward Tier</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${rewardType === 'adventurer' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                                            <input type="radio" name="tier" checked={rewardType === 'adventurer'} onChange={() => setRewardType('adventurer')} className="accent-indigo-600 w-4 h-4" />
                                            <div>
                                                <div className="font-bold text-indigo-900">Adventurer (Starter)</div>
                                                <div className="text-xs text-indigo-600 font-mono">1,500 Tokens + 500 FP</div>
                                            </div>
                                        </label>

                                        <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${rewardType === 'noble' ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                                            <input type="radio" name="tier" checked={rewardType === 'noble'} onChange={() => setRewardType('noble')} className="accent-purple-600 w-4 h-4" />
                                            <div>
                                                <div className="font-bold text-purple-900">Noble (High Tier)</div>
                                                <div className="text-xs text-purple-600 font-mono">6,000 Tokens + 2,000 FP</div>
                                            </div>
                                        </label>

                                        <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${rewardType === 'vip' ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                                            <input type="radio" name="tier" checked={rewardType === 'vip'} onChange={() => setRewardType('vip')} className="accent-amber-600 w-4 h-4" />
                                            <div>
                                                <div className="font-bold text-amber-900">VIP / Friend</div>
                                                <div className="text-xs text-amber-600 font-mono">10,000 Tokens + 5,000 FP</div>
                                            </div>
                                        </label>

                                        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${rewardType === 'custom' ? 'bg-gray-50 border-gray-300 ring-1 ring-gray-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                                            <input type="radio" name="tier" checked={rewardType === 'custom'} onChange={() => setRewardType('custom')} className="mt-1 accent-gray-600 w-4 h-4" />
                                            <div className="flex-1">
                                                <div className="font-bold text-gray-900 mb-1">Custom JSON</div>
                                                <textarea
                                                    value={customJson}
                                                    onChange={e => setCustomJson(e.target.value)}
                                                    className="w-full text-xs font-mono p-2 border rounded bg-white h-20"
                                                    disabled={rewardType !== 'custom'}
                                                />
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-100">
                                <button
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>Generating...</>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5" />
                                            Generate & Download CSV
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-xs text-gray-400 mt-2">
                                    * CSV file will be downloaded automatically.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Logs / Status */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full flex flex-col">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                                System Logs
                            </h2>
                            <div className="flex-1 bg-gray-900 rounded-xl p-4 font-mono text-xs text-green-400 overflow-y-auto max-h-[500px] shadow-inner">
                                {logs.length === 0 ? (
                                    <span className="text-gray-600 italic">Ready for operation...</span>
                                ) : (
                                    logs.map((log, i) => (
                                        <div key={i} className="mb-1 border-b border-gray-800/50 pb-1 last:border-0">
                                            {log}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                            <div className="flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-bold text-yellow-800 text-sm">Security Warning</div>
                                    <p className="text-xs text-yellow-700 mt-1 leading-relaxed">
                                        This page has public access in Development. Ensure you secure this route before Production deployment or ensure `SUPABASE_SERVICE_ROLE_KEY` is kept secret.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
