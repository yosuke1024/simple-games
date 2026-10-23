import { LightSymbol } from './LightSymbol';
export function TutorialFigure({ step }: { step: number }) {
  const lit = step === 0 ? [1, 3, 4, 5, 7] : step === 1 ? [] : [4];
  return (
    <div className="lg-figure" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className={`${lit.includes(index) ? 'lg-lit' : 'lg-dark'} ${index === 4 && step !== 1 ? 'lg-hinted' : ''} ${step !== 1 && [1, 3, 5, 7].includes(index) ? 'lg-affected' : ''}`}
        >
          <LightSymbol on={lit.includes(index)} />
          {index === 4 && step !== 1 ? <span className="lg-hint-marker">1</span> : null}
        </span>
      ))}
    </div>
  );
}
