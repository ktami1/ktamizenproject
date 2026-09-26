// AES-256-GCM envelopes, byte-compatible with worker/vault.py.
export const ITERATIONS = 210_000;

export interface Envelope {
  v: 1;
  iter: number;
  salt: string;
  iv: string;
  ct: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function deriveKey(passphrase: string, salt: string): Promise<CryptoKey> {
  const id = `${salt}:${passphrase}`;
  let key = keyCache.get(id);
  if (!key) {
    key = crypto.subtle
      .importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"])
      .then((base) =>
        crypto.subtle.deriveKey(
          { name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations: ITERATIONS },
          base,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        ),
      );
    keyCache.set(id, key);
  }
  return key;
}

// One salt per page load, like the worker: the random IV keeps files unique.
const sessionSalt = b64(crypto.getRandomValues(new Uint8Array(16)));

export async function encryptJSON(obj: unknown, passphrase: string): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, sessionSalt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
  return { v: 1, iter: ITERATIONS, salt: sessionSalt, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

export class WrongKeyError extends Error {
  constructor() {
    super("Chiave privata errata");
  }
}

export async function decryptJSON<T>(env: Envelope, passphrase: string): Promise<T> {
  if (env.iter !== ITERATIONS) throw new Error("Formato non supportato");
  const key = await deriveKey(passphrase, env.salt);
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, key, unb64(env.ct));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    throw new WrongKeyError();
  }
}

export function generatePassphrase(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [0, 6, 12, 18].map((i) => chars.slice(i, i + 6).join("")).join("-");
}
