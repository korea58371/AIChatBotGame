import { useRef, useEffect } from 'react';
import { useGameStore } from '@/lib/store';

// [Localization]
// [Fix] Module-Level Singleton to prevent orphaned audio on component remounts
let globalAudioInstance: HTMLAudioElement | null = null;

export function useVNAudio(currentBgm: string | null) {
    // We do not need a local ref anymore if we use the singleton
    // But to force re-renders or safety, we can keep using the hook structure.

    useEffect(() => {
        // [Logic] Handle Stop / Null
        if (!currentBgm) {
            if (globalAudioInstance) {
                const oldAudio = globalAudioInstance;
                // Fade out
                const fadeOut = setInterval(() => {
                    if (oldAudio.volume > 0.05) {
                        oldAudio.volume -= 0.05;
                    } else {
                        oldAudio.volume = 0;
                        oldAudio.pause();
                        clearInterval(fadeOut);
                        if (globalAudioInstance === oldAudio) {
                            globalAudioInstance = null;
                        }
                    }
                }, 100);
            }
            return;
        }

        // [Logic] Construct Path
        const bgmPath = currentBgm.startsWith('/') || currentBgm.startsWith('http')
            ? currentBgm
            : `/bgm/${currentBgm}`;

        // [Logic] Check Existing
        if (globalAudioInstance) {
            // Decode URI issues handling
            const currentSrc = decodeURIComponent(globalAudioInstance.src);
            const targetPath = decodeURIComponent(bgmPath);

            // If matches (ends with), ignore
            if (currentSrc.endsWith(targetPath) || currentSrc.includes(targetPath)) {
                return;
            }
        }

        console.log(`[Audio] Switching to: ${bgmPath}`);

        // [Logic] Fade Out Old Global
        if (globalAudioInstance) {
            const oldAudio = globalAudioInstance;
            const interval = 50;
            const volumeStep = 0.05; // Slower fade

            const fadeOut = setInterval(() => {
                if (oldAudio.volume > 0) {
                    oldAudio.volume = Math.max(0, oldAudio.volume - volumeStep);
                } else {
                    clearInterval(fadeOut);
                    oldAudio.pause();
                    oldAudio.src = ""; // Detach
                }
            }, interval);
        }

        // [Logic] Start New
        const newAudio = new Audio(bgmPath);
        newAudio.loop = true;
        newAudio.volume = 0;

        // Update Singleton IMMEDIATELY so any subsequent calls see it
        globalAudioInstance = newAudio;

        const playPromise = newAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.warn("[Audio] Play Failed:", e));
        }

        // Fade In
        const interval = 50;
        const targetVol = 0.3;
        const volumeStep = 0.02; // Smooth fade in

        const fadeIn = setInterval(() => {
            // Check if this audio is still the global instance
            if (globalAudioInstance !== newAudio) {
                clearInterval(fadeIn);
                return;
            }
            if (newAudio.volume < targetVol) {
                newAudio.volume = Math.min(targetVol, newAudio.volume + volumeStep);
            } else {
                clearInterval(fadeIn);
            }
        }, interval);

        return () => {
            // Cleanup on Unmount?
            // If we unmount, we usually Leave the BGM playing (Global BGM).
            // So we DO NOT pause here. 
            // The next component mount will pick it up via singleton check.
        };

    }, [currentBgm]);

    const playSfx = (sfxName: string) => {
        const sfx = new Audio(`/sfx/${sfxName}`);
        sfx.volume = 0.5;
        sfx.play().catch(e => console.warn("SFX play failed:", e));
    };

    return { playSfx };
}
