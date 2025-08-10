import { getTG, isTelegramWebApp } from './isTelegram';

export function initTelegram() {
    if (!isTelegramWebApp()) return null;

    const tg = getTG();
    try {
        tg.ready();
        tg.expand();

        const data = (window as any).Telegram.WebApp.initDataUnsafe || {};
        console.log('[TG]', { version: tg.version, platform: tg.platform, data });

        return { tg, data };
    } catch (e) {
        console.error('[TG] init error', e);
        return null;
    }
}
