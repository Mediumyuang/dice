import React from 'react';

interface BrowserBlockerProps {
    botUsername: string;
}

export function BrowserBlocker({ botUsername }: BrowserBlockerProps): React.JSX.Element {
    const telegramUrl = `https://t.me/${botUsername}?startapp=1`;

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
                    href={telegramUrl}
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
