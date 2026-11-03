import { CargoIcon } from './CargoIcon';
export function TutorialFigure({ step }: { step: number }) {
  return (
    <div className="rg-tutorial-figure" aria-hidden="true">
      <div className="rg-tutorial-items" style={{ paddingTop: 25 }}>
        {step === 1 ? (
          <>
            <CargoIcon cargo="wolf" />
            <span style={{ fontSize: 32 }}>×</span>
            <CargoIcon cargo="goat" />
          </>
        ) : (
          <>
            <CargoIcon cargo="wolf" />
            <CargoIcon cargo="goat" />
            <CargoIcon cargo="cabbage" />
          </>
        )}
      </div>
      <svg viewBox="0 0 260 65" width="100%" height="65">
        <path
          d="M15 52q20-10 40 0t40 0 40 0 40 0 40 0 30 0"
          fill="none"
          stroke="currentColor"
          opacity=".3"
          strokeWidth="2"
        />
        {step !== 1 ? (
          <>
            <path d="M92 24h76l-12 17h-52Z" fill="currentColor" />
            <circle cx="106" cy="12" r="6" fill="currentColor" />
            <path d="m180 26 28 0m-8-8 8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3" />
          </>
        ) : null}
      </svg>
    </div>
  );
}
