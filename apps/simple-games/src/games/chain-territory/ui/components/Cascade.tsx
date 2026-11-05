import { useEffect, useState } from 'react';
import { type Cell } from '../../game';
import { Board } from './Board';
export function Cascade({ waves, durationMs }: { waves: Cell[][]; durationMs: number }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setStep((n) => Math.min(n + 1, waves.length - 1)),
      durationMs / Math.max(1, waves.length),
    );
    return () => window.clearInterval(timer);
  }, [waves, durationMs]);
  return (
    <div className="ct-cascade" aria-hidden="true" inert>
      <Board board={waves[step] ?? waves[0]!} blocked onPlay={() => {}} lastCell={null} />
    </div>
  );
}
