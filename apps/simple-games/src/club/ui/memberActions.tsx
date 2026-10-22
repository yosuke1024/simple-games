/**
 * The Owner's two ways to deal with a member (club.md §17-3), shared by the
 * Members screen's rows and the Member screen: a new nickname saved in place,
 * and Remove with its two ends. Both only draw and report what was pressed;
 * the screen that opened them sends the request and says how it went.
 */
import { useState } from 'react';
import type { Member } from '../api/types';
import type { T } from './common';

/**
 * Remove has two ends (club.md §17-3), so it is its own dialog on the shell's
 * dialog classes: keep their results, or erase them with them.
 */
export function RemoveDialog({
  member,
  t,
  onCancel,
  onRemove,
}: {
  member: Pick<Member, 'nickname'>;
  t: T;
  onCancel: () => void;
  onRemove: (purge: boolean) => void;
}) {
  const title = t('clubRemoveTitle', { name: member.nickname });
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
        <p className="dialog-body">{t('clubRemoveBody')}</p>
        <p className="dialog-body">{t('clubRemoveEraseBody')}</p>
        <div className="dialog-actions club-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} autoFocus>
            {t('cancel')}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => onRemove(false)}>
            {t('clubRemove')}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => onRemove(true)}>
            {t('clubRemoveErase')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Owner only: a new nickname for a member, saved in place (club.md §17-3). */
export function RenamePanel({
  member,
  t,
  onCancel,
  onSave,
}: {
  member: Pick<Member, 'nickname'>;
  t: T;
  onCancel: () => void;
  onSave: (nickname: string) => Promise<void>;
}) {
  const [text, setText] = useState(member.nickname);
  const [busy, setBusy] = useState(false);
  const trimmed = text.trim();
  const save = async () => {
    setBusy(true);
    await onSave(trimmed);
    setBusy(false);
  };
  return (
    <div className="club-rename">
      <input
        className="club-input"
        type="text"
        maxLength={24}
        value={text}
        aria-label={t('clubRenameTitle')}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="club-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || trimmed === '' || trimmed === member.nickname}
          onClick={() => void save()}
        >
          {t('clubSave')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
