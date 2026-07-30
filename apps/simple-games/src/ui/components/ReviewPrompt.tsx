/**
 * The quiet review question (docs/REVIEW_PROMPT_POLICY.md), shown by the
 * shell on the way back from a game. Two steps, both one screen tall:
 * "enjoying it?" — yes opens the native in-app review card, "not really"
 * offers a feedback mail draft instead. Dismissing is always the first,
 * easiest option to hit, and the caller has already booked the showing, so
 * closing this dialog never costs the player anything.
 */
import { useState } from 'react';
import {
  openFeedbackEmail,
  requestStoreReview,
  resolveReviewPrompt,
} from '../../services/review';
import { useSettings } from '../../state/SettingsContext';

export interface ReviewPromptProps {
  open: boolean;
  onClose: () => void;
}

export function ReviewPrompt({ open, onClose }: ReviewPromptProps) {
  const { locale, t } = useSettings();
  const [step, setStep] = useState<'ask' | 'feedback'>('ask');

  if (!open) return null;

  const close = () => {
    setStep('ask');
    onClose();
  };

  return (
    <div className="overlay" onClick={close}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t(step === 'ask' ? 'reviewPromptTitle' : 'reviewFeedbackTitle')}
        onClick={(event) => event.stopPropagation()}
      >
        {step === 'ask' ? (
          <>
            <h2 className="dialog-title">{t('reviewPromptTitle')}</h2>
            <div className="dialog-actions dialog-actions-column">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  resolveReviewPrompt();
                  void requestStoreReview();
                  close();
                }}
              >
                {t('reviewYes')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  resolveReviewPrompt();
                  setStep('feedback');
                }}
              >
                {t('reviewNo')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={close} autoFocus>
                {t('reviewLater')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="dialog-title">{t('reviewFeedbackTitle')}</h2>
            <p className="dialog-body">{t('reviewFeedbackBody')}</p>
            <div className="dialog-actions dialog-actions-column">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  openFeedbackEmail(locale);
                  close();
                }}
              >
                {t('reviewFeedbackAction')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={close}>
                {t('close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
