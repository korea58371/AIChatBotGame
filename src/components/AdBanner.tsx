"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
    /**
     * Google AdSense Slot ID (광고 단위 ID)
     * 애드센스 대시보드에서 생성한 광고 단위의 ID를 입력하세요.
     */
    dataAdSlot: string;
    format?: "auto" | "fluid" | "rectangle";
    responsive?: boolean;
    style?: React.CSSProperties;
    className?: string;
}

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

export const AdBanner = ({
    dataAdSlot,
    format = "auto",
    responsive = true,
    style,
    className,
}: AdBannerProps) => {
    const adRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // [Fix] 개발 모드에서는 Placeholder가 렌더링되므로 AdSense 요청을 보내지 않음
        // 이를 막지 않으면 "All 'ins' elements... already have ads" 에러가 발생함
        if (process.env.NODE_ENV === 'development') return;

        try {
            if (typeof window !== "undefined") {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            }
        } catch (e) {
            console.error("AdSense Error:", e);
        }
    }, []);

    // 개발 환경에서는 플레이스홀더를 보여줘서 레이아웃을 확인하기 쉽게 함
    if (process.env.NODE_ENV === 'development') {
        return (
            <div
                className={`bg-[#1a1a1a] border border-[#333] rounded-lg flex flex-col items-center justify-center text-[#666] p-4 relative overflow-hidden ${className}`}
                style={{ width: '100%', minHeight: '100px', ...style }}
            >
                {/* Diagonal Stripes Pattern */}
                <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 50%, #000 50%, #000 75%, transparent 75%, transparent)',
                        backgroundSize: '20px 20px'
                    }}
                />

                <div className="z-10 flex flex-col items-center gap-1">
                    <span className="text-2xl opacity-50">📢</span>
                    <span className="font-bold text-xs uppercase tracking-widest">Google AdSense Area</span>
                    <span className="font-mono text-[10px] bg-black/50 px-2 py-0.5 rounded text-[#444]">
                        DEV MODE • SLOT: {dataAdSlot}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className={className} ref={adRef}>
            <ins
                className="adsbygoogle"
                style={{ display: "block", ...style }}
                data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
                data-ad-slot={dataAdSlot}
                data-ad-format={format}
                data-full-width-responsive={responsive ? "true" : "false"}
            />
        </div>
    );
};
