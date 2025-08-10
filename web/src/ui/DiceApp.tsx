import React, { useEffect, useState } from 'react';
import { TonConnectUI } from '@tonconnect/ui';
import { isTelegramWebApp, initTelegram } from '../lib/telegram';

interface GameResult {
    roll: number;
    result: 'WIN' | 'LOSE';
    newBalance: number;
    payout?: number;
}

interface Balance {
    balance: number;
    tg_id: number;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export function DiceApp(): React.JSX.Element {
    const [inTG, setInTG] = useState<boolean>(false);
    const [tgCtx, setTgCtx] = useState<any>(null);
    const [tonConnect, setTonConnect] = useState<TonConnectUI | null>(null);
    const [balance, setBalance] = useState<number>(0);
    const [target, setTarget] = useState<number>(50);
    const [amount, setAmount] = useState<number>(10);
    const [status, setStatus] = useState<string>('');
    const [spinning, setSpinning] = useState<boolean>(false);
    const [recentGames, setRecentGames] = useState<GameResult[]>([]);
    const [isConnected, setIsConnected] = useState<boolean>(false);

    useEffect(() => {
        // Проверяем Telegram WebApp
        const telegramAvailable = isTelegramWebApp();
        setInTG(telegramAvailable);

        if (telegramAvailable) {
            const ctx = initTelegram();
            setTgCtx(ctx);

            if (ctx) {
                // Инициализируем TonConnect только в Telegram
                const tc = new TonConnectUI({
                    manifestUrl: `${location.origin}/tonconnect-manifest.json`
                });
                setTonConnect(tc);

                // Подписываемся на изменения подключения
                tc.onStatusChange((wallet) => {
                    setIsConnected(!!wallet);
                    if (wallet) {
                        loadBalance();
                    }
                });

                setStatus('Telegram WebApp готов к работе');
            } else {
                setStatus('Ошибка инициализации Telegram WebApp');
            }
        } else {
            setStatus('Приложение должно быть запущено в Telegram');
        }
    }, []);

    const loadBalance = async () => {
        if (!tgCtx?.data?.user?.id) return;

        try {
            const response = await fetch(`${API_BASE}/api/balance?tg_id=${tgCtx.data.user.id}`, {
                headers: {
                    'X-TG-ID': tgCtx.data.user.id.toString()
                }
            });

            if (response.ok) {
                const data: Balance = await response.json();
                setBalance(data.balance);
            }
        } catch (error) {
            console.error('Failed to load balance:', error);
        }
    };

    const handleDeposit = async () => {
        if (!tgCtx?.data?.user?.id || !tonConnect) return;

        try {
            setStatus('Подготовка депозита...');

            // Генерируем memo для идентификации депозита
            const nonce = Math.random().toString(36).substring(2, 15);
            const memo = `GAME:${tgCtx.data.user.id}:${nonce}`;

            // Получаем адрес казны из env (в реальном приложении)
            const treasuryAddress = import.meta.env.VITE_TREASURY_ADDRESS || 'EQ...';

            // Открываем платеж через TonConnect
            await tonConnect.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 600, // 10 минут
                messages: [
                    {
                        address: treasuryAddress,
                        amount: (amount * 1000000000).toString(), // конвертируем в нанотоны
                        comment: memo
                    }
                ]
            });

            setStatus('Ждём подтверждение транзакции...');

            // Опрашиваем сервер до зачисления
            const checkBalance = async () => {
                try {
                    const response = await fetch(`${API_BASE}/api/balance?tg_id=${tgCtx.data.user.id}`, {
                        headers: {
                            'X-TG-ID': tgCtx.data.user.id.toString()
                        }
                    });

                    if (response.ok) {
                        const data: Balance = await response.json();
                        if (data.balance > balance) {
                            setBalance(data.balance);
                            setStatus(`Депозит зачислен! Новый баланс: ${data.balance} TON`);
                            return;
                        }
                    }

                    // Повторяем проверку через 5 секунд
                    setTimeout(checkBalance, 5000);
                } catch (error) {
                    console.error('Balance check failed:', error);
                }
            };

            setTimeout(checkBalance, 5000);

        } catch (error) {
            console.error('Deposit failed:', error);
            setStatus('Ошибка при депозите');
        }
    };

    const handleBet = async () => {
        if (!tgCtx?.data?.user?.id || !isConnected) {
            setStatus('Подключите кошелёк для игры');
            return;
        }

        if (balance < amount) {
            setStatus('Недостаточно средств');
            return;
        }

        setSpinning(true);
        setStatus('Делаем ставку...');

        try {
            const response = await fetch(`${API_BASE}/api/bet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-TG-ID': tgCtx.data.user.id.toString()
                },
                body: JSON.stringify({
                    tg_id: tgCtx.data.user.id,
                    amount: amount,
                    target: target
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка при ставке');
            }

            const result: GameResult = await response.json();

            setBalance(result.newBalance);
            setRecentGames(prev => [result, ...prev.slice(0, 19)]);

            setStatus(result.result === 'WIN'
                ? `Победа! +${result.payout} TON`
                : `Проигрыш -${amount} TON`
            );

        } catch (error) {
            console.error('Bet failed:', error);
            setStatus('Ошибка при ставке');
        } finally {
            setSpinning(false);
        }
    };

    const handleWithdraw = async () => {
        if (!tgCtx?.data?.user?.id || !tonConnect) return;

        try {
            setStatus('Подготовка вывода...');

            const response = await fetch(`${API_BASE}/api/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-TG-ID': tgCtx.data.user.id.toString()
                },
                body: JSON.stringify({
                    tg_id: tgCtx.data.user.id,
                    amount: balance,
                    to: 'auto' // автоматический вывод на подключенный кошелёк
                })
            });

            if (response.ok) {
                setStatus('Заявка на вывод отправлена');
                setBalance(0);
            } else {
                throw new Error('Ошибка при выводе');
            }

        } catch (error) {
            console.error('Withdraw failed:', error);
            setStatus('Ошибка при выводе');
        }
    };

    if (!inTG) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: '20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                textAlign: 'center'
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '20px',
                    padding: '40px',
                    maxWidth: '400px',
                    width: '100%',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎲</div>
                    <h1 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold' }}>
                        TON Dice Bank
                    </h1>
                    <p style={{
                        margin: '0 0 30px 0',
                        fontSize: '16px',
                        lineHeight: '1.5',
                        opacity: 0.9
                    }}>
                        Это приложение работает только в Telegram Mini App.
                        Откройте его через Telegram бота для безопасной игры.
                    </p>

                    <a
                        href={`https://t.me/${import.meta.env.VITE_TG_BOT_USERNAME || 'your_bot'}?startapp=1`}
                        style={{
                            display: 'inline-block',
                            background: '#0088cc',
                            color: 'white',
                            textDecoration: 'none',
                            padding: '15px 30px',
                            borderRadius: '10px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            transition: 'all 0.3s ease',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.background = '#006699';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = '#0088cc';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        🚀 Открыть в Telegram
                    </a>

                    <div style={{
                        marginTop: '20px',
                        fontSize: '14px',
                        opacity: 0.7
                    }}>
                        Безопасные транзакции • Проверяемая честность • TON Blockchain
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app">
            <div className="container">
                <div className="badge" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <span>TON Dice Bank · Telegram Mini App</span>
                    <span className="status">
                        {isConnected ? 'Кошелёк подключен' : 'Кошелёк не подключен'}
                    </span>
                </div>

                <div className="title">
                    Привет, {tgCtx?.data?.user?.first_name || 'Игрок'}!
                </div>
                <div className="subtitle">
                    {isConnected ? 'Ваш TON кошелёк подключен' : 'Подключите TON кошелёк для игры'}
                </div>

                {/* Кошелёк и баланс */}
                <section className="card">
                    <div className="section-title">Кошелёк</div>
                    <div className="balance-display">
                        Баланс: <strong>{balance} TON</strong>
                    </div>

                    {!isConnected ? (
                        <button
                            className="button button-primary"
                            onClick={() => tonConnect?.connectWallet()}
                            style={{ width: '100%', marginTop: 12 }}
                        >
                            Подключить TON кошелёк
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button
                                className="button button-secondary"
                                onClick={handleDeposit}
                                style={{ flex: 1 }}
                            >
                                Пополнить
                            </button>
                            <button
                                className="button button-secondary"
                                onClick={handleWithdraw}
                                style={{ flex: 1 }}
                                disabled={balance <= 0}
                            >
                                Вывести
                            </button>
                        </div>
                    )}
                </section>

                {/* Игровой интерфейс */}
                <section className="card">
                    <div className="scale" id="scale">
                        <div className="target-line" style={{ left: `${Math.max(1, Math.min(85, target))}%` }} />
                        <div className="needle" id="needle" style={{ left: '0%' }} />
                    </div>
                    <div className="scale-labels"><span>0</span><span>50</span><span>100</span></div>

                    <div className="grid two-col" style={{ marginTop: 16 }}>
                        <div>
                            <div className="label">Target (1..99)</div>
                            <input
                                className="input"
                                type="number"
                                min={1}
                                max={99}
                                value={target}
                                onChange={(e) => setTarget(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                                disabled={!isConnected}
                            />
                        </div>
                        <div>
                            <div className="label">Ставка (TON)</div>
                            <input
                                className="input"
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={amount}
                                onChange={(e) => setAmount(Math.max(0.1, Number(e.target.value) || 0.1))}
                                disabled={!isConnected}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                        <button
                            className="button button-primary"
                            onClick={handleBet}
                            disabled={!isConnected || spinning}
                        >
                            {spinning ? 'Крутим...' : 'Сделать ставку'}
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => setTarget(50)}
                            disabled={!isConnected}
                        >
                            50/50
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => setTarget((t) => Math.max(1, Math.min(99, t - 5)))}
                            disabled={!isConnected}
                        >
                            -5
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => setTarget((t) => Math.max(1, Math.min(99, t + 5)))}
                            disabled={!isConnected}
                        >
                            +5
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => setAmount((a) => Math.max(0.1, a / 2))}
                            disabled={!isConnected}
                        >
                            1/2
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => setAmount((a) => a * 2)}
                            disabled={!isConnected}
                        >
                            x2
                        </button>
                    </div>

                    {status && (
                        <div className="status" style={{ marginTop: 12 }}>
                            {status}
                        </div>
                    )}
                </section>

                {/* История игр */}
                <section className="card" style={{ marginTop: 16 }}>
                    <div className="section-title">История игр (последние 20)</div>
                    <div className="grid">
                        {recentGames.length === 0 ? (
                            <div className="status">Пока пусто. Сделайте ставку.</div>
                        ) : (
                            recentGames.map((game, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                    fontSize: 13,
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                    padding: '6px 0'
                                }}>
                                    <span style={{ color: '#a9b2c1' }}>
                                        {new Date().toLocaleTimeString()}
                                    </span>
                                    <span>ROLL {game.roll} {'<'} {target}</span>
                                    <span style={{ color: game.result === 'WIN' ? '#4ade80' : '#f87171' }}>
                                        {game.result}
                                    </span>
                                    <span style={{ color: game.result === 'WIN' ? '#4ade80' : '#f87171' }}>
                                        {game.result === 'WIN' ? `+${game.payout}` : `-${amount}`} TON
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            <div className="footer">TON Dice Bank · Проверяемая честность · TON Blockchain</div>
        </div>
    );
}
