import fs from 'node:fs';
import path from 'node:path';
import localtunnel from 'localtunnel';

async function main() {
    const port = Number(process.env.WEB_PORT ?? 5173);
    const tunnel = await localtunnel({ port });
    const url = tunnel.url; // e.g., https://*.loca.lt
    const envPath = path.resolve(process.cwd(), '.env');
    let content = '';
    try { content = fs.readFileSync(envPath, 'utf8'); } catch { }
    const lines = content.split(/\r?\n/).filter(Boolean).filter((l) => !l.startsWith('WEBAPP_URL='));
    lines.unshift(`WEBAPP_URL=${url}`);
    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
    process.stdout.write(`[tunnel] WEBAPP_URL=${url}\n`);

    const cleanup = async () => {
        try { await tunnel.close(); } catch { }
        process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch((err) => {
    console.error('[tunnel] failed:', err);
    process.exit(1);
});


