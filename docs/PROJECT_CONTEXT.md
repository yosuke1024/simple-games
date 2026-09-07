# Simple Games — Project Context / Source of Truth

Updated: 2026-09-07

この文書は、Simple Games を変更・レビュー・説明するときの **共通の入口** である。
ここに全仕様を複製しない。実装上の事実はコード、恒久的な原則は各 canonical document を正とし、
この文書は「何が正か」「今どこを目指しているか」「どの文書を読むべきか」を固定する。

## 1. Authority — 何を正とするか

情報が食い違う場合は、次の順で扱う。

1. **現在の実装事実** — 実際に何が出荷コードに存在するかは `main` のコード・設定・テストを正とする。
2. **恒久的なプロダクト判断** — 何を作るべきか / 作ってはいけないかは `docs/PRODUCT_PRINCIPLES.md` と各 policy 文書を正とする。
3. **ゲーム固有仕様** — 各 `docs/*_RULES.md` を正とする。
4. **現在の方向性・優先順位** — この文書の「Current direction」を正とする。
5. **Issue / `docs/plans/`** — 提案・検討・実装履歴であり、上記 canonical source と矛盾する場合は canonical source を優先する。

重要な判断を Issue や会話だけに残さない。採用された判断は、実装 PR と同時かそれ以前に適切な canonical document へ反映する。

## 2. Product definition

Simple Games by PixApps は、**静かに、無料で、オフラインで遊べるクラシックゲームのコレクション**である。
ゲームを大量に詰め込むこと自体が目的ではなく、複数のゲームを同じ誠実な原則の下で提供する。

Brand promise:

> **Honest by design. Simple games, built in the open.**

Design philosophy:

> **Built by subtraction.**
> We remove what gets between you and the game.

目指すのは「少ない機能」ではなく **少ない負担** である。
ユーザーの操作、判断、待ち時間、通信、中断、義務感を減らす変更を優先する。

詳細: `docs/PRODUCT_PRINCIPLES.md`, `docs/BRAND.md`

## 3. Current product snapshot

### Collection

- 1つの `Simple Games: Offline Games` として提供する。
- 現在の正式収録は **30 games**。
- 実装上のゲーム一覧・ID・並び順・カテゴリの正は `apps/simple-games/src/app/registry.ts` の `GAMES` / `GAME_CATEGORIES`。
- 人間向け一覧は root `README.md`。
- 各ゲームの実装は `apps/simple-games/src/games/<game-id>/` に分離する。
- 未実装タイトルを Coming Soon として表示しない。

### Platforms

同一のゲーム実装を基盤として Android / iOS / Web を提供する。

- **Android / iOS app**: 静かに長く遊ぶための完成版。ゲーム機能は初回起動からオフラインで利用できる。
- **Web**: インストールせず試せる入口、検索流入、PixApps / app への導線、非妨害型広告による収益化。
- Web を意図的に不便にして app へ誘導しない。
- platform 差分の正は `docs/WEB_VERSION.md` と platform code / config。

## 4. Non-negotiable product constraints

以下は成長施策や一般的なゲームアプリ慣習より優先する。

- ゲーム機能を課金または広告視聴で解放しない。
- サブスクリプションを導入しない。
- アカウント登録を要求しない。
- ゲームデータを端末外へ保存しない。クラウドセーブを作らない。
- オンラインランキング、フレンド、対人オンライン機能を作らない。
- ストリーク、ログインボーナス、期間限定イベント、人工的な緊急性を作らない。
- Push / ローカル通知で再訪を促さない。
- ゲームプレイを中断する広告を app に導入しない。
- API サーバー、クラウド DB、認証基盤、継続固定費を必要とする構成を持たない。
- AI API / 有料問題生成 API に依存しない。
- ローエンド端末、低通信、低消費電力を設計制約として扱う。
- 実施していない検証を成功扱いにしない。

詳細: `docs/PRODUCT_PRINCIPLES.md`, `docs/OFFLINE_POLICY.md`, `docs/ADS_POLICY.md`

## 5. Current direction — Friction first

現時点のプロダクト改善の中心は **engagement mechanics を増やすことではなく、ゲーム内外のストレスを徹底的に減らすこと** である。

共有機能の整備後は、「中毒性を上げる」方向の追加施策をいったん止め、次を優先する。

1. 遊び始めるまでの手数を減らす。
2. プレイ中の誤操作、モード切替、探索、待ち時間を減らす。
3. タッチ / マウス / キーボード / タブレットそれぞれで自然に操作できるようにする。
4. 結果確認、再挑戦、次のゲーム開始までの不要な摩擦を減らす。
5. 多言語、アクセシビリティ、ローエンド端末での摩擦を減らす。
6. ゲームそのものの判断や挑戦まで自動化して、ゲーム性を空にしない。

判断基準:

