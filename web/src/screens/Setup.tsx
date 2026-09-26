import { Check, Circle, Copy, ExternalLink, Eye, EyeOff, Loader2, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useToast } from "../components/ui";
import { clearConfig, DEFAULTS, type Config } from "../lib/config";
import { copy } from "../lib/export";
import { setup, verifyPassphrase, type SetupStep } from "../lib/store";
import { generatePassphrase } from "../lib/vault";

type Mode = "first" | "login";

const STEPS: { id: SetupStep; label: string }[] = [
  { id: "access", label: "Verifica accesso al repo" },
  { id: "branch", label: "Installazione worker e branch dati cifrato" },
  { id: "secrets", label: "Salvataggio segreti su GitHub" },
  { id: "verify", label: "Verifica chiave privata" },
];

function Secret({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder?: string; id: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-group">
      <input id={id} className="input mono" type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} />
      <button type="button" className="btn btn-ghost" onClick={() => setShow(!show)} aria-label={show ? "Nascondi" : "Mostra"}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export function Setup({ current, onDone }: { current: Config | null; onDone: (c: Config) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(current ? "login" : "first");
  const [repo, setRepo] = useState(current?.repo ?? DEFAULTS.repo);
  const [token, setToken] = useState(current?.token ?? "");
  const [apify, setApify] = useState("");
  const [pass, setPass] = useState(current?.passphrase ?? (current ? "" : generatePassphrase()));
  const [dataBranch, setDataBranch] = useState(current?.dataBranch ?? DEFAULTS.dataBranch);
  const [codeRef, setCodeRef] = useState(current?.codeRef ?? DEFAULTS.codeRef);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<SetupStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cfg: Config = { repo: repo.trim().replace(/^https:\/\/github\.com\//, "").replace(/\/$/, ""), token: token.trim(), passphrase: pass.trim(), dataBranch: dataBranch.trim(), codeRef: codeRef.trim() };
  const ready = /^[\w.-]+\/[\w.-]+$/.test(cfg.repo) && cfg.token.length > 10 && cfg.passphrase.length >= 12 && (mode === "login" || !!current || apify.trim().length > 10);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "first") await setup(cfg, apify, setStep);
      else await verifyPassphrase(cfg);
      onDone(cfg);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  const stepIndex = step ? STEPS.findIndex((s) => s.id === step) : -1;

  return (
    <div className="container narrow" style={{ padding: "40px var(--gutter) 64px" }}>
      <div className="panel">
        <div className="panel-head">
          <h1>{current ? "Impostazioni" : "Configura Slidemine"}</h1>
          <p>Tutto gira gratis su GitHub Actions e Apify. Il tuo account Instagram non viene mai usato. I risultati sono cifrati: solo chi ha la chiave privata li può leggere.</p>
        </div>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === "first"} onClick={() => setMode("first")}>
            {current ? "Reinstalla / aggiorna" : "Prima configurazione"}
          </button>
          <button role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>
            {current ? "Dispositivo" : "Ho già configurato"}
          </button>
        </div>

        <div className="panel-body">
          <div className="steps">
            <div className="step">
              <span className="step-n">1</span>
              <div className="field">
                <h3>Token GitHub</h3>
                <p>
                  Crea un token “fine-grained” limitato al solo repo <span className="code">{cfg.repo || "owner/repo"}</span>.
                  {mode === "first" && " Permessi richiesti:"}
                </p>
                {mode === "first" ? (
                  <ul>
                    <li><b>Contents</b>: Read and write</li>
                    <li><b>Workflows</b>: Read and write</li>
                    <li><b>Secrets</b>: Read and write</li>
                    <li><b>Actions</b>: Read-only</li>
                  </ul>
                ) : (
                  <ul>
                    <li><b>Contents</b>: Read and write · <b>Actions</b>: Read-only</li>
                  </ul>
                )}
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <a className="btn btn-sm" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                    Crea token <ExternalLink size={13} />
                  </a>
                </div>
                <label className="sr-only" htmlFor="tok">Token GitHub</label>
                <Secret id="tok" value={token} onChange={setToken} placeholder="github_pat_…" />
                <div className="field" style={{ marginTop: 10 }}>
                  <label htmlFor="repo">Repository</label>
                  <input id="repo" className="input mono" value={repo} onChange={(e) => setRepo(e.target.value)} spellCheck={false} />
                </div>
              </div>
            </div>

            {mode === "first" && (
              <div className="step">
                <span className="step-n">2</span>
                <div className="field">
                  <h3>Token Apify {current && <span className="muted" style={{ fontWeight: 400 }}>(lascia vuoto per non cambiarlo)</span>}</h3>
                  <p>Apify recupera i post dai suoi server, senza login Instagram. Il piano gratuito include 5$ di crediti al mese: bastano per diversi profili da 300 post.</p>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <a className="btn btn-sm" href="https://console.apify.com/sign-up" target="_blank" rel="noreferrer">
                      Account gratuito <ExternalLink size={13} />
                    </a>
                    <a className="btn btn-sm" href="https://console.apify.com/settings/integrations" target="_blank" rel="noreferrer">
                      Copia il token <ExternalLink size={13} />
                    </a>
                  </div>
                  <label className="sr-only" htmlFor="apify">Token Apify</label>
                  <Secret id="apify" value={apify} onChange={setApify} placeholder="apify_api_…" />
                </div>
              </div>
            )}

            <div className="step">
              <span className="step-n">{mode === "first" ? 3 : 2}</span>
              <div className="field">
                <h3>Chiave privata</h3>
                <p>
                  {mode === "first"
                    ? "Cifra ogni risultato. Salvala in un posto sicuro (es. password manager): serve per accedere da altri dispositivi e non si può recuperare."
                    : "La chiave che hai salvato durante la prima configurazione."}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label className="sr-only" htmlFor="pass">Chiave privata</label>
                    <Secret id="pass" value={pass} onChange={setPass} placeholder="xxxxxx-xxxxxx-xxxxxx-xxxxxx" />
                  </div>
                  {mode === "first" && (
                    <>
                      <button className="btn btn-icon" type="button" title="Copia" aria-label="Copia chiave" onClick={async () => (await copy(pass)) && toast("Chiave copiata")}>
                        <Copy size={15} />
                      </button>
                      <button className="btn btn-icon" type="button" title="Genera nuova" aria-label="Genera nuova chiave" onClick={() => setPass(generatePassphrase())}>
                        <RefreshCw size={15} />
                      </button>
                    </>
                  )}
                </div>
                {mode === "first" && current && (
                  <div className="note" style={{ marginTop: 10 }}>
                    <ShieldCheck size={15} />
                    Cambiare chiave rende illeggibili le analisi già fatte con la chiave precedente.
                  </div>
                )}
              </div>
            </div>
          </div>

          <details>
            <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>Avanzate</summary>
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <div className="field">
                <label htmlFor="db">Branch dati</label>
                <input id="db" className="input mono" value={dataBranch} onChange={(e) => setDataBranch(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="cr">Branch del codice worker</label>
                <input id="cr" className="input mono" value={codeRef} onChange={(e) => setCodeRef(e.target.value)} />
              </div>
            </div>
          </details>

          {busy && mode === "first" && (
            <ul className="checklist">
              {STEPS.map((s, i) => (
                <li key={s.id} data-s={i < stepIndex ? "done" : i === stepIndex ? "active" : "todo"}>
                  {i < stepIndex ? <Check size={15} /> : i === stepIndex ? <Loader2 size={15} className="spin" /> : <Circle size={15} />}
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          {error && <div className="alert" role="alert">{error}</div>}
        </div>

        <div className="panel-foot">
          {current && (
            <button
              className="btn btn-ghost btn-danger"
              style={{ marginRight: "auto" }}
              onClick={() => {
                clearConfig();
                location.hash = "#/";
                location.reload();
              }}
            >
              <LogOut size={15} /> Esci da questo dispositivo
            </button>
          )}
          {current && (
            <a className="btn" href="#/">
              Annulla
            </a>
          )}
          <button className="btn btn-primary" disabled={!ready || busy} onClick={submit}>
            {busy && <Loader2 size={15} className="spin" />}
            {mode === "first" ? (current ? "Reinstalla" : "Configura") : "Accedi"}
          </button>
        </div>
      </div>
    </div>
  );
}
