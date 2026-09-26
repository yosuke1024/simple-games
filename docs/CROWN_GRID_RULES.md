# Crown Grid — 正式ゲームルール

`scripts/new-game.mjs` が生成したスタブ。実装
(`apps/simple-games/src/games/crown-grid/`)、テスト、Quick Rules はここに従う。
コードはここへ `§n` で言及する。挙動を変えるときは、同じコミットでこの文書を直す。

ブランド原則([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md))はこの文書より上位にある。

ゲーム ID は `crown-grid`、i18n キーの接頭辞は `crownGrid`、保存キーの接頭辞は `cg.` である。

## 1. TODO

実装より先に、ここへ本当のルールを書くこと:

- 終了条件・クリア条件
- 操作方法
- 保存する記録(`storage/schemas.ts` の Stats / Flags を実際の値に置き換える)
- Quick Rules(アプリ内チュートリアル、最大 3 ステップ)
