import characters_extra from './characters_extra.json';
import characters_main from './characters_main.json';
import characters_supporting from './characters_supporting.json';

// --- Type Definitions ---
export interface SystemLogic {
    base_weight: number;
    lifecycle: {
        start: number;
        peak: number;
        end: number;
    };
    region: {
        home: string;
        active_zones: string[];
    };
    tags: string[];
}

export interface CharacterData {
    title: string;
    appearance_phase: number;
    system_logic?: SystemLogic; // Added optional system_logic
    profile: any;
    personality: any;
    social?: any;
    강함?: any;
    외형?: any;
    secret?: any;
    인간관계?: Record<string, string>;
    preferences?: any;
    활동지역?: string;
}

export const characters_main_typed = characters_main as Record<string, CharacterData>;
export const characters_supporting_typed = characters_supporting as Record<string, CharacterData>;
export const characters_extra_typed = characters_extra as unknown as Record<string, CharacterData>;

export {
    characters_extra,
    characters_main,
    characters_supporting
};

