import * as Crypto from 'expo-crypto';

/**
 * Passwords are never stored in plain text. Each user gets a random salt;
 * we hash `salt:password` with SHA-256 and store only the hash + salt.
 * This is fine for "protect against casually reading AsyncStorage", but it
 * is NOT a substitute for a real backend + bcrypt/argon2 if this app ever
 * gets a server. See README "Known limits".
 */

export async function generateSalt(byteLength = 16): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const hash = await hashPassword(password, salt);
  return hash === expectedHash;
}
