# Phase 4 仕様書（確定版）

※ 本書は仕様の確定を記録するものであり、実装はユーザーの確認後に開始する。

## 0. Scope

- 対象: 「思い出を探す」・「人生の地図」・個別アカウント方式（本人用アカウントの発行と参加）・photoReactions 記録
- 非対象: AI 機能、閲覧時間・反応速度・記憶能力の評価指標、場所（地理）データ、本人への写真表示制限

---

## 1. 個別アカウント方式

### 1.1 基本方針

| 項目 | 決定 |
|---|---|
| 認証方式 | Firebase Authentication / メール・パスワード |
| アカウント | 本人用（role: `person`）と家族用（role: `family`）をUIDで区別 |
| 日常の本人操作 | ゼロ（永続セッション。本人はアプリを開くだけ） |
| 初期設定・本人ログイン | 家族が実施（共有タブレット上で 1 回） |
| 本人参加の検証 | **Cloud Functions（信頼できるサーバー側）で行う**。クライアントは Rules を通じて直接参加させない |
| 追跡 | すべての操作記録（photoReactions 等）は uid で保存。家族の閲覧を本人の反応として集計しない（分析時に members.role で区別） |

### 1.2 本人アカウントの発行（家族が実施）

- 画面: 「家族の設定」（family ロール限定。URL は `/settings`、ホームの管理者操作に配置）
- Cloud Functions の callable `createPersonAccount` を呼び出す:

```
createPersonAccount({ email, password, displayName })
  前提: 呼び出し元が family ロール
  検証（サーバー側）:
    - email は実在可能な形式（RFC 的に妥当。.local 等の架空ドメインは使用しない）
    - password は Firebase Auth の強度基準（8 文字以上推奨）
    - displayName 1〜30 文字
    - 同一家族の person メンバーは最大 1 名（再発行は既存を削除してから）
  処理: Admin SDK で auth.createUser()（呼び出し元セッションは保持される）
        + families/{fid}/inviteCodes/{code} に参加コードを作成
  戻り値: { uid, code, expiresAt }
```

- 画面は「本人アカウントを作りました。パスワードは必ず家族が安全に保管してください」と注意を示し、参加コードを大きな字で表示（コードの有効期限は 15 分）

### 1.3 参加コード（6 桁）の要件

| 要件 | 実装 |
|---|---|
| 試行回数制限 | コードごとに `attempts` を数え、**5 回失敗で無効化**。加えて呼び出し元 UID 単位でも `joinAttempts` をサーバー側に記録し、**15 分あたり 5 失敗**で以降の検証を一時ブロック |
| 一回限りの使用 | `usedByUid` をトランザクションで原子的に設定。非 null なら使用済みとして拒否 |
| 期限 | `expiresAt`（発行から 15 分）。期限切れコードは検証失敗 |
| 原子的な消費 | すべての検証・消費は Firestore `runTransaction` 内で行い、二重使用を構造的に不可能にする |

コードドキュメント:

```
families/{fid}/inviteCodes/{code}   （code = 6 桁数字。サーバーのみ生成）
{
  kind: "person",
  createdByUid: string,
  createdAt: Timestamp (server),
  expiresAt: Timestamp (server),
  usedByUid: string | null,
  usedAt: Timestamp | null,
  attempts: number          // 失敗試行数
}
```

クライアントから inviteCodes は一切読み書きさせない（Rules で全部拒否。Admin SDK のみが触る）。

### 1.4 本人の参加フロー（家族が代行操作）

1. 家族が「本人のアカウントを作る」でアカウント発行 → 参加コードを控える
2. 家族がタブレットで本人アカウントにログイン（家族セッションから切り替え）
3. 参加待ち画面に表示された「参加コードを入れる」欄にコード入力（本人側 UI は家族が触って完了）
4. callable `joinFamilyWithCode({ code })`:

```
joinFamilyWithCode({ code })
  前提: 呼び出し元はこのコードの本人（Auth は発行済みアカウント）
  検証（サーバー）:
    - users/{caller.uid} が既に familyId を持つ → 拒否
    - コード存在・期限・attempts < 5・usedByUid == null
    - 成功: トランザクション内で usedByUid = caller.uid を設定
  処理: members/{fid}/{caller.uid} (role: person, displayName) 作成
        + users/{caller.uid}.familyId = fid を更新（同一トランザクション）
  失敗時: attempts を 1 増やす
```

