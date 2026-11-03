import { CardFace, cardClass } from './CardFace';
export function TutorialFigure({ step }: { step: number }) {
  return (
    <div className="df-tutorial-figure" aria-hidden="true">
      <span className="df-demo-arrow">
        {step === 0 ? '3 → 2 → ★' : step === 1 ? '4 × → ↺' : '2 ⇄ 2'}
      </span>
      {(step === 0 ? [3, 6, 12] : step === 1 ? [5, 18, 31, 44] : [0, 1, 39, 40]).map((c) => (
        <span className={cardClass(c)} key={c}>
          <CardFace card={c} />
        </span>
      ))}
    </div>
  );
}
