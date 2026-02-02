import characters_enemy from './characters_enemy.json';
import characters_main from './characters_main.json';
import characters_supporting from './characters_supporting.json';

// --- Type Definitions ---
export interface SystemLogic {
    tags: string[];
    is_enemy?: boolean; // Added is_enemy flag
}

export interface CharacterData {
    title: string;
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
export const characters_enemy_typed = characters_enemy as unknown as Record<string, CharacterData>;

export {
    characters_enemy,
    characters_main,
    characters_supporting
};

