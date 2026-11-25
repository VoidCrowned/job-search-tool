// Turns errors from Claude or the Jobsuche API into a status, a machine-readable code and a message.
// Used by the local server (as HTTP answers) and the online version (as RequestErrors), so the website
// shows the same texts either way.
import Anthropic from '@anthropic-ai/sdk';
import { JobsucheError } from '../api/client.ts';
import { RefusalError } from './letter/claude.ts';

export interface ErrorInfo {
  status: number;
  code?: string;
  message: string;
}

export function describeError(err: unknown): ErrorInfo {
  if (err instanceof RefusalError) return { status: 422, code: 'AI_REFUSED', message: err.message };
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { status: 502, code: 'AI_AUTH', message: 'The API key was rejected.' };
  }
  // No answer at all: offline, or (online version) the browser blocked the request.
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 502, code: 'AI_CONNECTION', message: 'Claude could not be reached.' };
  }
  if (err instanceof Anthropic.RateLimitError) return { status: 503, code: 'AI_RATE_LIMIT', message: 'Anthropic rate limit reached.' };
  if (err instanceof Anthropic.APIError) return { status: 502, code: 'AI_ERROR', message: 'Claude could not write the letter.' };
  if (err instanceof JobsucheError) {
    // Pass 400/404 through; anything else is the upstream API's fault.
    return { status: err.status === 400 || err.status === 404 ? err.status : 502, code: err.code, message: err.message };
  }
  return { status: 500, message: 'Unexpected error.' };
}
