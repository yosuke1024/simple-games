/**
 * The small sheet another member's name opens (club.md §17-3, decision 49):
 * the name, the one record the row that was pressed already showed, and one
 * `Report` button behind a confirmation. Nothing else — no other tables, no
 * counts, nothing that would make it a profile. The screens never open it on
 * the owner's device (the owner acts through Members / Reported) or on the
 * viewer's own name.
 *
 * Built on the shell's dialog card the way GameActionSheet is (`overlay` /
 * `dialog action-sheet`): Escape and the backdrop close it, focus moves in and
 * stays in while it is open, and goes back to the name that opened it.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import type { T } from './common';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function NameSheet({
  nickname,
  detail,
  onReport,
  onClose,
  t,
}: {
  nickname: string;
  /** The row's own record (its facts, or the member's joined-on line); empty for none. */
  detail: string;
  /** Sends the report; the screen that opened the sheet says how it went. */
  onReport: () => Promise<void>;
  onClose: () => void;
  t: T;
}) {
  const [confirming, setConfirming] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  // The name that opened the sheet, read on the first render: by the time an
  // effect runs, `autoFocus` has already moved the focus into the sheet.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  // Back to that name once the sheet closes, so a keyboard user keeps their place in the list.
  useEffect(
    () => () => {
      if (opener?.isConnected) opener.focus();
    },
    [opener],
  );

  // Escape steps back one layer: out of the confirmation, then out of the sheet.
  // On the window (as GameActionSheet does) so it works before focus is inside.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (confirming) setConfirming(false);
      else onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirming, onClose]);

  // Tab and Shift+Tab go round the sheet's own controls, never behind it.
  const trapTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || sheet.current === null) return;
    const items = Array.from(sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !sheet.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !sheet.current.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {confirming ? null : (
        <div className="overlay" onClick={onClose}>
          <div
            ref={sheet}
            className="dialog action-sheet club-name-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={nickname}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={trapTab}
          >
            <h2 className="action-sheet-title club-name-sheet-name">{nickname}</h2>
            {detail ? <p className="dialog-body club-name-sheet-detail">{detail}</p> : null}
            <button
              type="button"
              className="action-sheet-action club-name-sheet-report"
              onClick={() => setConfirming(true)}
            >
              <span className="settings-row-label">{t('clubReport')}</span>
            </button>
            <div className="dialog-actions">
              {/* Close takes the first focus: a stray Enter never starts a report. */}
              <button type="button" className="btn btn-ghost" onClick={onClose} autoFocus>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title={t('clubReportTitle')}
        body={t('clubReportBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('clubReport')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          // The sheet goes first; the screen says "Reported" once the server answers.
          onClose();
          void onReport();
        }}
      />
    </>
  );
}
