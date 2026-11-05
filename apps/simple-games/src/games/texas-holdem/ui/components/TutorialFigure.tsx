import { CardFace, cardClass } from './CardFace';
const figures: number[][][] = [
  [
    [0, 13],
    [26, 12, 25, 24, 23],
  ],
  [
    [0, 13],
    [26, 12, 25],
  ],
  [
    [0, 13],
    [26, 12, 25, 24, 23],
  ],
];
export function TutorialFigure({ step }: { step: number }) {
  return (
    <div className="th-tutorial-figure" aria-hidden="true">
      {(figures[step] ?? figures[0]!).map((group, i) => (
        <div className="th-figure-group" key={i}>
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
