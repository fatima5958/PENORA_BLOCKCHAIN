// src/lib/crypto/penoraKeys.ts
// ============================================================================
// PENORA BLOCKCHAIN — STEEMIT-STYLE CRYPTOGRAPHIC KEY ENGINE
// Implements Ed25519 keypair generation, Base58Check formatting,
// Steemit-style key authorities (Owner, Active, Posting, Memo),
// and detached challenge signing / verification via TweetNaCl.
// ============================================================================

import nacl from 'tweetnacl';

// Bitcoin / Steem standard Base58 alphabet (excludes 0, O, I, l to prevent misreading)
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ALPHABET_MAP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  ALPHABET_MAP[ALPHABET[i]] = i;
}

/**
 * Double SHA-256 checksum for Base58Check validation (first 4 bytes).
 * Uses a pure JS implementation so it operates synchronously in both
 * browser and Node environments.
 */
function sha256(bytes: Uint8Array): Uint8Array {
  // Simple SHA-256 helper using standard 32-bit math
  function rotr(n: number, x: number) {
    return (x >>> n) | (x << (32 - n));
  }
  function ch(x: number, y: number, z: number) {
    return (x & y) ^ (~x & z);
  }
  function maj(x: number, y: number, z: number) {
    return (x & y) ^ (x & z) ^ (y & z);
  }
  function sigma0(x: number) {
    return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
  }
  function sigma1(x: number) {
    return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
  }
  function gamma0(x: number) {
    return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
  }
  function gamma1(x: number) {
    return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);
  }

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const length = bytes.length;
  const bitLength = length * 8;
  const numBlocks = Math.ceil((length + 9) / 64);
  const totalLength = numBlocks * 64;
  const padded = new Uint8Array(totalLength);
  padded.set(bytes);
  padded[length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLength - 4, bitLength >>> 0, false);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000), false);

  const W = new Uint32Array(64);

  for (let b = 0; b < numBlocks; b++) {
    const offset = b * 64;
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      W[i] = (gamma1(W[i - 2]) + W[i - 7] + gamma0(W[i - 15]) + W[i - 16]) >>> 0;
    }

    let a = H0, bVal = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let i = 0; i < 64; i++) {
      const T1 = (h + sigma1(e) + ch(e, f, g) + K[i] + W[i]) >>> 0;
      const T2 = (sigma0(a) + maj(a, bVal, c)) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + T1) >>> 0;
      d = c;
      c = bVal;
      bVal = a;
      a = (T1 + T2) >>> 0;
    }

    H0 = (H0 + a) >>> 0;
    H1 = (H1 + bVal) >>> 0;
    H2 = (H2 + c) >>> 0;
    H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0;
    H5 = (H5 + f) >>> 0;
    H6 = (H6 + g) >>> 0;
    H7 = (H7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, H0, false);
  outView.setUint32(4, H1, false);
  outView.setUint32(8, H2, false);
  outView.setUint32(12, H3, false);
  outView.setUint32(16, H4, false);
  outView.setUint32(20, H5, false);
  outView.setUint32(24, H6, false);
  outView.setUint32(28, H7, false);
  return out;
}

export function doubleSha256(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

// ----------------------------------------------------------------------------
// Base58 & Base58Check Encoding / Decoding
// ----------------------------------------------------------------------------

export function encodeBase58(source: Uint8Array): string {
  if (source.length === 0) return '';
  const digits = [0];
  for (let i = 0; i < source.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += source[i];
    let carry = 0;
    for (let j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = '';
  // Leading zeros
  for (let k = 0; source[k] === 0 && k < source.length - 1; k++) {
    str += '1';
  }
  for (let q = digits.length - 1; q >= 0; q--) {
    str += ALPHABET[digits[q]];
  }
  return str;
}

export function decodeBase58(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (!(c in ALPHABET_MAP)) throw new Error(`Invalid Base58 character: ${c}`);
    for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
    bytes[0] += ALPHABET_MAP[c];
    let carry = 0;
    for (let j = 0; j < bytes.length; ++j) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let leadingZeros = 0;
  for (let k = 0; str[k] === '1' && k < str.length - 1; k++) {
    leadingZeros++;
  }
  const result = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[result.length - 1 - i] = bytes[i];
  }
  return result;
}

export function encodeBase58Check(payload: Uint8Array): string {
  const checksum = doubleSha256(payload).slice(0, 4);
  const combined = new Uint8Array(payload.length + 4);
  combined.set(payload, 0);
  combined.set(checksum, payload.length);
  return encodeBase58(combined);
}

export function decodeBase58Check(str: string): Uint8Array {
  const decoded = decodeBase58(str);
  if (decoded.length < 4) throw new Error('Base58Check string too short');
  const payload = decoded.slice(0, decoded.length - 4);
  const checksum = decoded.slice(decoded.length - 4);
  const expectedChecksum = doubleSha256(payload).slice(0, 4);
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== expectedChecksum[i]) {
      throw new Error('Base58Check checksum mismatch');
    }
  }
  return payload;
}

// ----------------------------------------------------------------------------
// Steemit-Style Key Types & Formatting
// ----------------------------------------------------------------------------

export type KeyRole = 'owner' | 'active' | 'posting' | 'memo';

