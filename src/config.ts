import dotenv from 'dotenv';

dotenv.config();

function intFromEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const PORT = intFromEnv('PORT', 3000);
export const SERVER_SEED_SECRET = process.env.SERVER_SEED_SECRET ?? 'change_me';
export const DB_PATH = process.env.DB_PATH ?? './data.sqlite';
export const WEBAPP_URL = process.env.WEBAPP_URL ?? 'http://localhost:5173';

export const START_BALANCE = intFromEnv('START_BALANCE', 1000);
export const MIN_BET = intFromEnv('MIN_BET', 1);
export const MAX_BET = intFromEnv('MAX_BET', 100);
// House edge in basis points (100 = 1.00%)
export const HOUSE_EDGE_BPS = intFromEnv('HOUSE_EDGE_BPS', 100);
// Дополнительная динамическая надбавка к edge в базисных пунктах (0.01%),
// увеличивается по мере удаления target от середины диапазона
export const EXTRA_EDGE_MAX_BPS = intFromEnv('EXTRA_EDGE_MAX_BPS', 60);


