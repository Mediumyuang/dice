import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PORT } from '../config.js';
import { computeRoll, generateServerSeed, serverSeedHash } from '../core/provablyFair.js';
import { clearPendingBet, getPendingBet, getStats, getUser, incrementNonce, recordBet, setPendingBet, updateBalance, updateClientSeed, updateServerSeed, upsertUser } from '../db/index.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:5173', 'https://dice-vert-delta.vercel.app'],
    credentials: true
}));
app.use(express.json());

// Game API endpoints
app.post('/api/game/bet', async (req, res) => {
    try {
        const { walletAddress, target, amount } = req.body;

        if (!walletAddress || !target || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create or get user by wallet address
        let user = getUser(walletAddress);
        if (!user) {
            const s = generateServerSeed('default');
            const h = serverSeedHash(s);
            user = upsertUser(walletAddress, walletAddress, s, h, walletAddress);
        }

        // Validate bet
        if (target < 1 || target > 100) {
            return res.status(400).json({ error: 'Target must be 1-100' });
        }

        if (amount < 0.1 || amount > 100) {
            return res.status(400).json({ error: 'Amount must be 0.1-100 TON' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Set pending bet
        setPendingBet(user.telegramId, target, amount);

        res.json({
            success: true,
            message: 'Bet placed successfully',
            serverSeedHash: user.serverSeedHash
        });

    } catch (error) {
        console.error('Bet error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/game/roll', async (req, res) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        let user = getUser(walletAddress);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const pendingBet = getPendingBet(user.telegramId);
        if (!pendingBet) {
            return res.status(400).json({ error: 'No pending bet' });
        }

        // Compute roll
        const roll = computeRoll(user.serverSeed, user.clientSeed, user.nonce);
        const win = roll < pendingBet.target;

        // Calculate payout
        const payout = win ? Math.floor(pendingBet.amount * (100 / pendingBet.target) * 0.99) : 0;
        const delta = -pendingBet.amount + payout;
        const newBalance = updateBalance(user.telegramId, delta);

        // Record bet
        recordBet({
            userId: user.telegramId,
            nonce: user.nonce,
            target: pendingBet.target,
            amount: pendingBet.amount,
            roll,
            win,
            payout,
            serverSeedHash: user.serverSeedHash
        });

        clearPendingBet(user.telegramId);
        incrementNonce(user.telegramId);

        res.json({
            success: true,
            roll,
            win,
            payout,
            newBalance,
            serverSeedHash: user.serverSeedHash,
            clientSeed: user.clientSeed,
            nonce: user.nonce
        });

    } catch (error) {
        console.error('Roll error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/user/:walletAddress', (req, res) => {
    try {
        const { walletAddress } = req.params;
        const user = getUser(walletAddress);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const stats = getStats(user.telegramId);

        res.json({
            balance: user.balance,
            serverSeedHash: user.serverSeedHash,
            stats
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/user/connect', async (req, res) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        let user = getUser(walletAddress);
        if (!user) {
            const s = generateServerSeed('default');
            const h = serverSeedHash(s);
            user = upsertUser(walletAddress, walletAddress, s, h, walletAddress);
        }

        res.json({
            success: true,
            balance: user.balance,
            serverSeedHash: user.serverSeedHash
        });

    } catch (error) {
        console.error('Connect error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`TON Dice API server running on port ${PORT}`);
});
