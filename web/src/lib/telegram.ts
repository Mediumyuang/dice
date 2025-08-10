export function getTG() { 
    return (window as any)?.Telegram?.WebApp 
}

export function isTG() { 
    const tg = getTG(); 
    return !!tg && typeof tg.initData === 'string' && tg.initData.length > 0; 
}

export function initTG() {
    if (!isTG()) return null;
    
    const tg = getTG(); 
    try { 
        tg.ready(); 
        tg.expand(); 
        return { 
            tg, 
            user: (tg as any).initDataUnsafe?.user || null 
        }; 
    } catch { 
        return null; 
    }
}
