// Letter templates for when no API key is set. Filled from the profile and the job ad;
// anything unknown stays as a visible [Placeholder] for the user to fill in.
import type { JobDetails } from '../../api/types.ts';
import type { LetterLanguage } from '../../shared/letter.ts';
import type { Profile } from '../../shared/profile.ts';

interface Words {
  locale: string;
  yourName: string;
  yourStreet: string;
  yourTown: string;
  yourEmail: string;
  yourPhone: string;
  company: string;
  subject: (title: string, refnr: string) => string;
  greeting: string;
  opening: (title: string, company: string) => string;
  why: string;
  skills: (list: string) => string;
  skillsMissing: string;
  example: string;
  closing: string;
  signOff: string;
}

const WORDS: Record<LetterLanguage, Words> = {
  de: {
    locale: 'de-DE',
    yourName: '[Dein Name]',
    yourStreet: '[Straße und Hausnummer]',
    yourTown: '[PLZ Ort]',
    yourEmail: '[E-Mail]',
    yourPhone: '[Telefon]',
    company: '[Unternehmen]',
    subject: (title, refnr) => `Bewerbung als ${title} (Referenznummer ${refnr})`,
    greeting: 'Sehr geehrte Damen und Herren,',
    opening: (title, company) => `mit großem Interesse habe ich Ihre Stellenanzeige als ${title} bei ${company} gelesen.`,
    why: '[Warum diese Stelle und dieses Unternehmen? 1–2 Sätze.]',
    skills: (list) => `Besonders einbringen kann ich meine Kenntnisse in ${list}.`,
    skillsMissing: '[Deine wichtigsten Kenntnisse für diese Stelle]',
    example: '[Ein konkretes Beispiel aus deiner Erfahrung, das zur Stelle passt.]',
    closing: 'Über eine Einladung zu einem persönlichen Gespräch freue ich mich sehr.',
    signOff: 'Mit freundlichen Grüßen',
  },
  en: {
    locale: 'en-GB',
    yourName: '[Your name]',
    yourStreet: '[Street and number]',
    yourTown: '[Postcode Town]',
    yourEmail: '[Email]',
    yourPhone: '[Phone]',
    company: '[Company]',
    subject: (title, refnr) => `Application for ${title} (reference ${refnr})`,
    greeting: 'Dear Sir or Madam,',
    opening: (title, company) => `I read your advertisement for the position of ${title} at ${company} with great interest.`,
    why: '[Why this role and this company? 1–2 sentences.]',
    skills: (list) => `In particular, I can contribute my skills in ${list}.`,
    skillsMissing: '[Your key skills for this role]',
    example: '[A concrete example from your experience that fits the role.]',
    closing: 'I would be delighted to be invited to an interview.',
    signOff: 'Yours faithfully',
  },
};

/** Splits "a, b\nc" into ["a", "b", "c"]. */
export function splitList(text: string): string[] {
  return text
    .split(/[\n,;•]+/)
    .map((s) => s.replace(/^[-*\s]+/, '').trim())
    .filter(Boolean);
}

function joinList(items: string[], language: LetterLanguage): string {
  if (items.length <= 1) return items.join('');
  const and = language === 'de' ? 'und' : 'and';
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

export function fillTemplate(profile: Profile, job: JobDetails, language: LetterLanguage, today = new Date()): string {
  const w = WORDS[language];
  const v = (value: string, placeholder: string) => value.trim() || placeholder;
  const town = [profile.postcode.trim(), profile.city.trim()].filter(Boolean).join(' ');
  const jobPlace = job.stellenlokationen?.[0]?.adresse?.ort;
  const company = job.firma?.trim() || w.company;
  const date = new Intl.DateTimeFormat(w.locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(today);
  const skills = splitList(profile.skills).slice(0, 5);

  const lines = [
    v(profile.name, w.yourName),
    v(profile.street, w.yourStreet),
    town || w.yourTown,
    [v(profile.email, w.yourEmail), v(profile.phone, w.yourPhone)].join(' · '),
    '',
    company,
    ...(jobPlace ? [jobPlace] : []),
    '',
    `${profile.city.trim() || (language === 'de' ? '[Ort]' : '[Town]')}, ${date}`,
    '',
    w.subject(job.stellenangebotsTitel, job.referenznummer),
    '',
    w.greeting,
    '',
    `${w.opening(job.stellenangebotsTitel, company)} ${w.why}`,
    '',
    `${skills.length ? w.skills(joinList(skills, language)) : w.skillsMissing} ${w.example}`,
    '',
    w.closing,
    '',
    w.signOff,
    '',
    v(profile.name, w.yourName),
  ];
  return lines.join('\n');
}
