import { CardFace, cardClass } from './CardFace';
const figures: number[][][] = [
  [[5], [7]],
  [
    [5, 7],
    [18, 20],
  ],
  [[12], [25]],
];
export function TutorialFigure({ step }: { step: number }) {
  return (
    <div className="du-tutorial-figure" aria-hidden="true">
      {(figures[step] ?? figures[0]!).map((group, i) => (
        <div className="du-figure-group" key={i}>
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
