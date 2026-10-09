// The HTTP client for AIHOT's public API. Their published rules ask for one request at a time, a
// conditional request where a response offers an ETag, no concurrency, and a wait for Retry-After
// instead of a retry storm; this client is those rules in code, and it is the only place that calls
// out. Tests hand the sync functions a fake of this interface instead.
import { BRIDGE } from "../config.ts";

export interface AihotAnswer<T> {
  data: T | null;
  /** True when the ETag sent still matches: no body was transferred. */
  notModified: boolean;
  etag: string | null;
}

export interface AihotTextAnswer {
  html: string | null;
  notModified: boolean;
  etag: string | null;
}

export interface AihotClient {
  get<T>(path: string, query?: Record<string, string | number | null | undefined>, opts?: { etag?: string | null }): Promise<AihotAnswer<T>>;
  /** One of AIHOT's own pages, as HTML. Same pacing, conditional requests and error rules as `get`. */
  text(path: string, opts?: { etag?: string | null }): Promise<AihotTextAnswer>;
}

export class AihotHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(status: number, message: string, retryAfterMs: number | null = null) {
    super(message);
    this.name = "AihotHttpError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** One request at a time, at least the configured interval apart. */
let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = lastRequestAt + BRIDGE.minIntervalMs - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export function httpClient(): AihotClient {
  return {
    async get<T>(path: string, query: Record<string, string | number | null | undefined> = {}, opts: { etag?: string | null } = {}): Promise<AihotAnswer<T>> {
      const response = await request(path, query, opts, "application/json");
      if (response.status === 304) return { data: null, notModified: true, etag: response.headers.get("etag") ?? opts.etag ?? null };
      return { data: (await response.json()) as T, notModified: false, etag: response.headers.get("etag") };
    },
    async text(path: string, opts: { etag?: string | null } = {}): Promise<AihotTextAnswer> {
      const response = await request(path, {}, opts, "text/html");
      if (response.status === 304) return { html: null, notModified: true, etag: response.headers.get("etag") ?? opts.etag ?? null };
      return { html: await response.text(), notModified: false, etag: response.headers.get("etag") };
    },
  };
}

/** One successful (or not modified) response. Errors and retries are decided here, once, for both entrances. */
async function request(path: string, query: Record<string, string | number | null | undefined>, opts: { etag?: string | null }, accept: string): Promise<Response> {
  const url = new URL(`${BRIDGE.baseUrl()}${path}`);
  for (const [key, value] of Object.entries(query)) if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
  const headers: Record<string, string> = { accept, "user-agent": BRIDGE.userAgent() };
  if (opts.etag) headers["if-none-match"] = opts.etag;

  let attempt = 0;
  for (;;) {
    await throttle();
    let response: Response;
    try {
      response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000), redirect: "follow" });
    } catch (error) {
      if (attempt++ < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
        continue;
      }
      throw new AihotHttpError(0, `${path}: ${(error as Error).message}`);
    }
    if (response.status === 304 || response.ok) return response;
    const wait = retryAfterMs(response);
    if (RETRYABLE.has(response.status) && attempt++ < 2) {
      // Their rule: wait out a 429 rather than retry into it. Never longer than the interval they gave.
      await new Promise((resolve) => setTimeout(resolve, Math.min(wait ?? 5_000 * attempt, 60_000)));
      continue;
    }
    throw new AihotHttpError(response.status, `${path}: ${response.status} ${await response.text().catch(() => "")}`.slice(0, 500), wait);
  }
}
