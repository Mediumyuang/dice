import { Telegraf, Context } from 'telegraf';
import { HOUSE_EDGE_BPS, EXTRA_EDGE_MAX_BPS, MAX_BET, MIN_BET, SERVER_SEED_SECRET, START_BALANCE, WEBAPP_URL } from '../config.js';
import { computeRoll, generateServerSeed, serverSeedHash } from '../core/provablyFair.js';
import { clearPendingBet, getPendingBet, getStats, getUser, incrementNonce, recordBet, setPendingBet, updateBalance, updateClientSeed, updateServerSeed, upsertUser } from '../db/index.js';

function formatHelp(): string {
    return [
        'Команды:',
        '/start — создать аккаунт и показать hash(serverSeed)',
        '/help — помощь',
        '/bet <число 1–100> <сумма> — ставка на "меньше"',
        '/roll — закрутить текущую ставку',
        '/proof — раскрыть serverSeed и начать новый раунд',
        '',
        `Параметры: стартовый баланс = ${START_BALANCE} POINTS, лимиты: ${MIN_BET}..${MAX_BET}, house edge = ${(HOUSE_EDGE_BPS / 100).toFixed(2)}%`
    ].join('\n');
}

function dynamicEdgeBps(target: number): number {
    // Усиливаем edge к краям диапазона. Центр (50) — базовый edge.
    // Нормализация отклонения: 0..1 на отрезке 1..99
    const clamped = Math.max(1, Math.min(99, target));
    const deviation = Math.abs(clamped - 50) / 49; // ~0..1
    const extra = Math.round(deviation * EXTRA_EDGE_MAX_BPS);
    return HOUSE_EDGE_BPS + extra;
}

function calcPayoutGross(amount: number, target: number): number {
    // Мультипликатор: (100% - dynamic_edge) / target%
    const edgeBps = dynamicEdgeBps(target);
    const numerator = 10000 - edgeBps; // в bps
    const payout = Math.floor((amount * numerator) / (target * 100));
    return Math.max(0, payout);
}

