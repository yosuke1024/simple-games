const MARKS = ['', '●', '◆', '✚', '▲', '★', '■', '✿'];
export function Marble({ color }: { color: number }) {
  return (
    <span className={'mw-marble mw-color-' + color} aria-hidden="true">
      <span>{MARKS[color]}</span>
    </span>
  );
}
