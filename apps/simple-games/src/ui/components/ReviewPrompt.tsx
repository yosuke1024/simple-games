/**
 * The quiet review question (docs/REVIEW_PROMPT_POLICY.md), shown by the
 * shell on the way back from a game. Two steps, both one screen tall:
 * "enjoying it?" — yes opens the native in-app review card, "not really"
 * offers a feedback mail draft instead. Dismissing is always the first,
 * easiest option to hit, and the caller has already booked the showing, so
 * closing this dialog never costs the player anything.
 *
 * Mounted only while it is shown, so which of the two steps is on screen
 * never outlives a showing. That matters because closing is not this
 * component's alone to do: Android's hardware back closes it from the
 * collection's listener (issue #173), and a step kept across that would put
 * the next showing's first screen on the feedback offer instead of the
 * question.
 */
import { useState } from 'react';
import { openFeedbackEmail, requestStoreReview, resolveReviewPrompt } from '../../services/review';
import { useSettings } from '../../state/SettingsContext';

export interface ReviewPromptProps {
  onClose: () => void;
}

export function ReviewPrompt({ onClose }: ReviewPromptProps) {
  const { locale, t } = useSettings();
  const [step, setStep] = useState<'ask' | 'feedback'>('ask');

  return (
    <div className="overlay" onClick={onClose}>
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
                  onClose();
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
              <button type="button" className="btn btn-ghost" onClick={onClose} autoFocus>
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
                  onClose();
                }}
              >
                {t('reviewFeedbackAction')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                {t('close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
