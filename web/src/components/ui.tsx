import { Check, Monitor, Moon, Sun } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getPref, setPref } from "../lib/config";
import type { JobState, JobStatus } from "../lib/types";

export const STATE_LABEL: Record<JobState, string> = {
  queued: "In coda",
  fetching: "Recupero post",
  reading: "Lettura testo",
  done: "Completato",
  partial: "Parziale",
  error: "Errore",
};

export function StatusPill({ state }: { state: JobState }) {
  return (
    <span className="pill" data-state={state}>
      <span className="dot" />
      {STATE_LABEL[state]}
    </span>
  );
}

export function jobProgress(s: JobStatus): number | null {
  if (s.state === "done") return 1;
  if (s.state === "reading" && s.totalSlides) return Math.min(1, s.slides / s.totalSlides);
  if (s.state === "reading" && s.total) return Math.min(1, s.processed / s.total);
  return null;
}

export function Progress({ value }: { value: number | null }) {
  return (
    <div className={`progress${value == null ? " indeterminate" : ""}`} role="progressbar" aria-valuenow={value == null ? undefined : Math.round(value * 100)}>
      <i style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
    </div>
  );
}

const AVATAR_COLORS = ["#0a0a0a", "#e60023", "#0060df", "#7c3aed", "#0a7c42", "#b25c00", "#db2777", "#0891b2"];
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className="avatar" style={{ background: AVATAR_COLORS[h % AVATAR_COLORS.length], width: size, height: size, fontSize: size * 0.4 }}>
      {name.replace(/[^a-z0-9]/gi, "")[0] ?? "?"}
    </span>
  );
}

export function Brand() {
  return (
    <a className="brand" href="#/">
      <span className="brand-mark" aria-hidden>
        <span style={{ width: 12 }} />
        <span style={{ width: 9 }} />
        <span style={{ width: 6 }} />
      </span>
      Slidemine
    </a>
  );
}

type Theme = "system" | "light" | "dark";
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getPref<Theme>("theme", "system"));
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", theme);
    setPref("theme", theme);
  }, [theme]);
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label = { system: "Tema: sistema", light: "Tema: chiaro", dark: "Tema: scuro" }[theme];
  return (
    <button className="btn btn-ghost btn-icon" onClick={() => setTheme(next[theme])} title={label} aria-label={label}>
      <Icon size={16} />
    </button>
  );
}

// ---------- toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <Check size={14} />
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

/** Calls fn now and then every `ms` while `active`; pauses in hidden tabs. */
export function usePolling(fn: () => void | Promise<void>, ms: number, active: boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    let stop = false;
    let t: number | undefined;
    const tick = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        try {
          await ref.current();
        } catch {
          /* surfaced by the caller */
        }
      }
      if (!stop) t = window.setTimeout(tick, ms);
    };
    t = window.setTimeout(tick, ms);
    const onVis = () => document.visibilityState === "visible" && ref.current();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, active]);
}
