# 本番デプロイ手順（チェックリスト）

開発環境（エミュレータ、プロジェクト `demo-memoria`）から本番へ移す手順。
上から順に行う。前提として、デプロイ前に `npm run test:rules`（ルールテスト）と
エミュレータでの Functions 動作確認（phase4-review.md の T4–T10）を通しておくこと。

## 1. Firebase プロジェクト

- [ ] 本番用 Firebase プロジェクトを作成する（エミュレータ用の demo とは分ける）
- [ ] プランを **Blaze** にする（Cloud Functions の実行に必須。無料枠内なら請求は発生しない）
- [ ] Authentication で「メール / パスワード」を有効化する
- [ ] Firestore Database と Storage を作成する（リージョンは asia-northeast1 を推奨）

## 2. アプリ側の接続設定

- [ ] Firebase コンソールで Web アプリを登録し、設定値を取得する
- [ ] デプロイ先の環境変数に設定する:
  - `NEXT_PUBLIC_FIREBASE_API_KEY` / `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` /
    `NEXT_PUBLIC_FIREBASE_PROJECT_ID` / `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` /
    `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` / `NEXT_PUBLIC_FIREBASE_APP_ID`
  - `NEXT_PUBLIC_USE_EMULATORS` は **設定しない**（本番では実サービスへ接続する）
- [ ] `.firebaserc` の対象プロジェクトを本番プロジェクトへ切り替える

## 3. ルールと Functions のデプロイ

```bash
cd functions && npm install && npm run build && cd ..
firebase deploy --only firestore:rules,storage,functions
```

- [ ] デプロイが成功し、Functions（createPersonAccount など 5 つ）が一覧に出ること

## 4. Web アプリのデプロイ

Next.js アプリは Vercel に置く想定（静的エクスポートはしない）。

- [ ] Vercel にリポジトリを接続し、上記環境変数を設定する
- [ ] ビルドが成功し、発行された URL でトップが開くこと
- [ ] Firebase Authentication の「承認済みドメイン」に Vercel のドメインを追加する

## 5. デプロイ後のスモーク確認

- [ ] 家族アカウントで登録・ログインできる
- [ ] 写真を 1 枚追加でき、ホームと写真一覧に出る
- [ ] 人物・出来事を作り、写真と関連付けられる
- [ ] 家族の設定から本人のアカウントを発行し、そのアカウントでログインできる
- [ ] 本人としてログインし、写真を見ると「ふりかえり」（家族側）に記録が出る
- [ ] 家族の設定から記録のダウンロード（JSON）ができる
- [ ] 使い方ページ（/help）が開く

## 6. 注意

- エミュレータ用の `demo-memoria` を本番として使わない（データ保護も課金管理も別物）。
- ルールを変更したら、必ずルールテストを通してから再デプロイする。
- 本人アカウントのパスワード再発行はメール送信ではなく家族による再発行方式
  （Phase 4 仕様）。運用開始前に家族へその旨を共有しておく。
