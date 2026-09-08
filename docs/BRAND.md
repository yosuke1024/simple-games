# Simple Games — ブランドガイド

## 名称

- シリーズ名: **Simple Games by PixApps**
- Simple Games は独立企業名ではなく、PixApps が提供するシンプルゲームシリーズのレーベル。

基本表記:

```text
Simple Games
by PixApps
```

補助表記:

```text
A Simple Game by PixApps
```

## コンセプト(Honest by design)

中心思想:

> Honest by design. Simple games, built in the open.
> You don't have to take our word for it. The source code is public.

> 無料ゲームを、誠実に。シンプルなゲームを、オープンに。
> 私たちの説明を信じる必要はありません。ソースコードを公開しています。

コンセプト語: シンプル / 完全オフライン / 低消費電力 / 広告は控えめ / 急かさない /
サブスクなし / 機能課金なし / ログインなし / ソースコード公開

**OSS は誠実さの証明である。** ソースコード公開は開発者向けの訴求ではなく、
「広告はバナーだけ」「トラッキングなし」「オフラインで全機能」という**アプリの**
約束をユーザー自身(または誰か)が検証できる仕組みとして扱う(版ごとの差分は
PRODUCT_PRINCIPLES.md「適用範囲」と WEB_VERSION.md)。
ストア文面では OSS を最後の訴求に置く(下の「訴求の順序」)。

### 設計思想(Built by subtraction)

