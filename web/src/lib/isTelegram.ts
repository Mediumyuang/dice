export function getTG() {
    return (window as any)?.Telegram?.WebApp
}

export function isTelegramWebApp(): boolean {
    const tg = getTG();
    return !!tg && typeof tg.initData === 'string' && tg.initData.length > 0;
}
