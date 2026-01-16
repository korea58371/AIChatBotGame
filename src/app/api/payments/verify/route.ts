import { NextRequest, NextResponse } from "next/server";

// 1인 개발 시 유지보수를 위해:
// 실제 프로덕션에서는 DB에 저장된 '주문 상품의 가격'을 조회해서 비교해야 합니다.
// 지금은 클라이언트가 보낸 amount와 실제 결제된 amount를 비교하는 최소한의 검증만 구현합니다.
// 보안 강화 시: DB에서 merchant_uid로 주문을 조회하여 가격을 가져오세요.

export async function POST(req: NextRequest) {
    try {
        const { imp_uid, merchant_uid, expectedAmount } = await req.json();

        // 1. 포트원 API 액세스 토큰 발급
        const tokenResponse = await fetch("https://api.iamport.kr/users/getToken", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                imp_key: process.env.PORTONE_API_KEY,
                imp_secret: process.env.PORTONE_API_SECRET,
            }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.code !== 0) {
            throw new Error(`Token Error: ${tokenData.message}`);
        }
        const { access_token } = tokenData.response;

        // 2. imp_uid로 결제 정보 단건 조회
        const paymentResponse = await fetch(
            `https://api.iamport.kr/payments/${imp_uid}`,
            {
                headers: { Authorization: access_token },
            }
        );

        const paymentData = await paymentResponse.json();
        if (paymentData.code !== 0) {
            throw new Error(`Payment Lookup Error: ${paymentData.message}`);
        }

        const { amount, status } = paymentData.response;

        // 3. 검증 로직
        // 결제 상태가 'paid'인지 확인
        if (status !== "paid") {
            return NextResponse.json({ success: false, message: "Payment status is not paid." }, { status: 400 });
        }

        // 요청된 금액과 실제 결제 금액 일치 여부 확인
        // 주의: Javascript 숫자 부동소수점 오차 가능성 고려 (지금은 정수형 단순 비교)
        if (amount !== expectedAmount) {
            // 위변조 의심
            console.error(`[Payment Fraud Warning] Expected: ${expectedAmount}, Actual: ${amount}, MerchantUID: ${merchant_uid}`);
            return NextResponse.json({ success: false, message: "Amount mismatch. Possible forgery." }, { status: 400 });
        }

        // 4. 검증 성공: 여기에 DB 업데이트 로직 (포인트 지급, 아이템 지급 등)을 추가하면 됩니다.
        // await db.users.updatePoints(...) 

        return NextResponse.json({ success: true, verified: true });

    } catch (error: any) {
        console.error("Payment Verification Failed:", error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
