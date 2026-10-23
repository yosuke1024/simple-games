import { createSession, move, solution } from '../../game';
import { MazeDrawing } from './Board';
export function TutorialFigure({ step }: { step: number }) {
  let session = createSession(5, 7);
  const path = solution(session);
  for (const target of path.slice(0, step === 1 ? 4 : step === 2 ? 7 : 0))
    session = move(session, target)!;
  return (
    <div className="me-figure" aria-hidden="true">
      <MazeDrawing session={session} hint={step === 2 ? (solution(session)[0] ?? null) : null} />
    </div>
  );
}
