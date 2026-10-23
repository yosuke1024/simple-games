import { SYMBOLS } from '../../game';
export function TutorialFigure({ step }: { step: number }) {
  const colours =
    step === 0
      ? [0, 0, 2, 0, 1, 2, 1, 1, 2]
      : step === 1
        ? [1, 1, 2, 1, 1, 2, 1, 1, 2]
        : Array<number>(9).fill(2);
  return (
    <div className="cf-figure" aria-hidden="true">
      {colours.map((colour, index) => (
        <span key={index} className={`cf-colour-${colour} ${index === 0 ? 'cf-origin' : ''}`}>
          {SYMBOLS[colour]}
        </span>
      ))}
    </div>
  );
}
