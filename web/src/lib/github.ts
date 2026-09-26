// Minimal GitHub REST client for the data branch. All calls run in the
// browser with the user's own fine-grained token.
import type { Config } from "./config";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function explain(status: number, path: string, body: string): string {
  if (status === 401) return "Token GitHub non valido o scaduto.";
  if (status === 403 && /rate limit/i.test(body)) return "Limite di richieste GitHub raggiunto: riprova tra qualche minuto.";
  if (status === 403 || (status === 404 && path.includes("/actions/secrets")))
    return "Il token non ha i permessi necessari (vedi la guida nelle impostazioni).";
  if (status === 404) return "Non trovato su GitHub (repo o branch inesistente?).";
  return `GitHub ha risposto ${status}.`;
}

export class GitHub {
  constructor(private cfg: Pick<Config, "repo" | "token" | "dataBranch">) {}

  private get base() {
    return `${API}/repos/${this.cfg.repo}`;
  }

  async req<T = unknown>(path: string, init: RequestInit & { raw?: boolean } = {}): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.base}${path}`;
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: init.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        Authorization: `Bearer ${this.cfg.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new GitHubError(res.status, explain(res.status, path, body));
    }
    const text = await res.text();
    if (init.raw) return text as T;
    // Some endpoints (e.g. secrets PUT → 201) answer with an empty body.
    return (text ? JSON.parse(text) : undefined) as T;
  }

  repo() {
    return this.req<{ full_name: string; private: boolean; default_branch: string; permissions?: { push: boolean } }>("");
  }

  async branchSha(branch = this.cfg.dataBranch): Promise<string | null> {
    try {
      const r = await this.req<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`);
      return r.object.sha;
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null;
      throw e;
    }
  }

  async readText(path: string): Promise<string | null> {
    try {
      return await this.req<string>(`/contents/${path}?ref=${encodeURIComponent(this.cfg.dataBranch)}`, { raw: true });
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null;
      throw e;
    }
  }

  async readJSON<T>(path: string): Promise<T | null> {
    const t = await this.readText(path);
    return t == null ? null : (JSON.parse(t) as T);
  }

  async list(path: string): Promise<{ name: string; path: string; sha: string; type: string }[]> {
    try {
      const r = await this.req<unknown>(`/contents/${path}?ref=${encodeURIComponent(this.cfg.dataBranch)}`);
      return Array.isArray(r) ? r : [];
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return [];
      throw e;
    }
  }

  /** One commit on the data branch that writes and/or deletes files. */
  async commit(message: string, files: Record<string, string | null>, opts: { createBranch?: boolean } = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const head = await this.branchSha();
      if (!head && !opts.createBranch) throw new GitHubError(404, "Branch dati mancante: riapri le impostazioni.");
      let baseTree: string | undefined;
      if (head) baseTree = (await this.req<{ tree: { sha: string } }>(`/git/commits/${head}`)).tree.sha;
      const tree = await this.req<{ sha: string }>("/git/trees", {
        method: "POST",
        body: JSON.stringify({
          base_tree: baseTree,
          tree: Object.entries(files).map(([path, content]) =>
            content == null
              ? { path, mode: "100644", type: "blob", sha: null }
              : { path, mode: "100644", type: "blob", content },
          ),
        }),
      });
      const commit = await this.req<{ sha: string }>("/git/commits", {
        method: "POST",
        body: JSON.stringify({ message, tree: tree.sha, parents: head ? [head] : [] }),
      });
      try {
        if (head) {
          await this.req(`/git/refs/heads/${encodeURIComponent(this.cfg.dataBranch)}`, {
            method: "PATCH",
            body: JSON.stringify({ sha: commit.sha }),
          });
        } else {
          await this.req("/git/refs", {
            method: "POST",
            body: JSON.stringify({ ref: `refs/heads/${this.cfg.dataBranch}`, sha: commit.sha }),
          });
        }
        return commit.sha;
      } catch (e) {
        // The worker pushed meanwhile: rebuild on the new head.
        if (e instanceof GitHubError && e.status === 422 && attempt < 3) continue;
        throw e;
      }
    }
  }

  async setSecret(name: string, value: string) {
    const { key, key_id } = await this.req<{ key: string; key_id: string }>("/actions/secrets/public-key");
    const sodium = (await import("libsodium-wrappers")).default;
    await sodium.ready;
    const sealed = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key, sodium.base64_variants.ORIGINAL));
    await this.req(`/actions/secrets/${name}`, {
      method: "PUT",
      body: JSON.stringify({ encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), key_id }),
    });
  }

  async secretExists(name: string): Promise<boolean> {
    try {
      await this.req(`/actions/secrets/${name}`);
      return true;
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return false;
      throw e;
    }
  }

  async latestRun(): Promise<WorkflowRun | null> {
    try {
      const r = await this.req<{ workflow_runs: WorkflowRun[] }>(
        `/actions/runs?branch=${encodeURIComponent(this.cfg.dataBranch)}&per_page=5`,
      );
      return r.workflow_runs[0] ?? null;
    } catch {
      return null; // token without Actions:read — status files still work
    }
  }
}

export interface WorkflowRun {
  id: number;
  status: "queued" | "in_progress" | "completed" | "waiting" | "requested" | "pending";
  conclusion: string | null;
  html_url: string;
  created_at: string;
}
