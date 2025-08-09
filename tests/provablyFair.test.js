import { describe, it, expect } from 'vitest';
import { computeRoll, generateServerSeed, serverSeedHash, verifyServerSeed } from '../src/core/provablyFair.js';
describe('provably fair', () => {
    it('hash matches serverSeed', () => {
        const s = generateServerSeed('secret');
        const h = serverSeedHash(s);
        expect(h).toMatch(/^[0-9a-f]{64}$/);
        expect(verifyServerSeed(s, h)).toBe(true);
    });
    it('deterministic roll for same inputs', () => {
        const serverSeed = generateServerSeed('secret');
        const clientSeed = 'client';
        const a = computeRoll(serverSeed, clientSeed, 0);
        const b = computeRoll(serverSeed, clientSeed, 0);
        const c = computeRoll(serverSeed, clientSeed, 1);
        expect(a).toBe(b);
        expect(a).not.toBe(c);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(100);
    });
});
