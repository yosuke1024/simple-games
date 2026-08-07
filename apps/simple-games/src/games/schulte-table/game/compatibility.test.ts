/**
 * Golden boards. These literals pin released behaviour: a player's fastest
 * time for level 1 is a time against *this* board, and a record standing
 * against a board that no longer exists is a lie the app tells quietly.
 *
 * If this test is red, either a migration plan exists and this file changes in
 * the same commit, or the generator has drifted. Do not "fix" the expectation
 * to make it pass.
 */
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from './levels';
import { createDailySession, createLevelSession } from './session';

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


describe('generated boards never drift (docs/SCHULTE_TABLE_RULES.md §6)', () => {
  it('pins the first level of the size bands', () => {
    expect(createLevelSession(1).values).toEqual([7, 3, 6, 1, 8, 2, 9, 5, 4]);
    expect(createLevelSession(16).values).toEqual([6, 1, 4, 3, 9, 7, 5, 8, 2]);
    expect(createLevelSession(21).values).toEqual([
      3, 12, 5, 1, 2, 11, 16, 14, 6, 7, 13, 4, 15, 9, 8, 10,
    ]);
    expect(createLevelSession(56).values).toEqual([
      20, 15, 4, 8, 23, 16, 18, 2, 6, 24, 21, 3, 12, 22, 11, 10, 9, 25, 17, 5, 1, 14, 13, 19, 7,
    ]);
  });

  it('pins a daily board', () => {
    expect(createDailySession('2026-08-07').values).toEqual([
      8, 16, 1, 15, 19, 12, 7, 9, 6, 17, 4, 11, 24, 5, 14, 22, 2, 3, 25, 13, 20, 18, 23, 10, 21,
    ]);
  });

  it('pins all 100 released levels, not just the band openings', () => {
    // The boards spelled out above are the readable ones; these are the rest.
    // A level's board, size and order together are what a best time stands
    // against, so all three go into the digest — two levels can share a board
    // shape and differ only in the order they are tapped (§7).
    const digests: string[] = [];
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const session = createLevelSession(level);
      digests.push(
        `${level}:${digest(`${session.size}|${session.order}|${session.values.join(',')}`)}`,
      );
    }
    expect(digests).toEqual([
    '1:a1731993', '2:3c59411b', '3:294d994b', '4:98dc5953',
    '5:1590b52b', '6:c147316b', '7:1782e19b', '8:86683723',
    '9:9198ef13', '10:996086eb', '11:e95d2793', '12:f38af0bb',
    '13:3047dae3', '14:65edfb2b', '15:8c3fa00b', '16:128509a7',
    '17:66f15b27', '18:d53c8707', '19:76777d57', '20:0cd749f7',
    '21:6ce2b2cc', '22:dc9eedfa', '23:21c5bdfc', '24:6696a08e',
    '25:a3392d2a', '26:2b663ed8', '27:b15b6102', '28:b7c712ea',
    '29:2f1e00fa', '30:a976462a', '31:fec5293a', '32:5cb3d006',
    '33:2772bc92', '34:4251a7e4', '35:cfbb6a66', '36:7e2f8722',
    '37:8a10fb00', '38:8ca4fe22', '39:7682df8c', '40:a6bc400c',
    '41:3e5be5e8', '42:0399ecac', '43:c7cee5c6', '44:ef865d16',
    '45:fd0d4a3a', '46:af10df4a', '47:91d5220c', '48:815bbd38',
    '49:f0763f6e', '50:188f9524', '51:3a2e76aa', '52:2e5a90dc',
    '53:73e7e9c8', '54:b989f4b4', '55:08a1c14a', '56:c279dca5',
    '57:e9b1d42d', '58:de888959', '59:e1f43e35', '60:11d34085',
    '61:ab019789', '62:4d023f3f', '63:642aa8b5', '64:172db843',
    '65:b982ef39', '66:187c114b', '67:128ba4ad', '68:64254dd9',
    '69:7030749f', '70:e2ef2b07', '71:b01407f9', '72:0665516b',
    '73:508d617d', '74:56ca1479', '75:d99463eb', '76:a0947bff',
    '77:0b9d0149', '78:e36e8299', '79:ca7b4cf5', '80:d302d77d',
    '81:fcf57917', '82:372578a5', '83:8b99e6d9', '84:0ddbcb85',
    '85:b29cca7f', '86:86b543c5', '87:4dc01345', '88:1ad4a3e1',
    '89:aa5d7199', '90:585a7df3', '91:6ceef141', '92:a14df4d7',
    '93:3665f789', '94:359bbdd3', '95:e8d3dc1b', '96:e3e4b379',
    '97:829a0a7b', '98:eb3dd02b', '99:ff9b211d', '100:c86f3b33',
    ]);
  });
});
