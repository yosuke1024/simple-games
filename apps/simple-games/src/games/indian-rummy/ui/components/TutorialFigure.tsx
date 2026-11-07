import { CardFace, cardClass } from './CardFace';
const figures: number[][][] = [
  [[40, 41], [42]],
  [[40, 41, 42]],
  [
    [40, 41, 42],
    [13, 14, 15],
  ],
];
export function TutorialFigure({ step }: { step: number }) {
  return (
    <div className="ir-tutorial-figure" aria-hidden="true">
      {(figures[step] ?? figures[0]!).map((group, i) => (
        <div className="ir-figure-group" key={i}>
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
