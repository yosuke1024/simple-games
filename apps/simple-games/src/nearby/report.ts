import { SUPPORT_EMAIL } from '@simple-games/brand';

/** A snapshot of only the content the user selected, not a transcript or identity. */
export interface ReportTarget {
  title: string;
  content: string;
}

export function reportDraft(target: ReportTarget, reason: string): string {
  return `Simple Games — ${target.title}\n\n${reason}\n\n${target.content}`;
}

export function reportEmail(body: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Simple Games — Nearby Play report')}&body=${encodeURIComponent(body)}`;
}

/** Hiding a discovery result is local to this search, not an identity block. */
export function listingKey(peer: { id: string; name: string; gameId: string; roomName?: string }) {
  return JSON.stringify([peer.id, peer.name, peer.gameId, peer.roomName]);
}
