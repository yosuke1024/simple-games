/**
 * Nested Tic-Tac-Toe — the Indonesian catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is. Addressed as
 * "kamu", as Checkers and Gomoku do.
 *
 * Glossary (§12), one word each: small board = papan kecil · square = kotak ·
 * send = mengirim · take / taken = merebut / direbut (never "menang", which
 * is the match) · closed = tertutup · open = terbuka · first / second =
 * Pertama / Kedua · cross / circle = silang / lingkaran.
 */
import type { NestedTicTacToeMessages } from './en';

export const id: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: 'Pilih lawanmu',
  nestedTicTacToeDifficulty_easy: 'Mudah',
  nestedTicTacToeDifficulty_normal: 'Normal',
  nestedTicTacToeDifficulty_hard: 'Sulit',
  nestedTicTacToeRecordNote: 'Menang {wins} · Kalah {losses}',
  nestedTicTacToeChooseSideLabel: 'Siapa jalan duluan',
  nestedTicTacToePlayFirst: 'Pertama',
  nestedTicTacToePlaySecond: 'Kedua',
  nestedTicTacToePlayFirstLabel: 'Pertama, memakai silang',
  nestedTicTacToePlaySecondLabel: 'Kedua, memakai lingkaran',
  nestedTicTacToeConfirmSwitchTitle: 'Ganti permainan yang sedang berjalan?',
  nestedTicTacToeConfirmSwitchBody:
    'Permainan {current} kamu akan diganti dengan permainan {next} yang baru.',
  nestedTicTacToeBoardLabel: 'Papan Nested Tic-Tac-Toe, sembilan papan kecil',
  nestedTicTacToeSmallOpen: 'Papan kecil {board}: terbuka',
  nestedTicTacToeSmallPlayable: 'Papan kecil {board}: terbuka, main di sini',
  nestedTicTacToeSmallMine: 'Papan kecil {board}: direbut olehmu',
  nestedTicTacToeSmallCpu: 'Papan kecil {board}: direbut CPU',
  nestedTicTacToeSmallOpponent: 'Papan kecil {board}: direbut {player}',
  nestedTicTacToeSmallDrawn: 'Papan kecil {board}: seri (tertutup)',
  nestedTicTacToeCellEmpty: 'Papan kecil {board}, kotak {square}: kosong',
  nestedTicTacToeCellPlayable: 'Papan kecil {board}, kotak {square}: main di sini',
  nestedTicTacToeCellYourCross: 'Papan kecil {board}, kotak {square}: silangmu',
  nestedTicTacToeCellYourCircle: 'Papan kecil {board}, kotak {square}: lingkaranmu',
  nestedTicTacToeCellCpuCross: 'Papan kecil {board}, kotak {square}: silang CPU',
  nestedTicTacToeCellOpponentCross: 'Papan kecil {board}, kotak {square}: silang {player}',
  nestedTicTacToeCellCpuCircle: 'Papan kecil {board}, kotak {square}: lingkaran CPU',
  nestedTicTacToeCellOpponentCircle: 'Papan kecil {board}, kotak {square}: lingkaran {player}',
  nestedTicTacToeYourTurnSent: 'Giliranmu — main di papan yang berbingkai',
  nestedTicTacToeYourTurnFree: 'Giliranmu — main di papan terbuka mana saja',
  nestedTicTacToeCpuTurn: 'Giliran CPU',
  nestedTicTacToeWinTitle: 'Kamu menang',
  nestedTicTacToeWinBody: 'Tiga papanmu berderet.',
  nestedTicTacToeLoseTitle: 'CPU menang',
  nestedTicTacToeLoseBody: 'CPU merebut tiga papan yang berderet.',
  nestedTicTacToeDrawTitle: 'Seri',
  nestedTicTacToeDrawBody:
    'Semua papan kecil sudah tertutup, dan tidak ada yang punya tiga papan berderet.',
  nestedTicTacToeBoardsYou: 'Papanmu',
  nestedTicTacToeBoardsCpu: 'Papan CPU',
  nestedTicTacToeWins: 'Menang',
  nestedTicTacToeLosses: 'Kalah',
  nestedTicTacToeDraws: 'Seri',
  nestedTicTacToeStep1Title: 'Langkahmu mengirim lawan',
  nestedTicTacToeStep1Body:
    'Kotak yang kamu isi di dalam papan kecil menentukan papan tempat lawan main berikutnya.',
  nestedTicTacToeStep2Title: 'Direbut atau penuh: papan terbuka mana saja',
  nestedTicTacToeStep2Body:
    'Jika papan itu sudah direbut atau penuh, main di papan terbuka mana saja.',
  nestedTicTacToeStep3Title: 'Tiga papan berderet',
  nestedTicTacToeStep3Body:
    'Tiga berderet merebut papan kecil; tiga papan yang direbut dan berderet memenangkan permainan.',
};
