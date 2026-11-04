# Memoria 設計ドキュメント（Phase 1）

> コンセプト：**写真から、人生をたどる。**
> 認知症のある本人と家族が、同じ画面で写真を追加・整理し、人生の記憶ネットワークを一緒に育てる Web アプリ。

---

## 1. 技術構成

| 領域 | 採用技術 | 採用理由 |
|---|---|---|
| フレームワーク | **Next.js（App Router / v15 系）** | 画面数が多くページ分割が自然。SSR/CSR を画面ごとに選べ、Firebase との相性が良い。画像最適化・PWA 対応も容易。 |
| 言語 | **TypeScript（strict）** | データモデル（写真・人物・出来事・関連）の整合性を型で担保し、機能追加時の事故を減らす。 |
| スタイリング | **Tailwind CSS（v4）** | 「大きな文字・大きなボタン・十分な余白」をユーティリティクラスとデザイントークンで統一しやすい。 |
| 認証 | **Firebase Authentication** | メール/パスワードで家族単位の認証を最小構成で実現。将来 Google ログイン等へ拡張可能。 |
| DB | **Cloud Firestore** | 家族（グループ）単位のデータ分離がクエリとセキュリティルールで表現しやすい。写真⇔人物⇔出来事の「関連」をドキュメント参照で自然に設計できる。オフラインキャッシュでタブレット利用に向く。 |
| ストレージ | **Firebase Storage** | 写真の保存に特化。ダウンロード URL を Firestore に保持する構成。リサイズは将来対応。 |
| 状態管理 | **Zustand（軽量）/ React フック中心** | グローバルに持ちたいのは「現在ユーザー・役割・家人ID」程度。重い Redux は不要。 |
| バリデーション | **Zod** | Firestore の読み書きスキーマをランタイムでも検証し、不正データを弾く。 |
| その他 | dayjs（日付表示）、swipe 検出自作（依存最小化） | スワイプはシンプルな pointer イベント実装で十分。 |

**決めないこと（MVP でやらないこと）**
- AI 機能（人物認識・分類・推薦・文字起こし）は一切実装しない。将来追加を見込み、`photo.tagsHint` のようなオプションフィールド境界を設けておく。
- サーバー・API は作らない（Next.js の Route Handler も最小限に留める）。
- テストは手動確認 + 主要ロジックの単体テスト（Vitest）を最低限。

---

## 2. ディレクトリ構成

```
memoria/
├── docs/                        # 設計ドキュメント
├── firestore.rules              # セキュリティルール
├── storage.rules
├── firebase/                    # Firebase 接続・エミュレータ用設定
│   ├── client.ts                # クライアント SDK 初期化
│   ├── emulators/               # エミュレータ動作用（本番鍵非依存で開発）
│   └── rules/                   # テスト用ルールコピー
├── src/
│   ├── app/                     # Next.js App Router（= URL = 画面）
│   │   ├── (public)/            # 未ログイン領域
│   │   │   └── login/
│   │   ├── (app)/               # ログイン後の共通レイアウト（ホームボタン常設）
│   │   │   ├── home/            # ホーム
│   │   │   │   └── today/       # 今日の思い出
│   │   │   ├── photos/          # 写真一覧
│   │   │   │   ├── new/         # 写真を追加（本人用シンプルフロー）
│   │   │   │   └── [photoId]/   # 写真詳細（編集はここ）
│   │   │   ├── people/          # 人物一覧
│   │   │   │   ├── new/
│   │   │   │   └── [personId]/  # 人物詳細・関連写真
│   │   │   ├── events/          # 出来事一覧
│   │   │   │   ├── new/
│   │   │   │   └── [eventId]/
│   │   │   ├── explore/         # 思い出を探す（スワイプ＋大ボタン）
│   │   │   └── map/             # 人生の地図（関連カード一覧）
│   │   ├── family/              # 家族設定・招待・メンバー管理（家族役割者のみ）
│   │   └── layout.tsx, globals.css
│   ├── components/
│   │   ├── ui/                  # BigButton, PhotoCard, SectionTitle など基本部品
│   │   ├── layout/              # HomeButton 常設ヘッダー/フッター
│   │   ├── photo/               # 写真関連コンポーネント
│   │   ├── person/
│   │   └── event/
│   ├── features/                # ドメインロジック
│   │   ├── photo/               # 追加・関連付け・リンク移動
│   │   ├── person/
│   │   ├── event/
│   │   ├── explore/             # スワイプ検出・反応記録
│   │   └── map/
│   ├── lib/
│   │   ├── firestore/          # コレクションアクセス&変換 (Zod 併用)
│   │   ├── auth/               # 認証コンテキスト・役割
│   │   └── utils/
│   ├── types/                   # 共有型定義（データモデル）
│   └── constants/               # 色・文字サイズ・文言
├── public/                      # アイコン・フォールバック画像
└── package.json
```

