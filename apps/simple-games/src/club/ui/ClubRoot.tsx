/**
 * The Club House screens (docs/architecture/club.md §9). TODO(work package B):
 * entry → Join / Club / Challenge / Settings. This stub only hands control back.
 */
import type { ClubRootProps } from '@/ui/clubBridge';

export function ClubRoot({ onBack }: ClubRootProps) {
  return (
    <div className="club-root">
      <button type="button" className="settings-row" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
