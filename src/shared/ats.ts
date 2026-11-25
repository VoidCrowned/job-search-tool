// Checks whether a letter will survive an applicant tracking system (ATS): plain text, readable length,
// nothing left to fill in, and the ad's key terms present. Deterministic, so it works for every letter source.
import { PLACEHOLDER } from './letter.ts';

export type AtsCheckId = 'length' | 'plainText' | 'symbols' | 'placeholders' | 'company' | 'jobTitle' | 'keywords';

export interface AtsCheck {
  id: AtsCheckId;
  ok: boolean;
  /** Extra facts for the message, e.g. the word count or missing keywords. */
  words?: number;
  count?: number;
  missing?: string[];
  found?: number;
  total?: number;
}

export interface AtsInput {
  jobTitle?: string;
  company?: string;
  /** Key terms from the ad; without them the keyword check is skipped. */
  keywords?: string[];
}

export const MIN_WORDS = 180;
export const MAX_WORDS = 500;
/** Share of the ad's keywords a letter should contain. */
export const KEYWORD_TARGET = 0.6;

const EMOJI = /\p{Extended_Pictographic}/u;
const DECORATIVE = /[★☆✓✔✗✘•►▸▪■□●○◆◇→⇒➜➔❖]/;
const MARKDOWN = /(^\s*#{1,6}\s)|(\*\*[^*]+\*\*)|(__[^_]+__)|(^\s*\|.*\|\s*$)|(^\s*[-*]\s+\[[ x]\])/m;

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}+#]+/gu, ' ')
    .trim();
}

/** "Pflegefachkraft (m/w/d)" → "Pflegefachkraft"; gender suffixes and brackets don't need to appear. */
function coreTitle(title: string): string {
  return title.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

/** A keyword counts as present if the phrase appears, or every longer word of it (by its first 6 letters). */
export function containsTerm(text: string, term: string): boolean {
  const hay = ` ${normalise(text)} `;
  const needle = normalise(term);
  if (!needle) return true;
  if (hay.includes(` ${needle} `)) return true;
  // German compounds: "Pflege" counts inside "Pflegeplanung". Short terms ("IT", "SAP") must match as whole words.
  if (needle.length >= 5 && hay.includes(needle)) return true;
  const parts = needle.split(' ').filter((w) => w.length > 3);
  return parts.length > 0 && parts.every((w) => hay.includes(w.slice(0, 6)));
}

const LEGAL_FORM =
  /[\s,]+(gemeinnützige\s+)?(g?GmbH(\s*&\s*Co\.?\s*KG(aA)?)?|mbH|e\.\s?V\.?|e\.\s?G\.?|eG|AG|KGaA|KG|OHG|GbR|SE|UG(\s*\(haftungsbeschränkt\))?|Ltd\.?|Inc\.?|LLC)\s*$/i;

/**
 * A company counts as named if its full name appears, the name without its legal form ("e.V.", "GmbH"),
 * or a form with the leading words shortened to initials ("DRK Landesverband Hamburg").
 */
export function containsCompany(text: string, company: string): boolean {
  let core = company.trim();
  for (let prev = ''; prev !== core; ) [prev, core] = [core, core.replace(LEGAL_FORM, '').trim()];
  const candidates = [company, core];
  const words = core.split(/\s+/).filter(Boolean);
  for (let k = 2; k <= words.length; k++) {
    const head = words.slice(0, k);
    if (!head.every((w) => /^\p{Lu}/u.test(w))) break;
    candidates.push([head.map((w) => w[0]).join(''), ...words.slice(k)].join(' '));
  }
  return candidates.some((c) => c.trim() && containsTerm(text, c));
}

export function checkAts(text: string, input: AtsInput = {}): AtsCheck[] {
  const words = text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  const placeholders = text.match(PLACEHOLDER)?.length ?? 0;
  const checks: AtsCheck[] = [
    { id: 'length', ok: words >= MIN_WORDS && words <= MAX_WORDS, words },
    { id: 'plainText', ok: !MARKDOWN.test(text) && !text.includes('\t') },
    { id: 'symbols', ok: !EMOJI.test(text) && !DECORATIVE.test(text) },
    { id: 'placeholders', ok: placeholders === 0, count: placeholders },
  ];
  if (input.company?.trim()) checks.push({ id: 'company', ok: containsCompany(text, input.company) });
  if (input.jobTitle?.trim()) checks.push({ id: 'jobTitle', ok: containsTerm(text, coreTitle(input.jobTitle)) });

  const keywords = [...new Set((input.keywords ?? []).map((k) => k.trim()).filter(Boolean))];
  if (keywords.length) {
    const missing = keywords.filter((k) => !containsTerm(text, k));
    const found = keywords.length - missing.length;
    checks.push({ id: 'keywords', ok: found / keywords.length >= KEYWORD_TARGET, missing, found, total: keywords.length });
  }
  return checks;
}
