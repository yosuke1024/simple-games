import { CardFace, cardClass } from './CardFace';
const figures: number[][][] = [
  [[19], [32]],
  [[7], [20]],
  [[32], [33]],
];
export function TutorialFigure({ step }: { step: number }) {
  return (
    <div className="ce-tutorial-figure" aria-hidden="true">
      {(figures[step] ?? figures[0]!).map((group, i) => (
        <div className="ce-figure-group" key={i}>
          {group.map((card, j) => (
            <span className={cardClass(card)} key={j}>
              <CardFace card={card} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
