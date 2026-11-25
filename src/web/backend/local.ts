// The local backend: the Hono server on this computer (src/server/app.ts), reached through /api/*.
import type { JobDetails, SearchResponse } from '../../api/types.ts';
import type { LetterFile } from '../../shared/letter.ts';
import type { Profile } from '../../shared/profile.ts';
import type { Backup } from '../../shared/backup.ts';
import { deleteJson, getJson, sendJson } from '../api.ts';
import type { AiConfig, Backend, KeyStatus, LetterResult } from './types.ts';

const letters = (refnr: string) => `/api/letters/${encodeURIComponent(refnr)}`;

export const localBackend: Backend = {
  kind: 'local',
  searchJobs: (query, signal) => getJson<SearchResponse>(`/api/jobs?${query}`, signal),
  jobDetails: (refnr, signal) => getJson<JobDetails>(`/api/jobs/${encodeURIComponent(refnr)}`, signal),
  logoUrl: (hash) => `/api/logo/${encodeURIComponent(hash)}`,

  getProfile: (signal) => getJson<Profile>('/api/profile', signal),
  saveProfile: (profile) => sendJson<Profile>('PUT', '/api/profile', profile),

  getLetters: (refnr) => getJson<LetterFile>(letters(refnr)),
  generateLetter: (refnr, request) => sendJson<LetterResult>('POST', `${letters(refnr)}/generate`, request),
  saveVersion: (refnr, version) => sendJson<LetterResult>('POST', `${letters(refnr)}/versions`, version),

  exportData: () => getJson<Backup>('/api/backup'),
  importData: (backup) => sendJson<{ letters: number }>('POST', '/api/backup', backup),

  aiConfig: () => getJson<AiConfig>('/api/config'),
  keyStatus: () => getJson<KeyStatus>('/api/settings/key'),
  setKey: (key) => sendJson<KeyStatus>('PUT', '/api/settings/key', { key }),
  removeKey: () => deleteJson<KeyStatus>('/api/settings/key'),
};
