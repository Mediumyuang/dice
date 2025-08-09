import { bufferToUint64, generateRandomBytes, hmacSha256, sha256Hex } from './rng.js';

// Generate a server seed (hex) using secure randomness mixed with a secret
export function generateServerSeed(secret: string): string {
    const random = generateRandomBytes(32);
    const digest = hmacSha256(Buffer.from(secret, 'utf8'), random.toString('hex'));
    return Buffer.from(digest).toString('hex');
}

export function serverSeedHash(serverSeed: string): string {
    return sha256Hex(Buffer.from(serverSeed, 'hex'));
}

export function verifyServerSeed(serverSeed: string, expectedHash: string): boolean {
    return serverSeedHash(serverSeed) === expectedHash;
}

// Deterministic roll in range 0..99 (inclusive), provably fair
export function computeRoll(serverSeed: string, clientSeed: string, nonce: number): number {
    const key = Buffer.from(serverSeed, 'hex');
    const message = `${clientSeed}:${nonce}`;
    const digest = hmacSha256(key, message);
    const value = bufferToUint64(digest.subarray(0, 8));
    const max = 2n ** 64n;
    const roll = Number((value * 100n) / max); // 0..99
    return roll;
}


