import { CardFace, cardClass, CardBack } from './CardFace';
export function TutorialFigure({ step }: { step: number }) {
  return (
    <div className="om-tutorial-figure" aria-hidden="true">
      <span className="om-demo-arrow">{step === 0 ? '2 + 2' : step === 1 ? '↓' : '★'}</span>
      {step === 1 ? (
        <span className="om-card">
          <CardBack />
        </span>
      ) : (
        (step === 0 ? [8, 21] : [52]).map((c) => (
          <span className={cardClass(c)} key={c}>
            <CardFace card={c} />
          </span>
        ))
      )}
    </div>
  );
}
