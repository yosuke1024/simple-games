# Pipe Link — 正式ゲームルール

この文書は Simple Games 収録タイトル「Pipe Link」の唯一のルールソースになる。**いまは
スタブである。**本文 — 盤面・規則・操作・生成と一意性・ティア・Undo と Hint・保存・統計・
Quick Rules・演出とアクセシビリティ・i18n・意図的な差分・検証の範囲 — は Phase 2 で
**コードより先に**ここへ書き、以後は実装(`apps/simple-games/src/games/pipe-link/`)・テスト・
Quick Rules がこの文書に従う(コードはここへ `§n` で言及し、挙動を変えるときは同じコミットで
この文書を直す)。それまでの仕様は計画
[plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md](plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md)
の「49. Pipe Link」にあり、本文が書かれたらこちらが勝つ。

ブランド原則([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md))はこの文書より上位にある。

ゲーム ID は `pipe-link`、i18n キーの接頭辞は `pipeLink`、保存キーの接頭辞は `pn.`、
カテゴリは `logic`、No. 49。**Web 先行公開(ベータ)のタイトル**で、アプリにはまだ収録して
いない(registry では遊べるようになるまで `channel: 'in-development'` — どのビルドにも出ない — その後
`'web-beta'`。[WEB_VERSION.md](WEB_VERSION.md)「先行公開(ベータ)」)。

## 決まっていること(2026-10-19、製品オーナーの判断 — 詳細と理由は計画)

- タイルを回して水源から全タイルへ水を通す論理パズル。タイルは端・直線・エルボ・T の 4 種
  (十字なし)。水源につながったタイルが点灯し、**全タイルが点灯したらクリア**(解は全域木)。
- Easy 5×5 / Medium 7×7 / Hard 8×8 の Free Play と Daily(Medium 固定・今日の 1 問だけ)。
  9×9 は v1 に無い。New Board と Restart(初期の向きへ)。
- タップで 90° 時計回り。反時計回りはマウスの右クリックと Shift+Enter(Minesweeper /
  Nonogram の右クリックの契約に合わせる)で、タッチには無い。
- Undo は無料・無制限。Hint も無料・無制限(技法で証明できるタイルを 1 枚、技法で言えない
  ときだけ解の 1 枚)。自動回転・答え合わせボタン・タイルロック・Hint の回数制限は作らない。
- 出題は一意解だけ(解を 2 つまで数える)。ティアは要る推論で分ける(L1 噛み合わせ / L2 閉路と
  孤立の排除 / L3 仮定 1 回)。生成と探索に仕事量の上限、上限で同梱盤面へ。読み込み時に
  一意性を証明し直さない。
- プレイ中に時計も手数も出さない。自己ベストは経過秒。保存キーは `pn.saveGame` /
  `pn.saveDaily`(2 スロット規則)/ `pn.stats` / `pn.flags` / `pn.prefs`(`storage/schemas.ts` の
  仮の Stats / Flags は Phase 2 で置き換える)。
- Quick Rules(文案は仮): 1) パイプをタップすると 90° 回る。2) 水源につながったパイプは光る。3) すべてのパイプが光ったら完成。
- 他社の製品名(Pipe Mania 等)はアプリ内・ストア文言に書かない。外の製品との対応は意図的な
  差分の節でだけ書く。提案時の使い捨て試作の数値(一意率など)は、実装で再現するまで
  「検証済み」と書かない。

## i18n の来歴

`en` が原文になる。**訳はまだ無い**(いまは 14 言語ともスキャフォールドの英語のプレースホルダー)。
`ja` と他の 12 言語は AI が書く予定で、書いた後もネイティブと作者が読むまでは未読として扱う
([I18N_POLICY.md](I18N_POLICY.md))。
