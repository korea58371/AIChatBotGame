const ENV = process.env.NEXT_PUBLIC_APP_ENV || 'development';

export const FEATURES = {
    // [Example] NEW_STORE_UI: 'new_store_ui',
    // [Example] BETA_NARRATIVE: 'beta_narrative',
    TEST_FEATURE: 'test_feature',
    ENABLE_FATE_SHOP: 'enable_fate_shop', // [NEW] Control Fate Points purchase availability
} as const;

export type FeatureKey = typeof FEATURES[keyof typeof FEATURES];

/**
 * Checks if a feature is enabled in the current environment.
 * Order of precedence:
 * 1. LocalStorage Override (Dev/Admin usage in Prod)
 * 2. Environment Defaults
 */
export function isFeatureEnabled(key: FeatureKey): boolean {
    // 1. Force enable/disable via LocalStorage (Dev Override)
    // Format: "feat:feature_key" = "true" | "false"
    if (typeof window !== 'undefined') {
        const override = window.localStorage.getItem(`feat:${key}`);
        if (override === 'true') return true;
        if (override === 'false') return false;
    }

    // 2. Environment-based defaults
    switch (ENV) {
        case 'development':
            return true; // All features ON in dev by default
        case 'staging':
            return true; // All features ON in staging/preview
        case 'production':
            return false; // Features OFF by default in prod
        default:
            return false;
    }
}

/**
 * [Dev Tool] Toggles a feature flag locally.
 * Usable in Browser Console: `import { toggleFeature } from ...; toggleFeature('...', true)`
 * Or expose via window.
 */
export function toggleFeature(key: FeatureKey, value: boolean) {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(`feat:${key}`, String(value));
        console.log(`[FeatureFlag] ${key} set to ${value}. Reload to apply.`);
    }
}

// Expose to window for easy console access in Production
if (typeof window !== 'undefined') {
    (window as any).__toggleFeature = toggleFeature;
}
