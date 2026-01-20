import React from 'react';

/**
 * [Game UI Registry]
 * Client-Side Registry for React Components (HUD, etc).
 * Separated from GameRegistry to avoid "Server Component importing Client Component" errors.
 */

export interface GameUIConfig {
    id: string;
    components: {
        HUD?: React.ComponentType<any>;
        // Add more dynamic UI components here (e.g. Inventory, StatusScreen)
    };
}

class GameUIRegistryImpl {
    private uiConfigs: Map<string, GameUIConfig> = new Map();

    register(config: GameUIConfig) {
        // Allow overwriting/merging if needed, or just set
        this.uiConfigs.set(config.id, config);
        console.log(`[GameUIRegistry] Registered UI for game: ${config.id}`);
    }

    getHUD(id: string): React.ComponentType<any> | undefined {
        return this.uiConfigs.get(id)?.components.HUD;
    }

    get(id: string): GameUIConfig | undefined {
        return this.uiConfigs.get(id);
    }
}

export const GameUIRegistry = new GameUIRegistryImpl();
