import React, { useEffect, useMemo, useState } from 'react';
import { TonConnectUIProvider, TonConnectButton, useTonConnectUI } from '@tonconnect/ui-react';

type RollResult = {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    roll: number;
    win: boolean;
    payout: number;
    balance: number;
};

function InnerApp(): React.JSX.Element {
    const [tgAvailable, setTgAvailable] = useState<boolean>(false);
    const [username, setUsername] = useState<string>('');
    const [target, setTarget] = useState<number>(50);
    const [amount, setAmount] = useState<number>(10);
    const [clientSeed, setClientSeed] = useState<string>('');
    const [status, setStatus] = useState<string>('');
    const [spinning, setSpinning] = useState<boolean>(false);
    const [recent, setRecent] = useState<{ ts: number; roll: number; target: number; amount: number; win: boolean; payout: number }[]>([]);
    const [tonUI] = useTonConnectUI();

    const connected = tonUI?.connected ?? false;
    const walletAddress = useMemo(() => tonUI?.wallet?.account?.address ?? '', [tonUI?.wallet?.account?.address]);

    useEffect(() => {
        const wa = (window as any).Telegram?.WebApp;
        if (wa) {
            try {
                wa.ready();
                wa.expand();
                setTgAvailable(true);
                const u = wa.initDataUnsafe?.user;
                setUsername(u?.username || u?.first_name || 'Игрок');
            } catch { }
        }
    }, []);

    function sendDataToBot(payload: unknown): void {
        const wa = (window as any).Telegram?.WebApp;
        if (!wa) {
            setStatus('Telegram WebApp API недоступен. Откройте через Telegram');
            return;
        }
        try {
            wa.sendData(JSON.stringify(payload));
            setStatus('Отправлено боту. Проверьте чат.');
        } catch (e) {
            setStatus('Ошибка отправки в бота');
        }
    }

    function onSpin(): void {
        setSpinning(true);
        setTimeout(() => setSpinning(false), 1200);
        sendDataToBot({ action: 'bet_roll', target, amount });
        // локальная запись в историю (UI-уровень). Сервер всё равно хранит свою историю
        setRecent((prev) => [{ ts: Date.now(), roll: -1, target, amount, win: false, payout: 0 }, ...prev].slice(0, 20));
    }

    return (
        <div className="app">
            <div className="container">
                <div className="badge" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <span>TON Dice · Mini App</span>
                    <TonConnectButton />
                </div>
                <div className="title">Привет, {username}!</div>
                <div className="subtitle">{tgAvailable ? 'WebApp активен' : 'Открой Mini App через Telegram для полного функционала'}</div>

                <div className="layout">
                    <section className="card">
                        <div className={`wheel ${spinning ? 'spinning' : ''}`}></div>
                        <div className="pointer" />
                        <div className="grid two-col" style={{ marginTop: 10 }}>
                            <div>
                                <div className="label">Target (1..100)</div>
                                <input className="input" type="number" min={1} max={100} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
                            </div>
                            <div>
                                <div className="label">Amount (POINTS)</div>
                                <input className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                            <button className="button button-primary" onClick={onSpin}>Сделать ставку и крутить</button>
                            <button className="button button-secondary" onClick={() => setTarget(50)}>50/50</button>
                        </div>
                    </section>

                    <section className="card">
                        <div className="section-title">Пров Fair настройки</div>
                        <div className="grid">
                            <div>
                                <div className="label">clientSeed</div>
                                <input className="input" type="text" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} placeholder="Введите свой clientSeed" />
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button className="button button-secondary" onClick={() => setClientSeed('')}>Очистить</button>
                                <button className="button button-primary" onClick={() => sendDataToBot({ action: 'set_client_seed', clientSeed })}>Сохранить clientSeed</button>
                            </div>
                            <div className={`status ${tgAvailable ? '' : 'warn'}`}>{status || (!tgAvailable ? 'Telegram WebApp API недоступен. Откройте через Telegram' : '')}</div>
                            <div className="section-title" style={{ marginTop: 10 }}>Кошелёк</div>
                            <div className="status">{connected ? `Подключен: ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : 'Кошелёк не подключен'}</div>
                        </div>
                    </section>
                </div>

                <section className="card" style={{ marginTop: 16 }}>
                    <div className="section-title">История (последние 20)</div>
                    <div className="grid">
                        {recent.length === 0 ? (
                            <div className="status">Пока пусто. Сделайте ставку.</div>
                        ) : (
                            recent.map((r, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '6px 0' }}>
                                    <span style={{ color: '#a9b2c1' }}>{new Date(r.ts).toLocaleTimeString()}</span>
                                    <span>ROLL {r.roll >= 0 ? r.roll : '…'} {'<'} {r.target}</span>
                                    <span>{r.win ? 'WIN' : 'LOSE'}</span>
                                    <span>{r.win ? `+${r.payout}` : `-${r.amount}`} pts</span>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            <div className="footer">Без картинок · ультра современный неон/стекло дизайн</div>
        </div>
    );
}

export function App(): React.JSX.Element {
    // Manifest URL можно хранить рядом: public/tonconnect-manifest.json, но для MVP используем инлайн URL
    const manifestUrl = 'https://dice-vert-delta.vercel.app/tonconnect-manifest.json';
    return (
        <TonConnectUIProvider manifestUrl={manifestUrl} walletsListConfiguration={{ includeWallets: [
            { appName: 'tonkeeper', name: 'Tonkeeper', imageUrl: 'https://raw.githubusercontent.com/ton-connect/sdk/main/assets/tonconnect-logo.png', aboutUrl: 'https://tonkeeper.com' }
        ]}}>
            <InnerApp />
        </TonConnectUIProvider>
    );
}


