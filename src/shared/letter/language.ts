// Decides whether a letter should be German or English, based on the job ad's own language.
import type { LetterLanguage } from '../letter.ts';

const GERMAN = new Set(
  'der die das und ist mit für wir sie ihr ihre auf eine einen ein zu von bei den dem des sind wird werden oder nicht auch als im über unsere unser du dich dir'.split(' '),
);
const ENGLISH = new Set(
  'the and of to with for we you your our are is in a an be will this that as on or not who have from'.split(' '),
);

export function detectLanguage(...texts: (string | undefined)[]): LetterLanguage {
  const words = texts.join(' ').toLowerCase().match(/\p{L}+/gu) ?? [];
  let de = 0;
  let en = 0;
  for (const w of words) {
    if (GERMAN.has(w)) de++;
    else if (ENGLISH.has(w)) en++;
  }
  // German is the default for the German job market; English only when the ad clearly is.
  return en >= 5 && en > de * 1.5 ? 'en' : 'de';
}
