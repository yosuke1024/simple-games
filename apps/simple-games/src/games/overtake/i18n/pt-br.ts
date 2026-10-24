/**
 * Brazilian Portuguese catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `Posição` for Place (never classificação or ranking),
 * `Esbarrões` for Bumps (never batida; not toques, which this collection uses
 * for taps — Schulte Table's `Toques errados`), `você` as in the shell.
 */
import type { OvertakeMessages } from './en';

export const ptBR: OvertakeMessages = {
  overtakeName: 'Overtake',

  // Home
  overtakeControls: 'Controles',
  overtakeControlsDrag: 'Arrastar',
  overtakeControlsButtons: 'Botões',

  // The game screen
  overtakeStart: 'Começar',
  overtakePause: 'Pausar',
  overtakeTouchToStart: 'Toque para começar',
  overtakePaused: 'Pausado',
  overtakePlaceNow: 'Posição {place} de 4',
  overtakeBoardLabel: 'Overtake, nível {n}: {state}',
  overtakeState_ready: 'pronto',
  overtakeState_running: 'correndo',
  overtakeState_paused: 'pausado',
  overtakeState_finished: 'na chegada',
  overtakePad: 'Botões de direção',
  overtakeSteerLeft: 'Virar à esquerda',
  overtakeSteerRight: 'Virar à direita',
  overtakeSlowDown: 'Aliviar',

  // The finish
  overtakeLiveResult: 'Posição {place} de 4. Esbarrões: {bumps}.',
  overtakeResultCleared: 'Nível {n} concluído',
  overtakeResultPlaced: 'Nível {n} — {place}',
  overtakePlace: 'Posição',
  overtakeBumps: 'Esbarrões',

  // Quick Rules (§10)
  overtakeStep1Title: 'Troque de faixa',
  overtakeStep1Body:
    'Mova o carro para a esquerda e a direita para trocar de faixa — o acelerador é automático, então a velocidade sobe sozinha.',
  overtakeStep2Title: 'Alivie',
  overtakeStep2BodyDrag:
    'Onde o trânsito aperta, puxe o dedo para baixo para aliviar — um esbarrão faz você parar, então aliviar é mais rápido.',
  overtakeStep2BodyHold:
    'Onde o trânsito aperta, segure ▼ para aliviar — um esbarrão faz você parar, então aliviar é mais rápido.',
  overtakeStep3Title: 'Chegue primeiro',
  overtakeStep3Body:
    'Cruze a linha antes dos três carros que andam no próprio ritmo, e o próximo nível se abre.',
};
