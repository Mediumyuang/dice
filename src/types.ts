export type User = {
    telegramId: number;
    balance: number;
    serverSeed: string; // hex
    serverSeedHash: string; // sha256 hex
    clientSeed: string; // by default: telegramId as string
    nonce: number; // increases each roll
    username?: string | null;
    createdAt: number;
    updatedAt: number;
};

export type PendingBet = {
    userId: number; // telegramId
    target: number; // roll-under target 1..100
    amount: number; // integer points
    createdAt: number;
};

export type BetRecord = {
    id: number;
    userId: number;
    nonce: number;
    target: number;
    amount: number;
    roll: number; // 0..99
    win: 0 | 1;
    payout: number; // gross credited amount if win, else 0
    serverSeedHash: string;
    createdAt: number;
};


