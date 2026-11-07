/** Dev-only review of the actual collection artwork, including the small row. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GAMES } from '../../src/app/registry';
import { GameTile } from '../../src/ui/components/GameTile';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '../../src/ui/styles.css';
import './preview.css';

const query = new URLSearchParams(location.search);
document.documentElement.dataset.theme = query.get('theme') === 'dark' ? 'dark' : 'light';
const games = GAMES.filter((game) => game.category === 'cards');

function Preview() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);
  const [monochrome, setMonochrome] = useState(query.has('mono'));
  const [compact, setCompact] = useState(query.has('compact'));
  return (
    <main className="artwork-review">
      <header>
        <h1>トランプ16種類の一覧イラスト</h1>
        <div className="review-controls">
          <button
            type="button"
            onClick={() => {
              const next = theme === 'light' ? 'dark' : 'light';
              document.documentElement.dataset.theme = next;
              setTheme(next);
            }}
          >
            {theme === 'light' ? 'ダークに切り替え' : 'ライトに切り替え'}
          </button>
          <label>
            <input
              type="checkbox"
              checked={monochrome}
              onChange={(e) => setMonochrome(e.target.checked)}
            />
            単色で比較
          </label>
          <label>
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => setCompact(e.target.checked)}
            />
            48pxで比較
          </label>
        </div>
      </header>
      <div
        className={`review-grid${monochrome ? ' review-mono' : ''}${compact ? ' review-compact' : ''}`}
      >
        {games.map((game) => (
          <div className={compact ? 'game-row' : 'game-cell'} key={game.id} data-game-id={game.id}>
            <GameTile game={game} />
            <span className={compact ? 'game-row-title' : 'game-cell-title'}>{game.title}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
