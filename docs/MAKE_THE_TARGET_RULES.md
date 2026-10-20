# Make the Target — 正式ゲームルール

この文書は Simple Games の Web 先行公開タイトル「Make the Target」の唯一のルールソースになる。
**いまはスタブである。**本文 — 盤面・規則・操作・生成と仕事量・ティア・Undo(Hint は作らない)・
モードとデイリー・保存・統計・Quick Rules・演出とアクセシビリティ・i18n・意図的な差分・検証の
範囲 — は Phase 2 で**コードより先に**ここへ書き、以後は実装(`apps/simple-games/src/games/make-the-target/`)・
テスト・Quick Rules がこの文書に従う(コードはここへ `§n` で言及し、挙動を変えるときは同じコミットで
この文書を直す)。それまでの仕様は計画
[plans/2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md](plans/2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md)
の「53. Make the Target」にあり、本文が書かれたらこちらが勝つ。

ブランド原則([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md))はこの文書より上位にある。

ゲーム ID は `make-the-target`、i18n キーの接頭辞は `makeTheTarget`、保存キーの接頭辞は `tg.`、
カテゴリは `puzzle`、No. 53。**Web 先行公開(ベータ)のタイトル**で、アプリにはまだ収録して
いない(registry の `channel: 'web-beta'`。[WEB_VERSION.md](WEB_VERSION.md)「先行公開(ベータ)」)。
**Web 版への配信もまだ**で、統合と検証を終えてから landing へ同期する(計画「フェーズ」)。
Club House には登録しない(registry の `challenge` を持たない)。保存スキーマは正式収録まで
凍結しない。

## これまでに決まったこと(2026-10-20 — オーナーが 5 本をまとめて採った提案の仕様と、計画の判断。詳細は計画)

- 並んだ数字(4〜6 枚)から 2 つを選び、+ − × ÷ のどれかで 1 つにまとめる一人用パズル。使った
  2 つは消え、結果が新しい数字になる。各数字は 1 回だけ使う。**途中の結果は正の整数に限る**
  (負・0・分数になる手は打てない)。**最後に残る 1 つが目標と等しければクリア。**等しくなければ
  解けておらず、Undo で戻る。途中の局面が「もう届かない」ことは示さない。時計は出ない。
- Easy / Medium / Hard の Free Play と Daily(Medium 固定・今日の 1 問だけ。端末のローカル日付。
  過去の日付には遡れない)。レベル・ストリーク・星の評価は作らない。ヘッダの ↻ は共有の
  `RestartDialog`(同じ問題を最初から / New Board。デイリーは再挑戦だけ)。
- 助けは **Undo だけ**(無料・無制限。1 手 = 1 回のまとめ)。**Hint は作らない** — 盤面は完全に
  見えており、「次にどれをまとめるか」「まだ届くか」を教えるのは詰めの判断そのものの肩代わりに
  なる([PEG_SOLITAIRE_RULES.md](PEG_SOLITAIRE_RULES.md) §6 と同じ判断)。列挙のソルバーは生成と
  テストのためだけにあり、画面からは呼ばない。放棄したあとに解を 1 つ見せる案は**未決 — 計画**
  (製品オーナーの指示は「案を記録する」)。
- プレイ中に時計も手数も出さない。**自己ベストは経過秒**(手数は問題の枚数で決まるので比べない)。
  スコアは作らない。比べる相手は自分の記録だけ。
- 生成は seed から決定的(`make-the-target-<difficulty>-<token>` / `make-the-target-daily-<YYYY-MM-DD>`)。
  **全列挙**で目標に届く組み方の数と ÷ の要否を数え、ティアの条件を満たす問題だけ出す。仕事量
  (列挙で訪れた状態の数)に上限を置き、上限に届いたら同梱の検証済み問題へ。探索が走るのは
  New Board とデイリーを開くときだけで、読み込みでは走らない(保存した手を再生するだけ —
  [GAME_LIFECYCLE.md](GAME_LIFECYCLE.md)「CPU 探索」)。
- 保存キーは `tg.saveGame` / `tg.saveDaily`(2 スロット規則 — [architecture/storage-keys.md](architecture/storage-keys.md)、
  `src/test/savedGameSlots.test.ts`)/ `tg.stats` / `tg.flags` / `tg.prefs`(最後に選んだ難易度だけ)。
  スキャフォールドの `tg.stats` / `tg.flags` と `storage/schemas.ts` の仮の Stats / Flags は Phase 3 で
  置き換える。保存は fail-closed — 規則から生まれえない手の列・解けた問題・今日でないデイリーは
  読み捨て、黙って新しい問題を始めない。
- 盤面に翻訳の要る文字を置かない。置くのは数字と `+` `−`(U+2212)`×`(U+00D7)`÷`(U+00F7)
  だけ([QUICK_MATH_RULES.md](QUICK_MATH_RULES.md) §1 と同じ記号)。
- Quick Rules(文案は仮・3 ステップ): 1) 2 つの数字を選び、+ − × ÷ のどれかで 1 つにまとめる。2) 使った数字は消え、結果が新しい数字になる。3) 最後の 1 つが目標と同じになればクリア。
- 他社の製品名(一般に「24」と呼ばれる形式・Countdown の数字ラウンド)はアプリ内・ストア文言に
  書かず、この文書の「意図的な差分」の比較の節にだけ、出典と確認日つきで書く
  ([BRAND.md](BRAND.md)「自社タイトルと比較対象の名前」)。題「Make the Target」の商標・両ストアの
  検索はまだ行っておらず、確認日つきで同じ節に書く。
- 提案時の算術と使い捨ての試作の値(列挙の状態数など)は、実装で再現するまで「検証済み」と書かない。

Phase 2 でここに書く前に決めること(計画の未決事項): 放棄後の解の提示、ティアの定義(数の範囲・
目標の帯・解の数の帯・÷ の要否)、Hard の 6 枚、目標の作り方、操作の順と不成立の見せ方、
`×1` / `÷1` の手、クリア後の Undo、履歴の保存と表示、デイリーの統計の数え方、結果カードの
第一ボタン、統計と結果の文言、題の確認。

## 多言語(来歴)

`en` が原文(source)になる。**訳はまだ無い** — いまのところ、14 言語ともスキャフォールドが置いた
英語のプレースホルダーである。`ja` と他 12 言語(de / es / fr / hi / id / ko / pt-BR / th / tr / vi /
zh-Hans / zh-Hant)は文言が決まってから AI が書く予定で、書いた後も作者とネイティブが読むまでは
未読として扱う([I18N_POLICY.md](I18N_POLICY.md)「翻訳の状態は「等級」ではなく「来歴と、検証できた
事実」で書く」)。高リスク文言(無料・オフライン・課金・削除・保存の約束)はこのゲームの文言に足さない。
