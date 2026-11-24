// The user's profile: used to write application letters. Shared by server (validation, storage) and web app (form).

export const PROFILE_FIELDS = [
  'name',
  'email',
  'phone',
  'street',
  'postcode',
  'city',
  'desiredRoles',
  'skills',
  'languages',
  'notes',
  'cv',
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type Profile = Record<ProfileField, string>;

/** Long free-text fields; the rest are single lines. */
export const MULTILINE_FIELDS: readonly ProfileField[] = ['desiredRoles', 'skills', 'languages', 'notes', 'cv'];

export const MAX_LENGTH: Record<ProfileField, number> = {
  name: 200,
  email: 200,
  phone: 100,
  street: 200,
  postcode: 20,
  city: 200,
  desiredRoles: 2_000,
  skills: 5_000,
  languages: 1_000,
  notes: 5_000,
  cv: 50_000,
};

export function emptyProfile(): Profile {
  return Object.fromEntries(PROFILE_FIELDS.map((f) => [f, ''])) as Profile;
}

export function isProfileEmpty(p: Profile): boolean {
  return PROFILE_FIELDS.every((f) => p[f].trim() === '');
}

/** Validates untrusted input. Unknown keys are dropped, missing ones become ''. */
export function parseProfile(input: unknown): { profile: Profile; errors: string[] } {
  const profile = emptyProfile();
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { profile, errors: ['Profile must be an object.'] };
  }
  const obj = input as Record<string, unknown>;
  for (const field of PROFILE_FIELDS) {
    const value = obj[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') {
      errors.push(`${field}: must be text`);
      continue;
    }
    if (value.length > MAX_LENGTH[field]) {
      errors.push(`${field}: too long (max ${MAX_LENGTH[field]} characters)`);
      continue;
    }
    profile[field] = value;
  }
  return { profile, errors };
}
