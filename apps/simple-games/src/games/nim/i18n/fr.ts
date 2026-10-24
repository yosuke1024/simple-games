/** AI-authored translation draft; no human review claimed. See docs/NIM_RULES.md. */
import type { NimMessages } from './en';
export const fr: NimMessages = {
  nimName: 'Nim',
  nimMode_easy: 'Facile',
  nimMode_normal: 'Normal',
  nimMode_hard: 'Difficile',
  nimRow: 'Rangée {row} : {count} pierres',
  nimTake: 'Prendre {count}',
  nimYourTurn: 'À vous',
  nimCpuTurn: 'Tour du CPU',
  nimPaused: 'En pause. Reprenez à votre rythme.',
  nimLastMove: 'Dernier coup : {count} de la rangée {row}.',
  nimGoal: 'Prenez la dernière pierre pour gagner.',
  nimChooseRow: 'Choisissez une rangée.',
  nimChooseCount: 'Choisissez combien en prendre.',
  nimWon: 'Vous gagnez !',
  nimLost: 'Le CPU gagne',
  nimOpponent: 'Adversaire',
  nimWins: 'Victoires',
  nimLosses: 'Défaites',
  nimStep1Title: 'Choisissez une rangée',
  nimStep1Body: 'Choisissez une rangée contenant des pierres ; vous commencez toujours.',
  nimStep2Title: 'Prenez-en une ou plus',
  nimStep2Body: 'Choisissez combien de pierres retirer de cette rangée, puis confirmez.',
  nimStep3Title: 'Prenez la dernière pierre',
  nimStep3Body:
    'Vous et le CPU jouez à tour de rôle ; la dernière pierre fait gagner. Annuler reprend votre coup et la réponse du CPU.',
};
