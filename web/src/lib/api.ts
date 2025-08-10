export const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function api(path: string, opts: RequestInit = {}) {
    const res = await fetch(API_BASE + path, {
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        ...opts,
    });
    
    const ct = res.headers.get('content-type') || '';
    
    if (!res.ok) {
        let msg = await res.text().catch(() => '');
        throw new Error(`API ${res.status}: ${msg.slice(0, 200)}`);
    }
    
    if (!ct.includes('application/json')) {
        const text = await res.text();
        throw new Error(`API non-JSON response. content-type=${ct}. First bytes: ${text.slice(0, 80)}`);
    }
    
    return res.json();
}
