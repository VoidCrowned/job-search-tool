// The backend the website uses. Only the local one exists so far; the browser-only one for the online
// version follows in #74 and will be picked at build time.
import { localBackend } from './local.ts';
export type { AiConfig, Backend, GenerateRequest, KeyStatus, LetterResult } from './types.ts';

export const backend = localBackend;
