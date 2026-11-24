// Pure display helpers for job data. Every function takes the current language's messages,
// which also carry the locale for dates and currency.
import type { JobBase } from '../api/types.ts';
import type { Messages } from './i18n/en.ts';

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const euroFormats = new Map<string, Intl.NumberFormat>();

function dateFormat(locale: string) {
  let f = dateFormats.get(locale);
  if (!f) dateFormats.set(locale, (f = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })));
  return f;
}

function euro(locale: string) {
  let f = euroFormats.get(locale);
  if (!f) euroFormats.set(locale, (f = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })));
  return f;
}

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

export function formatDateTime(iso: string, m: Messages): string {
  let f = dateTimeFormats.get(m.locale);
  if (!f) dateTimeFormats.set(m.locale, (f = new Intl.DateTimeFormat(m.locale, { dateStyle: 'medium', timeStyle: 'short' })));
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : f.format(d);
}

export function formatNumber(n: number, m: Messages): string {
  return n.toLocaleString(m.locale);
}

export function formatDate(iso: string | undefined, m: Messages): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? undefined : dateFormat(m.locale).format(d);
}

/** "20146 Hamburg", plus "(+2 more)" when the job has several locations. */
export function formatPlace(job: JobBase, m: Messages): string | undefined {
  const locs = job.stellenlokationen ?? [];
  const first = locs[0]?.adresse;
  if (!first) return undefined;
  const main = [first.plz, first.ort].filter(Boolean).join(' ') || first.region || first.land;
  return locs.length > 1 ? `${main} (${m.format.moreLocations(locs.length - 1)})` : main;
}

export function workingTimes(job: JobBase, m: Messages): string[] {
  const out: string[] = [];
  if (job.arbeitszeitVollzeit) out.push(m.format.fullTime);
  const partTime =
    job.arbeitszeitTeilzeitVormittag ||
    job.arbeitszeitTeilzeitNachmittag ||
    job.arbeitszeitTeilzeitAbend ||
    job.arbeitszeitTeilzeitFlexibel;
  if (partTime) out.push(m.format.partTime);
  if (job.arbeitszeitSchichtNachtWochenende) out.push(m.format.shifts);
  if (job.istGeringfuegigeBeschaeftigung) out.push(m.format.miniJob);
  return out;
}

export function formatPay(job: JobBase, m: Messages): string | undefined {
  const unit =
    job.verguetungsangabe === 'STUNDENLOHN' ? ` ${m.format.perHour}` : job.verguetungsangabe === 'JAHRESGEHALT' ? ` ${m.format.perYear}` : '';
  const n = (v: number) => euro(m.locale).format(v);
  if (job.gehaltsspanneVon != null && job.gehaltsspanneBis != null) {
    return `${n(job.gehaltsspanneVon)} – ${n(job.gehaltsspanneBis)}${unit}`;
  }
  if (job.festgehalt != null) return `${n(job.festgehalt)}${unit}`;
  return undefined;
}

export function formatContract(job: JobBase, m: Messages): string | undefined {
  switch (job.vertragsdauer) {
    case 'UNBEFRISTET':
      return m.format.permanent;
    case 'BEFRISTET': {
      const until = formatDate(job.befristetBis, m);
      return until ? m.format.fixedTermUntil(until) : m.format.fixedTerm;
    }
    default:
      return undefined;
  }
}

export function formatOfferType(job: JobBase, m: Messages): string | undefined {
  return job.stellenangebotsart ? (m.format.offerTypes[job.stellenangebotsart] ?? job.stellenangebotsart) : undefined;
}
