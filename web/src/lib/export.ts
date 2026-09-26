import type { JobResult, Post } from "./types";

export function postText(p: Post, numbered = p.kind === "carousel"): string {
  const slides = p.slides.filter((s) => s.paragraphs.length);
  if (!numbered) return slides.map((s) => s.paragraphs.join("\n")).join("\n\n");
  return slides.map((s) => `${String(s.i).padStart(2, "0")}. ${s.paragraphs.join("\n    ")}`).join("\n");
}

function metrics(p: Post) {
  const likes = p.likesHidden ? "like nascosti" : `${p.likes ?? 0} like`;
  return `${likes} · ${p.comments ?? 0} commenti`;
}

export function toText(posts: Post[]): string {
  return posts
    .map((p) => `#${p.rank} — ${p.kind === "carousel" ? "CAROUSEL" : "SINGLE"} — ${metrics(p)}\n${postText(p)}`)
    .join("\n\n");
}

export function toMarkdown(r: JobResult, posts: Post[]): string {
  const head = `# @${r.profile.username}\n\n${posts.length} post, ordinati per popolarità.\n`;
  const body = posts.map((p) => {
    const title = `## #${p.rank} · ${p.kind === "carousel" ? `Carousel (${p.slides.length})` : "Post singolo"}`;
    const meta = `*${metrics(p)}*${p.url ? ` · [apri](${p.url})` : ""}`;
    const text =
      p.kind === "carousel"
        ? p.slides
            .filter((s) => s.paragraphs.length)
            .map((s) => `${s.i}. ${s.paragraphs.join(" ")}`)
            .join("\n")
        : p.slides.flatMap((s) => s.paragraphs).map((t) => `> ${t}`).join("\n>\n");
    return `${title}\n${meta}\n\n${text || "_(nessun testo)_"}`;
  });
  return [head, ...body].join("\n\n");
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(posts: Post[]): string {
  const rows = [["rank", "tipo", "like", "like_nascosti", "commenti", "punteggio", "slide", "testo", "url", "data"]];
  for (const p of posts)
    for (const s of p.slides)
      rows.push([
        String(p.rank),
        p.kind,
        p.likes == null ? "" : String(p.likes),
        p.likesHidden ? "si" : "no",
        p.comments == null ? "" : String(p.comments),
        String(p.score),
        String(s.i),
        s.paragraphs.join(" / "),
        p.url ?? "",
        p.takenAt ?? "",
      ]);
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
