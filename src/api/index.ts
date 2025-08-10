import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({ 
    origin: ['http://localhost:5173', 'https://<мой_фронт_домен>'], 
    credentials: false 
}));
app.use(express.json());

// Middleware для валидации Telegram ID
function validateTelegramAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const tgId = req.headers['x-tg-id'];

    if (!tgId || isNaN(Number(tgId))) {
        return res.status(401).json({ error: 'Invalid Telegram ID' });
    }

    req.tgId = Number(tgId);
    next();
}

// Расширяем типы для Express
declare global {
    namespace Express {
        interface Request {
            tgId?: number;
        }
    }
}

// Функция для расчета выигрыша
function calculatePayout(amount: number, target: number): number {
    const multiplier = 100 / target;
    const houseEdge = 0.98; // 2% комиссия
    return Math.floor(amount * multiplier * houseEdge);
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Получить баланс пользователя
app.get('/api/balance', validateTelegramAuth, async (req, res) => {
    try {
        const { tg_id } = req.query;
        const tgId = Number(tg_id);

        if (!tgId || isNaN(tgId)) {
            return res.status(400).json({ error: 'Invalid tg_id parameter' });
        }

        // Найти или создать пользователя
        let user = await prisma.user.findUnique({
            where: { tg_id: BigInt(tgId) },
            include: { Balance: true }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    tg_id: BigInt(tgId),
                    Balance: {
                        create: {
                            amount: BigInt(0)
                        }
                    }
                },
                include: { Balance: true }
            });
        }

        // Создать баланс если его нет
        if (!user.Balance) {
            await prisma.balance.create({
                data: {
                    user_id: user.id,
                    amount: BigInt(0)
                }
            });
            user.Balance = { user_id: user.id, amount: BigInt(0) };
        }

        res.json({
            balance: Number(user.Balance.amount),
            tg_id: tgId
        });
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Получить историю транзакций
app.get('/api/ledger', validateTelegramAuth, async (req, res) => {
    try {
        const { tg_id } = req.query;
        const tgId = Number(tg_id);
        const limit = Number(req.query.limit) || 20;

        if (!tgId || isNaN(tgId)) {
            return res.status(400).json({ error: 'Invalid tg_id parameter' });
        }

        const user = await prisma.user.findUnique({
            where: { tg_id: BigInt(tgId) }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const ledger = await prisma.ledger.findMany({
            where: { user_id: user.id },
            orderBy: { created_at: 'desc' },
            take: limit
        });

        res.json(ledger.map(entry => ({
            id: entry.id,
            type: entry.type,
            amount: Number(entry.amount),
            tx_hash: entry.tx_hash,
            memo: entry.memo,
            created_at: entry.created_at
        })));
    } catch (error) {
        console.error('Ledger error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Сделать ставку
app.post('/api/bet', validateTelegramAuth, async (req, res) => {
    try {
        const { tg_id, amount, target } = req.body;

        // Валидация
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        if (!target || target < 1 || target > 99) {
            return res.status(400).json({ error: 'Target must be between 1 and 99' });
        }

        const tgId = Number(tg_id);
        if (!tgId || isNaN(tgId)) {
            return res.status(400).json({ error: 'Invalid tg_id' });
        }

        // Найти пользователя
        const user = await prisma.user.findUnique({
            where: { tg_id: BigInt(tgId) },
            include: { Balance: true }
        });

        if (!user || !user.Balance) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentBalance = Number(user.Balance.amount);
        if (currentBalance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Генерируем результат
        const roll = crypto.randomInt(0, 100);
        const isWin = roll < target;
        const payout = isWin ? calculatePayout(amount, target) : 0;

        // Обновляем баланс и записываем в ledger
        await prisma.$transaction(async (tx) => {
            // Списание ставки
            await tx.balance.update({
                where: { user_id: user.id },
                data: { amount: BigInt(currentBalance - amount) }
            });

            await tx.ledger.create({
                data: {
                    user_id: user.id,
                    type: 'debit',
                    amount: BigInt(amount),
                    memo: `Bet: target=${target}, roll=${roll}`
                }
            });

            // Если выигрыш, начисляем
            if (isWin) {
                const newBalance = currentBalance - amount + payout;
                await tx.balance.update({
                    where: { user_id: user.id },
                    data: { amount: BigInt(newBalance) }
                });

                await tx.ledger.create({
                    data: {
                        user_id: user.id,
                        type: 'deposit',
                        amount: BigInt(payout),
                        memo: `Win: target=${target}, roll=${roll}`
                    }
                });
            }
        });

        // Получаем обновленный баланс
        const updatedBalance = await prisma.balance.findUnique({
            where: { user_id: user.id }
        });

        res.json({
            roll,
            result: isWin ? 'WIN' : 'LOSE',
            newBalance: Number(updatedBalance?.amount || 0),
            payout: isWin ? payout : undefined
        });

    } catch (error) {
        console.error('Bet error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Вывод средств
app.post('/api/withdraw', validateTelegramAuth, async (req, res) => {
    try {
        const { tg_id, amount, to } = req.body;

        const tgId = Number(tg_id);
        if (!tgId || isNaN(tgId)) {
            return res.status(400).json({ error: 'Invalid tg_id' });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Найти пользователя
        const user = await prisma.user.findUnique({
            where: { tg_id: BigInt(tgId) },
            include: { Balance: true }
        });

        if (!user || !user.Balance) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentBalance = Number(user.Balance.amount);
        if (currentBalance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Проверяем лимиты (например, максимум 1000 TON за раз)
        if (amount > 1000) {
            return res.status(400).json({ error: 'Withdrawal limit exceeded' });
        }

        // Здесь должна быть логика отправки TON через tonapi
        // Пока просто списываем с баланса
        await prisma.$transaction(async (tx) => {
            await tx.balance.update({
                where: { user_id: user.id },
                data: { amount: BigInt(currentBalance - amount) }
            });

            await tx.ledger.create({
                data: {
                    user_id: user.id,
                    type: 'withdraw',
                    amount: BigInt(amount),
                    memo: `Withdrawal to ${to}`
                }
            });
        });

        res.json({
            success: true,
            message: 'Withdrawal request submitted',
            newBalance: currentBalance - amount
        });

    } catch (error) {
        console.error('Withdraw error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Обработка депозитов (для пуллера)
app.post('/api/deposit', async (req, res) => {
    try {
        const { tx_hash, amount, memo, from_address } = req.body;

        if (!tx_hash || !amount || !memo) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Парсим memo: GAME:tg_id:nonce
        const memoParts = memo.split(':');
        if (memoParts.length !== 3 || memoParts[0] !== 'GAME') {
            return res.status(400).json({ error: 'Invalid memo format' });
        }

        const tgId = Number(memoParts[1]);
        if (!tgId || isNaN(tgId)) {
            return res.status(400).json({ error: 'Invalid tg_id in memo' });
        }

        // Проверяем, не обрабатывали ли мы уже эту транзакцию
        const existingTx = await prisma.ledger.findFirst({
            where: { tx_hash }
        });

        if (existingTx) {
            return res.status(409).json({ error: 'Transaction already processed' });
        }

        // Находим или создаем пользователя
        let user = await prisma.user.findUnique({
            where: { tg_id: BigInt(tgId) },
            include: { Balance: true }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    tg_id: BigInt(tgId),
                    Balance: {
                        create: {
                            amount: BigInt(0)
                        }
                    }
                },
                include: { Balance: true }
            });
        }

        if (!user.Balance) {
            await prisma.balance.create({
                data: {
                    user_id: user.id,
                    amount: BigInt(0)
                }
            });
            user.Balance = { user_id: user.id, amount: BigInt(0) };
        }

        // Зачисляем депозит
        await prisma.$transaction(async (tx) => {
            const currentBalance = Number(user!.Balance!.amount);
            await tx.balance.update({
                where: { user_id: user!.id },
                data: { amount: BigInt(currentBalance + amount) }
            });

            await tx.ledger.create({
                data: {
                    user_id: user!.id,
                    type: 'deposit',
                    amount: BigInt(amount),
                    tx_hash,
                    memo: `Deposit from ${from_address}`
                }
            });
        });

        res.json({
            success: true,
            message: 'Deposit processed',
            user_id: user.id,
            new_balance: Number(user.Balance!.amount) + amount
        });

    } catch (error) {
        console.error('Deposit processing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
});

// 404 handler - всегда возвращаем JSON
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});
