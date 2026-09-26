import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Avatar, jobProgress, Progress, StatusPill, usePolling, useToast } from "../components/ui";
import { getPref, setPref, type Config } from "../lib/config";
import { fmtAgo, parseUsername } from "../lib/format";
import { effectiveStatus, listJobs, queueJob, updateWorker, workerNeedsUpdate } from "../lib/store";
import { ACTIVE, type JobSummary } from "../lib/types";

const LIMITS = [
  { v: 1000, label: "Tutti i post" },
  { v: 300, label: "Ultimi 300" },
  { v: 100, label: "Ultimi 100" },
  { v: 30, label: "Ultimi 30 (test)" },
];

export function Home({ cfg }: { cfg: Config }) {
  const toast = useToast();
  const [input, setInput] = useState("");
  const [limit, setLimit] = useState<number>(() => getPref("limit", 1000));
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setJobs(await listJobs(cfg));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [cfg]);

  useEffect(() => {
    refresh();
    workerNeedsUpdate(cfg).then(setNeedsUpdate, () => {});
  }, [cfg, refresh]);

  const anyActive = !!jobs?.some((j) => ACTIVE.includes(effectiveStatus(j).state));
  usePolling(refresh, anyActive ? 8000 : 30000, true);

  async function start() {
    const username = parseUsername(input);
    if (!username) {
      setInputError("Inserisci un username valido, es. @nomeprofilo o il link del profilo.");
      return;
    }
    setInputError(null);
    setStarting(true);
    try {
      const id = await queueJob(cfg, username, limit);
      toast(`Analisi di @${username} avviata`);
      setInput("");
      location.hash = `#/job/${id}`;
    } catch (e) {
      setInputError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <section className="hero container">
        <h1>
          Il testo dei post migliori,
          <br />
          in ordine di popolarità.
        </h1>
        <p>Inserisci un profilo Instagram pubblico. Slidemine legge ogni carousel e ogni post e li ordina per interazioni. Puoi chiudere la pagina: il lavoro continua da solo.</p>

        <form
          className="command"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <span className="prefix">instagram.com/</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="nomeprofilo"
            aria-label="Profilo Instagram"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
          <button className="btn btn-primary" disabled={starting || !input.trim()}>
            {starting ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
            <span className="label">Avvia</span>
          </button>
        </form>
        <div className="command-opts">
          <span>Quanti post:</span>
          <select
            className="select"
            style={{ width: "auto", height: 32 }}
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPref("limit", Number(e.target.value));
            }}
          >
            {LIMITS.map((l) => (
              <option key={l.v} value={l.v}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="faint">· reel esclusi · testo IT/EN</span>
        </div>
        <div className="command-error" role="alert">
          {inputError}
        </div>
      </section>

      <section className="container narrow" style={{ paddingBottom: 48 }}>
        {needsUpdate && (
          <div className="banner" data-tone="warn" style={{ marginBottom: 16 }}>
            <div className="banner-row">
              <span>È disponibile una versione aggiornata del worker.</span>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  try {
                    await updateWorker(cfg);
                    setNeedsUpdate(false);
                    toast("Worker aggiornato");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Aggiorna
              </button>
            </div>
          </div>
        )}

        <div className="section-head">
          <h2>Analisi</h2>
          <button className="btn btn-ghost btn-sm" onClick={refresh} aria-label="Aggiorna elenco">
            <RefreshCw size={14} />
          </button>
        </div>
        {error && (
          <div className="alert" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}
        {jobs === null ? (
          <div className="jobs">
            {[0, 1, 2].map((i) => (
              <div className="job-row" key={i}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                <div className="job-main">
                  <div className="skeleton" style={{ width: "40%", height: 14 }} />
                  <div className="skeleton" style={{ width: "70%", height: 12 }} />
                </div>
                <span />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty">
            <strong>Nessuna analisi ancora</strong>
            Scrivi un profilo qui sopra per iniziare.
          </div>
        ) : (
          <div className="jobs">
            {jobs.map((j) => {
              const s = effectiveStatus(j);
              const active = ACTIVE.includes(s.state);
              return (
                <a className="job-row" key={j.id} href={`#/job/${j.id}`}>
                  <Avatar name={j.request.username} />
                  <div className="job-main">
                    <div className="job-title">
                      <strong>@{j.request.username}</strong>
                      <StatusPill state={s.state} />
                    </div>
                    {active ? (
                      <>
                        <Progress value={jobProgress(s)} />
                        <span className="job-sub">{s.message}</span>
                      </>
                    ) : (
                      <span className="job-sub">
                        {s.state === "error" ? s.message : `${s.processed} post letti`}
                      </span>
                    )}
                  </div>
                  <div className="job-meta">
                    <span>{fmtAgo(s.finishedAt ?? s.updatedAt ?? j.request.requestedAt)}</span>
                    {active && s.total > 0 && (
                      <span className="mono">
                        {s.processed}/{s.total}
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
