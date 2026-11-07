import { CardFace, cardClass } from './CardFace';
const figures: number[][][] = [
  [
    [0, 12, 11],
    [13, 14, 15],
  ],
  [[20, 24, 18, 25]],
  [[0], [12]],
];
export function TutorialFigure({ step }: { step: number }) {
  return (
    <div className="sa-tutorial-figure" aria-hidden="true">
      {(figures[step] ?? figures[0]!).map((group, i) => (
        <div className="sa-figure-group" key={i}>
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
