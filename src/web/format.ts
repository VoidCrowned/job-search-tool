// Pure display helpers for job data. British English labels.
import type { JobBase } from '../api/types.ts';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const euro = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

export function formatDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? undefined : dateFormat.format(d);
}

/** "20146 Hamburg", plus "+2 more" when the job has several locations. */
export function formatPlace(job: JobBase): string | undefined {
  const locs = job.stellenlokationen ?? [];
  const first = locs[0]?.adresse;
  if (!first) return undefined;
  const main = [first.plz, first.ort].filter(Boolean).join(' ') || first.region || first.land;
  return locs.length > 1 ? `${main} (+${locs.length - 1} more)` : main;
}

export function workingTimes(job: JobBase): string[] {
  const out: string[] = [];
  if (job.arbeitszeitVollzeit) out.push('Full-time');
  const partTime =
    job.arbeitszeitTeilzeitVormittag ||
    job.arbeitszeitTeilzeitNachmittag ||
    job.arbeitszeitTeilzeitAbend ||
    job.arbeitszeitTeilzeitFlexibel;
  if (partTime) out.push('Part-time');
  if (job.arbeitszeitSchichtNachtWochenende) out.push('Shifts / nights / weekends');
  if (job.istGeringfuegigeBeschaeftigung) out.push('Mini-job');
  return out;
}

export function formatPay(job: JobBase): string | undefined {
  const unit = job.verguetungsangabe === 'STUNDENLOHN' ? ' per hour' : job.verguetungsangabe === 'JAHRESGEHALT' ? ' per year' : '';
  const n = (v: number) => euro.format(v);
  if (job.gehaltsspanneVon != null && job.gehaltsspanneBis != null) {
    return `${n(job.gehaltsspanneVon)} – ${n(job.gehaltsspanneBis)}${unit}`;
  }
  if (job.festgehalt != null) return `${n(job.festgehalt)}${unit}`;
  return undefined;
}

export function formatContract(job: JobBase): string | undefined {
  switch (job.vertragsdauer) {
    case 'UNBEFRISTET':
      return 'Permanent';
    case 'BEFRISTET':
      return job.befristetBis ? `Fixed-term until ${formatDate(job.befristetBis)}` : 'Fixed-term';
    default:
      return undefined;
  }
}

const OFFER_TYPES: Record<string, string> = {
  ARBEIT: 'Job',
  SELBSTAENDIGKEIT: 'Self-employment',
  AUSBILDUNG: 'Apprenticeship',
  PRAKTIKUM_TRAINEE: 'Internship / trainee',
};

export function formatOfferType(job: JobBase): string | undefined {
  return job.stellenangebotsart ? (OFFER_TYPES[job.stellenangebotsart] ?? job.stellenangebotsart) : undefined;
}
