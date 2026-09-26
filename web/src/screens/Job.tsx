import { ChevronDown, Copy, Download, ExternalLink, FileJson, FileSpreadsheet, FileText, LayoutGrid, List, Loader2, RotateCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PostCard, PostRow } from "../components/PostCard";
import { Avatar, jobProgress, Progress, StatusPill, usePolling, useToast } from "../components/ui";
import { getPref, setPref, type Config } from "../lib/config";
import { copy, download, toCSV, toMarkdown, toText } from "../lib/export";
import { fmtDuration, fmtFull } from "../lib/format";
import { deleteJob, effectiveStatus, loadRequest, loadResult, loadStatus, loadThumbs, retryJob } from "../lib/store";
import { ACTIVE, type JobRequest, type JobResult, type JobStatus, type JobSummary, type Post } from "../lib/types";

type Filter = "all" | "carousel" | "single";
type Sort = "score" | "likes" | "comments" | "recent" | "slides";
type View = "grid" | "list";

const SORTS: { v: Sort; label: string }[] = [
  { v: "score", label: "Più popolari" },
  { v: "likes", label: "Più like" },
  { v: "comments", label: "Più commenti" },
  { v: "recent", label: "Più recenti" },
  { v: "slides", label: "Più slide" },
];

function sortPosts(posts: Post[], sort: Sort) {
  const by: Record<Sort, (a: Post, b: Post) => number> = {
    score: (a, b) => a.rank - b.rank,
    likes: (a, b) => (b.likes ?? -1) - (a.likes ?? -1),
    comments: (a, b) => (b.comments ?? 0) - (a.comments ?? 0),
    recent: (a, b) => (b.takenAt ?? "").localeCompare(a.takenAt ?? ""),
    slides: (a, b) => b.slides.length - a.slides.length,
  };
  return [...posts].sort(by[sort]);
}

function columnsFor(w: number) {
  return w >= 1180 ? 4 : w >= 920 ? 3 : w >= 620 ? 2 : 1;
}

