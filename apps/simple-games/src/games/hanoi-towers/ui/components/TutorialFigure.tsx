import { Tower } from './Board';
export function TutorialFigure({ step }: { step: number }) {
  const board = step === 0 ? [0, 0, 0] : step === 1 ? [1, 0, 0] : [2, 2, 2];
  return (
    <div className="ht-figure" aria-hidden="true">
      {[0, 1, 2].map((peg) => (
        <Tower key={peg} board={board} peg={peg} selected={step === 0 && peg === 0} />
      ))}
    </div>
  );
}
