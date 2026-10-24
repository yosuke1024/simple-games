/**
 * Nested Tic-Tac-Toe — the French catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is. Addressed as
 * "vous", as the shell's French catalog does.
 *
 * Glossary (§12), one word each: small board = petit plateau · square = case
 * · send = envoyer · take / taken = prendre / pris (never "gagner", which is
 * the match) · closed = fermé · open = ouvert · first / second = En premier /
 * En second · cross / circle = croix / rond. The record note puts each number
 * after its label, as the English does, so a count of 1 needs no singular.
 */
import type { NestedTicTacToeMessages } from './en';

export const fr: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: 'Choisissez votre adversaire',
  nestedTicTacToeDifficulty_easy: 'Facile',
  nestedTicTacToeDifficulty_normal: 'Normal',
  nestedTicTacToeDifficulty_hard: 'Difficile',
  nestedTicTacToeRecordNote: 'Victoires {wins} · Défaites {losses}',
  nestedTicTacToeChooseSideLabel: 'Qui commence',
  nestedTicTacToePlayFirst: 'En premier',
  nestedTicTacToePlaySecond: 'En second',
  nestedTicTacToePlayFirstLabel: 'En premier, avec la croix',
  nestedTicTacToePlaySecondLabel: 'En second, avec le rond',
  nestedTicTacToeConfirmSwitchTitle: 'Remplacer la partie en cours ?',
  nestedTicTacToeConfirmSwitchBody:
    'Votre partie {current} sera remplacée par une nouvelle partie {next}.',
  nestedTicTacToeBoardLabel: 'Plateau de Nested Tic-Tac-Toe, neuf petits plateaux',
  nestedTicTacToeSmallOpen: 'Petit plateau {board} : ouvert',
  nestedTicTacToeSmallPlayable: 'Petit plateau {board} : ouvert, jouez ici',
  nestedTicTacToeSmallMine: 'Petit plateau {board} : pris par vous',
  nestedTicTacToeSmallCpu: 'Petit plateau {board} : pris par le CPU',
  nestedTicTacToeSmallDrawn: 'Petit plateau {board} : nul (fermé)',
  nestedTicTacToeCellEmpty: 'Petit plateau {board}, case {square} : vide',
  nestedTicTacToeCellPlayable: 'Petit plateau {board}, case {square} : jouez ici',
  nestedTicTacToeCellYourCross: 'Petit plateau {board}, case {square} : votre croix',
  nestedTicTacToeCellYourCircle: 'Petit plateau {board}, case {square} : votre rond',
  nestedTicTacToeCellCpuCross: 'Petit plateau {board}, case {square} : croix du CPU',
  nestedTicTacToeCellCpuCircle: 'Petit plateau {board}, case {square} : rond du CPU',
  nestedTicTacToeYourTurnSent: 'À vous : jouez dans le plateau encadré',
  nestedTicTacToeYourTurnFree: 'À vous : jouez dans n’importe quel plateau ouvert',
  nestedTicTacToeCpuTurn: 'Au tour du CPU',
  nestedTicTacToeWinTitle: 'Vous avez gagné',
  nestedTicTacToeWinBody: 'Trois de vos plateaux alignés.',
  nestedTicTacToeLoseTitle: 'Le CPU gagne',
  nestedTicTacToeLoseBody: 'Le CPU a pris trois plateaux alignés.',
  nestedTicTacToeDrawTitle: 'Match nul',
  nestedTicTacToeDrawBody:
    'Tous les petits plateaux sont fermés, et personne n’a trois plateaux alignés.',
  nestedTicTacToeBoardsYou: 'Vos plateaux',
  nestedTicTacToeBoardsCpu: 'Plateaux du CPU',
  nestedTicTacToeWins: 'Victoires',
  nestedTicTacToeLosses: 'Défaites',
  nestedTicTacToeDraws: 'Nuls',
  nestedTicTacToeStep1Title: 'Votre coup envoie l’adversaire',
  nestedTicTacToeStep1Body:
    'La case où vous jouez dans un petit plateau désigne le plateau où votre adversaire jouera ensuite.',
  nestedTicTacToeStep2Title: 'Pris ou plein : tout plateau ouvert',
  nestedTicTacToeStep2Body:
    'Si ce plateau est pris ou plein, jouez dans n’importe quel plateau ouvert.',
  nestedTicTacToeStep3Title: 'Trois plateaux alignés',
  nestedTicTacToeStep3Body:
    'Aligner trois prend un petit plateau ; aligner trois plateaux pris gagne la partie.',
};
