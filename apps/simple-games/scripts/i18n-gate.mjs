#!/usr/bin/env node
/**
 * The working end of the release gate in docs/I18N_POLICY.md,「リリース前の門」.
 *
 *   node scripts/i18n-gate.mjs status            what is outstanding
 *   node scripts/i18n-gate.mjs pending <locale>  the strings to back-translate
 *   node scripts/i18n-gate.mjs approve <locale> <key> --by <who>
 *
 * `pending` prints ONLY the translated strings — never the English. That is the
 * whole reason the step works: hand this output to a session or model that has
 * not seen the source, ask for a plain translation back into Japanese, and the
 * result is evidence rather than an echo. Paste the English in alongside and
 * you have measured nothing.
 *
 * `approve` records the exact pair of strings that was reviewed, so editing
 * either one afterwards turns the approval stale and fails gate.test.ts.
 *
 * Enforcement lives in the test, not here: a script anyone can skip is not a
 * gate. This is the ergonomics around it.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const I18N = join(HERE, '../src/i18n');
const RECORD_PATH = join(I18N, 'gateRecord.json');

const digest = (value) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

/**
 * The catalogues are TypeScript, and this script must not need a build step to
 * run. Read the source and pull out the string literals: these files are plain
 * `key: 'value',` records with no logic in them, which the i18n tests already
 * guarantee.
 */
function readCatalog(locale) {
  const text = readFileSync(join(I18N, `locales/${locale}.ts`), 'utf8');
  const out = {};
  // key: 'single-quoted, possibly multi-line, with \' escapes'
  const pattern = /^\s{2}(?:\/\/.*\n\s*)?'?([A-Za-z0-9_]+)'?:\s*\n?\s*'((?:[^'\\]|\\.)*)'/gm;
  for (const match of text.matchAll(pattern)) {
    out[match[1]] = match[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  }
  return out;
}

function readList(file, exportName) {
  const text = readFileSync(join(I18N, file), 'utf8');
  const body = text.slice(text.indexOf(exportName));
  // Start at the assignment, not the first '[' — the type annotation
  // `readonly (keyof Messages)[]` has one, and matching that yields an empty
  // list and a green "gate complete" over nothing at all.
  const start = body.indexOf('= [');
  const block = body.slice(start, body.indexOf('];', start));
  const found = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (found.length === 0) {
    console.error(`Could not read ${exportName} from ${file}. Refusing to report on an empty list.`);
    process.exit(2);
  }
  return found;
}

function machineLocales() {
  const text = readFileSync(join(I18N, 'provenance.ts'), 'utf8');
  const block = text.slice(text.indexOf('LOCALE_PROVENANCE'));
  return [...block.matchAll(/'?([a-z-]+)'?:\s*'machine'/g)].map((m) => m[1]);
}

const keys = readList('highRiskKeys.ts', 'HIGH_RISK_KEYS');
const locales = machineLocales();
const record = JSON.parse(readFileSync(RECORD_PATH, 'utf8'));
const approvals = record.approvals;
const en = readCatalog('en');

const [command, ...args] = process.argv.slice(2);

if (command === 'status') {
  let outstanding = 0;
  for (const locale of locales) {
    const done = keys.filter((key) => approvals[locale]?.[key]);
    const stale = done.filter((key) => {
      const entry = approvals[locale][key];
      const target = readCatalog(locale)[key];
      return digest(en[key]) !== entry.source || (target && digest(target) !== entry.target);
    });
    outstanding += keys.length - done.length + stale.length;
    const mark = done.length === keys.length && stale.length === 0 ? '✅' : '  ';
    console.log(
      `${mark} ${locale.padEnd(8)} ${String(done.length).padStart(2)}/${keys.length} approved` +
        (stale.length ? `, ${stale.length} STALE` : ''),
    );
  }
  console.log(
    outstanding === 0
      ? '\nGate complete.'
      : `\n${outstanding} approval(s) outstanding. \`pending <locale>\` prints what to back-translate.`,
  );
  process.exit(0);
}

if (command === 'pending') {
  const locale = args[0];
  if (!locales.includes(locale)) {
    console.error(`"${locale}" is not a machine locale. One of: ${locales.join(', ')}`);
    process.exit(1);
  }
  const catalog = readCatalog(locale);
  console.log(`# ${locale} — back-translate these into Japanese.`);
  console.log('# Whoever does this must NOT be shown the English original.\n');
  for (const key of keys) {
    if (approvals[locale]?.[key]) continue;
    console.log(`${key}: ${catalog[key]}`);
  }
  process.exit(0);
}

if (command === 'approve') {
  const [locale, key] = args;
  const byIndex = args.indexOf('--by');
  const by = byIndex === -1 ? '' : args[byIndex + 1];
  if (!locales.includes(locale) || !keys.includes(key) || !by) {
    console.error('usage: approve <machine-locale> <high-risk-key> --by <who back-translated>');
    process.exit(1);
  }
  const target = readCatalog(locale)[key];
  if (target === undefined) {
    console.error(`${locale} has no string for "${key}"`);
    process.exit(1);
  }
  approvals[locale] ??= {};
  approvals[locale][key] = {
    source: digest(en[key]),
    target: digest(target),
    reviewedOn: new Date().toISOString().slice(0, 10),
    by,
  };
  writeFileSync(RECORD_PATH, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  console.log(`recorded ${locale}.${key} (back-translated by ${by})`);
  process.exit(0);
}

console.error('usage: i18n-gate.mjs status | pending <locale> | approve <locale> <key> --by <who>');
process.exit(1);
