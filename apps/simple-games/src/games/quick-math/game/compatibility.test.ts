/**
 * Golden question sets. These literals pin released behaviour: a player's
 * fastest time for level 37 is a time against *those ten questions*, and a
 * record standing against a set that no longer exists is a lie the app tells
 * quietly. The saved-game record makes it sharper still — it stores a seed and
 * a question index, so a generator that drifts would resume somebody onto a
 * different question than the one they left.
 *
 * If this test is red, either a migration plan exists and this file changes in
 * the same commit, or the generator has drifted. Do not "fix" the expectation
 * to make it pass.
 */
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from './levels';
import { questionText } from './questions';
import { questionsForDaily, questionsForLevel } from './session';

/**
 * FNV-1a, 32-bit. A digest rather than the literal boards keeps a hundred
 * levels readable; the array below still names the level that moved, which a
 * single hash over everything could not.
 *
 * Copied per game like `rng.ts` is, for the same reason: a shared helper would
 * make one game's test a dependency of another's.
 */
function digest(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}


/** `tokens = answer`, which is the whole question in one readable string. */
const spell = (level: number): string[] =>
  questionsForLevel(level).map((q) => `${questionText(q)} = ${q.answer}`);

describe('generated questions never drift (docs/QUICK_MATH_RULES.md §5, §6)', () => {
  it('pins the first level of each band', () => {
    expect(spell(1)).toEqual([
      '6 − 4 = ? = 2',
      '9 − 2 = ? = 7',
      '6 − 1 = ? = 5',
      '3 + 2 = ? = 5',
      '8 + 3 = ? = 11',
      '5 + 2 = ? = 7',
      '3 + 3 = ? = 6',
      '2 + 1 = ? = 3',
      '7 + 2 = ? = 9',
      '3 + 4 = ? = 7',
    ]);
    expect(spell(21)).toEqual([
      '5 × 6 = ? = 30',
      '2 × 5 = ? = 10',
      '2 × 3 = ? = 6',
      '8 × 2 = ? = 16',
      '3 × 7 = ? = 21',
      '5 × 5 = ? = 25',
      '2 × 6 = ? = 12',
      '6 × 6 = ? = 36',
      '4 × 3 = ? = 12',
      '9 × 4 = ? = 36',
    ]);
    expect(spell(41)).toEqual([
      '18 ÷ 9 = ? = 2',
      '24 ÷ 8 = ? = 3',
      '48 ÷ 6 = ? = 8',
      '28 ÷ 7 = ? = 4',
      '63 ÷ 7 = ? = 9',
      '32 ÷ 8 = ? = 4',
      '4 ÷ 2 = ? = 2',
      '56 ÷ 8 = ? = 7',
      '16 ÷ 2 = ? = 8',
      '6 ÷ 3 = ? = 2',
    ]);
    expect(spell(61)).toEqual([
      '5 − ? = 2 = 3',
      '11 − ? = 6 = 5',
      '9 + ? = 14 = 5',
      '10 + ? = 12 = 2',
      '3 + ? = 7 = 4',
      '9 − ? = 6 = 3',
      '3 + ? = 4 = 1',
      '2 + ? = 3 = 1',
      '11 + ? = 14 = 3',
      '4 − ? = 2 = 2',
    ]);
    expect(spell(91)).toEqual([
      '20 + 1 − 3 = ? = 18',
      '18 − 4 − 3 = ? = 11',
      '17 + 2 = ? = 19',
      '3 + 2 + 1 = ? = 6',
      '6 − 3 − 3 = ? = 0',
      '20 + 3 − 2 = ? = 21',
      '15 + 2 − 3 = ? = 14',
      '17 − 1 = ? = 16',
      '12 + 1 + 1 = ? = 14',
      '11 + 2 − 5 = ? = 8',
    ]);
  });

  it('pins a daily set', () => {
    expect(questionsForDaily('2026-08-07').map((q) => `${questionText(q)} = ${q.answer}`)).toEqual([
      '14 ÷ ? = 2 = 7',
      '11 + ? = 14 = 3',
      '22 × ? = 154 = 7',
      '26 × 7 = ? = 182',
      '17 × 4 = ? = 68',
      '42 ÷ 7 = ? = 6',
      '16 − 8 = ? = 8',
      '11 + ? = 12 = 1',
      '2 × 3 = ? = 6',
      '176 ÷ ? = 22 = 8',
      '27 × ? = 108 = 4',
      '2 − 1 = ? = 1',
      '9 + 3 = ? = 12',
      '29 + 3 = ? = 32',
      '29 − ? = 24 = 5',
      '8 − ? = 0 = 8',
      '20 + ? = 22 = 2',
      '15 × ? = 75 = 5',
      '13 × ? = 52 = 4',
      '30 + 6 = ? = 36',
    ]);
  });

  it('pins all 100 released levels, not just the band openings', () => {
    // The five sets spelled out above are the readable ones; these are the
    // other ninety-five. Without them a change to `lerp()` or to a band's
    // interior could move level 37's questions with every literal above still
    // green — and Quick Math is the title where that matters most, because a
    // suspended set is restored from its *level*, not from the seed it saved:
    // a generator that moved would put somebody back on a different question
    // than the one they left.
    const digests: string[] = [];
    for (let level = 1; level <= MAX_LEVEL; level++) {
      digests.push(
        `${level}:${digest(
          questionsForLevel(level)
            .map((q) => `${questionText(q)}=${q.answer}`)
            .join('|'),
        )}`,
      );
    }
    expect(digests).toEqual([
    '1:a8ee37b1', '2:5a43a9df', '3:97a73aae', '4:182f8ece',
    '5:04020123', '6:0acddbee', '7:c8f29af5', '8:a36ae66f',
    '9:14af9d38', '10:a45fe18a', '11:c84cbda4', '12:5cc76794',
    '13:dd390135', '14:fbd85595', '15:b9262ae1', '16:c249fb8f',
    '17:535b3a51', '18:432c460d', '19:58f27f81', '20:f25aae59',
    '21:406359e3', '22:5aee1920', '23:cf3a9ce1', '24:51b85b95',
    '25:7aa12342', '26:8a55f6cf', '27:75429dd7', '28:9c0e6ba2',
    '29:889f7da2', '30:8b1471cd', '31:1d9dea17', '32:5a9f7d16',
    '33:80584dc7', '34:e6e9111f', '35:dec89d82', '36:6e2f1e88',
    '37:25a6a43f', '38:f142f6c8', '39:a2750a27', '40:8e6b20c8',
    '41:27d26471', '42:3144e306', '43:b367e3ea', '44:6834ab11',
    '45:3a08619a', '46:3d5f33ca', '47:facb400a', '48:5be56744',
    '49:fabf2f70', '50:9eaa3d14', '51:523e24da', '52:f01d408a',
    '53:3649e4fb', '54:f7b60afd', '55:6c220134', '56:20d51e3a',
    '57:637061b3', '58:48be9b8a', '59:f86ea7ad', '60:a7ad9c23',
    '61:4a2c12cf', '62:3025d4ce', '63:768aadf9', '64:59de004f',
    '65:f30080cd', '66:c69047ec', '67:fb1144ab', '68:45cef269',
    '69:7f8aecd2', '70:fa6eb419', '71:007cec38', '72:4732f1ac',
    '73:2f4a2e98', '74:778d0072', '75:b88a4e58', '76:8e9b47e1',
    '77:8984692a', '78:b2a27fe5', '79:fb027086', '80:e22c7d16',
    '81:d966cef0', '82:e2e47966', '83:9fb8d2b7', '84:ed4df209',
    '85:cbd31c7a', '86:f33bbabf', '87:26a55997', '88:79d4fd41',
    '89:f8e67b81', '90:5a7a6865', '91:03ea96e2', '92:774e392c',
    '93:e98ed8ef', '94:16333b10', '95:dc722c18', '96:a022784d',
    '97:578bfb7b', '98:758dd8d8', '99:7e9e374d', '100:53e310b4',
    ]);
  });
});
