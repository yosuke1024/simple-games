# 静的 Web 版

docs/ARCHITECTURE.md から 2026-09-05 に分割した全文。索引と要約は [../ARCHITECTURE.md](../ARCHITECTURE.md)。

**`https://pixapps.ai/simple-games/play/` で実装・公開済み。** この節はもともと
「将来の静的 Web 版」という見出しで、実装前に「現時点では実装しない」と書かれていた
名残である。実装済みの詳細・広告・計測・保存の版差分は
[WEB_VERSION.md](../WEB_VERSION.md) を正本とする。ここには変わらないレイヤー上の
前提だけを残す。

- `games/*/game/` は Pure TypeScript で、フォルダ外への import を ESLint
  (no-restricted-imports)で機械的に禁止している。React / DOM / Capacitor /
  課金 / 広告 / ストレージへの依存ゼロ。これが Web 版を静的構成のまま出せる根拠であり、
  Web 版のためにこのレイヤーへ何かを足す必要はない。
- 保存は `KVStore` 契約(`src/storage/kv.ts`)の背後にあり、Web 版は
  Capacitor Preferences の web 実装(`localStorage`)を差すだけで動く。
- **住所はクエリパラメータ 1 本**(`?game=<game-id>`)。ゲーム別ガイドから対象
  ゲームを直接開くための入口で、シェル(`app/webRoute.ts`)だけが読み書きし、
  `Capacitor.isNativePlatform()` の実行時ガードで native では動かない。契約と
  履歴の扱いは [WEB_VERSION.md](../WEB_VERSION.md)「URL(ゲーム別の入口)」が正本。
- ホスティングは Cloudflare Pages(`pixapps-landing` リポジトリへの生成物コミット)。
  GitHub Pages でも配信できる**純静的構成**を維持する。Functions / Workers / D1 / KV /
  Durable Objects / R2 / 独自 API / 認証 / クラウドセーブ / サーバー側生成は使わない。
  ロジック・生成・デイリー・保存・言語・テーマはブラウザ内で完結する。
- **未実装(今後)**: 再訪時のオフライン動作(PWA / Service Worker、M3)。導入までは
  Web 版は初回アクセスにダウンロードが必要で、ネイティブ版の「初回起動から
  オフライン」とは異なる([WEB_VERSION.md](../WEB_VERSION.md)「オフラインの扱い」)。
