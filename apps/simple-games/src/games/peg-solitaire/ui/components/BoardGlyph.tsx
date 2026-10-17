/**
 * A board's shape in miniature, for its button on the home screen (§7): the
 * cross of 33 and the triangle of 15, one dot per hole. Picture-first — the
 * two boards are told apart by their shape before their name is read. It is
 * decoration beside the name, so it is aria-hidden.
 */
import { geometryOf, type BoardKind } from '../../game';
import { layoutOf } from '../layout';

export function BoardGlyph({ kind }: { kind: BoardKind }) {
  const layout = layoutOf(geometryOf(kind));
  return (
    <svg
      className={`pg-glyph pg-glyph-${kind}`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {layout.centers.map((center, index) => (
        <circle key={index} cx={center.x} cy={center.y} r={0.32} />
      ))}
    </svg>
  );
}
