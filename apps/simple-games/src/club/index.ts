/**
 * The Club House layer's entry (docs/architecture/club.md §3). Core reaches
 * this file through one dynamic `import()` in src/app/clubGate.ts and reads
 * `clubModule`, whose shape Core itself declares (ui/clubBridge.ts). The
 * catalog is registered first so no screen renders a key.
 */
import './i18n';
import type { ClubModule } from '@/ui/clubBridge';
import { createBridge, loadConnections } from './bridge';
import { inviteFromHref } from './invite';
import { ClubRoot } from './ui/ClubRoot';

export const clubModule: ClubModule = { ClubRoot, createBridge, loadConnections, inviteFromHref };
