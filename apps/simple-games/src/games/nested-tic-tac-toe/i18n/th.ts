/**
 * Nested Tic-Tac-Toe — the Thai catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is.
 *
 * Glossary (§12), one word each: small board = กระดานเล็ก · square = ช่อง ·
 * send = ส่ง · take / taken = ยึด / ยึดแล้ว (never "ชนะ", which is the
 * match) · closed = ปิดแล้ว · open = เปิดอยู่ · first / second = เดินก่อน /
 * เดินทีหลัง · cross / circle = กากบาท / วงกลม.
 */
import type { NestedTicTacToeMessages } from './en';

export const th: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: 'เลือกคู่แข่ง',
  nestedTicTacToeDifficulty_easy: 'ง่าย',
  nestedTicTacToeDifficulty_normal: 'ปกติ',
  nestedTicTacToeDifficulty_hard: 'ยาก',
  nestedTicTacToeRecordNote: 'ชนะ {wins} · แพ้ {losses}',
  nestedTicTacToeChooseSideLabel: 'ใครเดินก่อน',
  nestedTicTacToePlayFirst: 'เดินก่อน',
  nestedTicTacToePlaySecond: 'เดินทีหลัง',
  nestedTicTacToePlayFirstLabel: 'เดินก่อน ใช้กากบาท',
  nestedTicTacToePlaySecondLabel: 'เดินทีหลัง ใช้วงกลม',
  nestedTicTacToeConfirmSwitchTitle: 'แทนที่เกมที่เล่นอยู่?',
  nestedTicTacToeConfirmSwitchBody: 'เกม {current} ของคุณจะถูกแทนที่ด้วยเกม {next} ใหม่',
  nestedTicTacToeBoardLabel: 'กระดาน Nested Tic-Tac-Toe มีกระดานเล็กเก้ากระดาน',
  nestedTicTacToeSmallOpen: 'กระดานเล็ก {board}: เปิดอยู่',
  nestedTicTacToeSmallPlayable: 'กระดานเล็ก {board}: เปิดอยู่ เล่นที่นี่ได้',
  nestedTicTacToeSmallMine: 'กระดานเล็ก {board}: คุณยึดแล้ว',
  nestedTicTacToeSmallCpu: 'กระดานเล็ก {board}: CPU ยึดแล้ว',
  nestedTicTacToeSmallOpponent: 'กระดานเล็ก {board}: {player} ยึดแล้ว',
  nestedTicTacToeSmallDrawn: 'กระดานเล็ก {board}: เสมอ (ปิดแล้ว)',
  nestedTicTacToeCellEmpty: 'กระดานเล็ก {board} ช่อง {square}: ว่าง',
  nestedTicTacToeCellPlayable: 'กระดานเล็ก {board} ช่อง {square}: เล่นที่นี่ได้',
  nestedTicTacToeCellYourCross: 'กระดานเล็ก {board} ช่อง {square}: กากบาทของคุณ',
  nestedTicTacToeCellYourCircle: 'กระดานเล็ก {board} ช่อง {square}: วงกลมของคุณ',
  nestedTicTacToeCellCpuCross: 'กระดานเล็ก {board} ช่อง {square}: กากบาทของ CPU',
  nestedTicTacToeCellOpponentCross: 'กระดานเล็ก {board} ช่อง {square}: กากบาทของ {player}',
  nestedTicTacToeCellCpuCircle: 'กระดานเล็ก {board} ช่อง {square}: วงกลมของ CPU',
  nestedTicTacToeCellOpponentCircle: 'กระดานเล็ก {board} ช่อง {square}: วงกลมของ {player}',
  nestedTicTacToeYourTurnSent: 'ตาคุณ — เล่นในกระดานที่มีกรอบ',
  nestedTicTacToeYourTurnFree: 'ตาคุณ — เล่นในกระดานที่เปิดอยู่กระดานไหนก็ได้',
  nestedTicTacToeCpuTurn: 'ตาของ CPU',
  nestedTicTacToeWinTitle: 'คุณชนะ',
  nestedTicTacToeWinBody: 'กระดานของคุณสามกระดานเรียงกัน',
  nestedTicTacToeLoseTitle: 'CPU ชนะ',
  nestedTicTacToeLoseBody: 'CPU ยึดได้สามกระดานที่เรียงกัน',
  nestedTicTacToeDrawTitle: 'เสมอ',
  nestedTicTacToeDrawBody: 'กระดานเล็กทุกกระดานปิดแล้ว และไม่มีฝ่ายใดมีสามกระดานเรียงกัน',
  nestedTicTacToeBoardsYou: 'กระดานของคุณ',
  nestedTicTacToeBoardsCpu: 'กระดานของ CPU',
  nestedTicTacToeWins: 'ชนะ',
  nestedTicTacToeLosses: 'แพ้',
  nestedTicTacToeDraws: 'เสมอ',
  nestedTicTacToeStep1Title: 'ช่องที่คุณเล่นส่งคู่แข่งไป',
  nestedTicTacToeStep1Body: 'ตำแหน่งที่คุณเล่นในกระดานเล็ก เป็นตัวกำหนดกระดานที่คู่แข่งจะเล่นต่อไป',
  nestedTicTacToeStep2Title: 'ถูกยึดหรือเต็ม: กระดานไหนก็ได้ที่เปิดอยู่',
  nestedTicTacToeStep2Body: 'ถ้ากระดานนั้นถูกยึดหรือเต็มแล้ว ให้เล่นในกระดานไหนก็ได้ที่ยังเปิดอยู่',
  nestedTicTacToeStep3Title: 'สามกระดานเรียงกัน',
  nestedTicTacToeStep3Body: 'เรียงสามในกระดานเล็กเพื่อยึดกระดานนั้น ยึดได้สามกระดานเรียงกันก็ชนะ',
};
