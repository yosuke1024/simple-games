# ワイド画面のレイアウト

docs/ARCHITECTURE.md から 2026-09-05 に分割した全文。索引と要約は [../ARCHITECTURE.md](../ARCHITECTURE.md)。

スマホ縦持ちを基準(Compact)に、広い画面では CSS media query だけで段階的に
広げる(issue #93)。端末名や User-Agent では判定しない — iPad の Split View で
幅が縮めば、幅だけを理由に Compact / Medium へ戻る。

**ただし iOS の出荷バイナリは iPhone 専用である**(`TARGETED_DEVICE_FAMILY = 1`)。
ここで書くワイド段階が実際に効くのは Web 版と大きめの端末幅であって、iPad
アプリとしては配信していない。理由は能力ではなく検証で、iPad 実機での回転 /
Split View / Stage Manager を一度も確認できておらず、Universal 化に App Store
Connect が要求する 13 インチのスクリーンショットも用意していないため
([RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) §4.7)。**CSS を消す話ではない** —
戻すときは `project.pbxproj` の 1 行と `Info.plist` の 1 ブロックだけで足りる。

| 段階    | 条件                                             | 方針                                                   |
| ------- | ------------------------------------------------ | ------------------------------------------------------ |
| Compact | 600px 未満(基準)                                 | 既存のスマホ縦積みを変えない                           |
| Medium  | `min-width: 600px`                               | 縦積みのまま盤面・コンテンツを拡大                     |
| Large   | `min-width: 900px`                               | 縦積みを保ち、リスト幅だけ広げる(過度に横へ伸ばさない) |
| Wide    | `min-width: 900px` かつ `orientation: landscape` | 対象ゲームは「盤面+操作領域」の横配置を許可            |

- 600px はスマホ横持ち(高さ側が 600 未満)と iPad Split View 半分(約 507〜559px)
  を Compact 側に残す線。900px は iPad 縦(768〜834px)を Medium に、iPad 横
  (1024px〜)と一般 PC を Wide に分ける線。ホームのみ `min-width: 1280px` で
  5 列に増やす(一覧の最大幅は約 1,160px で、本文を画面端まで伸ばさない)。
- 共通シェルが持つのは `--game-shell-max`(ゲームクローム = トップバーと
  アクションバーが揃う列幅、既定 560px)だけ。盤面の寸法・横配置の形は各ゲームの
  CSS が同じ media query で自分のぶんだけ持つ(`src/ui/styles.css`「wide
  viewports」の節を参照)。汎用レイアウトフレームワークは作らない。
- 盤面の拡大は幅だけでなく高さも見る(`min(100%, <上限>, calc(100vh - <クローム高>))`
  の形)。1366×768 のような「幅は広いが低い PC」で盤面や操作が縦に欠けないことを
  優先する。
- リサイズ・回転でゲーム Root を再マウントしない。レイアウトは CSS が追従し、
  進行中の盤面・Undo 履歴・選択状態は React の状態として生き続ける。
- **キーボードは入力アダプター**(issue #93)。共有は `ui/useGameKeys` の
  薄い登録シームだけ(handled のときだけ preventDefault / 入力要素は素通し /
  モーダル・リザルト中は enabled=false で解除)。キーの意味は各ゲームが
  自分のタップ handler の隣に持ち、**画面に無い機能をキーボード専用に
  しない**。全ゲーム共通の型は Undo = Ctrl/Cmd+Z、Hint = H(その画面に
  ボタンがある場合のみ・ボタンと同じ有効条件)。ゲーム固有のキーは各
  `docs/<GAME>_RULES.md` の「操作」に書く。
- Chromium 88 床はワイド段階の規則にも適用する(古い WebView の Android
  タブレットが 900px 幅で到達する)。container query / `:has()` / subgrid は
  使わず、`svh`/`dvh` は `vh` フォールバックの後にだけ書く。