function useColumns() {
  const [cols, setCols] = useState(() => columnsFor(window.innerWidth));
  useEffect(() => {
    const on = () => setCols(columnsFor(window.innerWidth));
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return cols;
}

export function Job({ cfg, id }: { cfg: Config; id: string }) {
  const toast = useToast();
  const cols = useColumns();
  const [request, setRequest] = useState<JobRequest | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("score");
  const [view, setView] = useState<View>(() => getPref<View>("view", "grid"));
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadedChunks = useRef(new Set<number>());
  const lastResultKey = useRef("");

  const summary: JobSummary | null = request ? { id, request, status } : null;
  const eff = summary ? effectiveStatus(summary) : null;
  const active = !!eff && ACTIVE.includes(eff.state);

  const refresh = useCallback(async () => {
    try {
      const [req, st] = await Promise.all([loadRequest(cfg, id), loadStatus(cfg, id)]);
      if (!req) {
        setError("Analisi non trovata: forse è stata eliminata.");
        return;
      }
      setRequest(req);
      setStatus(st);
      const key = st ? `${st.nonce}:${st.state}:${st.processed}` : "";
      if (st && st.processed > 0 && key !== lastResultKey.current) {
        lastResultKey.current = key;
        const r = await loadResult(cfg, id);
        if (r) setResult(r);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [cfg, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  usePolling(refresh, 10000, active);

  // Previews: load chunks in rank order so the top posts appear first.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    const chunks = [...new Set(result.posts.map((p) => p.thumb).filter((c): c is number => c != null))].sort((a, b) => a - b);
    (async () => {
      for (const c of chunks) {
        if (cancelled) return;
        // While running, the last chunk is still being filled: reload it on every refresh.
        const last = c === chunks[chunks.length - 1] && result.state === "running";
        if (loadedChunks.current.has(c) && !last) continue;
        try {
          const t = await loadThumbs(cfg, id, c);
          loadedChunks.current.add(c);
          if (!cancelled) setThumbs((prev) => ({ ...prev, ...t }));
        } catch {
          /* previews are optional */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result, cfg, id]);

  const posts = result?.posts ?? [];
  const counts = useMemo(
    () => ({ all: posts.length, carousel: posts.filter((p) => p.kind === "carousel").length, single: posts.filter((p) => p.kind === "single").length }),
    [posts],
  );
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = posts.filter(
      (p) =>
        (filter === "all" || p.kind === filter) &&
        (!needle || p.slides.some((s) => s.paragraphs.some((t) => t.toLowerCase().includes(needle)))),
    );
    return sortPosts(list, sort);
  }, [posts, filter, q, sort]);
  const interactions = posts.reduce((n, p) => n + (p.likes ?? 0) + (p.comments ?? 0), 0);
  const username = request?.username ?? "";

  async function doRetry(refetch = false) {
    if (!summary) return;
    setBusy(true);
    try {
      await retryJob(cfg, summary, refetch);
      toast(refetch ? "Nuovo recupero avviato" : "Ripresa avviata");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!confirm(`Eliminare l'analisi di @${username}? I dati cifrati verranno rimossi dal branch.`)) return;
    setBusy(true);
    try {
      await deleteJob(cfg, id);
      toast("Analisi eliminata");
      location.hash = "#/";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function exportAs(kind: "md" | "csv" | "json" | "copy") {
    setMenu(false);
    if (!result) return;
    const base = `${username}-slidemine`;
    if (kind === "copy") copy(toText(visible)).then((ok) => ok && toast(`${visible.length} post copiati`));
    if (kind === "md") download(`${base}.md`, toMarkdown(result, visible), "text/markdown");
    if (kind === "csv") download(`${base}.csv`, toCSV(visible), "text/csv");
    if (kind === "json") download(`${base}.json`, JSON.stringify({ ...result, posts: visible }, null, 2), "application/json");
  }

  if (loading)
    return (
      <div className="center">
        <Loader2 className="spin" size={20} />
        Decifratura in corso…
      </div>
    );
  if (!request || !eff)
    return (
      <div className="center">
        <p>{error ?? "Analisi non trovata."}</p>
        <a className="btn" href="#/">
          Torna alla home
        </a>
      </div>
    );

  const progress = jobProgress(eff);

  return (
    <>
      <div className="container">
        <header className="job-header">
          <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
            <Avatar name={username} size={48} />
            <div style={{ minWidth: 0 }}>
              <h1>@{username}</h1>
              <div className="sub">
                {result?.profile.fullName && <span>{result.profile.fullName}</span>}
                <StatusPill state={eff.state} />
                <a className="btn btn-ghost btn-sm" href={`https://www.instagram.com/${username}/`} target="_blank" rel="noreferrer">
                  Profilo <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!active && (
              <button className="btn btn-sm" onClick={() => doRetry(true)} disabled={busy} title="Recupera di nuovo i post e rileggi tutto (usa crediti Apify)">
                <RotateCw size={14} /> Aggiorna dati
              </button>
            )}
            <button className="btn btn-sm btn-ghost btn-danger" onClick={doDelete} disabled={busy} aria-label="Elimina analisi" title="Elimina">
              <Trash2 size={14} />
            </button>
          </div>
        </header>

        <div className="stats">
          <div className="stat">
            <div className="k">Post letti</div>
            <div className="v">
              {fmtFull(eff.state === "queued" ? 0 : Math.max(eff.processed, posts.length))}
              {eff.total > 0 && eff.state !== "done" && <span className="faint" style={{ fontSize: 14 }}> / {eff.total}</span>}
            </div>
          </div>
          <div className="stat">
            <div className="k">Carousel</div>
            <div className="v">{fmtFull(counts.carousel)}</div>
          </div>
          <div className="stat">
            <div className="k">Post singoli</div>
            <div className="v">{fmtFull(counts.single)}</div>
          </div>
          <div className="stat">
            <div className="k">Interazioni</div>
            <div className="v">{fmtFull(interactions)}</div>
          </div>
        </div>

        {active && (
          <div className="banner">
            <div className="banner-row">
              <span>
                <b>{eff.message}</b>{" "}
                <span className="muted">
                  {eff.state === "reading" && eff.totalSlides ? `· ${eff.slides}/${eff.totalSlides} immagini ` : ""}
                  {eff.startedAt && `· ${fmtDuration(eff.startedAt)}`}
                </span>
              </span>
              {eff.runUrl && (
                <a className="btn btn-ghost btn-sm" href={eff.runUrl} target="_blank" rel="noreferrer">
                  Log <ExternalLink size={13} />
                </a>
              )}
            </div>
            <Progress value={progress} />
            <span className="muted" style={{ fontSize: 13 }}>
              {eff.state === "queued"
                ? "Il worker parte entro 1–2 minuti. Puoi chiudere questa pagina."
                : "I post più popolari vengono letti per primi e compaiono qui mentre procede."}
            </span>
          </div>
        )}
        {eff.state === "error" && (
          <div className="banner" data-tone="error">
            <div className="banner-row">
              <span>
                <b>Qualcosa è andato storto.</b> <span className="muted">{eff.message}</span>
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                {eff.runUrl && (
                  <a className="btn btn-ghost btn-sm" href={eff.runUrl} target="_blank" rel="noreferrer">
                    Log <ExternalLink size={13} />
                  </a>
                )}
                <button className="btn btn-sm btn-primary" onClick={() => doRetry(false)} disabled={busy}>
                  <RotateCw size={14} /> Riprova
                </button>
              </div>
            </div>
          </div>
        )}
        {eff.state === "partial" && (
          <div className="banner" data-tone="warn">
            <div className="banner-row">
              <span>
                <b>Risultato parziale.</b> <span className="muted">{eff.message}</span>
              </span>
              <button className="btn btn-sm" onClick={() => doRetry(false)} disabled={busy}>
                Continua lettura
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="alert" role="alert" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}
      </div>

      {posts.length > 0 && (
        <div className="toolbar">
          <div className="container">
            <div className="segmented" role="group" aria-label="Filtro tipo">
              {(["all", "carousel", "single"] as Filter[]).map((f) => (
                <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {{ all: "Tutti", carousel: "Carousel", single: "Singoli" }[f]}
                  <span className="count">{counts[f]}</span>
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={15} />
              <span className="sr-only">Cerca nel testo</span>
              <input className="input" placeholder="Cerca nel testo…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordina">
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="segmented" role="group" aria-label="Vista">
              {(["grid", "list"] as View[]).map((v) => (
                <button
                  key={v}
                  aria-pressed={view === v}
                  aria-label={v === "grid" ? "Griglia" : "Lista"}
                  title={v === "grid" ? "Griglia" : "Lista"}
                  onClick={() => {
                    setView(v);
                    setPref("view", v);
                  }}
                >
                  {v === "grid" ? <LayoutGrid size={14} /> : <List size={14} />}
                </button>
              ))}
            </div>
            <div className="menu-wrap">
              <button className="btn btn-primary" onClick={() => setMenu(!menu)} aria-expanded={menu}>
                <Download size={15} /> Esporta <ChevronDown size={14} />
              </button>
              {menu && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 25 }} onClick={() => setMenu(false)} />
                  <div className="menu" role="menu">
                    <button role="menuitem" onClick={() => exportAs("copy")}>
                      <Copy size={15} /> Copia tutto il testo
                    </button>
                    <hr />
                    <button role="menuitem" onClick={() => exportAs("md")}>
                      <FileText size={15} /> Markdown (Notion)
                    </button>
                    <button role="menuitem" onClick={() => exportAs("csv")}>
                      <FileSpreadsheet size={15} /> CSV (Excel, Sheets)
                    </button>
                    <button role="menuitem" onClick={() => exportAs("json")}>
                      <FileJson size={15} /> JSON
                    </button>
                    <hr />
                    <span className="faint" style={{ fontSize: 12, padding: "2px 10px 4px" }}>
                      Esporta i {visible.length} post visibili
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="container">
        {posts.length > 0 && visible.length === 0 && (
          <div className="empty" style={{ marginTop: 20 }}>
            <strong>Nessun risultato</strong>
            Prova a cambiare filtro o ricerca.
          </div>
        )}
        {view === "grid" ? (
          <div className="masonry" style={{ "--cols": cols } as React.CSSProperties}>
            {Array.from({ length: cols }, (_, c) => (
              <div className="masonry-col" key={c}>
                {visible
                  .filter((_, i) => i % cols === c)
                  .map((p) => (
                    <PostCard key={p.id} p={p} thumb={thumbs[p.id]} q={q.trim()} />
                  ))}
              </div>
            ))}
          </div>
        ) : (
          visible.length > 0 && (
            <div className="table">
              <div className="trow head">
                <span>#</span>
                <span />
                <span>Testo</span>
                <span style={{ textAlign: "right" }}>Interazioni</span>
                <span />
              </div>
              {visible.map((p) => (
                <PostRow key={p.id} p={p} thumb={thumbs[p.id]} q={q.trim()} />
              ))}
            </div>
          )
        )}
        {posts.length === 0 && !active && eff.state !== "error" && (
          <div className="empty" style={{ margin: "24px 0 64px" }}>
            <strong>Nessun post</strong>
            Il profilo non ha post con immagini.
          </div>
        )}
      </div>
    </>
  );
}
