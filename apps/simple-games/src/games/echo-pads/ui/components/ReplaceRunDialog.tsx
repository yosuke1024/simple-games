/**
 * The one question the home and the level list ask (docs/ECHO_PADS_RULES.md
 * §9): the level slot holds one run, so starting a level while another level
 * run is suspended replaces it — and the question names both. Escape and the
 * backdrop are Cancel (ConfirmDialog → useDialogDismiss). The daily has a slot
 * of its own and never asks.
 */
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import type { EchoSession } from '../../game';
import { levelTitle } from '../labels';

export interface ReplaceRunDialogProps {
  /** The level asked for, or null while the dialog is closed. */
  pendingLevel: number | null;
  /** The suspended level run that would be replaced. */
  current: EchoSession | null;
  onCancel: () => void;
  onConfirm: (level: number) => void;
}

export function ReplaceRunDialog({
  pendingLevel,
  current,
  onCancel,
  onConfirm,
}: ReplaceRunDialogProps) {
  const { t } = useSettings();
  return (
    <ConfirmDialog
      open={pendingLevel !== null}
      title={t('echoPadsReplaceTitle')}
      body={
        pendingLevel === null || current === null || current.level === null
          ? undefined
          : t('echoPadsReplaceBody', {
              current: levelTitle(t, current.level),
              next: levelTitle(t, pendingLevel),
            })
      }
      cancelLabel={t('cancel')}
      confirmLabel={t('confirm')}
      onCancel={onCancel}
      onConfirm={() => {
        if (pendingLevel !== null) onConfirm(pendingLevel);
      }}
    />
  );
}