---

## 3. 画面構成

**原則：本人と家族は同じ画面を使う。役割による差は「編集・管理ボタンの有無」だけにする（表示の制御のみ。実体は Security Rules で強制）。**

| # | 画面 | パス | 主な用途 | 本人 | 家族 |
|---|---|---|---|---|---|
| 1 | ログイン | `/login` | メール/パスワード | ○ | ○ |
| 2 | ホーム | `/home` | 今日の思い出 / 最近追加 / 各機能への大ボタン | ○ | ○ |
| 3 | 今日の思い出 | `/home/today` | 「その日」の写真を手順よく見る | ○ | ○ |
| 4 | 写真一覧 | `/photos` | 大きなグリッド表示 | 閲覧 | 閲覧 |
| 5 | 写真を追加 | `/photos/new` | **選んで追加完了。入力一切不要** | 選択のみ | 選択のみ |
| 6 | 写真詳細 | `/photos/[id]` | 大きく表示・関連人物/出来事/関連写真 | 閲覧 | 編集可 |
| 7 | 人物一覧/詳細 | `/people`, `/people/[id]` | 大きいサムネ・関連写真 | 閲覧 | 登録・編集可 |
| 8 | 出来事一覧/詳細 | `/events`, `/events/[id]` | 関連人物・写真 | 閲覧 | 登録・編集可 |
| 9 | 思い出を探す | `/explore` | スワイプ でも 大ボタン でも同じ操作 | ○ | ○ |
| 10 | 人生の地図 | `/map` | 関係をカード一覧で探索（複雑な図は後日） | ○ | ○ |
| 11 | 家族設定 | `/family` | メンバー・招待コード・役割 | ✕ | ○ |

**画像追加フロー（本人を最優先に設計）**
1. `/photos/new` に大きな 2 ボタン：📷 写真を選ぶ ／ 🎞 カメラで撮る
2. 選択 → 即アップロード → **完了画面**：「写真が家族に加わりました」の絶対表示
3. 編集画面へ遷移させない。家族は後から写真詳細から説明を補完できる。

**思い出を探す（/explore）**
- カードを左右スワイプで「次へ/戻る」。ボタン「次へ」「戻る」を大きく並置（常時表示）。
- どちらの操作でも同一ハンドラ → 写真 id + 操作種別（swipe / button）を `photoReactions` に記録。
- ボタン操作を topple しない（スワイプ失敗時のたたき台になる）。

---

## 4. データベース設計（Firestore）

**基本方針：家族単位データ分離。全コレクションのパスを `families/{familyId}/...` 直下に置くことで Security Rules を単純化・強固にする。**

```
families/{familyId}
  name, createdAt, inviteCode(将来

  members/{userId}            ← 家族メンバーディレクトリ（ユーザー情報の公安）
    uid(=docId), displayName, role: "person" | "family", createdAt
  inviteCodes/{code}          ← 招待コード（使われたら家での減算 or invalid フラグ）
    familyId, createdAt, usedBy?, expiresAt

  photos/{photoId}
    storagePath, downloadURL, width, height,
    addedByUid, addedByRole,
    description?(家族編集), takenDate?(任意)
    personRefs: string[]    ← 人物の docId リスト（重複リンク集合はサブコレクションで正規化）
    eventRefs: string[]
    createdAt, updatedAt

  photos(photoId)/links/person/{personId}   ← 写真⇔人物の関連
    role: "subject" | "together" ...
  photos(photoId)/links/event/{eventId}     ← 写真⇔出来事の関連
  photos(photoId)/reactions/{uid}… or photoReactions コレクションへ
  photos(photoId)/relevance/…               ← 将来 AI 用のデータ留置場（今は空）

  people/{personId}
    name, displayName, photoURL(今年 or noImage),
    birthday?(任意), note?(家族編集),
    relatedPeople: personId[]   ← 家族など近い人
    addedByUid, createdAt

  events/{eventId}
    title, description?, startDate, endDate?,
    photos?: (配列ではなく links サブコレクションで保持)
    personRefs: string[]      ← 関連人物
    icon?(絵文字等の視覚ガイド)
    createdAt

  explore/… or photoReactions/{id}   ← 本人の写真への反応
    photoId, uid, action: "swipe_next" | "swipe_back" | "button_next" | "button_back"
    viewed, viewedAt, createdAt
    ...
```

**参照の方針**
- 「弱参照」で photoRefs / eventRefs を親ドキュメントに持つが、**正本は links サブコレクション**にして整合性を Code 側トランザクションで保つ。
- 「人物⇔写真」「人物⇔出来事」双方向参照が崩れない設計にする（後で人生の地図へ発展）。

