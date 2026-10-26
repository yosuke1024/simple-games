import { SUPPORT_EMAIL } from '@simple-games/brand';
import { useEffect, useRef, useState } from 'react';
import { useDialogDismiss } from '../ui/useDialogDismiss';
import { useNearbyText } from './i18n';
import { reportDraft, reportEmail, type ReportTarget } from './report';

export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const n = useNearbyText();
  useDialogDismiss(onClose);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // A long phone-sized report must open at the explanation, not scroll down
    // to its final action before the user has reviewed the selected evidence.
    title.current?.focus({ preventScroll: true });
  }, []);
  const [reason, setReason] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'reportCopied' | 'reportCopyFailed' | null>(null);
  const body = reportDraft(target, reason);
  const ready = accepted && reason !== '';
  const copy = async () => {
    if (!ready) return;
    try {
      await navigator.clipboard.writeText(`${SUPPORT_EMAIL}\n\n${body}`);
      setCopyStatus('reportCopied');
    } catch {
      setCopyStatus('reportCopyFailed');
    }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="dialog nearby-report"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nearby-report-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="nearby-report-title" className="dialog-title" ref={title} tabIndex={-1}>
          {n('report')}
        </h2>
        <p className="nearby-note">{n('reportHint')}</p>
        <p className="nearby-note">{SUPPORT_EMAIL}</p>
        <label className="nearby-field">
          {n('reportReason')}
          <select
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setAccepted(false);
              setCopyStatus(null);
            }}
          >
            <option value="">—</option>
            {(['reportHarassment', 'reportSexual', 'reportOther'] as const).map((key) => (
              <option key={key} value={n(key)}>
                {n(key)}
              </option>
            ))}
          </select>
        </label>
        <label className="nearby-field">
          {n('reportContent')}
          <textarea readOnly rows={6} value={body} />
        </label>
        <label className="nearby-check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          {n('reportConsent')}
        </label>
        <div className="nearby-actions">
          <a
            className="btn btn-primary"
            href={ready ? reportEmail(body) : undefined}
            aria-disabled={!ready}
            tabIndex={ready ? 0 : -1}
            onClick={(e) => {
              if (!ready) e.preventDefault();
            }}
          >
            {n('reportEmail')}
          </a>
          <button className="btn btn-secondary" disabled={!ready} onClick={() => void copy()}>
            {n('reportCopy')}
          </button>
        </div>
        {copyStatus && <p role="status">{n(copyStatus)}</p>}
        <button className="btn btn-ghost" onClick={onClose}>
          {n('cancel')}
        </button>
      </section>
    </div>
  );
}
