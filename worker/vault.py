"""AES-256-GCM envelope encryption, byte-compatible with web/src/lib/vault.ts.

The repo is public, so every file the worker writes to the data branch goes
through here. Key = PBKDF2-SHA256(passphrase, salt, ITERATIONS).
"""

import base64
import json
import os
from functools import lru_cache

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ITERATIONS = 210_000


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


@lru_cache(maxsize=64)
def _key(passphrase: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS)
    return kdf.derive(passphrase.encode())


class Vault:
    def __init__(self, passphrase: str):
        if not passphrase:
            raise ValueError("VAULT_KEY is empty")
        self.passphrase = passphrase
        # One salt per process: key derivation is slow, the IV keeps each file unique.
        self.salt = os.urandom(16)

    def encrypt(self, obj) -> dict:
        iv = os.urandom(12)
        data = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()
        ct = AESGCM(_key(self.passphrase, self.salt)).encrypt(iv, data, None)
        return {"v": 1, "iter": ITERATIONS, "salt": _b64(self.salt), "iv": _b64(iv), "ct": _b64(ct)}

    def decrypt(self, env: dict):
        salt = base64.b64decode(env["salt"])
        iv = base64.b64decode(env["iv"])
        ct = base64.b64decode(env["ct"])
        if env.get("iter", ITERATIONS) != ITERATIONS:
            raise ValueError("unsupported iteration count")
        return json.loads(AESGCM(_key(self.passphrase, salt)).decrypt(iv, ct, None))
