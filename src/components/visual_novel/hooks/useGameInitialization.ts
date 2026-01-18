import { useRef, useEffect } from 'react';
import { useGameStore } from '@/lib/store';
import { getExtraCharacterImages } from '@/app/actions/game';

interface UseGameInitializationProps {
    setIsMounted: (isMounted: boolean) => void;
}

export function useGameInitialization({ setIsMounted }: UseGameInitializationProps) {
    useEffect(() => {
        setIsMounted(true);
        // Load Assets
        const loadAssets = async () => {
            // [Dev Check] Only log or run expensive operations on Localhost
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            if (isLocal) console.log("Loading Assets...");
            try {
                const gameId = useGameStore.getState().activeGameId; // Get current game ID
                const extraChars = await getExtraCharacterImages(gameId);
                // if (isLocal) console.log("Loaded Extra Characters:", extraChars);
                useGameStore.getState().setAvailableExtraImages(extraChars);
            } catch (e) {
                console.error("Failed to load extra assets:", e);
                useGameStore.getState().setAvailableExtraImages([]);
            }

            // [Startup Warmup] Preload Cache in Background - DISABLED (Cost Saving)
            // (Functionality removed as per request)
        };
        loadAssets();
    }, []);
}