export function registerCommands(bot: Telegraf<Context>): void {
    bot.start((ctx) => {
        const from = ctx.from;
        if (!from) return;
        const clientSeed = String(from.id);
        const s = generateServerSeed(SERVER_SEED_SECRET);
        const h = serverSeedHash(s);
        const user = upsertUser(from.id, from.username, s, h, clientSeed);
        updateClientSeed(user.telegramId, clientSeed);
        const isHttps = WEBAPP_URL.startsWith('https://');
        ctx.reply([
            `Добро пожаловать, ${from.first_name ?? 'игрок'}!`,
            `Твой баланс: ${user.balance} POINTS`,
            `serverSeedHash: ${user.serverSeedHash}`,
            'clientSeed по умолчанию = твой Telegram id',
            '',
            formatHelp()
        ].join('\n'), isHttps ? {
            reply_markup: {
                keyboard: [[{ text: 'Открыть Mini App', web_app: { url: WEBAPP_URL } }]],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        } : undefined);
    });

    bot.command('help', (ctx) => ctx.reply(formatHelp()));

    bot.command('mini', (ctx) => {
        const isHttps = WEBAPP_URL.startsWith('https://');
        if (isHttps) {
            ctx.reply('Открыть Mini App:', {
                reply_markup: {
                    inline_keyboard: [[{ text: 'TON Dice', web_app: { url: WEBAPP_URL } }]]
                }
            });
        } else {
            ctx.reply(`WEBAPP_URL сейчас не HTTPS (${WEBAPP_URL}). Telegram требует HTTPS для WebApp. Открой в браузере или укажи HTTPS и повтори /mini.`);
        }
    });

    bot.command('bet', (ctx) => {
        const from = ctx.from; if (!from) return;
        const user = getUser(from.id);
        if (!user) { ctx.reply('Сначала /start'); return; }
        const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const parts = text.trim().split(/\s+/);
        if (parts.length < 3) { ctx.reply('Использование: /bet <число 1–100> <сумма>'); return; }
        const target = Number.parseInt(parts[1], 10);
        const amount = Number.parseInt(parts[2], 10);
        if (!Number.isFinite(target) || target < 1 || target > 100) { ctx.reply('Число должно быть 1..100'); return; }
        if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) { ctx.reply(`Ставка должна быть ${MIN_BET}..${MAX_BET}`); return; }
        if (user.balance < amount) { ctx.reply('Недостаточно средств'); return; }
        setPendingBet(user.telegramId, target, amount);
        const edgeBps = dynamicEdgeBps(target);
        const previewPayout = calcPayoutGross(amount, target);
        ctx.reply(`Ставка: ROLL UNDER ${target}, сумма ${amount} POINTS. Теоретич. выплата: ${previewPayout} (edge ${(edgeBps/100).toFixed(2)}%). Нажми /roll.`);
    });

    bot.command('roll', (ctx) => {
        const from = ctx.from; if (!from) return;
        const user = getUser(from.id);
        if (!user) { ctx.reply('Сначала /start'); return; }
        const pb = getPendingBet(user.telegramId);
        if (!pb) { ctx.reply('Сначала /bet <число> <сумма>'); return; }

        const roll = computeRoll(user.serverSeed, user.clientSeed, user.nonce);
        const win = roll < pb.target;
        const payoutGross = win ? calcPayoutGross(pb.amount, pb.target) : 0;
        // balance change: -amount + payoutGross
        const delta = -pb.amount + payoutGross;
        const newBalance = updateBalance(user.telegramId, delta);

        recordBet({
            userId: user.telegramId,
            nonce: user.nonce,
            target: pb.target,
            amount: pb.amount,
            roll,
            win,
            payout: payoutGross,
            serverSeedHash: user.serverSeedHash
        });

        clearPendingBet(user.telegramId);
        incrementNonce(user.telegramId);

        const stats = getStats(user.telegramId);
        ctx.reply([
            `serverSeedHash: ${user.serverSeedHash}`,
            `clientSeed: ${user.clientSeed}`,
            `nonce: ${user.nonce}`,
            `ROLL: ${roll} → ${win ? 'WIN' : 'LOSE'}`,
            win ? `Выплата: +${payoutGross} (чистая ${payoutGross - pb.amount})` : `Проигрыш: -${pb.amount}`,
            `Баланс: ${newBalance} POINTS`,
            `Бетов: ${stats.totalBets}, побед: ${stats.totalWon}`,
            'Проверка честности: /proof'
        ].join('\n'));
    });

    bot.command('proof', (ctx) => {
        const from = ctx.from; if (!from) return;
        const user = getUser(from.id);
        if (!user) { ctx.reply('Сначала /start'); return; }
        // reveal and rotate
        const oldSeed = user.serverSeed;
        const oldHash = user.serverSeedHash;
        const nextSeed = generateServerSeed(SERVER_SEED_SECRET);
        const nextHash = serverSeedHash(nextSeed);
        updateServerSeed(user.telegramId, nextSeed, nextHash);
        clearPendingBet(user.telegramId);

        ctx.reply([
            'Пруф предыдущего раунда:',
            `serverSeed: ${oldSeed}`,
            `sha256(serverSeed): ${oldHash}`,
            '',
            'Новый раунд:',
            `serverSeedHash: ${nextHash}`
        ].join('\n'));
    });

    // Handle Telegram WebApp data payloads
    bot.on('message', (ctx) => {
        const msg: any = ctx.message as any;
        if (!msg || !('web_app_data' in msg)) return;
        const wad = msg.web_app_data;
        try {
            const data = JSON.parse(wad.data ?? '{}');
            const from = ctx.from; if (!from) return;
            let user = getUser(from.id);
            if (!user) {
                const s = generateServerSeed(SERVER_SEED_SECRET);
                const h = serverSeedHash(s);
                user = upsertUser(from.id, from.username, s, h, String(from.id));
            }
            if (data.action === 'bet_roll') {
                const target = Number(data.target);
                const amount = Number(data.amount);
                if (!Number.isFinite(target) || target < 1 || target > 100) { ctx.reply('WebApp: некорректный target'); return; }
                if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) { ctx.reply('WebApp: некорректная сумма'); return; }
                if (user.balance < amount) { ctx.reply('WebApp: недостаточно средств'); return; }

                const roll = computeRoll(user.serverSeed, user.clientSeed, user.nonce);
                const win = roll < target;
                const payout = win ? calcPayoutGross(amount, target) : 0;
                const delta = -amount + payout;
                const newBalance = updateBalance(user.telegramId, delta);
                recordBet({
                    userId: user.telegramId,
                    nonce: user.nonce,
                    target,
                    amount,
                    roll,
                    win,
                    payout,
                    serverSeedHash: user.serverSeedHash
                });
                incrementNonce(user.telegramId);
                ctx.reply([
                    'WebApp бет принят и ролл выполнен:',
                    `serverSeedHash: ${user.serverSeedHash}`,
                    `clientSeed: ${user.clientSeed}`,
                    `nonce: ${user.nonce}`,
                    `ROLL: ${roll} → ${win ? 'WIN' : 'LOSE'}`,
                    win ? `Выплата: +${payout} (чистая ${payout - amount})` : `Проигрыш: -${amount}`,
                    `Баланс: ${newBalance} POINTS`
                ].join('\n'));
                return;
            }
            if (data.action === 'set_client_seed') {
                const cs = String(data.clientSeed ?? '').trim();
                if (!cs) { ctx.reply('WebApp: clientSeed пуст'); return; }
                updateClientSeed(user.telegramId, cs);
                ctx.reply(`clientSeed обновлён через WebApp: ${cs}`);
                return;
            }
            ctx.reply('WebApp: неизвестное действие');
        } catch {
            ctx.reply('WebApp: неверный формат данных');
        }
    });
}


