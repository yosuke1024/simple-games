/**
 * Expression lines, one move a line (docs/MAKE_THE_TARGET_RULES.md §4): the
 * moves made under the board, and the kept solution on the card after it was
 * shown (§5). An ordered list, each line drawn in signs (`7 × 3 = 21`) and
 * read aloud as a sentence (§12) — the signs are hidden from a screen reader
 * so it does not spell them out.
 */
import { useSettings } from '@/state/SettingsContext';
import type { Expression } from '../../game';
import { spokenLine, writtenLine } from '../spoken';

export interface ExpressionListProps {
  lines: readonly Expression[];
  label: string;
  className?: string;
}

export function ExpressionList({ lines, label, className = '' }: ExpressionListProps) {
  const { t } = useSettings();
  return (
    <ol className={`tg-lines ${className}`.trim()} aria-label={label}>
      {lines.map((line, index) => (
        <li key={index} className="tg-line">
          <span aria-hidden="true">{writtenLine(line)}</span>
          <span className="visually-hidden">{spokenLine(t, line)}</span>
        </li>
      ))}
    </ol>
  );
}
