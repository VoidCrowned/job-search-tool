// Typed client for the Bundesagentur für Arbeit Jobsuche API. Runs on the server (Node) only:
// the API sends no CORS headers, so browsers can't call it directly.

import { toApiQuery, type SearchParams } from './params.ts';
import type { ApiErrorBody, JobDetails, SearchResponse } from './types.ts';

/** The Jobsuche API's host. The online version reaches the same paths through its relay (worker/). */
export const UPSTREAM_HOST = 'https://rest.arbeitsagentur.de';
export const API_BASE = `${UPSTREAM_HOST}/jobboerse/jobsuche-service`;
export const LOGO_BASE = `${UPSTREAM_HOST}/vermittlung/ag-darstellung-service`;
/** Public client ID used by the official website; not a secret. */
export const API_KEY = 'jobboerse-jobsuche';

/** Public page of a job ad on arbeitsagentur.de. */
export function jobPageUrl(referenznummer: string): string {
  return `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(referenznummer)}`;
}

/** The details endpoint expects the reference number Base64-encoded (UTF-8, with padding). */
export function encodeRefnr(referenznummer: string): string {
  const bytes = new TextEncoder().encode(referenznummer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function logoUrl(kundennummerHash: string): string {
  return `${LOGO_BASE}/ct/v1/arbeitgeberlogo/${encodeURIComponent(kundennummerHash)}`;
}

export class JobsucheError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'JobsucheError';
    this.status = status;
    this.code = code;
  }
}

async function toError(res: Response): Promise<JobsucheError> {
  let body: ApiErrorBody | undefined;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Body isn't JSON; fall back to the status text.
  }
  const first = body?.messages?.[0];
  const code = first?.code;
  let message: string;
  if (code === 'STELLENANGEBOT_NICHT_GEFUNDEN') message = 'This job ad no longer exists.';
  else if (body?.detail === 'Ergebnismenge überschritten') message = 'Too far into the results. Narrow the search.';
  else if (first?.path) message = `Invalid value for "${first.path}"${first.detail ? `: ${first.detail}` : ''}.`;
  else if (res.status === 403) message = 'The Jobsuche API refused the request (403).';
  else message = `The Jobsuche API answered with ${res.status}${body?.detail ? `: ${body.detail}` : ''}.`;
  return new JobsucheError(res.status, message, code);
}

export interface ClientOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Extra attempts after a network failure (not after HTTP errors). Default 1. */
  retries?: number;
}

export function createJobsucheClient(options: ClientOptions = {}) {
  const doFetch = options.fetch ?? globalThis.fetch;
  const base = options.baseUrl ?? API_BASE;
  const timeoutMs = options.timeoutMs ?? 15_000;

  const retries = options.retries ?? 1;

  async function get(url: string): Promise<Response> {
    let res: Response | undefined;
    let lastError: unknown;
    // The API host sometimes drops connections (connect timeouts). GETs are safe to retry.
    for (let attempt = 0; attempt <= retries && !res; attempt++) {
      try {
        res = await doFetch(url, {
          headers: { 'X-API-Key': API_KEY, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        lastError = err;
      }
    }
    if (!res) {
      const reason = lastError instanceof Error && lastError.name === 'TimeoutError' ? 'timed out' : 'could not be reached';
      throw new JobsucheError(502, `The Jobsuche API ${reason}. Try again in a moment.`);
    }
    if (!res.ok) throw await toError(res);
    return res;
  }

  return {
    async searchJobs(params: SearchParams): Promise<SearchResponse> {
      const res = await get(`${base}/pc/v6/jobs?${toApiQuery(params)}`);
      const data = (await res.json()) as SearchResponse;
      return { ...data, ergebnisliste: data.ergebnisliste ?? [] };
    },

    async getJobDetails(referenznummer: string): Promise<JobDetails> {
      const res = await get(`${base}/pc/v4/jobdetails/${encodeURIComponent(encodeRefnr(referenznummer))}`);
      return (await res.json()) as JobDetails;
    },
  };
}

export type JobsucheClient = ReturnType<typeof createJobsucheClient>;