Honest by design が「何を約束するか」なら、Built by subtraction は「その約束をどう
生むか」— 足すのではなく削る、という判断軸である(issue #123。原則の本文は
[PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「引き算の原則」)。一般的な無料ゲーム
アプリが機能を足すことで競争するのに対し、Simple Games はユーザーとゲームのあいだに
ある不要なものを削ることで差別化する。2 つのラベルは別々のスローガンではなく 1 つの
話で、削った結果が約束になり、その約束を公開ソースで検証できる。

設計思想として:

> Built by subtraction.

ユーザーへの体験価値として:

> Less between you and the game.

一文で言うなら:

> We remove what gets between you and the game.
> あなたとゲームのあいだにあるものを、削る。

内部の判断原則として(公開文面に出す必要はない):

> We add features only when they remove friction.
> Every new feature must justify the friction it adds.

**「少ない機能」ではなく「少ない負担」である。** コピーでも「機能が少ない」
「ミニマル」を売りにしない。削るのは手数・中断・義務・通信・サイズ・サーバーで
あって、ゲームや Hint / Undo のような助けではない。

**引き算は、書いてあることではなく無いもので示す。** 削っていることを長々と
アピールする文章は、それ自体がしつこさになり、削って作ったブランドを毀損する。
思想の説明は判断原則(この文書と PRODUCT_PRINCIPLES.md)に置き、公開文面では
短い一文までにとどめる。

置き場所の目安:

- **LP**: 「削っている」と説明する節は**置かない**(2026-09-06 に「削るもの /
  残すもの」の表と補足 3 段落を一度追加し、上の理由で取り下げた)。LP で引き算を
  語るのはヒーローの一文(「あなたの時間を奪うのは、ゲームだけ。」)と `#quiet` の
  4 項目までで、それ以上は足さない。
- **ストア掲載文**: 思想は 1 文まで。ユーザーの実利を優先する(思想 2 割・
  実利 8 割が目安。`apps/simple-games/store/listing.md`「構成の意図」)。
- **README / 原則**: 判断原則として置く。

## メッセージ候補

ブランドメッセージ(候補):

> Free games, honestly made. Play everything for free with one small banner.
> Remove it forever for $3.99. No subscriptions, no paywalls—and the source
> code is public.

> 無料ゲームを、誠実に。すべてのゲームを、小さなバナー広告だけで無料提供。
> 広告は一度だけの購入で永久に削除できます。サブスクリプションも機能制限も
> ありません。ソースコードも公開しています。

シリーズメッセージ:

> One app. Many games. Many languages.

ストア短文(候補):

- "Classic games in one quiet, offline app. No subscriptions or paywalls."
- "Simple offline games with one small banner. Remove it forever with a single purchase."
- 引き算の行: "Less between you and the game. Offline classics, no account, no subscription."
- OSS 行: "Built in public. The source code is available on GitHub."

スクリーンショット短句(この 5 句を基本とする):

- "Many games. One app."
- "Fully offline."
- "No subscriptions."
- "Banner ads only."
- "Open source."

ストア文面では収録済みのゲーム名を具体的に挙げる(現在は "Sudoku, Solitaire,
Spider Solitaire, FreeCell, Hearts, Gin Rummy, Minesweeper, 2048, Block Puzzle,
Checkers, Reversi, Connect Four, Gomoku, Brick Breaker, Nonogram, Takuzu,
Futoshiki, Kakuro, Number Match, Quick Math, Schulte Table, Number Recall,
Water Sort, Sliding Puzzle, Memory Match, Sky Fighter, Bunny Hop" の 27 本)。
未収録のゲーム名は、**実際に収録された時点で**初めて足す。
ゲーム名は検索流入の中核だが、不自然なキーワード詰め込みはしない。

## 訴求の順序(ストア文面)

1. 1 つのアプリで複数のクラシックゲーム
2. 完全オフライン
3. ログイン不要
4. サブスクリプションなし
5. 全ゲーム機能が無料
6. 広告は小さなバナー 1 つだけ
7. $3.99 の一度だけの購入で広告を永久に削除
8. ソースコード公開

OSS は常に最後段。第 1 訴求は「ゲーム集・オフライン」であり、
OSS を先頭に出さない。

## 表現ルール

- 広告・課金への言及は謝罪調・強制調にしない。静かに事実を述べる
  (説明文の正文は ADS_POLICY.md)。
- **使用禁止**(広告が存在するため誤認を招く): "Ad-free", "No ads",
  "Completely free of ads", "No popup ads", "No forced ads"。
- **使用禁止**(広告削除の買い切りが存在するため誤認を招く): "No purchases",
  "No in-app purchases", 「課金なし」の無条件表現。
  代わりに "No paywalls" / "No subscriptions" /「機能課金なし」
  「ゲーム機能の課金ロックなし」を使う。
- **使用禁止**(同上): 何が無料かを言わず**無条件に「無料」だけを主張する**表現 —
  "Fully free", "Completely free",「完全無料」「完全無課金」。
  無料なのは**ゲーム機能**であって、広告の非表示ではない。代わりに
  「全ゲーム機能が無料」/ "All game features are free" のように対象を言う。
- **使用禁止**: "Lifetime Access"(無期限なのは広告削除権であって、
  アプリのサービス存続期間ではない)。
- **未実装の機能・未検証の性能を公開文面に書かない。** 「これから作る」ではなく
  「すでにそうなっている」だけをブランドの根拠にする(未収録のゲーム名を書かない
  規則と同じ)。Zero Friction の各機能(お気に入り・検索・ショートカット・直接復帰・
  入力経路)も、実装が終わった 2026-09 以降にだけ公開文面に載せている。
- **数値は公開時点の実測値だけ。** アプリの配布サイズを「約 x MB」と書くときは、
  Play Console / App Store Connect が示すその時点の配布サイズを確認してから書く。
  未確認の数値を固定コピーにしない。数字なしで「軽い」と言うほうが、古い数字を
  残すより誠実である([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「引き算の原則」)。

### 禁止表現はストア文面だけの規則ではない

上の禁止は**文言が置かれている場所を問わない**。ストア掲載文・スクリーンショットに
限らず、リポジトリ内の文字列にも同じ規則がかかる。タグライン類が置かれる場所は
2 つある:

- **アプリの画面に出る文言**: `apps/simple-games/src/i18n/locales/*.ts`。
  `tagline` は [`i18n/highRiskKeys.ts`](../apps/simple-games/src/i18n/highRiskKeys.ts) の
  「無料・オフライン・paywall 不在の保証」に属する高リスクキーなので、
  書き換えには [I18N_POLICY.md](I18N_POLICY.md) の「リリース前の門」がかかる。
  ここを直すのは文字列の置換ではなく、門を含む作業である。
  **タグラインのキーは 1 つに保つ。** コレクションホームとゲーム別ホームは同じ
  `tagline` を共有する。画面ごとに別キーを持つと、片方だけが規則の改定から
  取り残される — 実際、コレクション専用だった `collectionTagline` は
  「完全無課金」を 14 言語で主張したまま出荷されていた(現在は廃止)。

  **約束を運ぶキーは `tagline` だけではない**(2026-08-30 追加)。Web 版の
  アプリ案内カード(`webAppPromptTitle` / `webAppPromptBody`、issue #85、
  [WEB_VERSION.md](WEB_VERSION.md)「アプリへの送客」)が、1 つの版の 1 画面
  だけに出る 2 つ目の promise-bearing なキー対である。オフラインの言い方を
  改定するときは **`tagline` と一緒にここも直す** —— `collectionTagline` が
  取り残されたのと同じ形の事故が、これで起こりうるため。`tagline` を 1 つに
  保つ規則を捨てたのではなく、**別の版に別の約束があるぶんだけ例外を置いた**
  ということ(条件は WEB_VERSION.md 側に書いてある)。この 2 キーも
  `highRiskKeys.ts` に登録済みなので、書き換えには同じ門がかかる。

- **`packages/brand`**: 色・名称・URL・サポート窓口だけを置く。
  **マーケティング文言は置かない。** 14 言語に出す文言を英日 2 言語で持てないうえ、
  どこからも import されない文字列は規則の改定から静かに取り残される。

**未使用の定数も違反である。** 出荷されていないから安全なのではなく、
誰かが import した瞬間に違反が出荷される。実際 `packages/brand` には
「完全無課金」「No purchases」を含むタグライン定数が、
2026-07-30 の文言修正(`docs/plans/2026-07-30-collection-and-sudoku.md` §5)から
取り残されたまま残っていた — 未使用だったために、修正対象として誰の目にも入らなかった。

**この節は文書だけでなく CI が守る。** `.github/scripts/check-principles.sh` §6 が
`apps/*/src` と `packages/*/src` を走査し、上の禁止表現を落とす。
ただし**判定できるのは英語と日本語だけ**である — 「完全無料」は言語ごとに別の字面に
なるため、残り 12 言語で同じ主張がされていないことは grep では分からない。
そこは [I18N_POLICY.md](I18N_POLICY.md) の高リスクキーの門(独立逆翻訳 → 作者が読む)
と別モデル監査の担当で、**ここが緑でも 12 言語を見たことにはならない。**

## GitHub リポジトリの公開 metadata

このリポジトリの GitHub 上の Description / Website(API と `gh` では homepage)/
Topics は、README を開く前に検索結果・リポジトリカード・リンクプレビューとして
目に入る。このリポジトリ自体が `SOURCE_REPO_URL`(`packages/brand/src/index.ts`)
としてアプリの設定画面の About(「View Source Code」)から直接リンクされ、
「OSS は誠実さの証明である」(上の「コンセプト」節)という約束を確かめに来た人が
最初に読む文面でもある。つまりこの 3 項目は開発上のメタデータではなく**公開文面**
であり、上の「表現ルール」と `apps/simple-games/store/listing.md`「表現の約束」が
同じ強さでかかる(issue #159)。

**この節がこの 3 項目の正本(source of truth)である。** GitHub の About 欄は
人が手で入力する UI で、CI はここを検査しない。値を変えるときは、まずこの節を
直す PR を作り、そのうえで同じ値を GitHub 側へ人手で反映する。現在の値は issue #159
として 2026-09-08 に決めた。

以前の Description は次のとおりだった:

> Fully free. Fully offline. Simply playable. — Monorepo for the Simple Games series
> by PixApps (first title: Number Match Offline).

これは 2 点で誤っていた。「Fully free」は対象を言わず無条件に無料を主張する、
上の「表現ルール」の禁止表現そのもの。「first title: Number Match Offline」は、
ゲームごとに独立アプリを出す当初案の名残で、その案は 2026-07-30 に廃止され
(`docs/plans/2026-07-30-collection-and-sudoku.md` §0)、現行の canonical 文書の
どれにも残っていない。

### Description

```text
A quiet, honest, offline collection of classic games by PixApps. No login and no subscriptions. Banner ads only, never a full-screen or video ad. Built in the open.
```

- **ゲーム数は書かない。** GitHub の About 欄に人手で打ち込んだ数字は、収録が変わった
  瞬間に古くなる(この文書の「表現ルール」、および
  [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「数値は公開時点の実測値だけ」)。
  収録数の正は `README.md` と `apps/simple-games/src/app/registry.ts` が持ち、
  収録が変わる PR と同じ PR で変わる。この Description はどちらの数とも独立させる。
- **各語は「すでにそうなっている」ことだけを根拠にする。** "quiet" は上の
  「メッセージ候補」のストア短文 "Classic games in one quiet, offline app." と
  [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) の製品定義(「静かに、無料で、オフラインで
  遊べる」)。"honest" は上の「コンセプト」節の Honest by design そのもの。
  "No login and no subscriptions" は [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)
  「必須原則」のアカウント登録なし・サブスクなし(版をまたいで例外なく成立する側)で、
  並びは「訴求の順序」の 3・4 番目に合わせている。
- **"offline" はアプリの約束の言い換えである。** 根拠はアプリ名
  `Simple Games: Offline Games` と [OFFLINE_POLICY.md](OFFLINE_POLICY.md)(適用範囲は
  アプリ)。Web 版は初回アクセスにダウンロードが必要で、再訪時のオフライン動作
  (Service Worker)は未実装([WEB_VERSION.md](WEB_VERSION.md)「オフラインの扱い」)。
  この Description は Web 版の再訪オフラインを主張していないし、Web 版を主語にした
  文面(Web 版・Landing Page)でこの語をこの形で使わない。
- **広告は「ある」と言ってから「ない形式」を言う。** 「中断しない」を無条件の否定で
  書かないのは `apps/simple-games/store/listing.md`「表現の約束」の「中断の書き方」
  で、短い説明は検索結果に単独で出て、打ち消す文脈がないからだ。
  "Banner ads only, never a full-screen or video ad." はストア掲載文の
  "Nothing interrupts play: one small banner while you're online, never a full-screen
  or video ad" と同じ形。根拠は [ADS_POLICY.md](ADS_POLICY.md): アプリは Anchored
  Adaptive Banner 1 枠のみで盤面・操作に重ねず、Interstitial / Rewarded / App Open /
  Native は不採用。Web 版(同「Web 版」節)はアンカー・ホームのリスト下・リザルト
  (3 局に 1 回)のバナー枠だけで、Vignette(スキップ可の全画面)は未実装。
  **Web 版に Vignette を入れる判断をするときは、この Description を同時に見直す** ——
  その時点で "never a full-screen ad" は事実でなくなる。
- 上の「表現ルール」の禁止表現は使わない — 旧 Description の "Fully free" が
  まさにその違反だった。未実装・未検証の主張も書かない。OSS への言及は最後に置く
  (「訴求の順序」8 番目)。"Built in the open." で締めているのはそのためで、
  これはブランドプロミスそのものの言い換えでもある。
- GitHub の Description は 350 字まで。現在の文字列は約 160 字。

### Homepage

```text
https://pixapps.ai/simple-games/
```

`packages/brand/src/index.ts` の `LANDING_BASE_URL` に末尾スラッシュを足した値。
このページは別リポジトリ `pixapps-landing` の `public/simple-games/index.html`
(同ファイル `PLAY_STORE_URL` / `APP_STORE_URL` のコメントが指す、ストアリンクを
載せた Simple Games のランディング)で、ディレクトリの index として配信されるため
末尾スラッシュが正規の形になる(`WEB_PLAY_URL` と同じ理由。`PRIVACY_URL` /
`TERMS_URL` は単一ページなので付かない)。プレイ URL(`WEB_PLAY_URL`)ではなく
このページを指すのは、ブラウザ版(`/play/`)もゲーム別ガイド
(`/games/<game-id>/<locale>/`)もこの配下にあり、その根にあたる入口だからで、
プレイページはそのうちの 1 つでしかない。アプリの About 画面がリポジトリへ
リンクするのに対し、Homepage はリポジトリからプロダクトへ**逆方向に**リンクする。
この URL がリダイレクトなしで開くことはソースからは検証できないので、この節を
変えたときと [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) §6 で実際に開いて確かめる。

### Topics

```text
offline-games, classic-games, puzzle-games, card-games, board-games, arcade-games,
typescript, react, vite, capacitor, android, ios
```

**実装済みの事実だけを載せる。** ジャンル系トピックは
`apps/simple-games/src/app/registry.ts` の `GAME_CATEGORIES`(logic / cards /
puzzle / board / arcade / drills)に対応する(logic と puzzle → `puzzle-games`、
cards → `card-games`、board → `board-games`、arcade → `arcade-games`)。
**drills には対応するトピックを置かない** — Quick Math / Schulte Table /
Number Recall / Memory Match の分類だが、それを素直に表す語(`brain-training` など)
はプレイヤーへの効果を匂わせるので、下の理由で入れない。`classic-games` と
`offline-games` は個々のカテゴリではなくコレクション全体を指し、アプリ名
`Simple Games: Offline Games` の言い換えである。技術系トピックは
`apps/simple-games/package.json`(TypeScript / React / Vite / Capacitor)と、
`apps/simple-games/` 配下に実在する Android / iOS プロジェクトから採る。

あえて含めていないもの:

- `pwa` — Service Worker は [ARCHITECTURE.md](ARCHITECTURE.md) のとおり未実装。
  付けると出荷していない機能を主張することになる。
- `sudoku` のような個別ゲーム名 — 検索キーワードの詰め込みであり、issue #159 が
  明示的に非目標としている。ゲーム名の訴求は
  `apps/simple-games/store/listing.md`(ストア掲載文)の役割で、ここには置かない。
- `brain-training` のようなプレイヤーへの効果を匂わせるトピック — 脳トレドリル 3 本
  (Quick Math / Schulte Table / Number Recall)の掲載文が効能表現を避けているのと
  同じ理由([SCHULTE_TABLE_RULES.md](SCHULTE_TABLE_RULES.md) §14)。

トピックを足すのは、それが指すものが実際に出荷された時点だけ。成り立たなくなったら外す。

### 適用方法

リポジトリホーム(Code タブ)右側の About 欄の歯車から Description / Website /
Topics を直接編集する(Settings ページにこの 3 項目はない)。GitHub CLI でも
同じ変更ができる:

```sh
gh repo edit yosuke1024/simple-games \
  --description "A quiet, honest, offline collection of classic games by PixApps. No login and no subscriptions. Banner ads only, never a full-screen or video ad. Built in the open." \
  --homepage "https://pixapps.ai/simple-games/" \
  --add-topic offline-games,classic-games,puzzle-games,card-games,board-games,arcade-games,typescript,react,vite,capacitor,android,ios
```

`--add-topic` は追加のみを行う。この節からトピックを外すときは、
`--remove-topic`(または UI 側の操作)で別途外すこと。

### 見直すタイミング

- この節の値を変えたとき(同じ PR で GitHub 側も反映する)。
- リリースのたび([RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) §6): 3 項目が
  一致していること、Homepage がリダイレクトなしで開くこと。
- Web 版に Vignette など全画面形式の広告を入れる判断をしたとき(上の Description の
  広告の行)。
- 収録ゲームやカテゴリが増減したとき。Description に数は無いので変わらないはずだが、
  Topics とカテゴリの対応が崩れていないかは見る。

## ストーリー

英語:

> I started Simple Games because I wanted something simple to play during long
> flights. Every game works offline, requires no account, and keeps your
> progress on your device.

日本語:

> 長時間のフライト中に、通信や課金を気にせず遊べるシンプルなゲームが欲しくて、
> このシリーズを作りました。

## ビジュアル

カラーパレットとブランド定数は [`packages/brand`](../packages/brand/src/index.ts) を
唯一の情報源とする。トーン: シンプル・静か・読みやすい・急かさない。
課金ゲーム的な煽り表現を使わない。

### 配色の設計: 共通の下地 + タイトルごとに1色

- **下地(`seriesColors`)は全タイトル共通。** 温かみのある紙色の背景に、
  一段明るいタイルを重ねる。機内や就寝前の暗所で長時間見ても疲れないことを優先し、
  青みがかった灰色は使わない。別々のゲームを「同じシリーズ」に見せているのはこの下地である。
- **アクセント(`titleAccents`)はタイトルごとに1色だけ。** 変わるのはここだけで、
  選択状態・主要ボタン・スコアなど「そのゲームの識別色」として実際に画面へ出す。
  アクセントが画面に出ていないと、スクリーンショットがただの白と灰色になる。

| ゲーム            | 色                       | ライト    | ダーク    | 理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------ | --------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Number Match      | 藍                       | `#3f5b8f` | `#7d9ccf` | 暗所で目が疲れにくく、パズルアプリで飽和していない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Sudoku            | くすんだティール         | `#2f6f62` | `#6fb3a3` | 藍から十分離れて一目で別ゲームと分かり、寒色・低彩度なので盤面いっぱいにアクセント色の数字が並んでも読み疲れない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Solitaire         | くすんだフェルトグリーン | `#557a48` | `#97bd8a` | カード台が昔から持つ一色。カードの赤(ハート/ダイヤ)から遠く、白いカードが主役のまま騒がしくならない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Minesweeper       | スレートブルー           | `#4a5a72` | `#93a4bd` | 盤面が数字用の色階調を自前で持つため、クロムはシリーズの文字色寄りに留め、注意を引くのは数字だけにする                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Nonogram          | くすんだプラム           | `#6d5192` | `#a893cf` | 盤面はインクの塗りが主役でアクセントを使わないため、クロム・ヒント・選択に置く。他タイトルの色相から十分離れている                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Water Sort        | くすんだアクア           | `#33708c` | `#7fb4c9` | 盤面が9色の水パレットを自前で持つため(Minesweeper と同型)、クロムは審判役の水色一色に留め、パレットに混ざらない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Sliding Puzzle    | 陶土色                   | `#9c5b3c` | `#d1926f` | 盤面がタイルで埋まるためアクセントの占有面積が全タイトル中で最大。温かく彩度を抑えた色なら、その面積でも騒がしくならない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Memory Match      | くすんだローズ           | `#9e5468` | `#cf8fa4` | カード面は15色の記号パレットが持つため、クロムはどの記号とも被らない暖色一色に留める                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2048              | ジェイド                 | `#2b7d59` | `#79c39c` | 盤面がタイルで埋まる(Sliding Puzzle と同型)。本家のサンド系を借りないためにも寒色を採り、Solitaire の緑と Sudoku のティールの間に置く                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Block Puzzle      | オーキッド               | `#8b4f80` | `#c795bd` | 置いたブロックが一局を通して盤面に残るため占有面積が大きい。Nonogram のプラムと Memory Match のローズの間に残っていた色相                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Brick Breaker     | 黄土                     | `#8a6a2b` | `#c9a765` | ブロック自体をアクセントで描くため壁一面を支える必要がある。Sliding Puzzle の陶土より明確に黄色寄りの、シリーズに1つだけ空いていた暖色                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Sky Fighter       | 夕闇の青                 | `#5d5aa8` | `#9d9be0` | 敵機をアクセントで描く(自機はインク)ため、空の色は「相手側」の色。Number Match の藍と Nonogram のプラムの間、Water Sort のアクアから離す                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Bunny Hop         | 草原の緑                 | `#6e7a34` | `#b6c274` | 茂み・生垣・鳥をアクセントで描くため「邪魔物」の色として読まれる。Solitaire のフェルトと Brick Breaker の黄土の間の黄緑を採る                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Spider Solitaire  | 深い緑                   | `#31802f` | `#7fcc7d` | カード台の緑を Solitaire と分け合う。あちらより緑が強く冷たいので二本並んでも滲まない(ΔE 22。既存の最接近ペアは ΔE 11)。裏向きカードが全タイトル中で最も多く、その裏面は `--accent-ring-soft` で描くため、暖色だと裏面とハートが同じ一瞥に答えてしまう                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| FreeCell          | 深いインディゴ           | `#25256a` | `#6e6ecf` | コレクションホームで Solitaire の真下に来る唯一のタイトルなので、三色目のカード台の緑ではなくフェルトから最も遠い色相を採る。**当初の菫 `#853795` は同じ隙間を Reversi が取ってマージされたため失格になり(ライト ΔE 10.6・ダーク 2.3)**、Nonogram のプラムと Sky Fighter の夕闇の青からどちらも ΔE 23 離れたインディゴへ移した。シリーズで最も暗いアクセントで、52 枚すべてが最初から見えている唯一のソリティアに合う                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Reversi           | 菫                       | `#7f4a9c` | `#c48ad6` | 盤面はフェルトと白黒の石(すべてゲーム内容)なのでアクセントはクロムだけに置く。当初の苔色は Bunny Hop の草原の緑と一段違い(`#6e7a34` 対 `#6d7a3a`)で失格になり、Nonogram のプラムと Block Puzzle のオーキッドの間で最も広かった菫へ移した                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Connect Four      | くすんだ赤               | `#a8433d` | `#dd8f89` | アクセントがそのままプレイヤーのディスクなので、相手の固定ティールと腕一本の距離で見分かる必要がある。赤対青緑は色覚多様性で最も残るペア。Sliding Puzzle の陶土(橙)と Memory Match のローズ(桃)の中間で、警告色(`warn`)とは十分に離す                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Quick Math        | マスタード               | `#776e18` | `#c4ba6b` | 盤面は式一行で、アクセントが載るのは入力欄だけ。占有面積が最小なので彩度を上げられる。鉛筆とドリル帳の黄で、Brick Breaker の黄土と Bunny Hop の草の間                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Schulte Table     | ペトロール               | `#18787b` | `#6cbcc1` | 盤面は無彩色でなければならない(色を付けると探す作業が消える)ため、アクセントは「次に押す数字」だけに載る。Sudoku と Water Sort の間を彩度で分ける                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Number Recall     | 深いエメラルド           | `#1d6b33` | `#92dfa8` | 伏せ札は色ではなく面で区別する。アクセントは次の数字と、外したときの印だけ。**当初の `#2f7a3e` / `#76c37f` は #46 でマージされた Spider Solitaire に対してライト ΔE 11.0・ダーク 6.2 で、ダークがコレクション最接近ペア(7.9)を下回った** — 手順 5 のとおりマージ直前に測り直し、緑をさらに深く・彩度を上げて離した(Spider とはライト 14.5・ダーク 15.1、最接近は 2048 のライト 14.4・ダーク 12.4)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Checkers          | ウォルナット             | `#5a4632` | `#cbb08a` | アクセントがそのままプレイヤーの駒 12 個で、コレクション有数の占有面積。まず「木の駒台」と読まれるべき色を採る(相手はゲーム側のスレート)。暖色の四半分は 30° 以内に 4 タイトルが並ぶので、隔てるのは色相ではなく明度 — L27% で 5 本中最も暗く彩度が低い(Sliding Puzzle の陶土からライト ΔE 26.8、Brick Breaker の黄土からダーク ΔE 15.8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Gomoku            | 牡丹                     | `#a32d76` | `#e086bb` | 盤面は木地に白黒の石(すべてゲーム内容)なのでアクセントはクロムだけに置け、石の背後に回らないぶん彩度を上げられる。21 タイトル時点で最も広い空きは Reversi の菫・Block Puzzle のオーキッド・Memory Match のローズに挟まれたマゼンタ帯で、三者より深く彩度を上げて取る(Block Puzzle からライト ΔE 22.2・ダーク 16.2)。桃ではなくマゼンタなのは、くすんだ桃を Memory Match が既に持っているため                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Hearts            | スチールブルー           | `#2763c4` | `#96bde4` | **名前が指す色を採れない唯一のタイトル。**盤面はフェルトの上の赤い ♥ ♦ で、シリーズの赤(Connect Four)はカードの赤 `#b0483f` から ΔE 3.1 — 隣の色ではなく同じ色である。カード台の緑も三色目は塞がっている(FreeCell の判断)。アクセントは「出せる札」の印としてカード面の赤と黒の間に置かれるので、どちらでもない色でなければならない(赤から ΔE 86.9・Q♠ の黒から 58.4)。既存の青 4 本とは色相ではなく彩度で離す — S67% は青の中で突出し(Minesweeper のスレート 21%・Number Match の藍 39%・Water Sort のアクア 47%)、シリーズ最高の Schulte Table・Quick Math と同水準(Sky Fighter からライト ΔE 15.5・Water Sort からダーク 12.2)                                                                                                                                                                                                                              |
| Gin Rummy         | 深い菫                   | `#772b97` | `#b35dd5` | 盤面はフェルトの上のカード(すべてゲーム内容)なのでアクセントはクロムだけ — デッドウッドの数とノックボタン — に置け、彩度を上げられる(Gomoku と同型)。Reversi と色相を共有し(282° 対 285°)、色相ではなく深さと彩度で離れる: L38% S56% 対 Reversi の L45% S36% でライト ΔE 16.7・ダーク 27.9。Hearts と同じく赤(♢)もカード台の緑も採れない。ホームでは FreeCell の真下に来る(ΔE 30.8 / 28.8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Takuzu            | ワイン                   | `#88355e` | `#cb7ea4` | 盤面は 0 と 1 を自前の 2 つの静かな地色に置く(インクが主役)ため、アクセントはクロムと選択マスだけ — 面積が小さいので中明度で足りる。22 タイトルでは 1° 刻みの走査でもどの帯にも 30° 以内に既存色があり、隔てるのは色相ではなくマゼンタ四半分の中の深さと彩度(Block Puzzle からライト ΔE 14.6・Gomoku からダーク 9.8)。同じロジック節で 1 行違いに並ぶ Nonogram のプラムとはライト 29.4・ダーク 25.5                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Futoshiki         | パイン                   | `#29603a` | `#74c88d` | 盤面は数字と不等号のインクで、アクセントは選択マスとその行・列、そして数字パッドに乗る — Sudoku のティールと同じく「入力が盤面いっぱいに並んでも読み疲れない」ことが条件なので、緑帯で取れる最も明るい値ではなく深く彩度を抑えた値を採る。緑の四半分はコレクションで最も混んでおり(Solitaire / Spider / Number Recall / 2048 / Bunny Hop)、23 タイトルでは空き色相がないため隔てるのは深さ(Number Recall からライト ΔE 12.6・ダーク 9.4)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Kakuro            | タバコ                   | `#794e2f` | `#cb9e7e` | 新聞の鉛筆パズルであることを色が言う。盤面は紙の上のインクで、アクセントは選択した白マスとそれが属する 2 つの run に乗るので、暖かい茶が「鉛筆」として読まれ、手がかりの一種には見えない。暖色帯は Checkers が 20 タイトル時点で「空き色相なし」を確認した場所で、24 タイトルでも同じ — Sliding Puzzle の陶土と Checkers のウォルナットの間を深さと彩度で取る(陶土からライト ΔE 12.6・ダーク 9.2)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Mahjong Solitaire | 深い青菫                 | `#3b3196` | `#7e77c0` | 牌面は紙の上に牌セット自身の赤と緑を持ち(カードと同じゲーム内容)、アクセントは選択とヒントの枠としてその面の上に載る — だから赤と緑は測る前に除外した(Hearts / FreeCell と同じ理屈)。3 本同時選定(Bubble Pop / Ludo と相互距離も床の対象)で、中央値帯(                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | S−44 | ≤ 10・ | L−37 | ≤ 7)に絞ったうえで全床への最弱余裕を最大化して選んだ値。登録時に main の全 27 色 + `--warn` + 並行予約 2 色へ再測定済み: 最接近はライトが Gin Rummy の ΔE 19.1、ダークが Sky Fighter の 13.9(床 10.9 / 7.9 の 1.15 倍を要求)。ダークの紙とは 4.52 — 出荷済み最小の FreeCell 4.10 より上で、明るくして稼ぐと L65% で Sky Fighter から ΔE 8.3 の床割れになるため、明るさではなく距離を採った |
| Bubble Pop        | オックスブラッド         | `#712d2f` | `#cd6a6d` | 軌道ガイドをアクセントで描き、泡そのものの上に重ねるため、他タイトルと逆向きの制約になる — アクセントを先に決め、泡のパレット(`docs/BUBBLE_POP_RULES.md` §12)をこの色相家族の外側で選ぶ。Mahjong Solitaire・Ludo との 3 本同時選定(`docs/plans/2026-08-08-mahjong-bubble-ludo.md` Phase 1)で、中央値帯(                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | S−44 | ≤ 10・ | L−37 | ≤ 7)に絞ったうえで全床への最弱余裕を最大化して選んだ値。登録時に main の全 28 色 + `--warn` + Ludo の予約色へ再測定済み: 最接近はライトが Memory Match の ΔE 20.5、ダークが Connect Four の 15.0(床 10.9 / 7.9 の 1.15 倍を要求)。ホーム隣接(arcade 節頭、右は Brick Breaker・下は Sky Fighter)は 39.8 / 43.9 で床(15 / 11)を大きく上回る。白インクは 9.91、ダークの紙とは 5.03            |
| Ludo              | マゼンタ紫               | `#ad34a7` | `#cd6ac8` | 4 人の席の赤・緑・黄・青は**ゲーム内容**(`ludo.css` が持つ)なので、その 4 帯は測る前に除外した — クロムがその帯を着ると 5 人目の席に見える(Hearts が赤を・FreeCell が 3 本目のカード台の緑を落としたのと同じ理屈を 4 回かけたもの)。Mahjong Solitaire・Bubble Pop との 3 本同時選定(`docs/plans/2026-08-08-mahjong-bubble-ludo.md` Phase 1)で、中央値帯に絞ったうえで全床への最弱余裕を最大化して選んだ値。登録時に出荷済み 29 色 + `--warn` へ再測定済みで、**床は動いていない**(ライトは Sudoku × Schulte Table の ΔE 10.88、ダークは Nonogram × Sky Fighter の 7.91)。最接近はライト・ダークとも Gin Rummy で 17.74 / 16.61(床の 1.15 倍 = 12.5 / 9.1 を満たす)。board 節の頭なのでホーム隣接は右が Checkers・下が Reversi で、近い Reversi とは 24.53 / 18.04(要求 15 / 11)。`--warn` とはライト 77.74・ダーク 67.88。白インクは 5.49、ダークの紙とは 5.55 |

**盤面が自前の色階調を持つ場合の例外。** Minesweeper の数字スケール、Water Sort の
9 色、Memory Match の 15 色記号、そして **2048 の値ごとのタイル色**は、クロムではなく
**ゲーム内容**であり、1 タイトル 1 アクセントの制約の外にある。2048 の場合、最初の実装は
アクセントの濃淡だけでランプを作り、その結果 **2 と 4 が空きマスと見分けられなかった** —
プレイ時間の大半を占める値が読めないのは、識別色を守った代償として大きすぎる。現在は
石 → ジェイド → ティール → 青 → 藍 → 菫 → プラム → ローズ → 金(2048)と色相を歩き、
各段で色相と明度の両方を動かして色覚特性やグレースケールでも順序が残るようにしてある。
**他社の配色を借りてよいという例外ではない**(§本家との差異): 彩度はシリーズの紙の上で
成立する範囲に収める。

- **1 タイトルにつき変わるのは 1 色だけで、下地は固定。** 実装はシェルが
  ゲームのマウント時にルート要素へ `data-game="<id>"` を付け、CSS が
  アクセントトークンだけを差し替える(下地トークンは触らない。
  [ARCHITECTURE.md](ARCHITECTURE.md) の「タイトルごとのアクセント色」)。
- 新タイトルを追加するときは `titleAccents` に1エントリ足すだけにする。
  **存在しないゲームのアクセントを先回りして定義しない。** エントリを持つのは
  収録済みのタイトルだけで、追加はそのゲームを収録するリリースと同じものに乗せる。
  Spider Solitaire と FreeCell の 2 色だけは**同時に選んだ** — 2 本は同じリリースで
  収録され、しかも隣り合うタイルになるため、互いの距離を測らずに片方だけ決めると
  もう片方の選択肢を先に潰してしまうからである。

### アクセントを選ぶ手順

色相の空きは 13 タイトルの時点で既にほぼ埋まっており、「空いていそうな色相」を目で選ぶ
方法はもう通らない(Spider / FreeCell の選定では、当初案の**スチールシアンがこの方法で
失格になった** — シアン〜青の帯 135°〜225° はどの値を採っても既存色に近づきすぎる)。
新しいアクセントは次の順で決める。

1. 候補を機械的に絞る: 白文字 4.5:1 以上・紙に対して 3:1 以上・シリーズの彩度と明度の
   範囲内。**範囲は実測した収録済みの幅であって、固定の規則ではない** — 21 タイトル
   時点でライトは彩度 21〜67%・明度 27〜51%、ダークは彩度 24〜59%・明度 57〜74% に
   広がっている(この文書は長らく「彩度 20〜50%、明度 28〜48%」と書いていたが、
   Schulte Table の 67% / Quick Math の 66% / Number Recall の 57% が既にその外にある。
   狭い数字を書いたままにすると、実際には通っている候補を機械的に落としてしまう)。
2. 既存全色との**知覚距離(CIELAB ΔE)**を測る。色相角だけでは彩度と明度の差を
   見落とす。**基準は既存で最も近いペア** — ライトは ΔE 10.9 が 2 組
   (`#6d5192` × `#5d5aa8`、`#2f6f62` × `#18787b`)、ダークは `#a893cf` × `#9d9be0`
   の ΔE 7.9。ここより近い色は、コレクションで最も紛らわしい 2 枚を作ることになるので
   採らない。
3. コレクションホームでの**隣接**を見る。2 列グリッドなので、上下と左右のタイルとの
   距離が全体の平均より効く。
4. そのゲームの盤面がアクセントをどこに出すかを見る(カードの裏面・タイル・敵など)。
5. **並行しているブランチを疑う。**選定は、選んだ時点のパレットに対してしか正しくない。
   FreeCell の菫は Reversi が同じ枠を取ってマージされたことで失格になった(ライト
   ΔE 10.6・ダーク 2.3)。**Number Recall の緑も #46 のマージで同じ失格をした**
   (Spider Solitaire に対してダーク ΔE 6.2)。マージの直前にもう一度測り直すこと。
   Checkers と Gomoku は脳トレ 3 本がマージされた後の 20 色に対して測っている。

**20 タイトルを超えると、色相ではなく明度と彩度で離すことになる。**Checkers の選定では
色相を 3° 刻みで一周させたが、**どの帯にも 30° 以内に既存タイトルがいた** — 空いている
色相はもう存在しない。実際に効いたのは「暖色帯で最も暗く彩度の低い値を採る」という
明度方向の判断で、色相の隣人(Brick Breaker と 10°)とはライト ΔE 28.4 離れている。
Gomoku も同じで、マゼンタ帯の 3 タイトルとは色相ではなく彩度と深さで離れている。

### コントラスト

本文サイズの文字は背景に対して 4.5:1 以上、アクセント面は 3:1 以上を満たすこと

**この基準は `--paper`(ページ地)に対しても測る。** 先行して出た 4 色
(Bunny Hop 4.10 / Solitaire 4.33 / 2048 4.41 / Brick Breaker 4.42)は紙の上では
4.5:1 に届いておらず、`--surface`(カード地)の上でのみ満たしている。これらの
タイトルはアクセント文字をほぼカードの上にしか置かないため実害は出ていないが、
**基準を下回っていることは事実なので、満たしているように書かない。**
脳トレドリル 3 本は大きなアクセント数字を紙の上に直接置く(「次に押す数字」「入力欄」)
ため、3 本とも紙の上で 4.5:1 を満たす値に詰めてある(4.58 / 4.60 / 5.76)。
(ライト/ダーク両方)。配色を変えたら実測して確認する。

## アイコン

- ランチャーに出るのは**コレクション 1 つだけ**なので、アイコンもコレクションのもの
  1 つだけを作る。**ゲーム別のアイコンは作らない。**
- 現在のアイコンは**シリーズの文字色の上に置いた 4 枚のタイル**(1 枚だけ沈めてある)。
  特定のゲームの絵ではないので、タイトルが増えても古びない。文字を入れないため
  ランチャーサイズでも潰れない。
- アプリ内でのゲームの識別は、コレクションホームの**グリフ + そのタイトルの
  アクセント色**が担う(レジストリの `glyph`)。アイコンはその役割を持たない。
- 小さく表示しても認識可能であること。長い文字を入れない。
- 既存ゲームのアイコン・色・盤面を模倣しない。
- ソースは `apps/simple-games/assets/*.svg`。色を変えたら Android リソースを再生成する。
  生成ツールは依存に持たず、`apps/simple-games` で必要なときだけ呼ぶ:

  ```sh
  pnpm dlx --allow-build=sharp @capacitor/assets@3.0.5 generate --android
  ```

  常設の依存にしないのは、このツールが古い `sharp` / `tar` / `minimatch` を引き込み、
  出荷物に一切入らないのに脆弱性警告だけを増やすため。`--allow-build=sharp` は
  pnpm 10 が既定で止めるビルドスクリプトを、このツールに限って許可する指定。

- 名称・アイコン・ストア掲載素材を**出所表示として**使う許諾は Apache-2.0 に
  含まれない(§6)。ファイル自体はツリー内の他のファイルと同じく Apache-2.0 だが、
  それを使って PixApps 公式を名乗ることは別の話である。境界の説明と、fork 側が
  差し替えるべき素材の一覧は [TRADEMARKS.md](../TRADEMARKS.md)。
