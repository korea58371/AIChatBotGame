import { GameUIRegistry } from '@/lib/registry/GameUIRegistry';
import WuxiaHUD from '@/components/visual_novel/ui/WuxiaHUD';

// Register UI Components for Wuxia
console.log("[Wuxia] Registering UI Components...");

GameUIRegistry.register({
    id: 'wuxia',
    components: {
        HUD: WuxiaHUD
    }
});
