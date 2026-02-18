/**
 * retry.ts
 * 
 * API 호출 재시도 유틸리티.
 * Timeout + Exponential Backoff + Jitter 패턴 적용.
 * 
 * 사용 예시:
 *   const result = await withRetry(() => model.generateContent(prompt), {
 *       maxRetries: 2,
 *       timeoutMs: 30_000,
 *       label: 'Director',
 *   });
 */

export interface RetryOptions {
    /** 최대 재시도 횟수 (기본 2 = 총 3회 시도) */
    maxRetries?: number;
    /** 개별 시도 타임아웃 ms (기본 30초) */
    timeoutMs?: number;
    /** 로그 라벨 (예: 'Director', 'PostLogic') */
    label?: string;
    /** 초기 백오프 ms (기본 1000) */
    initialBackoffMs?: number;
}

/**
 * API 호출을 타임아웃 + 재시도 로직으로 감쌉니다.
 * 
 * - 각 시도마다 AbortSignal.timeout 적용
 * - 실패 시 exponential backoff + jitter 후 재시도
 * - 모든 시도 실패 시 마지막 에러를 throw
 */
export async function withRetry<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 2,
        timeoutMs = 30_000,
        label = 'API',
        initialBackoffMs = 1_000,
    } = options;

    let lastError: Error | unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // AbortSignal.timeout — 지정 시간 후 자동 abort
            const signal = AbortSignal.timeout(timeoutMs);
            const result = await fn(signal);

            if (attempt > 0) {
                console.log(`[Retry] ${label} succeeded on attempt ${attempt + 1}/${maxRetries + 1}`);
            }

            return result;
        } catch (e: any) {
            lastError = e;
            const isTimeout = e?.name === 'TimeoutError' || e?.name === 'AbortError'
                || e?.message?.includes('timeout') || e?.message?.includes('Timeout');
            const errorType = isTimeout ? 'TIMEOUT' : 'ERROR';

            console.warn(
                `[Retry] ${label} attempt ${attempt + 1}/${maxRetries + 1} ${errorType}: ${e?.message || e}`
            );

            if (attempt < maxRetries) {
                // Exponential backoff + jitter (±25%)
                const baseDelay = initialBackoffMs * Math.pow(2, attempt);
                const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1); // ±25%
                const delay = Math.round(baseDelay + jitter);

                console.log(`[Retry] ${label} retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}
