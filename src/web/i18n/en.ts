// English (British) UI texts. This file is the source: every other language must have the same keys,
// which the `Messages` type enforces at compile time.

export const en = {
  langName: 'English',
  /** Locale for dates and numbers. */
  locale: 'en-GB',

  app: {
    brand: 'Jobsuche',
    language: 'Language',
    notFound: 'Page not found.',
    backToSearch: 'Back to search',
    profile: 'Profile',
    dataSource: 'Data:',
    pageTitle: (what?: string) => (what ? `${what} · Jobsuche` : 'Jobsuche'),
  },

  profile: {
    title: 'My profile',
    intro: 'Used to write application letters. Saved only on this computer, in data/profile.json.',
    sections: { personal: 'Personal details', goals: 'What you are looking for', cv: 'CV' },
    fields: {
      name: 'Full name',
      email: 'Email',
      phone: 'Phone',
      street: 'Street and number',
      postcode: 'Postcode',
      city: 'Town',
      desiredRoles: 'Desired roles',
      skills: 'Key skills',
      languages: 'Languages',
      notes: 'Anything else for letters',
      cv: 'CV as text',
    } as Record<string, string>,
    hints: {
      desiredRoles: 'e.g. Junior web developer, IT support',
      skills: 'One per line or comma-separated',
      languages: 'e.g. German (native), English (C1)',
      notes: 'e.g. available from March, open to relocation, why you are changing jobs',
      cv: 'Paste your CV here as plain text. Claude reads it to write your letters.',
    } as Record<string, string>,
    save: 'Save profile',
    saving: 'Saving…',
    saved: 'Saved.',
    unsaved: 'Unsaved changes',
    loading: 'Loading profile…',
  },

  theme: {
    label: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },

  search: {
    what: 'What',
    whatPlaceholder: 'Job title, keyword',
    where: 'Where',
    wherePlaceholder: 'Town or postcode',
    radius: 'Radius',
    radiusDefault: 'Default (25 km)',
    radiusOnlyPlace: 'Only this place',
    km: (n: number) => `${n} km`,
    submit: 'Search',
    filters: 'Filters',
    type: 'Type',
    any: 'Any',
    published: 'Published',
    anyTime: 'Any time',
    publishedWithin: { 0: 'Today', 1: 'Since yesterday', 7: 'Last 7 days', 14: 'Last 14 days', 28: 'Last 28 days' } as Record<number, string>,
    workingTime: 'Working time',
    contract: 'Contract',
    includeTempAgencies: 'Include temporary agency jobs',
    idle: 'Enter a job title or a place to start.',
    loading: 'Searching…',
    noResults: 'No jobs found. Try a wider radius or fewer filters.',
    count: (total: string, place: string | undefined, from: number, to: number) =>
      `${total} jobs${place ? ` near ${place}` : ''} · showing ${from}–${to}`,
    pages: 'Pages',
    pageOf: (page: string, last: string) => `Page ${page} of ${last}`,
    previous: '← Previous',
    next: 'Next →',
    queryTitle: (what?: string, where?: string) => [what, where].filter(Boolean).join(' in '),
  },

  card: {
    publishedOn: (date: string) => `Published ${date}`,
    homeOffice: 'Home office',
    externalAd: 'External ad',
    openAsPage: 'Open as page',
    collapse: 'Collapse',
  },

  tools: {
    backToTop: '↑ Back to top',
    collapseAll: (n: number) => `Collapse all (${n})`,
  },

  options: {
    angebotsart: { '1': 'Job', '2': 'Self-employment', '4': 'Apprenticeship / dual study', '34': 'Internship / trainee' },
    arbeitszeit: { vz: 'Full-time', tz: 'Part-time', snw: 'Shifts / nights / weekends', mj: 'Mini-job' },
    befristung: { '1': 'Fixed-term', '2': 'Permanent', '3': 'Not stated' },
  },

  job: {
    back: '← Back to results',
    loading: 'Loading job ad…',
    tryOriginal: 'Try it on arbeitsagentur.de',
    fullAdOn: (host: string) => `Full ad on ${host} ↗`,
    viewOriginal: 'View on arbeitsagentur.de ↗',
    noDescription: 'This ad has no description here.',
    noDescriptionExternal: 'This ad has no description here. Open the full ad above.',
    logoAlt: (company?: string) => (company ? `${company} logo` : 'Employer logo'),
    facts: {
      place: 'Place',
      type: 'Type',
      workingTime: 'Working time',
      contract: 'Contract',
      start: 'Start',
      pay: 'Pay',
      homeOffice: 'Home office',
      occupation: 'Occupation',
      tempAgency: 'Temp agency',
      published: 'Published',
      reference: 'Reference',
    },
    asap: 'As soon as possible',
    startFrom: (date: string) => `From ${date}`,
    homeOfficeByArrangement: 'Possible, by arrangement',
    homeOfficePossible: 'Possible',
    tempAgencyYes: 'Yes (temporary agency work)',
  },

  format: {
    moreLocations: (n: number) => `+${n} more`,
    fullTime: 'Full-time',
    partTime: 'Part-time',
    shifts: 'Shifts / nights / weekends',
    miniJob: 'Mini-job',
    perHour: 'per hour',
    perYear: 'per year',
    permanent: 'Permanent',
    fixedTerm: 'Fixed-term',
    fixedTermUntil: (date: string) => `Fixed-term until ${date}`,
    offerTypes: {
      ARBEIT: 'Job',
      SELBSTAENDIGKEIT: 'Self-employment',
      AUSBILDUNG: 'Apprenticeship',
      PRAKTIKUM_TRAINEE: 'Internship / trainee',
    } as Record<string, string>,
  },

  errors: {
    serverDown: 'The local server is not reachable. Is `npm run dev` running?',
    notFound: 'This job ad no longer exists.',
    upstream: 'The Jobsuche API is not answering right now. Try again in a moment.',
    invalid: 'Some values are invalid.',
    generic: (status: number) => `Something went wrong (${status}).`,
  },
};

export type Messages = typeof en;
