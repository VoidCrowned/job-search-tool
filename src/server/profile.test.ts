import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.ts';
import { createStorage } from './storage.ts';
import { emptyProfile, parseProfile } from '../shared/profile.ts';
import type { JobsucheClient } from '../api/client.ts';

let dir: string;
const fakeClient = {} as JobsucheClient;
const app = () => createApp({ client: fakeClient, storage: createStorage(dir) });
const put = (body: unknown) =>
  app().request('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'jobsuche-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('parseProfile', () => {
  it('keeps known text fields and drops the rest', () => {
    const { profile, errors } = parseProfile({ name: 'Void', cv: 'Line 1\nLine 2', evil: 'x' });
    expect(errors).toEqual([]);
    expect(profile).toEqual({ ...emptyProfile(), name: 'Void', cv: 'Line 1\nLine 2' });
  });

  it('rejects non-text and over-long values', () => {
    expect(parseProfile({ name: 42 }).errors).toHaveLength(1);
    expect(parseProfile({ postcode: 'x'.repeat(21) }).errors).toHaveLength(1);
    expect(parseProfile([]).errors).toHaveLength(1);
  });
});

describe('profile API', () => {
  it('returns an empty profile before anything is saved', async () => {
    const res = await app().request('/api/profile');
    expect(await res.json()).toEqual(emptyProfile());
  });

  it('saves to data/profile.json and reads it back', async () => {
    const res = await put({ name: 'Void', city: 'Hamburg' });
    expect(res.status).toBe(200);
    const saved = JSON.parse(await readFile(join(dir, 'profile.json'), 'utf8'));
    expect(saved).toMatchObject({ name: 'Void', city: 'Hamburg' });
    expect(await (await app().request('/api/profile')).json()).toMatchObject({ name: 'Void', city: 'Hamburg' });
    // Atomic write leaves no temp files behind.
    expect(await readdir(dir)).toEqual(['profile.json']);
  });

  it('refuses invalid profiles without writing', async () => {
    const res = await put({ name: 42 });
    expect(res.status).toBe(400);
    expect(await readdir(dir)).toEqual([]);
  });

  it('refuses a body that is not JSON', async () => {
    const res = await app().request('/api/profile', { method: 'PUT', body: 'not json' });
    expect(res.status).toBe(400);
  });

  it('survives a hand-edited file with a bad field', async () => {
    await writeFile(join(dir, 'profile.json'), JSON.stringify({ name: 'Void', phone: 123 }));
    expect(await (await app().request('/api/profile')).json()).toMatchObject({ name: 'Void', phone: '' });
  });
});

describe('host check', () => {
  it('refuses requests addressed to another host name', async () => {
    const res = await app().request('http://evil.example/api/profile');
    expect(res.status).toBe(403);
  });

  it('accepts localhost and 127.0.0.1', async () => {
    expect((await app().request('http://127.0.0.1:8787/api/health')).status).toBe(200);
    expect((await app().request('http://localhost:5173/api/health')).status).toBe(200);
  });
});