5. 家族が自分のアカウントへ戻る（タブレットは本人アカウントのまま放置。家族は自分のスマホから家族アカウントを使う）

※ この一連の操作は本人が自ら行う場面がない（家族が設定時のみ）。

### 1.5 アカウント復旧（実在メールのため設計可能）

| 状況 | 復旧手段 |
|---|---|
| パスワード紛失 | 「家族の設定」→「本人アカウントのパスワードを再設定する」→ callable `sendPersonPasswordReset({ email })`（family ロール限定）。Firebase Auth のパスワード再設定メールが本人アカウントのメール宛に届く（家族が管理する実在メールボックス）。家族が新しいパスワードを設定し、タブレットで再ログイン |
| メールアドレス自体の訂正（入力ミス） | callable `updatePersonEmail({ personUid, newEmail })`（family ロール限定・Admin SDK で `updateUser`）。検証: personUid が自家族の person メンバーであること |
| アカウントを丸ごと作り直す | 「家族の設定」→ member 削除（`person` のメンバー解除）→ 新規発行。**旧 UID の photos 追加記録・photoReactions は消さない**（履歴として残す。旧 UID は捨てアカウント扱い） |
| 本人を家族から外す | member 削除（family ロール）。本人の users doc の familyId 解除も同トランザクション（Functions 側） |

### 1.6 サインアップ・ログインの変更点（クライアント）

- `AuthProvider` の「ログイン時に自分の家族を自動作成」を廃止
- 新規登録画面: 「家族として始める」（→ 現行どおり family ロールで家族グループ作成）／「参加コードで本人として入る」（→ users doc 作成 + joinFamilyWithCode を待つ）
- 本人アカウントが familyId 未設定のままログインした場合、ホームではなく「参加コード入力」画面を出す（家族が代行入力するための画面）

---

## 2. 思い出を探す（/explore）

- 順序: **アップロード日時の新しい順**（createdAt 降順・上限 500 件。ページングは残課題）
- 撮影日順は後から追加する候補（Phase 4 では実装しない）
- 写真 1 枚が主役の没入画面。上部に静かに「つながる人物・出来事」チップ
- 操作: 左右スワイプ＋下部大ボタン「まえの写真」/「つぎの写真」（両方常設。スワイプ強制なし）
- 遷移: タップ → 写真詳細（本人・家族とも可）。チップ → 人物・出来事詳細。「おわり」→ ホーム
- 最後の写真で「つぎ」を押すと大ボタン「最初からもう一度」を出す。自動送り・自動遷移なし
- **実際に表示された写真を photoReactions に記録**（§4）

---

## 3. 人生の地図（/map）

### 3.1 見せ方

- 「時間の一本道」方式。横スクロールの道に出来事が「駅」として並ぶ（古い → 新しい）
- 駅 = 出来事 1 件: マーク（icon）＋時期ラベル＋タイトル。タップで出来事詳細へ
- 駅の上に、その出来事に結び付いた写真タイルを最大 3 枚（撮影日不明の写真も**出来事経由なら載る**）。タップで写真詳細へ
- 操作: 横スワイプ + 「←」「→」大ボタン併設 + 駅タップ。自動再生なし。ホームボタンで戻る
- 本人・家族とも同じ画面。本人に「未整理」等の状態は見せない

### 3.2 時期データのモデル（events v2）

「正確な日付・年月・おおよその時期を区別する」「不明な日付を推測して表示しない」のため、events の日付フィールドを精度付き構造に拡張する:

```
startDate: null | { value: string, precision: "day" | "month" | "year" }
           value は値の整合を保つ ISO 部分集合:
             precision day   → "YYYY-MM-DD"
             precision month → "YYYY-MM"
             precision year  → "YYYY"
endDate:   同構造（startDate と同精度を要求）
eraLabel:  string | null   // 「子どもの頃」「戦前」など、年が特定できないおおよその時期
```

- 道の軸配置は **precision を持つ startDate のみ**。value の値そのものを表示する（day = YYYY年M月D日 / month = YYYY年M月 / year = YYYY年）。**表示は入力値の範囲に限定し、月・日を補って表示しない**
- eraLabel のみの出来事（軸に置ける数値がない）は、道の末尾に「時期がくわしくない出来事」の独立区画に並べる（入力された語をそのまま表示）
- 写真の `takenDate` は現行どおり `"YYYY-MM-DD"`（day 精度の任意データ）。地図は写真を駅経由で見せるため写真単体の軸配置はしない

