// Types for the Jobsuche API, based on live responses (November 2026).
// The official OpenAPI spec is out of date; see docs/API.md.

export interface Adresse {
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  region?: string;
  land?: string;
}

export interface Stellenlokation {
  adresse?: Adresse;
  breite?: number;
  laenge?: number;
}

export interface Zeitraum {
  von?: string;
  bis?: string;
}

export type Stellenangebotsart =
  | 'ARBEIT'
  | 'SELBSTAENDIGKEIT'
  | 'AUSBILDUNG'
  | 'PRAKTIKUM_TRAINEE'
  | (string & {});

export type Verguetungsangabe = 'KEINE_ANGABEN' | 'JAHRESGEHALT' | 'STUNDENLOHN' | (string & {});
export type ArtDerVerguetung = 'GEHALTSSPANNE' | 'FESTGEHALT' | (string & {});
export type Vertragsdauer = 'UNBEFRISTET' | 'BEFRISTET' | 'KEINE_ANGABE' | (string & {});

/** Fields shared by search results and job details. Almost everything is optional in practice. */
export interface JobBase {
  referenznummer: string;
  stellenangebotsTitel: string;
  stellenangebotsart?: Stellenangebotsart;
  firma?: string;
  arbeitgeberKundennummerHash?: string;
  hauptberuf?: string;
  alternativBeruf1?: string;
  alternativBeruf2?: string;
  weitereBerufe?: string[];
  stellenlokationen?: Stellenlokation[];
  eintrittszeitraum?: Zeitraum;
  veroeffentlichungszeitraum?: Zeitraum;
  datumErsteVeroeffentlichung?: string;
  aenderungsdatum?: string;
  externeURL?: string;
  chiffrenummer?: string;
  homeofficemoeglich?: boolean;
  homeofficetyp?: string;
  quereinstiegGeeignet?: boolean;
  istGeringfuegigeBeschaeftigung?: boolean;
  arbeitszeitVollzeit?: boolean;
  arbeitszeitTeilzeitVormittag?: boolean;
  arbeitszeitTeilzeitNachmittag?: boolean;
  arbeitszeitTeilzeitAbend?: boolean;
  arbeitszeitTeilzeitFlexibel?: boolean;
  arbeitszeitSchichtNachtWochenende?: boolean;
  verguetungsangabe?: Verguetungsangabe;
  artDerVerguetung?: ArtDerVerguetung;
  gehaltsspanneVon?: number;
  gehaltsspanneBis?: number;
  festgehalt?: number;
  vertragsdauer?: Vertragsdauer;
  befristetBis?: string;
  ausbildungsart?: string;
  studiengang?: string;
  studienform?: string;
}

export interface JobSearchItem extends JobBase {
  /** Distance in km from the searched place. */
  entfernung?: number;
  alleBerufe?: string[];
}

export interface Facet {
  counts: Record<string, number>;
  maxCount: number;
}

export interface SearchResponse {
  ergebnisliste?: JobSearchItem[];
  maxErgebnisse: number;
  page: number;
  size: number;
  woOutput?: {
    bereinigterOrt?: string;
    suchmodus?: string;
    koordinaten?: { lat: number; lon: number }[];
  };
  facetten?: Record<string, Facet>;
}

export interface JobDetails extends JobBase {
  /** Job description in Markdown. */
  stellenangebotsBeschreibung?: string;
  istBetreut?: boolean;
  istBehinderungGefordert?: boolean;
  istPrivateArbeitsvermittlung?: boolean;
  istArbeitnehmerUeberlassung?: boolean;
  allianzpartnerName?: string;
  allianzpartnerUrl?: string;
}

/** Error body the API returns for 400/404. */
export interface ApiErrorBody {
  messages?: { code?: string; path?: string; detail?: string }[];
  title?: string;
  detail?: string;
  status?: number;
}
