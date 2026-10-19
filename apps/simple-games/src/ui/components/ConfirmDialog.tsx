import type { ReactNode } from 'react';
import { useDialogDismiss } from '../useDialogDismiss';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  /** Also what Escape does. */
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  // The card mounts and unmounts with `open`, so it reads the opener on the
  // render that opens it (useDialogDismiss).
  return props.open ? <ConfirmDialogCard {...props} /> : null;
}

function ConfirmDialogCard({
  title,
  body,
  cancelLabel,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  useDialogDismiss(onCancel);
  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog-title">{title}</h2>
        {body ? <p className="dialog-body">{body}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
