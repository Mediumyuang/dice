import crypto from 'node:crypto';

export function sha256Hex(input: string | Buffer): string {
    return crypto.createHash('sha256').update(input).digest('hex');
}

export function hmacSha256(key: Buffer, message: string): Buffer {
    return crypto.createHmac('sha256', key).update(message).digest();
}

export function generateRandomBytes(size: number): Buffer {
    return crypto.randomBytes(size);
}

export function bufferToUint64(buffer: Buffer): bigint {
    let result = 0n;
    for (let i = 0; i < 8; i += 1) {
        result = (result << 8n) | BigInt(buffer[i]);
    }
    return result;
}


