// Job details with a per-tab cache: a card that is collapsed and reopened (or the same job opened as a page)
// doesn't load again.
import { useEffect, useState } from 'react';
import type { JobDetails } from '../api/types.ts';
import { getJson, RequestError, type Loadable } from './api.ts';

const MAX_CACHED = 200;
const cache = new Map<string, JobDetails>();
const inflight = new Map<string, Promise<JobDetails>>();

export function loadJobDetails(refnr: string): Promise<JobDetails> {
  const hit = cache.get(refnr);
  if (hit) return Promise.resolve(hit);
  let pending = inflight.get(refnr);
  if (!pending) {
    pending = getJson<JobDetails>(`/api/jobs/${encodeURIComponent(refnr)}`)
      .then((data) => {
        cache.set(refnr, data);
        // Drop the oldest entry once the cache is full (Map keeps insertion order).
        if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
        return data;
      })
      .finally(() => inflight.delete(refnr));
    inflight.set(refnr, pending);
  }
  return pending;
}

/** For tests. */
export function clearJobDetailsCache() {
  cache.clear();
  inflight.clear();
}

export function useJobDetails(refnr: string): Loadable<JobDetails> {
  const cached = cache.get(refnr);
  const [failure, setFailure] = useState<{ refnr: string; error: RequestError } | undefined>();
  const [, setLoaded] = useState(0);

  useEffect(() => {
    if (cache.has(refnr)) return;
    let active = true;
    loadJobDetails(refnr).then(
      () => active && setLoaded((n) => n + 1),
      (error: unknown) => {
        if (!active) return;
        setFailure({ refnr, error: error instanceof RequestError ? error : new RequestError(0, String(error)) });
      },
    );
    return () => {
      active = false;
    };
  }, [refnr]);

  if (cached) return { state: 'done', data: cached };
  if (failure?.refnr === refnr) return { state: 'error', error: failure.error };
  return { state: 'loading' };
}
