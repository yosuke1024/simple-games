import { CardFace, cardClass } from './CardFace';
const figures: number[][][] = [
  [[0, 12]],
  [[5, 6], [8]],
  [
    [0, 12],
    [18, 25],
  ],
];
export function TutorialFigure({ step }: { step: number }) {
  return (
    <div className="bj-tutorial-figure" aria-hidden="true">
      {(figures[step] ?? figures[0]!).map((group, i) => (
        <div className="bj-figure-group" key={i}>
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
