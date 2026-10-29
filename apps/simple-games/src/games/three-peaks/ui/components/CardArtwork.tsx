import { rankText, suit } from '../../game';

/** Decorative artwork only. The owning card supplies its complete accessible name. */
function SuitMark({ value, className }: { value: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {value === 0 && (
        <path d="M12 2C9 6 3 9 3 14a5 5 0 0 0 8 4c0 2-1 3-2 4h6c-1-1-2-2-2-4a5 5 0 0 0 8-4c0-5-6-8-9-12Z" />
      )}
      {value === 1 && (
        <path d="M12 22C9 18 2 13 2 7a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 6-7 11-10 15Z" />
      )}
      {value === 2 && <path d="m12 1 9 11-9 11L3 12Z" />}
      {value === 3 && (
        <path d="M12 2a5 5 0 0 0-4 8 5 5 0 1 0 3 8c0 2-1 3-2 4h6c-1-1-2-2-2-4a5 5 0 1 0 3-8 5 5 0 0 0-4-8Z" />
      )}
    </svg>
  );
}

export function CardFace({ card }: { card: number }) {
  const value = suit(card);
  const index = (
    <>
      <span className="tp-card-rank">{rankText(card)}</span>
      <SuitMark value={value} className="tp-card-small-suit" />
    </>
  );
  return (
    <span className="tp-card-art" aria-hidden="true">
      <span className="tp-card-index">{index}</span>
      <SuitMark value={value} className="tp-card-pip" />
      <span className="tp-card-index tp-card-index-bottom">{index}</span>
    </span>
  );
}

/** Decorative artwork only; the first rect is the accent panel inside the paper margin (§6). */
export function CardBack() {
  return (
    <svg className="tp-card-back" viewBox="0 0 100 140" aria-hidden="true" focusable="false">
      <rect className="tp-back-panel" x="7" y="7" width="86" height="126" rx="4" />
      <rect x="12" y="12" width="76" height="116" rx="2" />
      <path
        className="tp-back-weave"
        d="m12 32 38-20 38 20-76 38 76 38-38 20-38-20 76-38Zm0 19 76 38m-76 0 76-38M31 12v116m38-116v116"
      />
      <path className="tp-back-medallion" d="m50 40 20 30-20 30-20-30Z" />
      <path d="m50 53 11 17-11 17-11-17Zm0 10 5 7-5 7-5-7Z" />
    </svg>
  );
}

export function ExampleCard({ card }: { card?: number }) {
  return (
    <span
      className={`tp-example-card ${card === undefined ? 'tp-covered' : suit(card) === 1 || suit(card) === 2 ? 'tp-red' : ''}`}
    >
      {card === undefined ? <CardBack /> : <CardFace card={card} />}
    </span>
  );
}
