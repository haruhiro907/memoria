# Memoria | 写真から、人生をたどる

認知症のある本人と家族が、共通の画面で写真を追加・整理し、思い出をいっしょにたどる Web アプリです。

設計ドキュメントは [`docs/phase1-design.md`](docs/phase1-design.md) を参照してください。

## 技術スタック

- Next.js 16（App Router）／ TypeScript（strict）
- Tailwind CSS v4
- Firebase Authentication / Cloud Firestore / Firebase Storage
- zustand・zod・dayjs

## 開発の始め方

```bash
npm install
npm run dev        # http://localhost:3000
```

既定ではローカルの Firebase エミュレータに接続します（`.env.local` の `NEXT_PUBLIC_USE_EMULATORS=1`）。

### エミュレータの起動（別ターミナル）

```bash
npm run emulators  # Auth: 9099 / Firestore: 8080 / Storage: 9199 / UI: 4000
```

初回は `npx firebase login` が必要です。エミュレータユーザーは事前登録不要です（UI またはアプリのアカウント作成フローから作れます）。

## 本番の Firebase プロジェクトに接続する場合

1. [Firebase コンソール](https://console.firebase.google.com/) で新しいプロジェクトを作る
2. 「ウェブアプリを追加」して `firebaseConfig` の値を取得
3. `.env.local` に `.env.example` に従って値を転記し、`NEXT_PUBLIC_USE_EMULATORS=0` にする
4. `npx firebase deploy --only firestore:rules,firestore:indexes,storage::storage.rules` でルールを反映

## ディレクトリ構成（要点）

```
src/app/(app)/…     ログイン後の共通画面（ホーム・写真・人物・出来事・探す・地図）
src/app/(public)/…  ログイン画面
src/lib/firebase/…  Firebase クライアント（エミュレータ切替対応）
src/lib/auth/…      認証・役割（person / family）の状態管理
src/types/models.ts Firestore のデータモデル
firestore.rules     セキュリティルール（家族単位の分離）
storage.rules       写真ファイルのルール
```

## 開発ルール（プロンプト合意事項の要点）

- 本人と家族は共通の画面。権限差は Security Rules で強制する（ボタン非表示は UX のみ）。
- 本人の写真追加は「選ぶだけで完了」。入力は家族があとから補完する。
- AI 機能は実装しない（将来の拡張候補として記録のみ）。
