
import { GoogleAICacheManager } from '@google/generative-ai/server';

/**
 * [Server-Side Only] Manage Gemini API Caching
 * This file is separated to avoiding bundling '@google/generative-ai/server' in client builds.
 */
export async function getOrUpdateCache(
    apiKey: string,
    cacheKey: string,
    systemInstruction: string,
    modelName: string
): Promise<string | null> {
    try {
        const cacheManager = new GoogleAICacheManager(apiKey);

        // 1. List Caches
        const listResult = await cacheManager.list();
        // [Fix] Handle API response structure variations (SDK vs REST)
        const caches = (listResult as any).cachedContents || (listResult as any).caches || [];
        const existingCache = caches.find((c: any) => c.displayName === cacheKey);

        if (existingCache) {
            console.log(`[GeminiCache][Server] Found Existing Cache: ${existingCache.name} (Expire: ${existingCache.expireTime})`);

            // 2. Update TTL (Refresh)
            /*
            try {
                // @ts-ignore - API type definition might be missing ttlSeconds
                await cacheManager.update(existingCache.name, {
                    ttlSeconds: 60 * 60 // 1 Hour Refresh
                } as any);
                console.log(`[GeminiCache][Server] Refreshed TTL for: ${existingCache.name}`);
            } catch (updateError) {
                console.warn("[GeminiCache][Server] TTL Refresh failed (non-critical):", updateError);
            }
            */

            return existingCache.name; // Return Resource Name
        }

        // 3. Create New Cache
        console.log(`[GeminiCache][Server] Creating NEW Cache for key: ${cacheKey}...`);
        const newCache = await cacheManager.create({
            model: modelName,
            displayName: cacheKey,
            systemInstruction: {
                parts: [{ text: systemInstruction }],
                role: 'system'
            },
            contents: [], // [Fix] Required property
            ttlSeconds: 60 * 60, // 1 Hour
        } as any);

        console.log(`[GeminiCache][Server] Cache CREATED Success! Name: ${(newCache as any).name}`);
        return (newCache as any).name;

    } catch (error: any) {
        const msg = error.message || '';
        if (msg.includes('too short') || msg.includes('32768')) {
            // Quiet warning for insufficient content
            console.warn(`[GeminiCache][Server] Skipped Caching: Content too short for ${cacheKey}.`);
        } else {
            console.error(`[GeminiCache][Server] Error in getOrUpdateCache:`, error);
        }
        return null;
    }
}
