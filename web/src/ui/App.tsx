import React, { useEffect, useState } from 'react';

type RollResult = {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    roll: number;
    win: boolean;
    payout: number;
    balance: number;
};

export function App(): React.JSX.Element {
    const [tgAvailable, setTgAvailable] = useState<boolean>(false);
    const [username, setUsername] = useState<string>('');
    const [target, setTarget] = useState<number>(50);
    const [amount, setAmount] = useState<number>(10);
    const [clientSeed, setClientSeed] = useState<string>('');
    const [status, setStatus] = useState<string>('');
    const [spinning, setSpinning] = useState<boolean>(false);

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
    }

    return (
        <div className="app">
            <div className="container">
                <div className="badge">TON Dice · Mini App</div>
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
                        </div>
                    </section>
                </div>
            </div>

            <div className="footer">Без картинок · ультра современный неон/стекло дизайн</div>
        </div>
    );
}