---

## 4. photoReactions（データ設計）

### 4.1 レコード

```
families/{fid}/photoReactions/{reactionId}   （自動 ID・「実際に表示された」瞬間 1 件）
{
  uid:       string     // 操作者の認証 uid（本人/家族を区別して保存）
  photoId:   string     // 実際に表示した写真の ID
  action:    "photo_viewed"   // 固定値
  method:    "initial" | "swipe" | "button" | "direct"
  createdAt: Timestamp  // サーバー時刻（serverTimestamp）
}
```

| method | 意味 |
|---|---|
| initial | 探す画面を開いたとき最初に表示された写真 |
| swipe   | 探す画面でスワイプして切り替わった写真 |
| button  | 探す画面で大ボタンで切り替わった写真 |
| direct  | 探す以外の導線（写真詳細・地図・関連写真タイル）で表示した写真 |

- 探すの「おわり」・写真詳細閲後の戻りなど、写真の新規表示でない操作は記録しない
- 同じ写真をもう一度表示した場合も、表示のたびに 1 件記録する
- 閲覧時間・反応速度等の指標は実装しない（将来の分析は createdAt のみで行える形を維持）

### 4.2 本人と家族の区別

- レコードは uid のみ。**閲覧・分析時に `members/{uid}.role` と結合して本人/家族を判別**する
- 「本人の反応」の集計＝role が `person` の uid による photo_viewed のみ。家族の閲覧（role: family）は集計に含めない（同一レコード構造で保存し、後から区別する）
- Phase 4 では分析 UI を作らない（記録の蓄積と将来性の担保のみ）

---

## 5. データモデル変更一覧

| コレクション | 変更 | 内容 |
|---|---|---|
| `events/{id}` | v2 | `startDate` / `endDate` を精度付き構造に変更。`eraLabel` 追加 |
| `families/{fid}/inviteCodes/{code}` | 新設 | 参加コード（§1.3）。クライアント不可 |
| `joinAttempts/{uid}` | 新設（サーバー内部） | 参加試行ログ（レート制限用。クライアント不可） |
| `families/{fid}/photoReactions/{id}` | v2 | action を `photo_viewed` に統一し、method を 4 種類に変更。フィールド構造は据え置き |
| `families/{fid}/members/{uid}` | 変更なし | role: `person` が本運用で初めて現れる |
| `photos` / `people` / `links` | 変更なし | — |

- **既存データへの影響**: 本番データは未存在のため移行不要。エミュレータ上の仮データは個別化検証の開始時に削除・再作成する。`events` の日付は従来の文字列から精度付き構造へ置き換える（仮データのため手動再入力）

---

## 6. Security Rules 変更点

| 対象 | 現行 | 変更後 |
|---|---|---|
| `inviteCodes` | `get`: signedIn なら許可 / list, write: family | **read, write すべてクライアント不可（false）**。生成・消費は Admin SDK（Functions）のみ |
| `photoReactions` | create: uid 一致 + photoId は string | create に追加検証: `action == 'photo_viewed'`、`method` ∈ {initial, swipe, button, direct}、`getAfter(photos/{photoId})` で自家族の写真実在を確認 / update, delete: false（現行維持） |
| `users` | create: self のみ / update: self | Phase 4 で変更なし（家族の familyId 付与は Functions が Admin SDK で行うため Rules 不要） |
| `members` | create: family ロール（person を作れる）／既存の bootstrap 許可 | 変更なし。ただし現行の「家族作成時自分自身を family で追加」の bootstrap は維持 |
| `events` | なし | 精度構造のバリデーション（value と precision の整合）を Rules に追加 |

- 全体は deny-by-default を維持。Functions は Admin SDK で Rules をバイパスする（信頼境界は Functions へ移し、クライアントの権限を最小化する）

---

## 7. Cloud Functions 仕様

実装: `functions/`（TypeScript・callable functions。開発は Functions エミュレータ＋Firestore/Storage/Auth エミュレータで検証）

