/**
 * The band at the top of the table (docs/SCOPA_RULES.md §7, §11.2): one row
 * per side, drawn the same way, each with the match score, the dealer's mark
 * on the dealer's row, and this deal's public tally — cards, Diamonds, the 7♦
 * and scopas, the four things anyone at the table could have counted. The
 * CPU's row also shows how many cards it holds, as backs.
 *
 * What is not here, on purpose: either side's taken cards as a list, and the
 * CPU's primiera. At a real table both piles are face down, and the player
 * plays from memory (§7). No clock either — the score is the standing, not a
 * countdown.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { captureSummary } from '../../game/engine';
import { SEVEN_OF_DIAMONDS } from '../../game/cards';
import { CPU, YOU, type BySeat, type DealState, type Seat } from '../../game/types';
import { MiniCard, ScopaMark } from './CardFace';
import { SuitIcon } from './suits';

export interface CaptureBandProps {
  deal?: DealState;
  view?: Pick<DealState, 'dealer' | 'captured' | 'scopas'> & { opponentCount: number };
  localSeat?: Seat;
  names?: readonly string[];
  scores: BySeat<number>;
  /** The side whose scopa was just announced, for a moment's emphasis. */
  flash: Seat | null;
}

export const CaptureBand = memo(function CaptureBand({
  deal,
  view,
  scores,
  flash,
  localSeat = YOU,
  names,
}: CaptureBandProps) {
  const { t } = useSettings();

  const shown = view ?? (deal ? { ...deal, opponentCount: deal.hands[CPU].length } : null);
  if (!shown) return null;
  const peer = localSeat === YOU ? CPU : YOU;
  const row = (seat: Seat) => {
    const summary = captureSummary(shown, seat);
    const who = names?.[seat] ?? (seat === YOU ? t('scopaYou') : t('scopaCpu'));
    // One sentence per row, owned by the catalog: the 7♦ and the dealer are
    // filled into it from their own keys, which carry their own punctuation,
    // so each language orders and joins them itself (§12).
    const spoken = t('scopaBandLabel', {
      who,
      score: scores[seat],
      cards: summary.cards,
      diamonds: summary.diamonds,
      scopas: summary.scopas,
      settebello: summary.settebello ? t('scopaBandSettebello') : '',
      dealer: shown.dealer === seat ? t('scopaBandDealer') : '',
    });
    const held = shown.opponentCount;
    return (
      <div
        className={`sc-band-row ${flash === seat ? 'sc-band-flash' : ''}`}
        role="group"
        aria-label={spoken}
      >
        <span className="sc-band-who" aria-hidden="true">
          {who}
        </span>
        <span className="sc-band-score" aria-hidden="true">
          {scores[seat]}
        </span>
        <span
          className={`sc-dealer ${shown.dealer === seat ? '' : 'sc-dealer-off'}`}
          aria-hidden="true"
        />
        <span className="sc-band-tally" aria-hidden="true">
          <span className="sc-tally">
            <span className="sc-stack-icon" />
            {summary.cards}
          </span>
          {/* The ♦ carries the suit (in a red that reads on the page, not
              the card red); the count is in the band's own ink. */}
          <span className="sc-tally sc-tally-diamonds">
            <SuitIcon suit={2} />
            {summary.diamonds}
          </span>
          <MiniCard
            card={SEVEN_OF_DIAMONDS}
            className={summary.settebello ? 'sc-held' : 'sc-not-held'}
          />
          <span className="sc-tally">
            <ScopaMark />
            {summary.scopas}
          </span>
        </span>
        {seat === peer ? (
          <span
            className="sc-backs"
            role="img"
            aria-label={names ? `${who} · ${held}` : t('scopaCpuHandLabel', { n: held })}
          >
            {Array.from({ length: held }, (_, index) => (
              <span key={index} className="sc-back" />
            ))}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="sc-band">
      {row(peer)}
      {row(localSeat)}
    </div>
  );
});
