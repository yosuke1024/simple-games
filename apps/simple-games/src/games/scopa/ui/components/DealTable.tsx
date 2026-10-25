/**
 * One deal's settlement as a table (docs/SCOPA_RULES.md §3.2, §11.2): the five
 * categories down the side, both sides across, and for each one-point
 * category who took the point — a dash when level, and the 7♦ is never level.
 * Scopas are worth what they count, so their row is the points themselves.
 * Shared by the settlement between deals and the result card, which carries
 * the deciding deal's table instead of a settlement of its own.
 */
import { useSettings } from '@/state/SettingsContext';
import { CPU, YOU, type Seat } from '../../game/types';
import type { DealOutcome } from '../../game/engine';

const NOBODY = '—';

export function DealTable({
  outcome,
  names,
  localSeat = YOU,
}: {
  outcome: DealOutcome;
  names?: readonly string[];
  localSeat?: Seat;
}) {
  const { t } = useSettings();
  const peer = localSeat === YOU ? CPU : YOU;
  const name = (seat: Seat): string => names?.[seat] ?? t(seat === YOU ? 'scopaYou' : 'scopaCpu');
  const who = (seat: Seat | null): string => (seat === null ? NOBODY : name(seat));
  const primiera = (seat: Seat): string => {
    const tally = outcome.primiera[seat];
    return tally.suits === 4
      ? String(tally.total)
      : t('scopaPrimieraShort', { total: tally.total, suits: tally.suits });
  };
  const rows: { key: string; label: string; you: string; cpu: string; point: string }[] = [
    {
      key: 'cards',
      label: t('scopaCatCards'),
      you: String(outcome.cards[localSeat]),
      cpu: String(outcome.cards[peer]),
      point: who(outcome.awards.cards),
    },
    {
      key: 'diamonds',
      label: t('scopaCatDiamonds'),
      you: String(outcome.diamonds[localSeat]),
      cpu: String(outcome.diamonds[peer]),
      point: who(outcome.awards.diamonds),
    },
    {
      key: 'settebello',
      label: '7♦',
      you: outcome.awards.settebello === localSeat ? '✓' : NOBODY,
      cpu: outcome.awards.settebello === peer ? '✓' : NOBODY,
      point: who(outcome.awards.settebello),
    },
    {
      key: 'primiera',
      label: t('scopaCatPrimiera'),
      you: primiera(localSeat),
      cpu: primiera(peer),
      point: who(outcome.awards.primiera),
    },
    {
      key: 'scopa',
      label: t('scopaCatScopa'),
      you: String(outcome.scopas[localSeat]),
      cpu: String(outcome.scopas[peer]),
      point: '',
    },
  ];

  return (
    <table className="sc-deal-table">
      <thead>
        <tr>
          <th scope="col">
            <span className="visually-hidden">{t('scopaColCategory')}</span>
          </th>
          <th scope="col">{name(localSeat)}</th>
          <th scope="col">{name(peer)}</th>
          <th scope="col">{t('scopaColPoint')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.label}</th>
            <td>{row.you}</td>
            <td>{row.cpu}</td>
            <td>{row.point}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{t('scopaDealPoints')}</th>
          <td>+{outcome.points[localSeat]}</td>
          <td>+{outcome.points[peer]}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

/** Who took the table's last cards, in one line — or nothing when it was empty. */
export function SweepLine({ outcome }: { outcome: DealOutcome }) {
  const { t } = useSettings();
  const sweep = outcome.sweep;
  if (sweep === null || sweep.cards.length === 0) return null;
  const n = sweep.cards.length;
  return (
    <p className="sc-sweep">
      {sweep.seat === YOU ? t('scopaSweepYou', { n }) : t('scopaSweepCpu', { n })}
    </p>
  );
}
