/**
 * Device-local first-stage rules for Nearby's 14 supported languages. This is
 * a deliberately small set of explicit abuse, threats and sexual solicitations,
 * not a general dictionary of identities, body parts or personal names.
 * It does not understand context or catch all harmful text/evasions, and is not
 * a moderation/compliance guarantee. Reporting, blocking and human follow-up
 * remain necessary. No text is sent to a filtering service.
 */

// Ignore formatting only for comparison; never rewrite allowed user text or
// stored history. NFKC also handles full-width and compatibility characters.
const comparisonText = (value: string, ignoredSeparator = ''): string =>
  value
    .replace(/\p{Default_Ignorable_Code_Point}/gu, ignoredSeparator)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/i\u0307/g, 'i') // Uppercase Turkish dotted I after case conversion.
    .replace(/[’‘]/g, "'")
    .replace(/\s+/gu, ' ');

// Whole words/phrases for space-delimited languages. Unicode letter/number/mark
// boundaries avoid matching a short rule inside a name such as Scunthorpe.
const boundedPhrases = {
  en: [
    'fuck',
    'motherfucker',
    'cunt',
    'asshole',
    'kill yourself',
    'i will kill you',
    "i'll kill you",
    'send nudes',
  ],
  de: ['fick dich', 'ich bringe dich um', 'schick nacktfotos'],
  fr: ['va te faire foutre', 'je vais te tuer', 'envoie des nudes'],
  es: ['hijo de puta', 'te voy a matar', 'mándame fotos desnudas'],
  'pt-br': ['vai se foder', 'vou te matar', 'manda nudes'],
  tr: ['siktir git', 'seni öldüreceğim', 'çıplak fotoğraf gönder'],
  id: ['dasar bajingan', 'aku akan membunuhmu', 'kirim foto telanjang'],
  vi: ['đồ khốn', 'tao sẽ giết mày', 'gửi ảnh khỏa thân'],
  hi: ['तुम चूतिया हो', 'मैं तुम्हें मार डालूँगा', 'अपनी नंगी तस्वीर भेजो'],
} as const;

// These scripts do not reliably delimit words with spaces. Match explicit
// phrases, not individual characters or broad identity/anatomy vocabulary.
const containedPhrases = {
  ja: ['クソ野郎', '死ね', 'ぶっ殺す', '裸の写真送れ'],
  th: ['ไปตายซะ', 'กูจะฆ่ามึง', 'ส่งรูปโป๊มา'],
  ko: ['씨발', '죽여 버릴 거야', '죽여버릴거야', '누드 사진 보내'],
  'zh-hans': ['傻逼', '去死吧', '我要杀了你', '发裸照给我'],
  'zh-hant': ['去死吧', '我要殺了你', '發裸照給我'],
} as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bounded = new RegExp(
  `(?:^|[^\\p{L}\\p{N}\\p{M}])(?:${Object.values(boundedPhrases)
    .flat()
    .map((phrase) => escapeRegExp(comparisonText(phrase)))
    .join('|')})(?=$|[^\\p{L}\\p{N}\\p{M}])`,
  'u',
);
const contained = Object.values(containedPhrases)
  .flat()
  .map((phrase) => comparisonText(phrase));
const allowsNormalized = (value: string) =>
  !bounded.test(value) && !contained.some((phrase) => value.includes(phrase));

/** Text-shape/length validation is separate; this checks only the limited rules. */
export function isAllowedNearbyText(value: string): boolean {
  // A hidden character can be inserted inside a word or replace its separator.
  // Check both interpretations, without altering the original displayed text.
  return allowsNormalized(comparisonText(value)) && allowsNormalized(comparisonText(value, ' '));
}

/** Hide a legacy value as a whole without deleting or modifying its saved text. */
export function filteredNearbyText(value: string, replacement: string): string {
  return isAllowedNearbyText(value) ? value : replacement;
}
