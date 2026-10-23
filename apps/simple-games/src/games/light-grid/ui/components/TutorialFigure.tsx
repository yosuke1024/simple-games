export function TutorialFigure({ step }: { step: number }) {
  const lit = step === 0 ? [1, 3, 4, 5, 7] : step === 1 ? [] : [4];
  return (
    <div className="lg-figure" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className={`${lit.includes(index) ? 'lg-lit' : 'lg-dark'} ${index === 4 && step !== 1 ? 'lg-hinted' : ''}`}
        >
          {lit.includes(index) ? '✦' : '·'}
        </span>
      ))}
    </div>
  );
}