### 反応（photoReactions）
- 本人が写真をすすめる／戻る／長時間見た…などの行動を軽量に記録する。
- 将来の AI 推薦へ自然に発展できる形。

---

## 5. 認証・権限設計

### 役割（toolbar フィールドを LegalKeep に）
| role | 表示 | 権限 |
|---|---|---|
| `person` | 本人 | 閲覧・写真を追加（本人フロー）、「思い出を探す」反応。**編集不可** |
| `family` | 家族 | 閲覧・写真追加・説明/人物/出来事の編集・メンバー管理 |

### 権限の強制はすべて Firestore / Storage Security Rules で行う
**クライアントのボタン非表示は UX のためだけに行い、セキュリティとしては無効。**

```
families/{fam}/<doc>        →   isMember(fam) で allow
families/{fam}/members      →   read: isMember / write: family only
families/{fam}/photos.write →   all: isMember / update(const 編集): family only
families/{fam}/photoReactions.create →   isMember + 自己 uid 一致
```
- 家族 ID を知らないユーザーはそもそもクエリ／参照が不可（familyId 起点パスのため）。
- Storage は `/families/{fam}/photos/…` 配下を同様の isMember で保護。
- 招待は **招待コードからの参加** のみ。初回で `/family` が作成され、作成者は管理者視点を持つ。
- 本人か家族かに紐づく端末共有共用設定は行わず、1 ユーザー 1 アカウント & 共有感が headless に手動共有できる形。

### 保管と公開
- 写真は Firebase Storage； テータスは downloadURL を Firestore 保持（セキュリティルールでパス制御）。
- 家族内のデータ共有は $familiar が参照可能な枠だった：家族内の共有フォロー、他人への共有権限は後日。管理画面は family role のみが閲覧可。

---

## 6. UI / デザイン方針

- **タブレット横向き最優先**（10–11 inch / 1024–1366px 相当を第一報基準）→ PC・縦向き・スマホへ段階対応。
- **デザイントークン化**（Tailwind v4 `@theme`）：
  - 文字：本文(px) — 見出し 5xl / 本文 2xl / 補足 xl
  - 色は「視認性」と「温かみ」； 色だけの情報伝達は無し（テキスト＋形状も付ける）。
  - bg は温かみのある低彩度米色系，写真を白／薄い縁に刺して主役へ。
  - acctive state は **色 AND 形状(下線/四角幅)** の両方で伝える。
- **アニメーションは 150ms 以内の opacity/transform に限定。🐾 自動遷移なし。任意遷移なし。**
- **全画面に「ホームへ戻る」大ボタンを常設**（layout 層で良い）。
- 写真追加はリトライ対応（失敗時は「もう一度」大ボタンと失敗原因の簡易理由）。

---

## 7. 実装ロードマップ

| Phase | 内容 |
|---|---|
| **1 設計**（本ドキュメント） | 技術選定・画面・データモデル・権限設計 |
| **2 基盤構築** | Next.js 初期化、Tailwind v4、Design Token、Firebase 接続 (エミュレータ利用)、認証コンテキスト、共通 Layout（ホームボタン常設）、FLB New Project |
| **3 基本機能** | /photos/new (本人用シンプルフロー)、/photos、/photos/[id]、人物 CRUD、出来事 CRUD、関連付け (写真⇔人物・出来事) |
| **4 独自機能** | /explore（スワイプ＋ボタン両対応＋反応記録）、関連写真の「またぐ移動」、「人生の地図」のカード一覧 v1 |
| **5 検証** | タブレット/縦・横転、アップロード失敗リトライ、Security Rules テスト（エミュレータ）、操作性確認、仮データ↔実データの分離確認 |

---

## 8. 仕様決定（ユーザー確認済み）

1. **Firebase プロジェクト**：未作成 → エミュレータファーストで開発を進める。本番プロジェクト作成手順は Phase 2 で案内する。
2. **参加フロー**：**招待コード方式**（家族アカウント作成 → 家族グループ作成 → コード発行 → 新メンバーがコード入力で参加）。
3. **本人の認証**：**家族が発行する共有アカウント**。本人には簡易ログイン（パスワード入力を極力要求しない形）を検討。実装時に詳細を改めて確認する。
4. **画像リサイズ**：**リサイズなし、元画像のまま保存**。容量・表示性能の課題が出たら将来対応する。

### 共有アカウント方式に伴う補足
- 1 台のタブレットを家族で共有する前提。本人/家族の切り替えは、ログイン画面で「だれが使いますか？」と本人用の大ボタン（簡易ログイン）を出す方向で検討する（詳細は Phase 3 前に確認）。
