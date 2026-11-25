// API keys for Claude: OpenRouter ("sk-or-…") or Anthropic ("sk-ant-…"). Shared by the local server (.env)
// and the online version (browser storage).

/** One line, no spaces or quotes. */
export const API_KEY_PATTERN = /^sk-(or|ant)-[A-Za-z0-9_-]{16,250}$/;

export function isValidApiKey(key: string): boolean {
  return API_KEY_PATTERN.test(key);
}

/** Enough of the key to recognise it, never enough to use it. */
export function keyHint(key: string): string {
  return `${key.slice(0, key.startsWith('sk-ant-') ? 7 : 6)}…${key.slice(-4)}`;
}
