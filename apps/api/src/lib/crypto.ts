import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Generates a cryptographically secure random server seed (64 hex chars = 32 bytes).
 */
export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hashes a seed using SHA-256 and returns the hex digest.
 * Used to create the server seed hash that is shared with clients before the game.
 */
export function hashSeed(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

/**
 * Verifies Telegram Mini App initData using HMAC-SHA-256.
 * Per Telegram documentation:
 * 1. Create secret_key = HMAC_SHA256("WebAppData", bot_token)
 * 2. Create data_check_string from sorted key=value pairs (excluding hash)
 * 3. Verify: HMAC_SHA256(secret_key, data_check_string) === hash
 *
 * Also validates that auth_date is not older than maxAgeSeconds.
 *
 * @param initData - The raw initData query string from Telegram WebApp
 * @param botToken - The bot token for HMAC verification
 * @param maxAgeSeconds - Maximum age of the initData in seconds (default: 1 hour)
 * @returns The parsed data if valid, or null if verification fails
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 3600
): Record<string, string> | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return null;
    }

    // Build data_check_string: sort all key=value pairs except "hash", join with \n
    const entries: [string, string][] = [];
    for (const [key, value] of params.entries()) {
      if (key !== 'hash') {
        entries.push([key, value]);
      }
    }
    entries.sort(([a], [b]) => a.localeCompare(b));

    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    // Create secret key: HMAC_SHA256("WebAppData", bot_token)
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate hash: HMAC_SHA256(secret_key, data_check_string)
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Constant-time comparison
    if (calculatedHash.length !== hash.length) {
      return null;
    }

    const calcBuf = Buffer.from(calculatedHash, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');

    if (!timingSafeEqual(calcBuf, hashBuf)) {
      return null;
    }

    // Validate auth_date freshness
    const authDate = params.get('auth_date');
    if (!authDate) {
      return null;
    }

    const authTimestamp = parseInt(authDate, 10);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(authTimestamp) || now - authTimestamp > maxAgeSeconds) {
      return null;
    }

    // Return parsed data as a plain object
    const result: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Generates a short, URL-safe referral code.
 * Format: 8 alphanumeric characters.
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Computes SHA-256 hash of arbitrary data (e.g., replay data for integrity).
 */
export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}
