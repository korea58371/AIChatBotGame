import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SHOP_PRODUCTS, ShopProduct } from '@/data/shop-products';
import { useGameStore } from '@/lib/store';
import { usePortOne } from '@/hooks/usePortOne';
import { createClient } from '@/lib/supabase';
import { X, MessageSquare, Star, Zap, Info, Shield, ShoppingBag, Coins, Lock, Loader2 } from 'lucide-react';
import { useVNAudio } from '@/components/visual_novel/hooks/useVNAudio';
import { isFeatureEnabled, FEATURES } from '@/lib/features'; // [NEW] Feature Flag Import

interface StoreModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function StoreModal({ isOpen, onClose }: StoreModalProps) {
    const { userCoins, setUserCoins, playerStats, setPlayerStats, isGodMode } = useGameStore();
    const { requestPayment, isSdkLoaded } = usePortOne();
    const [processingId, setProcessingId] = useState<string | null>(null);
    // [Fix] Hook for SFX
    const { playSfx } = useVNAudio();

    const activeTabState = useState<'token' | 'fate'>('token');
    const [activeTab, setActiveTab] = activeTabState;

    // [Feature Flag] Check if Fate Shop is enabled
    const showFateShop = isFeatureEnabled(FEATURES.ENABLE_FATE_SHOP);

    const products = SHOP_PRODUCTS.filter(p => {
        if (p.type !== activeTab) return false;
        if (p.type === 'fate' && !showFateShop) return false;
        return true;
    });

    // Filter out Fate products if not in a context where they make sense? 
    // Actually, just show them all.

    const handlePurchase = async (product: ShopProduct) => {


        try {
            setProcessingId(product.id);

            // Save pending payment context for mobile redirection handling
            // Use localStorage instead of sessionStorage to survive browser tab switches/redirects on mobile
            if (typeof window !== 'undefined') {
                localStorage.setItem('pending_payment', JSON.stringify(product));
            }

            // 1. PortOne Payment Request
            const response = await requestPayment({
                pg: "kakaopay",
                pay_method: "card",
                merchant_uid: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: product.name,
                amount: product.price,
                m_redirect_url: typeof window !== 'undefined' ? window.location.href : undefined, // Mobile Redirect URL
            });

            // Clean up if returned immediately (PC/Non-redirect)
            if (typeof window !== 'undefined') {
                localStorage.removeItem('pending_payment');
            }

            // 2. Success Logic
            if (response.success) {
                console.log('Payment Response Success:', response);
                const totalAmount = product.amount + product.bonusAmount;
                console.log('Calculating Reward:', { current: userCoins, add: totalAmount, type: product.type });

                if (product.type === 'token') {
                    // Optimistic Update
                    const newCoins = userCoins + totalAmount;
                    setUserCoins(newCoins); // Update Store

                    try {
                        // [Fix] Use Server Action (Admin) to bypass RLS and ensure security
                        const { addCoins } = await import('@/app/actions/economy');
                        const result = await addCoins(totalAmount);

                        if (!result.success) {
                            throw new Error(result.error);
                        }
                    } catch (dbError: any) {
                        console.error('Failed to sync coins to Supabase:', dbError);
                        alert(`코인은 지급되었으나 서버 저장에 실패했습니다. (새로고침 시 사라질 수 있음)\n오류: ${dbError.message || dbError}`);
                    }
                } else {
                    // [Fix] Server-side Sync for Fate
                    const newFate = (playerStats.fate || 0) + totalAmount;
                    setPlayerStats({ fate: newFate }); // Optimistic Update

                    try {
                        const { addFatePoints } = await import('@/app/actions/economy');
                        const result = await addFatePoints(totalAmount);

                        if (!result.success) {
                            throw new Error(result.error);
                        }
                    } catch (dbError: any) {
                        console.error('Failed to sync fate to Supabase:', dbError);
                        alert(`포인트는 지급되었으나 서버 저장에 실패했습니다.\n오류: ${dbError.message || dbError}`);
                    }
                }

                // Show success alert
                setTimeout(() => {
                    alert(`구매 성공! ${product.name}이(가) 지급되었습니다.\n(총 ${product.type === 'token' ? totalAmount + '코인' : totalAmount + '포인트'})`);
                }, 100);
            } else {
                console.error('Payment Failed Response:', response);
                if (response.error_msg) {
                    alert(`결제 실패: ${response.error_msg}`);
                }
            }

        } catch (error: any) {
            console.error("Payment failed", error);
            // Error handling is done inside usePortOne mostly or here
            if (error.message !== 'Payment cancelled') {
                // alert(`결제 실패: ${error.message}`);
            }
        } finally {
            setProcessingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, y: 10, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.95, y: 10, opacity: 0 }}
                    className="w-full max-w-5xl bg-[#FAFAFA] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modern Header */}
                    <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-100">
                        <div>
                            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                                <ShoppingBag className="w-6 h-6 text-indigo-600" />
                                스토어
                            </h2>
                            <p className="text-sm text-gray-500 font-medium mt-1">
                                당신의 여정을 위한 특별한 제안
                            </p>
                        </div>

