
export interface GameEvent {
    id: string;
    condition: (state: any) => boolean;
    priority: number;
    prompt: string;
    type: 'narrative' | 'system';
    once: boolean;
}

export const GAME_EVENTS: GameEvent[] = [
    {
        id: 'wuxia_intro',
        priority: 100,
        type: 'narrative',
        once: true,
        condition: (state) => state.turnCount === 0,
        prompt: `
        ## [EVENT: 강호출두]
        주인공은 이제 막 강호에 발을 디딘 삼류 무인이다.
        객잔에 앉아 주위를 둘러보는 장면으로 시작하라.
        `
    }
];
