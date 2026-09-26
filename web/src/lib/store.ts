// App-level operations on the encrypted data branch.
import workflowTemplate from "../assets/ig-worker.yml?raw";
import type { Config } from "./config";
import { GitHub } from "./github";
import type { JobRequest, JobResult, JobStatus, JobSummary } from "./types";
import { decryptJSON, encryptJSON, type Envelope } from "./vault";

export const WORKER_VERSION = "1";
export const SECRET_VAULT = "SLIDEMINE_VAULT_KEY";
export const SECRET_APIFY = "SLIDEMINE_APIFY_TOKEN";
const WORKFLOW_PATH = ".github/workflows/slidemine-worker.yml";

export function workflowFile(cfg: Pick<Config, "dataBranch" | "codeRef">) {
  return workflowTemplate
    .replaceAll("__DATA_BRANCH__", cfg.dataBranch)
    .replaceAll("__CODE_REF__", cfg.codeRef)
    .replaceAll("__VERSION__", WORKER_VERSION);
}

export type SetupStep = "access" | "branch" | "secrets" | "verify";

/** First-time setup, or re-setup: installs worker, stores secrets. */
export async function setup(cfg: Config, apifyToken: string, onStep: (s: SetupStep) => void) {
  const gh = new GitHub(cfg);
  onStep("access");
  const repo = await gh.repo();
  if (repo.permissions && !repo.permissions.push) throw new Error("Il token non può scrivere su questo repo.");

  onStep("branch");
  const check = JSON.stringify(await encryptJSON({ ok: true, at: new Date().toISOString() }, cfg.passphrase));
  await gh.commit(
    "slidemine: install worker",
    { [WORKFLOW_PATH]: workflowFile(cfg), "vault-check.json": check, "README.md": DATA_README },
    { createBranch: true },
  );

  onStep("secrets");
  await gh.setSecret(SECRET_VAULT, cfg.passphrase);
  if (apifyToken.trim()) await gh.setSecret(SECRET_APIFY, apifyToken.trim());
  else if (!(await gh.secretExists(SECRET_APIFY))) throw new Error("Serve il token Apify per la prima configurazione.");

  onStep("verify");
  await verifyPassphrase(cfg);
}

/** Sign-in on a device where setup was already done elsewhere. */
export async function verifyPassphrase(cfg: Config) {
  const gh = new GitHub(cfg);
  await gh.repo();
  const env = await gh.readJSON<Envelope>("vault-check.json");
  if (!env) throw new Error("Configurazione non trovata: usa “Prima configurazione”.");
  await decryptJSON(env, cfg.passphrase);
}

export async function workerNeedsUpdate(cfg: Config): Promise<boolean> {
  const gh = new GitHub(cfg);
  const current = await gh.readText(WORKFLOW_PATH);
  return current !== workflowFile(cfg);
}

export async function updateWorker(cfg: Config) {
  await new GitHub(cfg).commit("slidemine: update worker", { [WORKFLOW_PATH]: workflowFile(cfg) });
}

function newId() {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${Date.now().toString(36)}-${rand}`;
}

function nonce() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function queueJob(cfg: Config, username: string, maxPosts: number): Promise<string> {
  const id = newId();
  const req: JobRequest = { username, maxPosts, nonce: nonce(), requestedAt: new Date().toISOString() };
  await new GitHub(cfg).commit("queue job", {
    [`queue/${id}.json`]: JSON.stringify(await encryptJSON(req, cfg.passphrase)),
  });
  return id;
}

export async function retryJob(cfg: Config, job: JobSummary, refetch = false) {
  const req: JobRequest = { ...job.request, nonce: nonce(), requestedAt: new Date().toISOString(), refetch };
  await new GitHub(cfg).commit("retry job", {
    [`queue/${job.id}.json`]: JSON.stringify(await encryptJSON(req, cfg.passphrase)),
  });
}

export async function deleteJob(cfg: Config, id: string) {
  const gh = new GitHub(cfg);
  const files: Record<string, null> = { [`queue/${id}.json`]: null };
  for (const f of await gh.list(`jobs/${id}`)) if (f.type === "file") files[f.path] = null;
  for (const f of await gh.list(`jobs/${id}/thumbs`)) files[f.path] = null;
  await gh.commit("delete job", files);
}

const requestCache = new Map<string, JobRequest>();

export async function listJobs(cfg: Config): Promise<JobSummary[]> {
  const gh = new GitHub(cfg);
  const entries = (await gh.list("queue")).filter((e) => e.name.endsWith(".json"));
  const jobs = await Promise.all(
    entries.map(async (e): Promise<JobSummary | null> => {
      const id = e.name.replace(/\.json$/, "");
      try {
        let request = requestCache.get(e.sha);
        if (!request) {
          const env = await gh.readJSON<Envelope>(e.path);
          if (!env) return null;
          request = await decryptJSON<JobRequest>(env, cfg.passphrase);
          requestCache.set(e.sha, request);
        }
        return { id, request, status: await loadStatus(cfg, id) };
      } catch {
        return null; // encrypted with another key: not ours to show
      }
    }),
  );
  return jobs
    .filter((j): j is JobSummary => j !== null)
    .sort((a, b) => b.request.requestedAt.localeCompare(a.request.requestedAt));
}

export async function loadStatus(cfg: Config, id: string): Promise<JobStatus | null> {
  const env = await new GitHub(cfg).readJSON<Envelope>(`jobs/${id}/status.json`);
  return env ? decryptJSON<JobStatus>(env, cfg.passphrase) : null;
}

export async function loadRequest(cfg: Config, id: string): Promise<JobRequest | null> {
  const env = await new GitHub(cfg).readJSON<Envelope>(`queue/${id}.json`);
  return env ? decryptJSON<JobRequest>(env, cfg.passphrase) : null;
}

export async function loadResult(cfg: Config, id: string): Promise<JobResult | null> {
  const env = await new GitHub(cfg).readJSON<Envelope>(`jobs/${id}/result.json`);
  return env ? decryptJSON<JobResult>(env, cfg.passphrase) : null;
}

export async function loadThumbs(cfg: Config, id: string, chunk: number): Promise<Record<string, string>> {
  const env = await new GitHub(cfg).readJSON<Envelope>(`jobs/${id}/thumbs/${chunk}.json`);
  return env ? decryptJSON<Record<string, string>>(env, cfg.passphrase) : {};
}

/** A job whose status has not caught up with the latest request is still queued. */
export function effectiveStatus(job: JobSummary): JobStatus {
  const s = job.status;
  if (!s || s.nonce !== job.request.nonce)
    return {
      jobId: job.id,
      username: job.request.username,
      state: "queued",
      message: "In attesa del worker…",
      total: s?.total ?? 0,
      processed: 0,
      slides: 0,
    };
  return s;
}

const DATA_README = `# Slidemine data

This branch is written by the Slidemine web app and its GitHub Actions worker.
Every JSON file here is AES-256-GCM encrypted with a key that is not stored
in this repository. Do not merge this branch.
`;