                        {/* Balance Display (Pill Style) */}
                        <div className="flex items-center gap-2 bg-gray-50 px-2 py-2 rounded-2xl border border-gray-200">
                            <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl shadow-sm border border-gray-100">
                                <span className="text-amber-500">🪙</span>
                                <div className="flex flex-col items-end leading-none">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Token</span>
                                    <span className="font-bold text-gray-800">{userCoins.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl shadow-sm border border-gray-100">
                                <span className="text-purple-500">✨</span>
                                <div className="flex flex-col items-end leading-none">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Fate</span>
                                    <span className="font-bold text-gray-800">{playerStats.fate?.toLocaleString() || 0}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => { playSfx('ui_click'); onClose(); }}
                            className="p-2 -mr-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                            onMouseEnter={() => playSfx('ui_hover')}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                        {/* Sidebar Navigation */}
                        <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-100 flex flex-row md:flex-col py-4 md:py-6 px-4 gap-2 shadow-sm z-10 shrink-0 overflow-x-auto md:overflow-visible no-scrollbar">
                            <TabButton
                                active={activeTab === 'token'}
                                onClick={() => setActiveTab('token')}
                                icon="🪙"
                                label="스토리 토큰"
                                desc="이야기 진행"
                                colorClass="bg-amber-50 text-amber-900 border-amber-200"
                                onMouseEnter={() => playSfx('ui_hover')}
                            />

                            {showFateShop && (
                                <TabButton
                                    active={activeTab === 'fate'}
                                    onClick={() => setActiveTab('fate')}
                                    icon="✨"
                                    label="운명 포인트"
                                    desc="신적 개입"
                                    colorClass="bg-purple-50 text-purple-900 border-purple-200"
                                    onMouseEnter={() => playSfx('ui_hover')}
                                />
                            )}

