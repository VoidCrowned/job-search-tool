// Search parameters: allowed values, parsing/validation and conversion to the API query.
// Shared by the server (validates incoming requests) and the web app (URL state, form).

export const ANGEBOTSART = {
  '1': 'Job',
  '2': 'Self-employment',
  '4': 'Apprenticeship / dual study',
  '34': 'Internship / trainee',
} as const;
export type Angebotsart = keyof typeof ANGEBOTSART;

// 'ho' (home office) is listed in the old docs but the live API returns 0 results for it, so it is left out.
export const ARBEITSZEIT = {
  vz: 'Full-time',
  tz: 'Part-time',
  snw: 'Shifts / nights / weekends',
  mj: 'Mini-job',
} as const;
export type Arbeitszeit = keyof typeof ARBEITSZEIT;

export const BEFRISTUNG = {
  '1': 'Fixed-term',
  '2': 'Permanent',
  '3': 'Not stated',
} as const;
export type Befristung = keyof typeof BEFRISTUNG;

/** Choices offered in the form. The API accepts any whole number from 0 to 100 (days since publication). */
export const VEROEFFENTLICHTSEIT_CHOICES = [0, 1, 7, 14, 28] as const;
export const UMKREIS_CHOICES = [0, 10, 25, 50, 100, 200] as const;

export const MAX_SIZE = 100;
/** The API refuses requests where page × size exceeds this ("Ergebnismenge überschritten"). */
export const MAX_RESULT_WINDOW = 10_000;
export const DEFAULT_SIZE = 25;

export interface SearchParams {
  was?: string;
  wo?: string;
  umkreis?: number;
  berufsfeld?: string;
  arbeitgeber?: string;
  angebotsart?: Angebotsart;
  arbeitszeit?: Arbeitszeit[];
  befristung?: Befristung[];
  veroeffentlichtseit?: number;
  zeitarbeit?: boolean;
  pav?: boolean;
  behinderung?: boolean;
  quereinstieg?: boolean;
  page: number;
  size: number;
}

export interface ParseResult {
  params: SearchParams;
  errors: string[];
}

type Input = URLSearchParams | Record<string, string | undefined>;

function get(input: Input, key: string): string | undefined {
  const v = input instanceof URLSearchParams ? input.get(key) : input[key];
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

function list(value: string | undefined): string[] {
  return value ? value.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [];
}

/** Parses untrusted input (query string) into SearchParams. Invalid values are dropped and reported. */
export function parseSearchParams(input: Input): ParseResult {
  const errors: string[] = [];
  const params: SearchParams = { page: 1, size: DEFAULT_SIZE };

  const text = (key: 'was' | 'wo' | 'berufsfeld' | 'arbeitgeber') => {
    const v = get(input, key);
    if (v === undefined) return;
    if (v.length > 200) errors.push(`${key}: too long (max 200 characters)`);
    else params[key] = v;
  };
  text('was');
  text('wo');
  text('berufsfeld');
  text('arbeitgeber');

  const int = (key: string, min: number, max: number): number | undefined => {
    const v = get(input, key);
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) {
      errors.push(`${key}: must be a whole number from ${min} to ${max}`);
      return undefined;
    }
    return n;
  };
  const bool = (key: 'zeitarbeit' | 'pav' | 'behinderung' | 'quereinstieg') => {
    const v = get(input, key);
    if (v === undefined) return;
    if (v === 'true' || v === 'false') params[key] = v === 'true';
    else errors.push(`${key}: must be true or false`);
  };

  const umkreis = int('umkreis', 0, 200);
  if (umkreis !== undefined) params.umkreis = umkreis;
  const veroeffentlichtseit = int('veroeffentlichtseit', 0, 100);
  if (veroeffentlichtseit !== undefined) params.veroeffentlichtseit = veroeffentlichtseit;

  const angebotsart = get(input, 'angebotsart');
  if (angebotsart !== undefined) {
    if (angebotsart in ANGEBOTSART) params.angebotsart = angebotsart as Angebotsart;
    else errors.push(`angebotsart: unknown value "${angebotsart}"`);
  }

  const enumList = <T extends string>(key: string, allowed: Record<T, string>): T[] | undefined => {
    const values = list(get(input, key));
    if (values.length === 0) return undefined;
    const bad = values.filter((v) => !(v in allowed));
    if (bad.length) errors.push(`${key}: unknown value(s) ${bad.map((b) => `"${b}"`).join(', ')}`);
    const good = [...new Set(values.filter((v): v is T => v in allowed))];
    return good.length ? good : undefined;
  };
  params.arbeitszeit = enumList('arbeitszeit', ARBEITSZEIT);
  params.befristung = enumList('befristung', BEFRISTUNG);
  if (!params.arbeitszeit) delete params.arbeitszeit;
  if (!params.befristung) delete params.befristung;

  bool('zeitarbeit');
  bool('pav');
  bool('behinderung');
  bool('quereinstieg');

  params.size = int('size', 1, MAX_SIZE) ?? DEFAULT_SIZE;
  const maxPage = Math.floor(MAX_RESULT_WINDOW / params.size);
  params.page = int('page', 1, maxPage) ?? 1;

  return { params, errors };
}

/** Converts SearchParams to the query string the Jobsuche API expects (lists joined with ";"). */
export function toApiQuery(params: SearchParams): URLSearchParams {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    q.set(key, Array.isArray(value) ? value.join(';') : String(value));
  }
  return q;
}

/** Same as toApiQuery, but leaves out defaults so URLs stay short. Used for the web app's own URLs. */
export function toAppQuery(params: SearchParams): URLSearchParams {
  const q = toApiQuery(params);
  if (params.page === 1) q.delete('page');
  if (params.size === DEFAULT_SIZE) q.delete('size');
  return q;
}
