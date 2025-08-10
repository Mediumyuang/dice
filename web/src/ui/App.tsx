import React, { useEffect, useMemo, useState } from 'react';

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

    // Telegram Wallet integration
    const [connected, setConnected] = useState<boolean>(false);
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [balance, setBalance] = useState<number>(1000);

    useEffect(() => {
        console.log('=== TON DICE APP INITIALIZATION ===');
        console.log('Current time:', new Date().toISOString());
        console.log('Window location:', window.location.href);
        console.log('User agent:', navigator.userAgent);
        console.log('Window object keys:', Object.keys(window));

        // Check for Telegram WebApp in different ways
        const telegram = (window as any).Telegram;
        const webApp = telegram?.WebApp;
        const tgWebApp = (window as any).tgWebApp;

        console.log('Telegram detection:', {
            hasTelegram: !!telegram,
            hasWebApp: !!webApp,
            hasTgWebApp: !!tgWebApp,
            telegramKeys: telegram ? Object.keys(telegram) : [],
            webAppKeys: webApp ? Object.keys(webApp) : [],
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer
        });

        if (webApp) {
            try {
                webApp.ready();
                webApp.expand();
                setTgAvailable(true);
                const u = webApp.initDataUnsafe?.user;
                setUsername(u?.username || u?.first_name || 'Игрок');
                webApp.HapticFeedback?.impactOccurred?.('soft');

                console.log('Telegram WebApp initialized:', {
                    version: webApp.version,
                    platform: webApp.platform,
                    user: u,
                    isVersionAtLeast69: webApp.isVersionAtLeast('6.9'),
                    initData: webApp.initData,
                    initDataUnsafe: webApp.initDataUnsafe
                });

                // Check if Telegram Wallet is available
                if (webApp.isVersionAtLeast('6.9')) {
                    console.log('Telegram Wallet is available');
                    webApp.MainButton?.show();
                    webApp.MainButton?.setText('Подключить кошелёк');
                    webApp.MainButton?.onClick(() => connectTelegramWallet());
                } else {
                    console.log('Telegram Wallet not available, using demo mode');
                    setStatus('Telegram Wallet недоступен. Используйте демо режим.');
                }
            } catch (error) {
                console.error('Telegram WebApp error:', error);
                setStatus('Ошибка инициализации Telegram WebApp');
            }
        } else {
            // Check if we're in Telegram by user agent or URL
            const isInTelegram = navigator.userAgent.includes('Telegram') ||
                window.location.href.includes('tgwebapp') ||
                window.location.href.includes('telegram') ||
                document.referrer.includes('telegram');

            console.log('Telegram WebApp not available:', {
                isInTelegram,
                userAgent: navigator.userAgent,
                url: window.location.href,
                referrer: document.referrer
            });

            if (isInTelegram) {
                setStatus('Ожидание инициализации Telegram WebApp...');
                setTgAvailable(true);

                // Retry initialization after a delay
                setTimeout(() => {
                    const retryWa = (window as any).Telegram?.WebApp;
                    if (retryWa) {
                        console.log('Telegram WebApp found on retry');
                        try {
                            retryWa.ready();
                            retryWa.expand();
                            const u = retryWa.initDataUnsafe?.user;
                            setUsername(u?.username || u?.first_name || 'Игрок');

                            if (retryWa.isVersionAtLeast('6.9')) {
                                retryWa.MainButton?.show();
                                retryWa.MainButton?.setText('Подключить кошелёк');
                                retryWa.MainButton?.onClick(() => connectTelegramWallet());
                                setStatus('Telegram WebApp готов к работе');
                            } else {
                                setStatus('Telegram Wallet недоступен. Используйте демо режим.');
                            }
                        } catch (error) {
                            console.error('Retry initialization failed:', error);
                            setStatus('Ошибка инициализации Telegram WebApp');
                        }
                    } else {
                        console.log('Telegram WebApp still not found after retry');
                        setStatus('Telegram WebApp не найден. Используйте демо режим.');
                    }
                }, 1000);
            } else {
                console.log('Not in Telegram - browser mode');
                setStatus('Режим браузера - используйте демо режим для тестирования');
                setTgAvailable(false);
            }
        }

        // Check API server availability
        fetch(`${API_BASE}/api/health`)
            .then(response => {
                if (response.ok) {
                    console.log('API server is available');
                } else {
                    console.error('API server responded with error:', response.status);
                    setStatus('API сервер недоступен');
                }
            })
            .catch(error => {
                console.error('API server connection failed:', error);
                setStatus('API сервер недоступен');
            });

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

    async function connectTelegramWallet(): Promise<void> {
        const wa = (window as any).Telegram?.WebApp;
        if (!wa) {
            setStatus('Telegram WebApp недоступен - используйте демо режим');
            return;
        }

        try {
            setStatus('Подключение к Telegram кошельку...');

            // Use Telegram Wallet API
            if (wa.isVersionAtLeast('6.9')) {
                // Request wallet access
                const result = await wa.requestWriteAccess();
                if (result) {
                    // Get wallet info
                    const walletInfo = await wa.getWalletInfo();
                    if (walletInfo) {
                        setConnected(true);
                        setWalletAddress(walletInfo.address || 'TG_Wallet');
                        setBalance(walletInfo.balance || 1000);
                        setStatus('Telegram кошелёк подключен!');

                        // Connect to backend
                        try {
                            const response = await fetch(`${API_BASE}/api/user/connect`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ walletAddress: walletInfo.address || 'TG_Wallet' })
                            });

                            if (response.ok) {
                                const data = await response.json();
                                setBalance(data.balance);
                                setStatus(`Баланс: ${data.balance} TON`);
                            }
                        } catch (error) {
                            console.error('Backend connection failed:', error);
                            setStatus('API сервер недоступен, но кошелёк подключен');
                        }
                    }
                } else {
                    setStatus('Доступ к кошельку не предоставлен');
                }
            } else {
                setStatus('Telegram Wallet недоступен в этой версии');
            }
        } catch (error) {
            console.error('Telegram Wallet connection error:', error);
            setStatus('Ошибка подключения к Telegram кошельку - используйте демо режим');
        }
    }

    async function disconnectWallet(): Promise<void> {
        setConnected(false);
        setWalletAddress('');
        setStatus('Кошелёк отключен');

        const wa = (window as any).Telegram?.WebApp;
        if (wa?.MainButton) {
            wa.MainButton.hide();
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
                    <span>TON Dice · Mini App v1.2</span>
                    <span className="status">
                        {connected ? 'Telegram кошелёк подключен' : 'Кошелёк не подключен'}
                    </span>
                </div>

                <div className="title">Привет, {username}!</div>
                <div className="subtitle">
                    {connected ? 'Telegram кошелёк подключен' : 'Подключите Telegram кошелёк для игры'}
                </div>

                {/* Wallet Connection */}
                {!connected ? (
                    <section className="card">
                        <div className="section-title">Подключение кошелька</div>
                        {tgAvailable ? (
                            <>
                                <button
                                    className="button button-primary"
                                    onClick={connectTelegramWallet}
                                    style={{ width: '100%', marginTop: 12 }}
                                >
                                    Подключить Telegram кошелёк
                                </button>
                                <div style={{
                                    marginTop: 8,
                                    fontSize: 12,
                                    color: '#a9b2c1',
                                    textAlign: 'center',
                                    padding: '8px',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    borderRadius: '6px'
                                }}>
                                    Telegram WebApp обнаружен
                                </div>
                            </>
                        ) : (
                            <div style={{
                                padding: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '8px',
                                marginTop: 12,
                                textAlign: 'center',
                                fontSize: '14px',
                                color: '#a9b2c1'
                            }}>
                                Откройте приложение через Telegram для подключения кошелька
                            </div>
                        )}
                        <button
                            className="button button-secondary"
                            onClick={() => {
                                setConnected(true);
                                setWalletAddress('EQDemo...1234');
                                setBalance(1000);
                                setStatus('Демо режим - кошелёк подключен');
                            }}
                            style={{ width: '100%', marginTop: 8 }}
                        >
                            Демо режим (без кошелька)
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => {
                                console.log('Force refresh clicked');
                                window.location.reload();
                            }}
                            style={{ width: '100%', marginTop: 8, fontSize: '12px' }}
                        >
                            🔄 Обновить страницу
                        </button>
                        <button
                            className="button button-secondary"
                            onClick={() => {
                                console.log('Force Telegram mode clicked');
                                setTgAvailable(true);
                                setStatus('Принудительно включен Telegram режим');
                            }}
                            style={{ width: '100%', marginTop: 8, fontSize: '12px' }}
                        >
                            🔧 Принудительно Telegram режим
                        </button>
                        <div style={{ marginTop: 12, fontSize: 12, color: '#a9b2c1', textAlign: 'center' }}>
                            {tgAvailable ?
                                'Используйте встроенный Telegram кошелёк для игры' :
                                'Для полного функционала откройте приложение через Telegram'
                            }
                        </div>
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