| 関数 | 呼び出し元 | 検証 | 主処理 |
|---|---|---|---|
| `createPersonAccount` | family ロール | email 形式・pw 強度・displayName・person メンバー上限 | auth.createUser + inviteCodes 発行（15 分） |
| `joinFamilyWithCode` | 本人アカウント | users.familyId なし / コード有効 / レート制限 | トランザクションでコード消費 + members person 作成 + familyId 更新 |
| `sendPersonPasswordReset` | family ロール | email が自家族 person メンバーのもの | 必要なら Admin で取得した email 宛に再設定手続きを発行 |
| `updatePersonEmail` | family ロール | personUid が自家族 person メンバー | Admin で email 変更（確認メールは運用で案内） |
| `removePersonMember` | family ロール | personUid が自家族 person メンバー | member 削除 + users.familyId 解除（トランザクション） |

- 注意: 本番での Functions 利用は Blaze（従量課金）プランが必要。開発・検証はエミュレータで完結する

---

## 8. コンポーネント・画面の追加（実装計画での一覧）

| 画面/部品 | 概要 |
|---|---|
| `/explore` | 探す本体（大写真・チップ・3 大ボタン・photo_viewed 記録） |
| `/map` | 時間の一本道（横スクロール・駅・写真タイル） |
| `/settings` | 家族の設定（家族限定）: 本人アカウント発行・コード表示・パスワード再設定・member 管理 |
| 参加/合格待ち画面 | 本人アカウントで未参加の場合のコード入力画面 |
| 新規登録画面 | 「家族として始める / 本人として参加する」選択 |
| events フォーム | 精度選択（日/月/年）+ eraLabel 入力 |

---

## 9. テスト計画（エミュレータ・Java 導入後に実施）

### 9.1 基盤（Phase 3 引き継ぎ）
- T1 ログイン/家族作成/写真追加/一覧・詳細/人物・出来事 CRUD/関連付け/削除 detach（前回の A〜F 項目）

### 9.2 権限
- T2 person ロールでの拒否確認（photos 編集、links, people/events CRUD, photoReactions 改変）
- T3 別家族データの読み書き拒否（Firestore/Storage）

### 9.3 アカウント発行・参加（Functions）
- T4 family ロールのみ createPersonAccount 成功 / person ロールは rejected
- T5 発行 → 本人ログイン → コード参加 → members(person) + familyId の一体確認
- T6 コード期限切れ / 5 連続誤入力（attempts 上限到達）で無効化 / 使用済みコードの再使用拒否 / 別家族のコードを混ぜて検証できない
- T7 レート制限: 同一 uid の 15 分あたり 5 失敗で一時ブロック
- T8 既に参加済み uid の再参加拒否
- T9 パスワード再設定メール送信と再ログイン
- T10 メール訂正 / member 削除（familyId 解除確認）

### 9.4 思い出を探す
- T11 開いたとき initial 記録 / スワイプ・ボタン各 1 回ずつ method 別に記録
- T12 タップ → 詳細 → 戻る → 探すに戻ると位置を維持（状態保持）
- T13 家族と本人で同一画面・ボタンの差だけ確認（person は関連付け等の編集操作が出ない）
- T14 不正 record（action/method 偽装・他人 uid・存在しない photoId）が Rules で拒否される

### 9.5 人生の地図
- T15 精度付きイベント（day/month/year）が正しい順序・表示で配置される
- T16 精度が月・年のとき月日を補って表示しない
- T17 eraLabel のみの出来事が末尾区画に載る
- T18 撮影日不明写真が出来事駅に表示される
- T19 日付のない出来事は道（軸）に載らない（末尾区画のみ）

### 9.6 非機能
- T20 エミュレータ停止中に写真追加失敗 → リトライで回収
- T21 オフライン〜復帰時の onSnapshot 反映
- T22 全画面のタブレット横向きレンダリング確認（10〜11 inch 相当の実寸確認）

---

## 10. 作業順序（実装フェーズ）

1. Rules・Functions（§6・§7）→ Emulator で T4〜T8
2. 認証フロー変更（§1.6）＋ /settings ＋参加待ち画面 → T5〜T10
3. events v2 のフォーム・一覧・地図対応 → T15〜T19
4. /explore ＋ photoReactions 記録 → T11〜T14
5. 全体リグレッション（T1〜T3・T20〜T22）→ 完了報告
