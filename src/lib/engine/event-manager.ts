
export interface GameEvent {
    id: string;
    // MAIN: 필수 진행 (조건 만족 시 즉시 발동)
    // SUB: 선택적 진행 (퀘스트)
    // RANDOM: 확률적 조우 (패러디, 일상)
    // CHAIN: 연계 이벤트 (이전 단계 완료 필요)
    type: 'MAIN' | 'SUB' | 'RANDOM' | 'CHAIN';

    chain_id?: string; // 연계 이벤트 그룹 ID
    next_event_id?: string; // 다음으로 이어질 이벤트 ID

    // 조건 검사 함수
    condition: (state: any) => boolean;

    priority: number; // 1(최우선) ~ 100(낮음), 같은 타입 내 정렬용
    probability?: number; // 0.0 ~ 1.0 (RANDOM 타입용 등장 확률)

    cooldown?: number; // 재발동 대기 턴 (0이면 1회성 혹은 즉시 반복 가능)
    once?: boolean; // true면 영구적으로 1회만 발동 (triggeredEvents에 기록됨)

    name: string; // UI / 디버그용 이름
    prompt: string; // AI에게 주입될 시스템 프롬프트 (서술 지침)
}

export class EventManager {
    /**
     * 현재 상태에서 가능한 모든 이벤트를 스캔하여 분류합니다.
     * @param events 전체 이벤트 리스트
     * @param state 현재 게임 상태
     */
    static scan(events: GameEvent[], state: any) {
        const mandatory: GameEvent[] = [];
        const randomCandidates: GameEvent[] = [];
        const triggered = state.triggeredEvents || [];

        for (const event of events) {
            // 1. 1회성 이벤트 체크
            if (event.once && triggered.includes(event.id)) {
                continue;
            }

            // 2. 쿨타임 체크 (TODO: state에 쿨타임 기록이 있다면 체크)
            // 지금은 단순화를 위해 생략하거나, 추후 확장

            // 3. 조건 검사 fail이면 스킵
            try {
                if (typeof event.condition !== 'function') {
                    // [Safety] Serialized events might lose functions. Skip them.
                    // console.warn(`[EventManager] Event ${event.id} has no valid condition function.`);
                    continue;
                }

                if (!event.condition(state)) continue;
            } catch (e) {
                console.warn(`[EventManager] Logic error in event ${event.id}:`, e);
                continue;
            }

            // 4. 분류
            if (event.type === 'MAIN' || event.type === 'CHAIN') {
                // 메인/연계는 조건 만족 시 '필수'로 취급 (우선순위 높음)
                mandatory.push(event);
            } else if (event.type === 'RANDOM') {
                randomCandidates.push(event);
            } else {
                // SUB 퀘스트 등도 일단 랜덤 후보군이나 별도 처리
                randomCandidates.push(event);
            }
        }

        // 우선순위 정렬 (낮은 숫자가 먼저)
        mandatory.sort((a, b) => a.priority - b.priority);

        return { mandatory, randomCandidates };
    }

    /**
     * 랜덤 후보군 중에서 가중치에 따라 N개를 선택합니다.
     */
    static pickRandom(candidates: GameEvent[], count: number = 1): GameEvent[] {
        if (candidates.length === 0) return [];

        const curating: GameEvent[] = [];
        const pool = [...candidates];

        for (let i = 0; i < count; i++) {
            if (pool.length === 0) break;

            // 가중치 랜덤 선택 (Weighted Random)
            // probability가 없으면 0.1(10%) 기본값
            const totalWeight = pool.reduce((sum, e) => sum + (e.probability ?? 0.1), 0);
            let randomVal = Math.random() * totalWeight;

            for (let j = 0; j < pool.length; j++) {
                const event = pool[j];
                const weight = event.probability ?? 0.1;

                randomVal -= weight;
                if (randomVal <= 0) {
                    curating.push(event);
                    pool.splice(j, 1); // 중복 선택 방지
                    break;
                }
            }
        }

        return curating;
    }

    /**
     * UI/Client-side용 헬퍼: 현재 상태에서 즉시 발동해야 할 필수 이벤트와 후보군을 반환합니다.
     * @param state 전체 게임 상태 (events 포함)
     */
    static checkEvents(state: any): { mandatory: GameEvent[], randomCandidates: GameEvent[] } {
        const events = state.events || [];
        if (!Array.isArray(events) || events.length === 0) return { mandatory: [], randomCandidates: [] };

        return this.scan(events, state);
    }
}
