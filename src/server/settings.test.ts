import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.ts';
import { updateEnvText } from './envFile.ts';
import { createStorage } from './storage.ts';

// Scratch folder and environment only: the repo's real .env is never read or written here.
let dir: string;
let env: NodeJS.ProcessEnv;
const envPath = () => join(dir, '.env');
const app = () => createApp({ storage: createStorage(dir), env, envPath: envPath() });
const json = { 'Content-Type': 'application/json' };
const OR_KEY = 'sk-or-v1-0123456789abcdefWXYZ';
const ANT_KEY = 'sk-ant-api03-0123456789abcdefABCD';

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'jobsuche-settings-'));
  env = {};
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('updateEnvText', () => {
  it('changes only the named lines and keeps comments and order', () => {
    const text = '# comment\n# OPENROUTER_API_KEY=sk-or-example\nANTHROPIC_API_KEY=old\nPORT=8787\n';
    expect(updateEnvText(text, { OPENROUTER_API_KEY: 'new', ANTHROPIC_API_KEY: undefined })).toBe(
      '# comment\n# OPENROUTER_API_KEY=sk-or-example\nPORT=8787\nOPENROUTER_API_KEY=new\n',
    );
    expect(updateEnvText('A=1\nOPENROUTER_API_KEY=x\nB=2', { OPENROUTER_API_KEY: 'y' })).toBe('A=1\nOPENROUTER_API_KEY=y\nB=2\n');
    expect(updateEnvText('', { OPENROUTER_API_KEY: undefined })).toBe('');
  });

  it('refuses multi-line values', () => {
    expect(() => updateEnvText('', { OPENROUTER_API_KEY: 'a\nPORT=1' })).toThrow();
  });
});

describe('API key settings', () => {
  it('saves an OpenRouter key to .env, switches Claude on and never returns the key', async () => {
    await writeFile(envPath(), '# my settings\nPORT=8787\nANTHROPIC_API_KEY=sk-or-v1-oldkeyoldkeyoldkey\n');
    env.ANTHROPIC_API_KEY = 'sk-or-v1-oldkeyoldkeyoldkey';
    const b = app();
    expect(await (await b.request('/api/settings/key')).json()).toEqual({ set: true, provider: 'openrouter', hint: 'sk-or-…dkey' });
    const res = await b.request('/api/settings/key', { method: 'PUT', headers: json, body: JSON.stringify({ key: ` ${OR_KEY} ` }) });
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).not.toContain('0123456789abcdef');
    expect(JSON.parse(body)).toEqual({ set: true, provider: 'openrouter', hint: 'sk-or-…WXYZ' });
    expect(await readFile(envPath(), 'utf8')).toBe(`# my settings\nPORT=8787\nOPENROUTER_API_KEY=${OR_KEY}\n`);
    expect((await stat(envPath())).mode & 0o777).toBe(0o600);
    expect(env).toEqual({ OPENROUTER_API_KEY: OR_KEY });
    expect(await (await b.request('/api/config')).json()).toEqual({ ai: true, model: 'anthropic/claude-opus-5.5', provider: 'openrouter' });
  });

  it('accepts Anthropic keys too and removes the key again', async () => {
    const a = app();
    expect(await (await a.request('/api/settings/key')).json()).toEqual({ set: false });
    await a.request('/api/settings/key', { method: 'PUT', headers: json, body: JSON.stringify({ key: ANT_KEY }) });
    expect(await (await a.request('/api/settings/key')).json()).toEqual({ set: true, provider: 'anthropic', hint: 'sk-ant-…ABCD' });
    expect(await readFile(envPath(), 'utf8')).toBe(`ANTHROPIC_API_KEY=${ANT_KEY}\n`);
    expect(await (await a.request('/api/settings/key', { method: 'DELETE' })).json()).toEqual({ set: false });
    expect(await readFile(envPath(), 'utf8')).toBe('');
    expect(await (await a.request('/api/config')).json()).toEqual({ ai: false });
  });

  it('refuses things that are not keys, without touching .env', async () => {
    for (const key of ['', 'hello', 'sk-or-short', `${OR_KEY}\nPORT=1`, `${OR_KEY} x`, 42]) {
      const res = await app().request('/api/settings/key', { method: 'PUT', headers: json, body: JSON.stringify({ key }) });
      expect(res.status).toBe(400);
    }
    await expect(stat(envPath())).rejects.toThrow();
  });

  it('refuses changes from other websites', async () => {
    const put = (headers: Record<string, string>) =>
      app().request('/api/settings/key', { method: 'PUT', headers, body: JSON.stringify({ key: OR_KEY }) });
    expect((await put({ ...json, Origin: 'https://evil.example' })).status).toBe(403);
    expect((await put({ 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await app().request('/api/settings/key', { method: 'DELETE', headers: { Origin: 'https://evil.example' } })).status).toBe(403);
    expect((await put({ ...json, Origin: 'http://localhost:5173' })).status).toBe(200);
  });
});
