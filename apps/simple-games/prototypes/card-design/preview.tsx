import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  PlayingCardFace,
  PlayingCardBack,
  PLAYING_CARD_SUITS,
} from '../../src/ui/cards/PlayingCardFace';
import { SuitIcon } from '../../src/games/hearts/ui/components/suits';
import '../../src/ui/styles.css';
import '../../src/games/hearts/ui/hearts.css';
const q = new URLSearchParams(location.search);
document.documentElement.dataset.theme = q.get('theme') ?? 'light';
const examples = [
  { rank: 1, suit: 0 },
  { rank: 7, suit: 1 },
  { rank: 10, suit: 2 },
  { rank: 11, suit: 3 },
  { rank: 12, suit: 1 },
  { rank: 13, suit: 0 },
];
const letter = (r: number) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[r] ?? String(r);
function OldFace({ rank, suit }: { rank: number; suit: number }) {
  return (
    <>
      <span className="ht-card-index" aria-hidden>
        <span className="ht-card-rank">{letter(rank)}</span>
        <SuitIcon suit={suit} />
      </span>
      <span className="ht-card-middle" aria-hidden>
        <SuitIcon suit={suit} />
      </span>
    </>
  );
}
function Row({ old = false, large = false }: { old?: boolean; large?: boolean }) {
  return (
    <div className={`deck-row${large ? ' large' : ''}`}>
      {examples.map(({ rank, suit }) => (
        <div
          className={`ht-card ${suit === 1 || suit === 2 ? 'ht-card-red' : 'ht-card-black'}`}
          key={`${rank}-${suit}`}
          role="img"
          aria-label={`${letter(rank)} ${PLAYING_CARD_SUITS[suit]}`}
        >
          {old ? (
            <OldFace rank={rank} suit={suit} />
          ) : (
            <PlayingCardFace rank={rank} suit={PLAYING_CARD_SUITS[suit]} />
          )}
        </div>
      ))}
    </div>
  );
}
const style = document.createElement('style');
style.textContent = `*{box-sizing:border-box}body{margin:0;overflow:auto;font-family:system-ui,sans-serif;background:#eeece6;color:#23312e}.review{max-width:1010px;margin:auto;padding:28px 38px 32px}h1{font-size:24px;margin:0 0 6px}p{font-size:14px;color:#5a655f;line-height:1.65;margin:0 0 22px}section{margin:20px 0 26px}h2{font-size:15px;font-weight:650;margin:0 0 12px}.deck-row{display:flex;gap:18px;align-items:center;background:#d5ddd5;border-radius:12px;padding:18px 22px}.deck-row .ht-card{position:relative;flex:none;width:64px;height:89.6px;padding:0;aspect-ratio:auto}.deck-row.large .ht-card{width:112px;height:156.8px}.review .ht-card-rank{font-size:17px}.review .ht-card-index{top:3px;left:4px;gap:1px}.review .ht-card-index .ht-suit{width:11px;height:11px}.note{margin-bottom:0;font-size:13px}.bottom{display:flex;gap:22px;align-items:center}.bottom .ht-card{position:relative;width:64px;height:89.6px;flex:none}.bottom p{margin:0} @media(max-width:650px){.review{padding:18px}.deck-row{gap:10px;padding:12px;flex-wrap:wrap}.deck-row.large .ht-card{width:88px;height:123.2px}}`;
document.head.appendChild(style);
createRoot(document.getElementById('root')!).render(
  <main className="review">
    <h1>カードデザインの比較</h1>
    <p>いまの実装をそのまま表示。まだ仕上げの確認中です。</p>
    <section>
      <h2>変更前 — Heartsで使っていた表示（幅64px）</h2>
      <Row old />
    </section>
    <section>
      <h2>現在の案 — 同じ大きさ（幅64px）</h2>
      <Row />
    </section>
    <section>
      <h2>現在の案 — 拡大（幅112px）</h2>
      <Row large />
    </section>
    <div className="bottom">
      <div className="ht-card">
        <PlayingCardBack />
      </div>
      <p className="note">
        裏面も共通化しています。
        <br />
        数字・スート・絵札の見やすさを確認するためのプレビューです。
      </p>
    </div>
  </main>,
);
