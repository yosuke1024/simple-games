import { CardFace, cardClass } from './CardFace';
export function TutorialFigure({ step }: { step: number }) {
  return (
    <div className="sv-tutorial-figure" aria-hidden="true">
      <span className="sv-demo-arrow">
        {step === 0 ? '← 7 →' : step === 1 ? '♠ ♥ ♦ ♣' : '○ ○ ○'}
      </span>
      {(step === 0 ? [5, 6, 7] : step === 1 ? [19, 32, 45] : [0, 12]).map((c) => (
        <span className={cardClass(c)} key={c}>
          <CardFace card={c} />
        </span>
      ))}
    </div>
  );
}
