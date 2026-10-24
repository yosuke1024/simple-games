/**
 * Invite links that open the app (App Links / Universal Links, 2026-10-24): the URL the
 * OS hands over is read by the same rules as the browser's address bar (clubGate.ts).
 */
import { describe, expect, it, vi } from 'vitest';
import { inviteFromAppLink } from './clubGate';

vi.mock('../ui/clubFeatures', () => ({
  PRIVATE_CLUBS_ENABLED: false,
  MANAGED_CLUB_ORIGIN: 'https://club.pixapps.ai',
}));

const TOKEN = 'invite-token-0123456789';

describe('inviteFromAppLink', () => {
  it('reads a managed invite link', () => {
    expect(inviteFromAppLink(`https://club.pixapps.ai/join#club=c_one123&invite=${TOKEN}`)).toEqual(
      { endpoint: 'https://club.pixapps.ai/clubs/c_one123', token: TOKEN },
    );
  });

  it('leaves every other URL to the shortcut reader', () => {
    expect(inviteFromAppLink('https://pixapps.ai/simple-games/play/?game=sudoku')).toBeNull();
    expect(inviteFromAppLink('https://club.pixapps.ai/join')).toBeNull();
    expect(inviteFromAppLink(null)).toBeNull();
    expect(inviteFromAppLink('not a url')).toBeNull();
  });

  it('acts only on managed Clubs while Private Clubs are off', () => {
    // The Public origin itself, without `club=`: a self-hosted invite shape.
    expect(inviteFromAppLink(`https://club.pixapps.ai/join#invite=${TOKEN}`)).toBeNull();
    expect(inviteFromAppLink(`https://evil.example/join#club=c_one123&invite=${TOKEN}`)).toBeNull();
  });
});
