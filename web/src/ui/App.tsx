import React, { useEffect, useMemo, useState } from 'react';
import { TonConnect } from '@tonconnect/sdk';

type RollResult = {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    roll: number;
    win: boolean;
    payout: number;
    balance: number;
};

const API_BASE = 'http://localhost:3000';

function InnerApp(): React.JSX.Element {
    const [tgAvailable, setTgAvailable] = useState<boolean>(false);
    const [username, setUsername] = useState<string>('Игрок');
    const [target, setTarget] = useState<number>(50);
    const [amount, setAmount] = useState<number>(10);
    const [status, setStatus] = useState<string>('');
    const [spinning, setSpinning] = useState<boolean>(false);
    const [recent, setRecent] = useState<{ ts: number; roll: number; target: number; amount: number; win: boolean; payout: number }[]>([]);

    // TON Wallet integration
    const [tonConnect, setTonConnect] = useState<TonConnect | null>(null);
    const [connected, setConnected] = useState<boolean>(false);
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [balance, setBalance] = useState<number>(1000);

    useEffect(() => {
        // Initialize TON Connect
        const connector = new TonConnect({
            manifestUrl: '/tonconnect-manifest.json'
        });
        setTonConnect(connector);

        // Check if already connected
        const unsubscribe = connector.onStatusChange(async (wallet) => {
            if (wallet) {
                setConnected(true);
                setWalletAddress(wallet.account.address);

                // Connect to backend and get user data
                try {
                    const response = await fetch(`${API_BASE}/api/user/connect`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ walletAddress: wallet.account.address })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setBalance(data.balance);
                    }
                } catch (error) {
                    console.error('Failed to connect to backend:', error);
                }
            } else {
                setConnected(false);
                setWalletAddress('');
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const wa = (window as any).Telegram?.WebApp;
        if (wa) {
            try {
                wa.ready();
                wa.expand();
                setTgAvailable(true);
                const u = wa.initDataUnsafe?.user;
                setUsername(u?.username || u?.first_name || 'Игрок');
                wa.HapticFeedback?.impactOccurred?.('soft');
            } catch { }
        }

        // Load recent games from localStorage
        try {
            const r = localStorage.getItem('tondice.recent');
            if (r) setRecent(JSON.parse(r));
        } catch { }
    }, []);

    useEffect(() => {
        // Save recent games to localStorage
        try {
            localStorage.setItem('tondice.recent', JSON.stringify(recent));
        } catch { }
    }, [recent]);

    function haptic(type: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' = 'light') {
        const wa = (window as any).Telegram?.WebApp;
        wa?.HapticFeedback?.impactOccurred?.(type);
    }

    function clampTarget(n: number): number { return Math.max(1, Math.min(100, Math.floor(n))); }
    function clampAmount(n: number): number { return Math.max(1, Math.floor(n)); }

    async function connectWallet(): Promise<void> {
        if (!tonConnect) return;
        try {
            await tonConnect.connect();
        } catch (error) {
            setStatus('Ошибка подключения кошелька');
        }
    }

    async function disconnectWallet(): Promise<void> {
        if (!tonConnect) return;
        try {
            await tonConnect.disconnect();
        } catch (error) {
            setStatus('Ошибка отключения кошелька');
        }
    }

    async function onSpin(): Promise<void> {
        if (!connected) {
            setStatus('Сначала подключите TON кошелёк');
            return;
        }

        if (balance < amount) {
            setStatus('Недостаточно средств');
            return;
        }

        setSpinning(true);
        setStatus('Крутим...');
        const startTs = Date.now();

        try {
            // Place bet
            const betResponse = await fetch(`${API_BASE}/api/game/bet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress,
                    target: clampTarget(target),
                    amount
                })
            });

            if (!betResponse.ok) {
                const error = await betResponse.json();
                throw new Error(error.error || 'Failed to place bet');
            }

            // Roll
            const rollResponse = await fetch(`${API_BASE}/api/game/roll`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ walletAddress })
            });

            if (!rollResponse.ok) {
                const error = await rollResponse.json();
                throw new Error(error.error || 'Failed to roll');
            }

            const result = await rollResponse.json();

            // Update UI
            setBalance(result.newBalance);
            const needle = document.getElementById('needle');
            if (needle) {
                needle.classList.remove('win', 'lose');
                needle.classList.add(result.win ? 'win' : 'lose');
                needle.setAttribute('style', `left: ${result.roll}%;`);
            }

            // Add to history
            setRecent((prev) => [{
                ts: startTs,
                roll: result.roll,
                target: clampTarget(target),
                amount,
                win: result.win,
                payout: result.payout
            }, ...prev].slice(0, 20));

            setStatus(result.win ? `Победа! +${result.payout} TON` : `Проигрыш -${amount} TON`);
            haptic(result.win ? 'medium' : 'light');

        } catch (error) {
            console.error('Game error:', error);
            setStatus(error instanceof Error ? error.message : 'Ошибка при игре');
        } finally {
            setSpinning(false);
        }
    }

    async function onAuto(count: number): Promise<void> {
        for (let i = 0; i < count; i += 1) {
            await onSpin();
            if (i < count - 1) {
                await new Promise((r) => setTimeout(r, 500));
            }
        }
    }

    return (
        <div className="app">
            <div className="container">
                <div className="badge" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <span>TON Dice · Mini App</span>
                    <span className="status">
                        {connected ? `Баланс: ${balance} TON` : 'Кошелёк не подключен'}
                    </span>
                </div>

                <div className="title">Привет, {username}!</div>
                <div className="subtitle">
                    {connected ? 'TON кошелёк подключен' : 'Подключите TON кошелёк для игры'}
                </div>

                {/* Wallet Connection */}
                {!connected ? (
                    <section className="card">
                        <div className="section-title">Подключение кошелька</div>
                        <button
                            className="button button-primary"
                            onClick={connectWallet}
                            style={{ width: '100%', marginTop: 12 }}
                        >
                            Подключить TON кошелёк
                        </button>
                    </section>
                ) : (
                    <section className="card">
                        <div className="section-title">Кошелёк</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span>Адрес: {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
                            <button className="button button-secondary" onClick={disconnectWallet}>
                                Отключить
                            </button>
                        </div>
                        <div className="balance-display">
                            Баланс: <strong>{balance} TON</strong>
                        </div>
                    </section>
                )}

                {/* Game Interface */}
                <section className="card">
                    <div className="scale" id="scale">
                        <div className="target-line" style={{ left: `${Math.max(1, Math.min(85, target))}%` }} />
                        <div className="needle" id="needle" style={{ left: '0%' }} />
                    </div>
                    <div className="scale-labels"><span>0</span><span>50</span><span>100</span></div>

                    <div className="grid two-col" style={{ marginTop: 16 }}>
                        <div>
                            <div className="label">Target (1..85)</div>
                            <input
                                className="input"
                                type="number"
                                min={1}
                                max={85}
                                value={target}
                                onChange={(e) => setTarget(Math.max(1, Math.min(85, Number(e.target.value) || 1)))}
                                disabled={!connected}
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
                                disabled={!connected}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                        <button
                            className="button button-primary"
                            onClick={onSpin}
                            disabled={!connected || spinning}
                        >
                            {spinning ? 'Крутим...' : 'Сделать ставку'}
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => setTarget(50)}
                            disabled={!connected}
                        >
                            50/50
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => setTarget((t) => Math.max(1, Math.min(85, t - 5)))}
                            disabled={!connected}
                        >
                            -5
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => setTarget((t) => Math.max(1, Math.min(85, t + 5)))}
                            disabled={!connected}
                        >
                            +5
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => setAmount((a) => Math.max(0.1, a / 2))}
                            disabled={!connected}
                        >
                            1/2
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => setAmount((a) => a * 2)}
                            disabled={!connected}
                        >
                            x2
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => onAuto(10)}
                            disabled={!connected}
                        >
                            Auto x10
                        </button>
                    </div>

                    {status && (
                        <div className="status" style={{ marginTop: 12 }}>
                            {status}
                        </div>
                    )}
                </section>

                {/* Game History */}
                <section className="card" style={{ marginTop: 16 }}>
                    <div className="section-title">История игр (последние 20)</div>
                    <div className="grid">
                        {recent.length === 0 ? (
                            <div className="status">Пока пусто. Сделайте ставку.</div>
                        ) : (
                            recent.map((r, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                    fontSize: 13,
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                    padding: '6px 0'
                                }}>
                                    <span style={{ color: '#a9b2c1' }}>
                                        {new Date(r.ts).toLocaleTimeString()}
                                    </span>
                                    <span>ROLL {r.roll} {'<'} {r.target}</span>
                                    <span style={{ color: r.win ? '#4ade80' : '#f87171' }}>
                                        {r.win ? 'WIN' : 'LOSE'}
                                    </span>
                                    <span style={{ color: r.win ? '#4ade80' : '#f87171' }}>
                                        {r.win ? `+${r.payout}` : `-${r.amount}`} TON
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            <div className="footer">TON Dice · Проверяемая честность · TON Blockchain</div>
        </div>
    );
}

export function App(): React.JSX.Element {
    return <InnerApp />;
}


