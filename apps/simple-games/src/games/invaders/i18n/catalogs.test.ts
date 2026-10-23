import { describe, expect, it } from 'vitest';
import { catalogs } from './index';
import { en } from './en';
describe('Invaders catalogs', () => {
  it('ships every message and matching interpolation tokens in all 14 locales', () => {
    expect(Object.keys(catalogs)).toHaveLength(14);
    for (const catalog of Object.values(catalogs)) {
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(catalog[key].trim().length).toBeGreaterThan(0);
        expect(catalog[key].match(/\{\w+\}/g) ?? []).toEqual(en[key].match(/\{\w+\}/g) ?? []);
      }
    }
  });
});
