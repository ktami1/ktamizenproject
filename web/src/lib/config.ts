export interface Config {
  repo: string; // owner/name
  token: string;
  passphrase: string;
  dataBranch: string;
  codeRef: string;
}

const KEY = "slidemine.config";

export const DEFAULTS = {
  repo: "ktami1/ktamizenproject",
  dataBranch: "ig-data",
  codeRef: "claude/instagram-scraping-ocr-0yhj79",
};

export function loadConfig(): Config | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Config;
    return c.token && c.passphrase && c.repo ? c : null;
  } catch {
    return null;
  }
}

export function saveConfig(c: Config) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage blocked: config lives for this tab only */
  }
}

export function clearConfig() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function getPref<T>(name: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`slidemine.pref.${name}`);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function setPref(name: string, value: unknown) {
  try {
    localStorage.setItem(`slidemine.pref.${name}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
