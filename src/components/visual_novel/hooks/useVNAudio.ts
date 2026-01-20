import { useRef, useEffect } from 'react';
import { useGameStore } from '@/lib/store';

// [Localization]
// [Fix] Module-Level Singleton to prevent orphaned audio on component remounts
let globalAudioInstance: HTMLAudioElement | null = null;

export function useVNAudio(currentBgm?: string | null) {
    const bgmVolume = useGameStore(state => state.bgmVolume);
    const sfxVolume = useGameStore(state => state.sfxVolume);

    // [New] Dynamic Volume Update Effect
    useEffect(() => {
        if (globalAudioInstance) {
            globalAudioInstance.volume = bgmVolume;
        }
    }, [bgmVolume]);

    useEffect(() => {
        // [Logic] SFX-Only Mode (undefined) -> Do nothing to BGM
        if (currentBgm === undefined) return;

        // [Logic] Handle Stop / Null
        if (currentBgm === null) {
            if (globalAudioInstance) {
                const oldAudio = globalAudioInstance;
                // Fade out
                const fadeOut = setInterval(() => {
                    if (oldAudio.volume > 0.05) {
                        oldAudio.volume = Math.max(0, oldAudio.volume - 0.05);
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
                // [Fix] Ensure volume is correct if we are just re-verifying
                if (Math.abs(globalAudioInstance.volume - bgmVolume) > 0.01) {
                    globalAudioInstance.volume = bgmVolume;
                }
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
        const volumeStep = 0.02; // Smooth fade in

        const fadeIn = setInterval(() => {
            // Check if this audio is still the global instance
            if (globalAudioInstance !== newAudio) {
                clearInterval(fadeIn);
                return;
            }

            // [Fix] Fetch fresh target volume from store state to support live adjustment
            const currentTargetVol = useGameStore.getState().bgmVolume;

            if (newAudio.volume < currentTargetVol) {
                newAudio.volume = Math.min(currentTargetVol, newAudio.volume + volumeStep);
            } else {
                // If we reached target (or target dropped below current because user lowered it), we stop fading
                newAudio.volume = currentTargetVol;
                clearInterval(fadeIn);
            }
        }, interval);

        return () => {
            // Cleanup on Unmount?
            // If we unmount, we usually Leave the BGM playing (Global BGM).
            // So we DO NOT pause here. 
            // The next component mount will pick it up via singleton check.
        };

    }, [currentBgm]); // Note: We do NOT rely on bgmVolume in dependency here to avoid restarting track on volume change

    const playSfx = (sfxName: string) => {
        // [Logic] Auto-append extension if missing
        const filename = sfxName.includes('.') ? sfxName : `${sfxName}.mp3`;
        const sfx = new Audio(`/sfx/${filename}`);

        // [Fix] Use current SFX volume
        sfx.volume = useGameStore.getState().sfxVolume;

        // [Fix] Reset time if reusing (though we create new instance here)
        sfx.currentTime = 0;

        sfx.play().catch(e => {
            // Ignore AbortError (common if spamming clicks)
            // Ignore NotAllowedError (browser autoplay policy before interaction)
            if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                console.warn(`SFX play failed for ${filename}:`, e);
            }
        });
    };

    return { playSfx };
}

// [Global Access]
// Used by SettingsModal to force-stop audio when exiting to Title
export function stopGlobalAudio() {
    if (globalAudioInstance) {
        console.log("[Audio] Force stopping global audio.");
        // Immediate fade out logic or hard stop?
        // Hard stop is safer to prevent lingering audio on TitleScreen
        const oldAudio = globalAudioInstance;

        // Fast Fade (prevent pop)
        const fadeOut = setInterval(() => {
            if (oldAudio.volume > 0.05) {
                oldAudio.volume = Math.max(0, oldAudio.volume - 0.1);
            } else {
                oldAudio.volume = 0;
                oldAudio.pause();
                oldAudio.src = ""; // Detach
                clearInterval(fadeOut);
            }
        }, 30);

        globalAudioInstance = null;
    }
}
