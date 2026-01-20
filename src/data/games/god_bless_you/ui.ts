import { GameUIRegistry } from '@/lib/registry/GameUIRegistry';
import ModernHUD from '@/components/visual_novel/ui/ModernHUD';

// Register UI Components for God Bless You
console.log("[GodBlessYou] Registering UI Components...");

GameUIRegistry.register({
    id: 'god_bless_you',
    components: {
        HUD: ModernHUD
    }
});