export interface KeyPair {
  role: KeyRole;
  privateKeyWif: string;  // Starts with '5', Base58Check formatted 32-byte seed
  publicKeyPen: string;   // Starts with 'PEN', Base58Check formatted 32-byte public key
  rawPublicKey: Uint8Array;
}

export interface AccountKeySuite {
  owner: KeyPair;
  active: KeyPair;
  posting: KeyPair;
  memo: KeyPair;
}

export interface PublicAuthorities {
  owner_public_key: string;
  active_public_key: string;
  posting_public_key: string;
  memo_public_key: string;
}

/**
 * Format a 32-byte raw public key into the approved Steemit-style "PEN..." representation.
 */
export function formatPublicKey(rawPublicKey: Uint8Array): string {
  if (rawPublicKey.length !== 32) throw new Error('Public key must be 32 bytes');
  return 'PEN' + encodeBase58Check(rawPublicKey);
}

/**
 * Parse a "PEN..." public key string back into raw 32 bytes.
 */
export function parsePublicKey(penPublicKey: string): Uint8Array {
  if (!penPublicKey.startsWith('PEN')) {
    throw new Error('PENORA public key must start with prefix "PEN"');
  }
  const raw = decodeBase58Check(penPublicKey.slice(3));
  if (raw.length !== 32) throw new Error('Invalid public key byte length');
  return raw;
}

/**
 * Format a 32-byte raw private key seed into Steemit WIF format (starts with '5').
 */
export function formatPrivateKeyWif(rawSeed: Uint8Array): string {
  if (rawSeed.length !== 32) throw new Error('Private seed must be 32 bytes');
  // WIF prefix 0x80 (128 in decimal) ensures the Base58 string begins with '5'
  const payload = new Uint8Array(33);
  payload[0] = 0x80;
  payload.set(rawSeed, 1);
  return encodeBase58Check(payload);
}

/**
 * Parse a Steemit WIF private key string (starts with '5') back to a 32-byte seed.
 */
export function parsePrivateKeyWif(wif: string): Uint8Array {
  const payload = decodeBase58Check(wif);
  if (payload.length !== 33 || payload[0] !== 0x80) {
    throw new Error('Invalid WIF private key format; must start with 5 and contain 32-byte payload');
  }
  return payload.slice(1);
}

// ----------------------------------------------------------------------------
// Key Generation & Derivation
// ----------------------------------------------------------------------------

/**
 * Generate a single keypair for a specific authority role.
 */
export function generateKeyPair(role: KeyRole): KeyPair {
  // Generate 32 bytes of cryptographically secure random entropy for seed
  const seed = nacl.randomBytes(32);
  const naclKeys = nacl.sign.keyPair.fromSeed(seed);

  return {
    role,
    privateKeyWif: formatPrivateKeyWif(seed),
    publicKeyPen: formatPublicKey(naclKeys.publicKey),
    rawPublicKey: naclKeys.publicKey,
  };
}

/**
 * Generate the complete Steemit-style four-key authority suite.
 */
export function generateAccountKeySuite(): AccountKeySuite {
  return {
    owner: generateKeyPair('owner'),
    active: generateKeyPair('active'),
    posting: generateKeyPair('posting'),
    memo: generateKeyPair('memo'),
  };
}

/**
 * Given any private key WIF, derive the corresponding public key and inspect matching role.
 */
export function deriveKeyInfoFromWif(wif: string): {
  rawSeed: Uint8Array;
  rawSecretKey: Uint8Array;
  publicKeyPen: string;
  rawPublicKey: Uint8Array;
} {
  const rawSeed = parsePrivateKeyWif(wif);
  const naclKeys = nacl.sign.keyPair.fromSeed(rawSeed);
  return {
    rawSeed,
    rawSecretKey: naclKeys.secretKey,
    publicKeyPen: formatPublicKey(naclKeys.publicKey),
    rawPublicKey: naclKeys.publicKey,
  };
}

// ----------------------------------------------------------------------------
// Cryptographic Challenge Signing & Verification
// ----------------------------------------------------------------------------

/**
 * Sign a server challenge string using a private key WIF.
 * Returns detached signature encoded in hex.
 */
export function signChallenge(challenge: string, privateKeyWif: string): string {
  const keyInfo = deriveKeyInfoFromWif(privateKeyWif);
  const messageBytes = new TextEncoder().encode(challenge);
  const signature = nacl.sign.detached(messageBytes, keyInfo.rawSecretKey);
  // Convert 64-byte signature to hex
  return Array.from(signature)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify a detached challenge signature against a registered public key.
 */
export function verifyChallengeSignature(
  challenge: string,
  signatureHex: string,
  publicKeyPen: string
): boolean {
  try {
    const rawPublicKey = parsePublicKey(publicKeyPen);
    const messageBytes = new TextEncoder().encode(challenge);
    if (signatureHex.length !== 128) return false;
    const signatureBytes = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      signatureBytes[i] = parseInt(signatureHex.slice(i * 2, i * 2 + 2), 16);
    }
    return nacl.sign.detached.verify(messageBytes, signatureBytes, rawPublicKey);
  } catch {
    return false;
  }
}
