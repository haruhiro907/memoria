# Memoria | 写真から、人生をたどる

認知症のある本人と家族が、**共通の画面**で写真を追加・整理し、思い出をいっしょにたどる Web アプリです。

写真を「人物」「出来事」とつないでいくと、一人の人生が道のように見えてきます。
派手な機能はありません。大きな文字、大きなボタン、迷わない画面。
そして **AI は使いません** —— 扱うのは、本人の人生の一次資料である写真だけです。

## デモの始め方（エミュレータ＋サンプルデータ）

```bash
npm install
npm run emulators   # 別ターミナル: Auth 9099 / Firestore 8080 / Storage 9199 / Functions 5001 / UI 4000
node scripts/seed-dev.mjs
npm run dev         # http://localhost:3000
```

シードで「サンプル家」のデモデータ（人物 4 名・出来事 9 件・写真 14 件・本人の表示記録）が入ります。

| ロール | メールアドレス | パスワード |
| --- | --- | --- |
| 家族 | `family@memoria.example` | `dev123456` |
| 本人 | `person@memoria.example` | `dev123456` |

家族でログインすると設定や「ふりかえり」が、本人でログインすると大きな文字のいつもの画面が見られます。
写真は風景イラスト風のダミー画像です（実在の人物の写真ではありません）。

## できること

- **写真を追加** — 選ぶだけで完了。名前も日付もいりません。家族は複数枚の一括追加もできます（途中の中断・再開つき）
- **思い出を探す** — 写真が 1 枚ずつ大きく出る、本人のための閲覧モード。勝手に次へ進みません
- **人物・出来事から探す** — 写真と人・出来事を関連付けて、つながりでたどる
- **人生の地図** — 出来事が年代順に「道の駅」のように並ぶ画面。時期が分からない出来事は、無理に置かず末尾に分けます
- **本人のアカウント** — 家族が参加コード（6 桁・15 分）で発行。本人も同じ画面を自分のアカウントで使えます
- **ふりかえり**（家族のみ） — 本人がよく見ている写真・時代・最近見た写真を表示記録から集計。※表示記録は「見た回数」であり、本人の記憶や反応の良し悪しを測るものではありません
- **記録のダウンロード** — 人物・出来事・写真と関連付けを JSON で持ち出せます（家族の設定から）
- **使い方ページ** — 本人にも家族にも分かる言葉で書いたヘルプ（`/help`）

## 設計の考え方

- **AI を使わない** — 生成 AI に「思い出」を作らせない。本人の一次資料（写真と家族の言葉）だけを扱う
- **精度を偽らない日付** — 分からない月日を勝手に補完しない。日付は「日まで分かる／月まで／年だけ／時期の名前だけ」を区別して持ち、地図の並びもその正直さで決める
- **本人と家族は同じ画面** — 別 UI を作らない。権限の差は Security Rules で強制し、ボタンの出し分けは UX のためだけに行う
- **大きな文字・大きなタップ領域** — 本文 24px 前後、ボタンは 128px 級。タブレット横向きが基準
- **失敗を無言にしない** — 保存や関連付けに失敗したら、理由と「もう一度ためす」を出す
- **焦点は 1 画面に 1 つ** — ホームで目立たせる操作は「思い出を探す」だけ。残りは「ほかの探し方」に塊として置く

詳しくは [`PRODUCT.md`](PRODUCT.md) / [`DESIGN.md`](DESIGN.md) / [`docs/phase1-design.md`](docs/phase1-design.md) を参照してください。

## 技術スタック

- Next.js 16（App Router）／ TypeScript（strict）／ Tailwind CSS v4
- Firebase Authentication / Cloud Firestore / Firebase Storage / Cloud Functions
- zustand・zod・dayjs

## 開発の始め方

```bash
npm install
npm run dev        # http://localhost:3000
```

既定ではローカルの Firebase エミュレータに接続します（`.env.local` の `NEXT_PUBLIC_USE_EMULATORS=1`）。
初回は `npx firebase login` が必要です。

### Phase 4（個別アカウント方式）

仕様は [`docs/phase4-spec.md`](docs/phase4-spec.md) を参照。

- 本人アカウントの発行・参加コードの消費・パスワード再設定の確認などは `functions/` の Cloud Functions（Admin SDK）が行います。`functions/` は独立プロジェクトです（`cd functions && npm install && npm run build`）。
- 登録画面では「家族として始める / 参加コードで本人として入る」を選びます。ログインしただけでは家族は自動作成されません。
- 家族はホームの「家族の設定」（`/settings`）から本人アカウントを発行し、参加コード（6 桁・15 分）を本人のタブレットの参加画面（`/join`）に入力します。

### テスト

```bash
npm run test:rules   # Firestore / Storage ルールのテスト（エミュレータ使用）
```

## 本番へのデプロイ

チェックリスト形式の手順を [`docs/deployment.md`](docs/deployment.md) にまとめています（Firebase プロジェクトの Blaze 化、ルールと Functions のデプロイ、Vercel への配置、デプロイ後のスモーク確認）。

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [`docs/phase1-design.md`](docs/phase1-design.md) | 全体設計（画面・データモデル・ルール方針） |
| [`docs/phase4-spec.md`](docs/phase4-spec.md) | 本人アカウント方式の確定仕様 |
| [`docs/phase4-review.md`](docs/phase4-review.md) | Phase 4 の仕様レビューと残課題 |
| [`docs/reflections.md`](docs/reflections.md) | ふりかえり画面の設計（表示記録の扱い） |
| [`docs/improvement-plan.md`](docs/improvement-plan.md) | デザイン critique に基づく改善計画 |
| [`docs/deployment.md`](docs/deployment.md) | 本番デプロイ手順 |

## ディレクトリ構成（要点）

```
src/app/(app)/…     ログイン後の共通画面（ホーム・写真・人物・出来事・探す・地図・ふりかえり・設定・使い方）
src/app/(public)/…  ログイン・参加画面
src/lib/firebase/…  Firebase クライアント（エミュレータ切替対応）
src/lib/auth/…      認証・役割（person / family）の状態管理
src/lib/firestore/… データアクセス層（zod 検証つき）
functions/…         Cloud Functions（本人アカウント発行・参加などのサーバー処理）
scripts/seed-dev.mjs  デモ用シード（エミュレータ専用）
src/types/models.ts Firestore のデータモデル
firestore.rules     セキュリティルール（家族単位の分離）
storage.rules       写真ファイルのルール
```

## 開発ルール（プロンプト合意事項の要点）

- 本人と家族は共通の画面。権限差は Security Rules で強制する（ボタン非表示は UX のみ）。
- 本人の写真追加は「選ぶだけで完了」。入力は家族があとから補完する。
- AI 機能は実装しない（将来の拡張候補として記録のみ）。