                            <div className="mt-auto px-4 py-4 bg-indigo-50 rounded-2xl border border-indigo-100 hidden md:block">
                                <p className="text-xs font-bold text-indigo-900 mb-1">💡 Pro Tip</p>
                                <p className="text-[11px] text-indigo-700 leading-relaxed">
                                    대량 구매 시 보너스 혜택이 적용됩니다. <br />
                                    <strong>모험가 패키지</strong>가 가장 인기가 많습니다!
                                </p>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F8F9FC]">
                            <div className="mb-4 md:mb-6">
                                <h3 className="text-lg font-bold text-gray-900">
                                    {activeTab === 'token' ? '스토리 토큰 충전' : '운명 포인트 충전'}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {activeTab === 'token' ? '이야기를 계속 이어나가기 위해 필요한 재화입니다.' : '결정적인 순간, 운명을 바꾸는 힘입니다.'}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                {products.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        onBuy={() => handlePurchase(product)}
                                        isLoading={processingId === product.id}
                                        isSdkLoaded={isSdkLoaded}
                                        playSfx={playSfx}
                                    />
                                ))}
                            </div>

                            <div className="mt-12 border-t border-gray-200 pt-8 pb-4">
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <h4 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        상품 이용 및 환불 안내
                                    </h4>
                                    <ul className="text-[10px] text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
                                        <li>모든 결제 상품은 구매일로부터 7일 이내에 사용하지 않은 경우에 한해 청약철회(환불)가 가능합니다.</li>
                                        <li>이미 사용하였거나 상품의 가치가 훼손된 경우(패키지 개봉 등) 청약철회가 제한될 수 있습니다.</li>
                                        <li>미성년자가 법정대리인의 동의 없이 구매한 경우, 본인 또는 법정대리인은 결제를 취소할 수 있습니다.</li>
                                        <li>시스템 오류로 인한 미지급 시, 고객센터로 문의주시면 확인 후 즉시 조치해드립니다.</li>
                                        <li>단순 변심으로 인한 환불 시 결제 수수료가 차감될 수 있습니다.</li>
                                    </ul>
                                </div>
                                <p className="text-center text-gray-300 text-[10px] mt-4 flex flex-col gap-0.5">
                                    <span>(주)비챗 엔터테인먼트 | 대표: AI Agent | 사업자등록번호: 123-45-67890</span>
                                    <span>통신판매업신고: 2026-가상세계-0001 | 주소: 디지털 데이터 센터 404호</span>
                                    <span>고객센터: support@bchat.ai | 1588-0000 (평일 09:00 ~ 18:00)</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function TabButton({ active, onClick, icon, label, desc, colorClass, onMouseEnter }: any) {
    return (
        <button
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border ${active
                ? `${colorClass} shadow-sm scale-[1.02]`
                : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
        >
            <div className={`text-xl ${active ? 'scale-110 drop-shadow-sm' : 'opacity-70'} transition-transform`}>
                {icon}
            </div>
            <div>
                <div className="font-bold text-sm leading-tight">{label}</div>
                <div className="text-[11px] opacity-70 font-medium mt-0.5">{desc}</div>
            </div>
        </button>
    );
}

function ProductCard({ product, onBuy, isLoading, isSdkLoaded, playSfx }: { product: ShopProduct, onBuy: () => void, isLoading: boolean, isSdkLoaded: boolean, playSfx: any }) {
    const isPopular = product.tag === 'POPULAR' || product.tag === 'BEST' || product.tag === 'HOT';

    return (
        <motion.div
            whileHover={{ scale: 1.01 }}
            onMouseEnter={() => playSfx('ui_hover')}
            className={`group relative bg-white border rounded-xl px-5 py-3 flex items-center justify-between transition-all duration-200 ${isPopular
                ? 'border-indigo-100 shadow-[0_2px_10px_rgba(79,70,229,0.05)] ring-1 ring-indigo-500/10'
                : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                }`}
        >
            {/* Tag Badge */}


            {/* Icon & Name */}
            {/* Icon & Amount Group */}
            {/* Left: Icon & Info */}
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg
                    ${product.type === 'token' ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-600'}
                `}>
                    {product.icon}
                </div>

                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-gray-900">
                            {product.amount.toLocaleString()}
                            <span className="text-xs font-normal text-gray-500 ml-0.5">
                                {product.type === 'token' ? '개' : 'P'}
                            </span>
                        </span>
                        {product.bonusAmount > 0 && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                +{product.bonusAmount.toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <button
                onClick={() => { playSfx('ui_click'); onBuy(); }}
                disabled={isLoading || !isSdkLoaded}
                className={`w-24 py-2 rounded-lg font-bold text-sm transition-all relative overflow-hidden flex items-center justify-center
                    ${isLoading || !isSdkLoaded
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
                    }
                `}
            >
                {isLoading ? (
                    <Loader2 className="animate-spin w-4 h-4" />
                ) : !isSdkLoaded ? (
                    <Loader2 className="animate-spin w-3 h-3 text-gray-300" />
                ) : (
                    <span>{product.price.toLocaleString()}원</span>
                )}
            </button>
        </motion.div>
    );
}
