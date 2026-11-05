import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import { suitOf, type Card } from '../../game';
import { CardFace, CardBack, cardClass, rankText, isJoker, SUITS } from './CardFace';
export function useTableNames(you: number, names?: readonly string[]) {
  const { t } = useSettings();
  return (seat: number) =>
    names?.[seat] ??
    (seat === you ? t('blackjackYou') : t('blackjackCpu', { n: seat > you ? seat : seat + 1 }));
}
export function useCardLabel() {
  const { t } = useSettings();
  return (card: Card) =>
    isJoker(card)
      ? t('blackjackJoker')
      : t('blackjackCard', { rank: rankText(card), suit: SUITS[suitOf(card)]! });
}
export function Face({ card }: { card: Card }) {
  const label = useCardLabel();
  return (
    <span className={cardClass(card)} role="img" aria-label={label(card)}>
      <CardFace card={card} />
    </span>
  );
}
export function Back() {
  return (
    <span className="bj-card" aria-hidden="true">
      <CardBack />
    </span>
  );
}
export function Seats({
  you,
  turn,
  over,
  counts,
  names,
  detail,
}: {
  you: number;
  turn: number;
  over: boolean;
  counts: readonly number[];
  names?: readonly string[];
  detail?: (seat: number) => ReactNode;
}) {
  const { t } = useSettings(),
    name = useTableNames(you, names);
  return (
    <div className="bj-seats">
      {counts.map((n, seat) => (
        <div
          key={seat}
          className={`bj-seat ${!over && turn === seat ? 'is-active' : ''}`}
          aria-current={!over && turn === seat ? 'true' : undefined}
        >
          {seat !== you && n > 0 ? (
            <span className="bj-seat-back" aria-hidden="true">
              <CardBack />
            </span>
          ) : null}
          <strong>{name(seat)}</strong>
          <span>{t('blackjackCards', { n })}</span>
          {detail?.(seat)}
        </div>
      ))}
    </div>
  );
}
export function Status({
  you,
  turn,
  over,
  names,
  children,
}: {
  you: number;
  turn: number;
  over: boolean;
  names?: readonly string[];
  children?: ReactNode;
}) {
  const { t } = useSettings(),
    name = useTableNames(you, names);
  return (
    <p className={`bj-status ${!over && you === turn ? 'is-yours' : ''}`} role="status">
      {children ??
        (over
          ? t('blackjackLost')
          : you === turn
            ? t('blackjackYourTurn')
            : t('blackjackTurn', { name: name(turn) }))}
    </p>
  );
}
export function Hand({
  cards,
  enabled = [],
  selected,
  onChoose,
}: {
  cards: readonly Card[];
  enabled?: readonly Card[];
  selected?: Card | null;
  onChoose?: (card: Card) => void;
}) {
  const { t } = useSettings(),
    label = useCardLabel(),
    ref = useRef<HTMLDivElement>(null),
    hadFocus = useRef(false);
  const signature = cards.join(','),
    active = enabled.join(',');
  useLayoutEffect(() => {
    if (
      hadFocus.current &&
      (document.activeElement === document.body || !document.activeElement?.isConnected)
    )
      ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [signature, active]);
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)
    )
      return;
    const buttons = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
    );
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement),
      offset =
        event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowRight'
            ? 1
            : event.key === 'ArrowUp'
              ? -7
              : 7;
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (((Math.max(0, current) + offset) % buttons.length) + buttons.length) % buttons.length;
    buttons[index]?.focus();
    event.preventDefault();
  };
  return (
    <div
      className="bj-hand"
      style={
        {
          '--bj-hand-columns': Math.max(1, Math.min(7, cards.length)),
          '--bj-hand-compact-columns': Math.max(1, Math.min(6, cards.length)),
        } as CSSProperties
      }
      ref={ref}
      aria-label={t('blackjackHand')}
      onKeyDown={moveFocus}
      onFocusCapture={() => {
        hadFocus.current = true;
      }}
      onBlurCapture={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          hadFocus.current = false;
      }}
    >
      {cards.map((card) =>
        onChoose ? (
          <button
            type="button"
            key={card}
            data-card={card}
            className={`${cardClass(card)} ${enabled.includes(card) ? 'is-legal' : ''} ${selected === card ? 'is-selected' : ''}`}
            disabled={!enabled.includes(card)}
            aria-label={label(card)}
            aria-pressed={selected === undefined ? undefined : selected === card}
            onClick={() => onChoose(card)}
          >
            <CardFace card={card} />
          </button>
        ) : (
          <Face card={card} key={card} />
        ),
      )}
    </div>
  );
}
