/**
 * Home (docs/PEG_SOLITAIRE_RULES.md §7): one button per board, and nothing
 * between the player and the board. A single tap starts a game — there is no
 * level list, no difficulty and no daily to pick through.
 *
 * The board with a suspended game wears "Resume" and is the main button;
 * with nothing suspended, the board chosen last is (`pg.prefs`, English to
 * begin with). The slot holds one game, so choosing the other board while one
 * is suspended replaces it — the one thing here worth asking about first,
 * naming both boards (Mancala's shape). Choosing the same board resumes it
 * without a question.
 *
 * The early-release notice under the tagline is the shell's
 * (docs/WEB_VERSION.md「先行公開(ベータ)」): it says, before anything is saved,
 * that this game's saves may be reset while it is in early release.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { BOARD_KINDS, geometryOf, type BoardKind } from '../../game';
import { usePegSolitaire } from '../../state/GameContext';
import { BoardGlyph } from '../components/BoardGlyph';

export function PegSolitaireHomeScreen() {
  const {
    navigate,
    session,
    stats,
    canResume,
    preferredBoard,
    startBoard,
    resumeGame,
    exitToCollection,
  } = usePegSolitaire();
  const { t } = useSettings();
  const [pending, setPending] = useState<BoardKind | null>(null);

  const current = canResume && session ? session.problem.kind : null;
  const main = current ?? preferredBoard;

  const choose = (kind: BoardKind) => {
    if (current === kind) {
      resumeGame();
      return;
    }
    if (current) setPending(kind);
    else startBoard(kind);
  };

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="peg-solitaire" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="peg-solitaire" />
        </span>
        <h1 className="home-title">{t('pegSolitaireName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="peg-solitaire" />
      </div>

      <div className="home-actions">
        <p className="pg-choose-label">{t('pegSolitaireChooseBoard')}</p>

        {BOARD_KINDS.map((kind) => {
          const record = stats[kind];
          // One quiet note per board: the suspended game, else the record so
          // far, else what the board is. Never a target.
          const note =
            current === kind
              ? t('resume')
              : record.best !== null
                ? t('pegSolitaireBestNote', { count: record.best })
                : t('pegSolitaireHoleCount', { count: geometryOf(kind).holes.length });
          return (
            <button
              key={kind}
              type="button"
              className={`btn ${kind === main ? 'btn-primary' : 'btn-secondary'} btn-big pg-choice`}
              onClick={() => choose(kind)}
            >
              <BoardGlyph kind={kind} />
              <span className="pg-choice-text">
                <span className="pg-choice-name">{t(`pegSolitaireBoard_${kind}`)}</span>
                <span className="btn-note">{note}</span>
              </span>
            </button>
          );
        })}

        <nav className="home-chips">
          <button type="button" className="home-chip" onClick={() => navigate('stats')}>
            <IconChart className="home-chip-icon" />
            <span>{t('statistics')}</span>
          </button>
        </nav>

        <div className="home-links">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('tutorial')}>
            {t('howToPlay')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={t('pegSolitaireConfirmSwitchTitle')}
        body={
          pending && current
            ? t('pegSolitaireConfirmSwitchBody', {
                current: t(`pegSolitaireBoard_${current}`),
                next: t(`pegSolitaireBoard_${pending}`),
              })
            : ''
        }
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next) startBoard(next);
        }}
      />
    </div>
  );
}
