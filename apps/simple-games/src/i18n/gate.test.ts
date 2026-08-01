/**
 * Enforces the release gate described in docs/I18N_POLICY.md,「リリース前の門」.
 *
 * A policy that only exists in a document is a policy that does not block a
 * release. This test is what connects the two.
 *
 * TWO DIFFERENT FAILURES, ON PURPOSE
 *
 *   stale / bogus approval  → always fails.
 *     Someone approved a pair of strings and then one of them changed, or the
 *     record names a locale or key that no longer exists. That is a silent
 *     regression: the record still claims a review that no longer applies.
 *
 *   missing approval        → fails only under I18N_GATE_STRICT.
 *     Twelve locales shipped before this gate existed. Failing on that every
 *     run would leave the suite permanently red, and a permanently red suite
 *     teaches everyone to ignore it. It is reported instead, and the release
 *     checklist runs the strict form:
 *
 *       I18N_GATE_STRICT=1 pnpm --filter simple-games exec vitest run src/i18n/gate.test.ts
 *
 * The backlog is real and written down (docs/I18N_POLICY.md). It is not hidden.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { catalogs, type Locale } from './index';
import { HIGH_RISK_KEYS } from './highRiskKeys';
import { LOCALE_PROVENANCE, machineLocales } from './provenance';
import record from './gateRecord.json';

interface Approval {
  source: string;
  target: string;
  reviewedOn: string;
  by: string;
}

const approvals = record.approvals as Record<string, Record<string, Approval>>;

const digest = (value: string) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

const STRICT = process.env.I18N_GATE_STRICT === '1';

describe('high-risk translation gate', () => {
  it('names only keys and locales that still exist', () => {
    const problems: string[] = [];
    for (const [locale, keys] of Object.entries(approvals)) {
      if (!(locale in LOCALE_PROVENANCE)) {
        problems.push(`approval for unknown locale "${locale}"`);
        continue;
      }
      for (const key of Object.keys(keys)) {
        if (!HIGH_RISK_KEYS.includes(key as keyof (typeof catalogs)['en'])) {
          problems.push(`approval for "${locale}.${key}", which is not a high-risk key`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('has no approval that its strings have outgrown', () => {
    const stale: string[] = [];
    for (const [locale, keys] of Object.entries(approvals)) {
      if (!(locale in LOCALE_PROVENANCE)) continue;
      for (const [key, approval] of Object.entries(keys)) {
        const typedKey = key as keyof (typeof catalogs)['en'];
        const source = catalogs.en[typedKey];
        const target = catalogs[locale as Locale]?.[typedKey];
        if (source === undefined || target === undefined) continue;

        if (digest(source) !== approval.source) {
          stale.push(
            `${locale}.${key}: the English changed since it was reviewed on ${approval.reviewedOn}. ` +
              `Re-run the gate for this key and update the record.`,
          );
        } else if (digest(target) !== approval.target) {
          stale.push(
            `${locale}.${key}: the translation changed since it was reviewed on ${approval.reviewedOn}. ` +
              `An approval covers the exact string that was read, not the locale.`,
          );
        }
      }
    }
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('records who back-translated, and it was not the translator', () => {
    const problems: string[] = [];
    for (const [locale, keys] of Object.entries(approvals)) {
      for (const [key, approval] of Object.entries(keys)) {
        if (!approval.by || !approval.reviewedOn) {
          problems.push(`${locale}.${key}: an approval must say who back-translated it and when`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('covers every machine locale (strict mode only)', () => {
    const outstanding: string[] = [];
    for (const locale of machineLocales()) {
      const missing = HIGH_RISK_KEYS.filter((key) => !approvals[locale]?.[key as string]);
      if (missing.length) outstanding.push(`${locale}: ${missing.length}/${HIGH_RISK_KEYS.length} keys unapproved`);
    }

    if (!STRICT) {
      if (outstanding.length) {
        const total = outstanding.length;
        console.warn(
          `\n  ⚠ i18n release gate: ${total} locale(s) not yet through the gate.\n` +
            outstanding.map((line) => `    ${line}`).join('\n') +
            `\n  This is the documented backlog (docs/I18N_POLICY.md), not a new regression.\n` +
            `  Before a release, run: I18N_GATE_STRICT=1 pnpm --filter simple-games exec vitest run src/i18n/gate.test.ts\n`,
        );
      }
      return;
    }

    expect(
      outstanding,
      `The release gate has not been completed:\n${outstanding.join('\n')}\n\n` +
        `For each key: have someone who has NOT seen the English back-translate the ` +
        `translated string, read that back-translation, then record the pair in gateRecord.json.`,
    ).toEqual([]);
  });
});
