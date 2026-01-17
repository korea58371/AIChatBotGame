"use client";

import { useEffect, useState } from "react";

/**
 * PortOne SDK Type Definitions
 * Minimal definition required for implementation
 */
interface RequestPayResponse {
    success: boolean;
    error_code?: string;
    error_msg?: string;
    imp_uid?: string;
    merchant_uid: string;
    paid_amount?: number;
    status?: string;
    // ... other fields as needed
}

interface PortOneParam {
    pg: string; // e.g., 'kakaopay', 'html5_inicis'
    pay_method: string; // 'card', 'trans', 'vbank', 'phone', etc.
    merchant_uid: string; // unique order ID
    name: string; // Product name
    amount: number;
    buyer_email?: string;
    buyer_name?: string;
    buyer_tel?: string;
    buyer_addr?: string;
    buyer_postcode?: string;
    m_redirect_url?: string; // For mobile redirection
}

declare global {
    interface Window {
        IMP?: {
            init: (userCode: string) => void;
            request_pay: (
                params: PortOneParam,
                callback: (rsp: RequestPayResponse) => void
            ) => void;
        };
    }
}

export const usePortOne = () => {
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);

    useEffect(() => {
        // Function to initialize IMP
        const initIMP = () => {
            if (window.IMP && process.env.NEXT_PUBLIC_PORTONE_USER_CODE) {
                window.IMP.init(process.env.NEXT_PUBLIC_PORTONE_USER_CODE);
                setIsSdkLoaded(true);
                return true;
            }
            return false;
        };

        // Check immediately
        if (initIMP()) return;

        // Poll for SDK availability (since it's loaded via lazyOnload in layout)
        const interval = setInterval(() => {
            if (initIMP()) {
                clearInterval(interval);
            }
        }, 500);

        // Stop polling after 10 seconds to avoid memory leaks
        const timeout = setTimeout(() => clearInterval(interval), 10000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);

    const requestPayment = (
        params: Omit<PortOneParam, "merchant_uid"> & { merchant_uid?: string }
    ): Promise<RequestPayResponse> => {
        return new Promise((resolve, reject) => {
            if (!window.IMP) {
                reject(new Error("PortOne SDK failed to load. Please refresh the page."));
                return;
            }

            const userCode = process.env.NEXT_PUBLIC_PORTONE_USER_CODE;
            if (!userCode) {
                reject(new Error("Payment setup error: User Code is missing in environment variables."));
                return;
            }

            // Always re-init before payment to ensure context is correct
            window.IMP.init(userCode);

            // Generate a unique merchant_uid if not provided
            const merchant_uid =
                params.merchant_uid || `mid_${new Date().getTime()}_${Math.random().toString(36).substring(7)}`;

            window.IMP.request_pay(
                {
                    ...params,
                    merchant_uid,
                },
                (rsp) => {
                    if (rsp.success) {
                        resolve(rsp);
                    } else {
                        resolve(rsp);
                    }
                }
            );
        });
    };

    return { isSdkLoaded, requestPayment };
};