> **新機能を足す前に、その問題を「手数を削る」「待ちを削る」「迷いを削る」ことで解決できないか確認する。**

これは `PRODUCT_PRINCIPLES.md` の Built by subtraction / Zero Friction を、現在の改善優先順位として明示したものである。

## 6. Monetization

### App

- 全ゲーム・全ゲーム機能を無料提供。
- Anchored Adaptive Banner 1枠のみ。オフラインでは広告取得しない。
- Rewarded / Interstitial / App Open / Native は採用しない。
- 買い切りの広告削除商品のみ。ゲーム機能差は作らない。

Canonical: `docs/ADS_POLICY.md`, `docs/PRODUCT_PRINCIPLES.md`

### Web

- 全ゲームを無料提供。
- ゲーム盤面・操作を妨害しない範囲で広告を掲載する。
- 広告視聴による機能解放を行わない。
- 課金機能は提供しない。

Canonical: `docs/WEB_VERSION.md`

## 7. Measurement and North Star

North Star は **「通知・ストリーク等で強制せず、それでも繰り返し自発的に遊ばれていること」**。
滞在時間最大化だけを成功としない。

- App: 個人追跡のための Analytics を入れない。ストア / 広告プラットフォームが提供する集計値を使う。
- Web: サイト側の集計計測として GA4 を利用し、`page_view`, `game_open`, `game_close` 等を見る。
- 計測を理由にゲームデータを外部送信しない。
- 数字は「何を改善するか」を判断する材料であり、ブランド原則を破る理由にはしない。

Canonical: `docs/GROWTH_MEASUREMENT.md`, `docs/WEB_VERSION.md`, `docs/PRODUCT_PRINCIPLES.md`

## 8. Engineering invariants

- Game logic は Pure TypeScript。
- 依存方向は `apps → packages`。循環依存禁止。
- `games/A` から `games/B` への依存禁止。
- Shell は各ゲーム内部の state / rules に踏み込まない。
- 各ゲームの保存領域を分離し、保存データ破損を波及させない。
- 既存 save schema の後方互換性を壊さない。migration は失敗時もデータを破壊しない。
- ゲームは lazy chunk として app 内に同梱し、open 時にネットワーク取得しない。
- 実際の重複が確認される前に共通フレームワークを作らない。
- 新規ゲーム・共通 UI の変更で既存ゲームの挙動を変えない。
- Android / iOS / Web の差は明示的に設計し、意図しない差分を作らない。

Canonical: `docs/ARCHITECTURE.md`, 各 game rules, tests

## 9. Canonical documents map

| Topic | Canonical source |
| --- | --- |
| Product philosophy / prohibitions / UX principles | `docs/PRODUCT_PRINCIPLES.md` |
| Brand / public wording | `docs/BRAND.md` |
| Architecture / dependency rules | `docs/ARCHITECTURE.md` |
| Offline behavior | `docs/OFFLINE_POLICY.md` |
| App advertising / IAP | `docs/ADS_POLICY.md` |
| Web role / differences / web measurement | `docs/WEB_VERSION.md` |
| Analytics interpretation | `docs/GROWTH_MEASUREMENT.md` |
| i18n | `docs/I18N_POLICY.md` |
| Release gates | `docs/RELEASE_CHECKLIST.md` |
| Review prompt | `docs/REVIEW_PROMPT_POLICY.md` |
| Game-specific behavior | `docs/<GAME>_RULES.md` |
| Current game inventory | `apps/simple-games/src/app/registry.ts` |
| Human-readable game inventory | `README.md` |
| Historical implementation plans | `docs/plans/` — not authoritative after completion |

## 10. Decision rules for proposals

新しい施策は次の順で評価する。

1. ユーザー体験、特に friction を改善するか。
2. Honest by design / Built by subtraction と矛盾しないか。
3. オフライン、低通信、低消費電力を維持できるか。
4. ローエンド端末で成立するか。
5. 固定インフラ費を増やさないか。
6. 保存データや既存ゲームを危険にさらさないか。
7. 実装と保守が十分に単純か。
8. その上で、流入・継続利用・収益へ合理的につながるか。

**8 を理由に 1–7 を破らない。**

## 11. Required reading before changes

変更前に全部の docs を読む必要はない。最低限:

- 常にこの `PROJECT_CONTEXT.md`
- product / UX の変更: `PRODUCT_PRINCIPLES.md`
- game の変更: 対象 `*_RULES.md`
- storage / migration: `ARCHITECTURE.md` + 対象 game rules
- ads / purchase: `ADS_POLICY.md`
- web only: `WEB_VERSION.md`
- public copy: `BRAND.md`
- i18n: `I18N_POLICY.md`

Issue や会話に新しい恒久判断が生まれた場合、実装だけで終わらせず、この map の適切な canonical source も更新する。
