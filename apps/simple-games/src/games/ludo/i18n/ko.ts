import type { LudoMessages } from './en';

export const ko: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: '상대를 고르세요',
  ludoDifficulty_easy: '쉬움',
  ludoDifficulty_normal: '보통',
  ludoDifficulty_hard: '어려움',
  ludoRecordNote: '{wins}승 · {losses}패',
  ludoConfirmSwitchTitle: '진행 중인 매치를 바꿀까요?',
  ludoConfirmSwitchBody: '진행 중인 {current} 매치가 새 {next} 매치로 바뀝니다.',

  // ---- the board ----
  ludoBoardLabel: '루도 보드',
  ludoYou: '나',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '4개 중 {home}개 골인',
  ludoSafeSquare: '안전 칸',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: '출발지',
  ludoWhereSquare: '{n}번 칸',
  ludoWhereSafe: '{n}번 안전 칸',
  ludoWhereColumn: '홈 구간의 {n}번 칸',
  ludoWhereHome: '골인',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: '{where}에 있는 내 말 움직이기',

  // ---- the die and the turn ----
  ludoRollAction: '굴리기',
  ludoRollLabel: '주사위 굴리기',
  ludoDieLabel: '주사위 눈: {die}',
  ludoDieUnrolled: '아직 주사위를 굴리지 않았습니다',
  ludoTurnRoll: '당신 차례 — 주사위를 굴리세요.',
  ludoTurnMove: '{die}가 나왔습니다. 움직일 말을 탭하세요.',
  ludoTurnCpu: 'CPU {n}이(가) 플레이 중…',
  ludoAutoPass: '그 눈으로 움직일 수 있는 말이 없어 차례를 넘깁니다.',
  ludoThirdSix: '6이 세 번 연속으로 나와 차례가 넘어갑니다.',
  ludoRollAgain: '6이 나왔습니다 — 한 번 더 굴리세요.',

  // ---- the end of a match ----
  ludoWinTitle: '승리!',
  ludoWinBody: '내 말 네 개가 모두 골인했습니다.',
  ludoLoseTitle: 'CPU {n} 승리',
  ludoLoseBody: '상대 말 네 개가 모두 골인했습니다. 다음 매치는 무료입니다.',
  ludoNoContestTitle: '결과 없음',
  ludoNoContestBody:
    '아무도 골인하지 못한 채 매치가 던지기 횟수 제한에 도달했습니다. 플레이한 것으로 기록되지만 승리도 패배도 아닙니다.',
  ludoWins: '승리',
  ludoLosses: '패배',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: '6이 나오면 말이 나갑니다',
  ludoStep1Body:
    '주사위를 굴린 뒤 움직일 말을 탭하세요. 규칙상 움직일 수 있는 말만 탭할 수 있고, 나머지는 그대로 있습니다.',
  ludoStep2Title: '6이 나오면 한 번 더 굴립니다',
  ludoStep2Body:
    '6이 나오면 한 번 더 굴릴 수 있습니다. 다만 6이 세 번 연속 나오면 아무것도 움직이지 못한 채 차례가 넘어갑니다.',
  ludoStep3Title: '상대 말 위에 올라가면 그 말은 되돌아갑니다',
  ludoStep3Body:
    '그 칸에 있는 상대 말은 모두 즉시 출발지로 돌아갑니다. 안전 칸에서는 이런 일이 일어나지 않습니다. 잡아도 추가 굴리기는 주어지지 않습니다 — 추가 굴리기를 주는 건 6뿐입니다.',
  ludoStep4Title: '내 말을 겹쳐도 보호되지 않습니다',
  ludoStep4Body:
    '같은 칸에 내 말 두 개가 있어도 아무도 막지 못하고 아무것도 보호하지 못합니다. 상대가 그 칸에 올라오면 쌓여 있던 말이 한꺼번에 출발지로 돌아가므로, 뭉쳐 있는 말은 요새가 아니라 표적입니다.',
  ludoStep5Title: '골인은 정확한 숫자로만',
  ludoStep5Body:
    '골인을 넘기는 숫자가 나오면 그 말은 전혀 움직일 수 없습니다. 말 네 개를 모두 골인시키면 승리합니다. 모든 눈은 매치의 시드에서 나오며, 여섯 숫자는 확률이 똑같고, 어느 자리든 다르게 굴려지지 않습니다.',
};
