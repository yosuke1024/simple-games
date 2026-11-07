import { APP_LINK_SCHEME, SHARE_BASE_URL, WEB_PLAY_URL } from '@simple-games/brand';
import { isAvailableGameId } from './gameChannel';
import type { GameId } from './registry';

/** null means ignore the URL; { gameId: null } is a trusted but unavailable game. */
export function nativeGameTarget(
  href: string | null | undefined,
): { gameId: GameId | null } | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.username || url.password || url.port || url.hash) return null;

  const share = new URL(SHARE_BASE_URL);
  const play = new URL(WEB_PLAY_URL);
  let id: string | null;
  if (url.origin === play.origin && /^\/simple-games\/play\/?$/.test(url.pathname)) {
    // Private launcher shortcuts keep their original address. The OS does not
    // claim /play/ URLs; regular browser links remain browser links.
    if (url.searchParams.getAll('game').length > 1) return null;
    id = url.searchParams.get('game');
  } else {
    let path: string;
    if (url.origin === share.origin && url.pathname.startsWith(share.pathname)) {
      path = url.pathname.slice(share.pathname.length);
    } else if (url.protocol === `${APP_LINK_SCHEME}:` && url.hostname === 'share') {
      path = url.pathname.slice(1);
    } else {
      return null;
    }
    // One literal slug, no nested path, encoded separators or alternative game
    // parameter. Unknown/retired slugs open the collection on older app builds.
    if (!/^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)?$/.test(path) || url.searchParams.has('game')) {
      return null;
    }
    id = path.replace(/\/$/, '') || null;
  }
  return { gameId: isAvailableGameId(id) ? id : null };
}
