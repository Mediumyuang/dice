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

function InnerApp(): React.JSX.Element {
    const [tgAvailable, setTgAvailable] = useState<boolean>(false);
    const [username, setUsername] = useState<string>('');
    const [target, setTarget] = useState<number>(50);
    const [amount, setAmount] = useState<number>(10);
    const [clientSeed, setClientSeed] = useState<string>('');
    const [status, setStatus] = useState<string>('');
    const [spinning, setSpinning] = useState<boolean>(false);
    const [recent, setRecent] = useState<{ ts: number; roll: number; target: number; amount: number; win: boolean; payout: number }[]>([]);
    const connected = false;
    const walletAddress = '';

    useEffect(() => {
        const wa = (window as any).Telegram?.WebApp;
        if (wa) {
            try {
                wa.ready();
                wa.expand();
                setTgAvailable(true);
                const u = wa.initDataUnsafe?.user;
                setUsername(u?.username || u?.first_name || 'Игрок');
                // Haptics light welcome
                wa.HapticFeedback?.impactOccurred?.('soft');
            } catch { }
        }
        // load persisted settings
        try {
            const s = localStorage.getItem('tondice.settings');
            if (s) {
                const j = JSON.parse(s);
                if (typeof j.target === 'number') setTarget(j.target);
                if (typeof j.amount === 'number') setAmount(j.amount);
                if (typeof j.clientSeed === 'string') setClientSeed(j.clientSeed);
            }
            const r = localStorage.getItem('tondice.recent');
            if (r) setRecent(JSON.parse(r));
        } catch { }
    }, []);

    function persist(): void {
        try {
            localStorage.setItem('tondice.settings', JSON.stringify({ target, amount, clientSeed }));
            localStorage.setItem('tondice.recent', JSON.stringify(recent));
        } catch { }
    }

    useEffect(() => { persist(); }, [target, amount, clientSeed, recent]);

    function haptic(type: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' = 'light') {
        const wa = (window as any).Telegram?.WebApp;
        wa?.HapticFeedback?.impactOccurred?.(type);
    }

    function sendDataToBot(payload: unknown): void {
        const wa = (window as any).Telegram?.WebApp;
        if (!wa) {
            setStatus('Telegram WebApp API недоступен. Откройте через Telegram');
            return;
        }
        try {
            wa.sendData(JSON.stringify(payload));
            setStatus('Отправлено боту. Проверьте чат.');
            haptic('medium');
        } catch (e) {
            setStatus('Ошибка отправки в бота');
        }
    }

    function onSpin(): void {
        setSpinning(true);
        const startTs = Date.now();
        // псевдо-анимация для UX до ответа сервера
        const pseudo = Math.floor(Math.random() * 100);
        const wheel = document.getElementById('wheel');
        if (wheel) {
            const finalAngle = 360 + (pseudo / 100) * 360; // минимум 1 оборот + приземление
            wheel.style.transform = `rotate(${finalAngle}deg)`;
        }
        setTimeout(() => setSpinning(false), 1200);
        // локальная запись в историю (UI-уровень)
        setRecent((prev) => [{ ts: startTs, roll: pseudo, target, amount, win: pseudo < target, payout: 0 }, ...prev].slice(0, 20));
        sendDataToBot({ action: 'bet_roll', target, amount });
    }

    async function onAuto(count: number): Promise<void> {
        for (let i = 0; i < count; i += 1) {
            onSpin();
            // небольшая пауза между спинами
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 350));
        }
    }

    return (
        <div className="app">
            <div className="container">
                <div className="badge" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <span>TON Dice · Mini App</span>
                    <span className="status">Кошелёк: скоро</span>
                </div>
                <div className="title">Привет, {username}!</div>
                <div className="subtitle">{tgAvailable ? 'WebApp активен' : 'Открой Mini App через Telegram для полного функционала'}</div>

                <div className="layout">
                    <section className="card">
                        <div className={`wheel ${spinning ? 'spinning' : ''}`} id="wheel"></div>
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
                        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                            <button className="button button-primary" onClick={onSpin}>Сделать ставку и крутить</button>
                            <button className="button button-secondary" onClick={() => setTarget(50)}>50/50</button>
                            <button className="button button-secondary" onClick={() => setTarget((t) => Math.max(1, t - 5))}>-5</button>
                            <button className="button button-secondary" onClick={() => setTarget((t) => Math.min(100, t + 5))}>+5</button>
                            <button className="button button-secondary" onClick={() => setAmount((a) => Math.max(1, Math.floor(a / 2)))}>1/2</button>
                            <button className="button button-secondary" onClick={() => setAmount((a) => a * 2)}>x2</button>
                            <button className="button button-secondary" onClick={() => onAuto(10)}>Auto x10</button>
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
                            <div className="status">{connected ? `Подключен: ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : 'Скоро добавим подключение TON-кошелька'}</div>
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
    return <InnerApp />;
}


