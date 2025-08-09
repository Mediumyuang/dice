import Database from 'better-sqlite3';
import { DB_PATH, START_BALANCE } from '../config.js';
import { PendingBet, User } from '../types.js';

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  balance INTEGER NOT NULL,
  server_seed TEXT NOT NULL,
  server_seed_hash TEXT NOT NULL,
  client_seed TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  username TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_bets (
  user_id INTEGER PRIMARY KEY,
  target INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(telegram_id)
);

CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  nonce INTEGER NOT NULL,
  target INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  roll INTEGER NOT NULL,
  win INTEGER NOT NULL,
  payout INTEGER NOT NULL,
  server_seed_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(telegram_id)
);
`);

export function getUser(telegramId: number): User | undefined {
    const row = db.prepare(
        `SELECT telegram_id as telegramId, balance, server_seed as serverSeed, server_seed_hash as serverSeedHash,
            client_seed as clientSeed, nonce, username, created_at as createdAt, updated_at as updatedAt
       FROM users WHERE telegram_id = ?`
    ).get(telegramId) as User | undefined;
    return row;
}

export function createUser(params: Omit<User, 'createdAt' | 'updatedAt'>): User {
    const now = Date.now();
    db.prepare(
        `INSERT INTO users (telegram_id, balance, server_seed, server_seed_hash, client_seed, nonce, username, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        params.telegramId,
        params.balance,
        params.serverSeed,
        params.serverSeedHash,
        params.clientSeed,
        params.nonce,
        params.username ?? null,
        now,
        now
    );
    return getUser(params.telegramId)!;
}

export function upsertUser(telegramId: number, username: string | undefined, serverSeed: string, serverSeedHash: string, clientSeed: string): User {
    const existing = getUser(telegramId);
    if (existing) {
        return existing;
    }
    return createUser({
        telegramId,
        balance: START_BALANCE,
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce: 0,
        username: username ?? undefined
    });
}

export function updateClientSeed(telegramId: number, clientSeed: string): void {
    db.prepare(`UPDATE users SET client_seed = ?, updated_at = ? WHERE telegram_id = ?`).run(clientSeed, Date.now(), telegramId);
}

export function updateServerSeed(telegramId: number, serverSeed: string, serverSeedHash: string): void {
    db.prepare(`UPDATE users SET server_seed = ?, server_seed_hash = ?, nonce = 0, updated_at = ? WHERE telegram_id = ?`)
        .run(serverSeed, serverSeedHash, Date.now(), telegramId);
}

export function incrementNonce(telegramId: number): number {
    db.prepare(`UPDATE users SET nonce = nonce + 1, updated_at = ? WHERE telegram_id = ?`).run(Date.now(), telegramId);
    const user = getUser(telegramId)!;
    return user.nonce;
}

export function updateBalance(telegramId: number, delta: number): number {
    db.prepare(`UPDATE users SET balance = balance + ?, updated_at = ? WHERE telegram_id = ?`).run(delta, Date.now(), telegramId);
    return getUser(telegramId)!.balance;
}

export function setPendingBet(userId: number, target: number, amount: number): void {
    const now = Date.now();
    db.prepare(`INSERT INTO pending_bets (user_id, target, amount, created_at) VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET target=excluded.target, amount=excluded.amount, created_at=excluded.created_at`)
        .run(userId, target, amount, now);
}

export function getPendingBet(userId: number): PendingBet | undefined {
    const row = db.prepare(`SELECT user_id as userId, target, amount, created_at as createdAt FROM pending_bets WHERE user_id = ?`).get(userId) as PendingBet | undefined;
    return row;
}

export function clearPendingBet(userId: number): void {
    db.prepare(`DELETE FROM pending_bets WHERE user_id = ?`).run(userId);
}

export function recordBet(params: {
    userId: number;
    nonce: number;
    target: number;
    amount: number;
    roll: number;
    win: boolean;
    payout: number;
    serverSeedHash: string;
}): void {
    db.prepare(`INSERT INTO bets (user_id, nonce, target, amount, roll, win, payout, server_seed_hash, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
            params.userId,
            params.nonce,
            params.target,
            params.amount,
            params.roll,
            params.win ? 1 : 0,
            params.payout,
            params.serverSeedHash,
            Date.now()
        );
}

export function getStats(userId: number): { totalBets: number; totalWon: number; } {
    const row = db.prepare(`SELECT COUNT(*) as totalBets, SUM(win) as totalWon FROM bets WHERE user_id = ?`).get(userId) as { totalBets: number; totalWon: number | null };
    return { totalBets: row.totalBets, totalWon: row.totalWon ?? 0 };
}


