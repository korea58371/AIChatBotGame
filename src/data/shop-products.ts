export interface ShopProduct {
    id: string;
    type: 'token' | 'fate';
    name: string;
    description: string;
    amount: number; // The base amount
    bonusAmount: number; // Bonus given
    price: number; // KRW
    icon: string; // Emoji or asset path
    tag?: string; // 'BEST', 'HOT', etc.
    gradient: string; // CSS gradient class for card background
}

export const SHOP_PRODUCTS: ShopProduct[] = [
    // --- Story Tokens (스토리 토큰) ---
    // Base Rate: 10 Tokens ≈ 200 KRW
    {
        id: 'token_starter',
        type: 'token',
        name: '맛보기 주머니',
        description: '가볍게 이야기를 즐겨보세요.',
        amount: 100,
        bonusAmount: 0,
        price: 2000,
        icon: '🪙',
        gradient: 'from-amber-200 to-amber-500'
    },
    {
        id: 'token_adventurer',
        type: 'token',
        name: '모험가 패키지',
        description: '본격적인 여정을 위한 선택.',
        amount: 300,
        bonusAmount: 30, // +10%
        price: 5500,
        icon: '💰',
        tag: 'POPULAR',
        gradient: 'from-amber-300 to-orange-500'
    },
    {
        id: 'token_hero',
        type: 'token',
        name: '영웅의 보따리',
        description: '끊김 없는 몰입감을 원한다면.',
        amount: 600,
        bonusAmount: 120, // +20%
        price: 10000,
        icon: '💎',
        tag: 'BEST',
        gradient: 'from-blue-400 to-indigo-600'
    },
    {
        id: 'token_legend',
        type: 'token',
        name: '전설의 금고',
        description: '운명을 마음대로 주무르세요.',
        amount: 1500,
        bonusAmount: 450, // +30%
        price: 22000,
        icon: '👑',
        tag: 'LEGENDARY',
        gradient: 'from-purple-500 to-rose-500'
    },

    // --- Fate Points (운명 포인트) ---
    // Base Rate: 10 Points ≈ 100 KRW
    {
        id: 'fate_shard',
        type: 'fate',
        name: '운명의 한 조각',
        description: '작은 기적을 일으킵니다.',
        amount: 100,
        bonusAmount: 0,
        price: 1000,
        icon: '✨',
        gradient: 'from-emerald-300 to-teal-500'
    },
    {
        id: 'fate_orb',
        type: 'fate',
        name: '개입의 구슬',
        description: '결정적인 순간을 바꿉니다.',
        amount: 500,
        bonusAmount: 50, // +10%
        price: 5000,
        icon: '🔮',
        tag: 'HOT',
        gradient: 'from-cyan-400 to-blue-600'
    }
];

export const getProductById = (id: string) => SHOP_PRODUCTS.find(p => p.id === id);
