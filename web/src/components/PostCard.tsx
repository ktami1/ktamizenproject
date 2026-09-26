import { Copy, ExternalLink, GalleryHorizontal, Heart, MessageCircle, Square } from "lucide-react";
import { useState, type ReactNode } from "react";
import { copy, postText } from "../lib/export";
import { fmtCompact, fmtDate, fmtFull } from "../lib/format";
import type { Post } from "../lib/types";
import { useToast } from "./ui";

const COLLAPSE_AFTER = 5;

function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {highlight(text.slice(i + q.length), q)}
    </>
  );
}

function Likes({ p }: { p: Post }) {
  return (
    <span title={p.likesHidden ? "Like nascosti dall'autore: stimati dai commenti per l'ordinamento" : `${fmtFull(p.likes)} like`}>
      <Heart size={13} /> {p.likesHidden ? "nascosti" : fmtCompact(p.likes)}
    </span>
  );
}

function Comments({ p }: { p: Post }) {
  return (
    <span title={`${fmtFull(p.comments)} commenti`}>
      <MessageCircle size={13} /> {fmtCompact(p.comments)}
    </span>
  );
}

export function PostText({ p, q, collapse = true }: { p: Post; q: string; collapse?: boolean }) {
  const [open, setOpen] = useState(false);
  const withText = p.slides.filter((s) => s.paragraphs.length);
  const failed = p.slides.filter((s) => s.error).length;
  const empty = p.slides.length - withText.length - failed;

  if (!withText.length)
    return <p className="text faint" style={{ fontSize: 13 }}>{failed ? "Immagine non disponibile" : "Nessun testo nell'immagine"}</p>;

  const note = (
    <>
      {empty > 0 && p.kind === "carousel" && <span className="faint" style={{ fontSize: 12 }}>{empty} slide senza testo</span>}
      {failed > 0 && <span className="faint" style={{ fontSize: 12 }}> · {failed} non scaricate</span>}
    </>
  );

  if (p.kind === "single" && withText.length === 1) {
    const s = withText[0];
    return (
      <div className={`text${s.confidence < 0.75 ? " lowconf" : ""}`} title={s.confidence < 0.75 ? "Lettura incerta" : undefined}>
        {s.paragraphs.map((t, i) => (
          <p key={i}>{highlight(t, q)}</p>
        ))}
      </div>
    );
  }

  const shown = collapse && !open && withText.length > COLLAPSE_AFTER + 1 ? withText.slice(0, COLLAPSE_AFTER) : withText;
  return (
    <>
      <ol className="slides">
        {shown.map((s) => (
          <li key={s.i}>
            <span className="n">{String(s.i).padStart(2, "0")}</span>
            <div className={s.confidence < 0.75 ? "lowconf" : undefined} title={s.confidence < 0.75 ? "Lettura incerta" : undefined}>
              {s.paragraphs.map((t, i) => (
                <p key={i}>{highlight(t, q)}</p>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {shown.length < withText.length && (
        <button className="more" onClick={() => setOpen(true)}>
          Mostra altre {withText.length - shown.length} slide
        </button>
      )}
      {(empty > 0 || failed > 0) && <div style={{ marginTop: 8 }}>{note}</div>}
    </>
  );
}

function Actions({ p, compact }: { p: Post; compact?: boolean }) {
  const toast = useToast();
  const cls = `btn btn-ghost btn-sm${compact ? " btn-icon" : ""}`;
  return (
    <>
      <button className={cls} title="Copia testo" aria-label="Copia testo" onClick={async () => (await copy(postText(p))) && toast("Testo copiato")}>
        <Copy size={14} /> {!compact && "Copia"}
      </button>
      {p.url && (
        <a className={cls} href={p.url} target="_blank" rel="noreferrer" title="Apri su Instagram" aria-label="Apri su Instagram">
          <ExternalLink size={14} /> {!compact && "Apri"}
        </a>
      )}
    </>
  );
}

export function PostCard({ p, thumb, q }: { p: Post; thumb?: string; q: string }) {
  return (
    <article className="card">
      <div className={p.thumb == null ? "card-head" : "card-media"}>
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : p.thumb != null && <div className="skeleton" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />}
        <span className={`rank${p.rank <= 3 ? " podium" : ""}`}>#{p.rank}</span>
        <span className="kind">
          {p.kind === "carousel" ? <GalleryHorizontal size={12} /> : <Square size={11} />}
          {p.kind === "carousel" ? `Carousel · ${p.slides.length}` : "Singolo"}
        </span>
      </div>
      <div className="card-body">
        <div className="metrics">
          <Likes p={p} />
          <Comments p={p} />
          <span className="date">{fmtDate(p.takenAt)}</span>
        </div>
        <PostText p={p} q={q} />
      </div>
      <div className="card-foot">
        <Actions p={p} />
      </div>
    </article>
  );
}

export function PostRow({ p, thumb, q }: { p: Post; thumb?: string; q: string }) {
  return (
    <div className="trow">
      <span className={`r${p.rank <= 3 ? " podium" : ""}`}>#{p.rank}</span>
      <div className="thumb">{thumb && <img src={thumb} alt="" loading="lazy" />}</div>
      <div style={{ minWidth: 0 }}>
        <span className="kind-inline">{p.kind === "carousel" ? `Carousel · ${p.slides.length}` : "Singolo"}</span>
        <PostText p={p} q={q} collapse={false} />
      </div>
      <div className="nums">
        <span>{p.likesHidden ? "like nascosti" : `${fmtFull(p.likes)} like`}</span>
        <span>{fmtFull(p.comments)} commenti</span>
        <span className="faint">{fmtDate(p.takenAt)}</span>
      </div>
      <div className="acts">
        <Actions p={p} compact />
      </div>
    </div>
  );
}
