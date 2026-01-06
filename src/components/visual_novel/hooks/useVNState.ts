import { useState, useMemo } from 'react';
import { useGameStore } from '@/lib/store';
import { createClient } from '@/lib/supabase';

// [Localization]
// Helper to manage UI state separately from Game Logic
export function useVNState() {
    // Modal/Panel Visibility States
    const [showHistory, setShowHistory] = useState(false);
    const [showInventory, setShowInventory] = useState(false);
    const [showCharacterInfo, setShowCharacterInfo] = useState(false);
    const [showWiki, setShowWiki] = useState(false);
    const [isPhoneOpen, setIsPhoneOpen] = useState(false);
    const [showSaveLoad, setShowSaveLoad] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Feature States
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [wikiTargetCharacter, setWikiTargetCharacter] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [activeProfileTab, setActiveProfileTab] = useState<'basic' | 'martial_arts' | 'relationships'>('basic');

    // Input States
    const [isInputOpen, setIsInputOpen] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [debugInput, setDebugInput] = useState('');
    const [isDebugOpen, setIsDebugOpen] = useState(false);

    // Hydration/Mount State
    const [isMounted, setIsMounted] = useState(false);

    return {
        // Modals
        showHistory, setShowHistory,
        showInventory, setShowInventory,
        showCharacterInfo, setShowCharacterInfo,
        showWiki, setShowWiki,
        isPhoneOpen, setIsPhoneOpen,
        showSaveLoad, setShowSaveLoad,
        showResetConfirm, setShowResetConfirm,

        // Features
        statusMessage, setStatusMessage,
        wikiTargetCharacter, setWikiTargetCharacter,
        isFullscreen, setIsFullscreen,
        activeProfileTab, setActiveProfileTab,

        // Input
        isInputOpen, setIsInputOpen,
        userInput, setUserInput,
        debugInput, setDebugInput,
        isDebugOpen, setIsDebugOpen,

        // Lifecycle
        isMounted, setIsMounted,
    };
}
