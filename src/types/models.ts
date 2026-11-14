import type { Timestamp } from "firebase/firestore";

/**
 * Memoria のデータモデル（Phase 1 設計書 docs/phase1-design.md / Phase 4 仕様 docs/phase4-spec.md に対応）
 *
 * パス構成:
 *   users/{uid}                              … 家族ポインタ（uid, familyId）
 *   families/{familyId}                      … 家族グループ
 *   families/{familyId}/members/{uid}        … メンバーと役割（role の正本）
 *   families/{familyId}/inviteCodes/{code}   … 招待コード
 *   families/{familyId}/photos/{photoId}     … 写真
 *   families/{familyId}/people/{personId}    … 人物
 *   families/{familyId}/events/{eventId}     … 出来事
 *   families/{familyId}/photoReactions/{id}  … 本人の写真への反応（操作記録）
 *
 * 関連（写真⇔人物⇔出来事）は links サブコレクションを正本にする（Phase 3 で実装）。
 */

/** 役割。person=本人 / family=家族（編集・管理可） */
export type MemberRole = "person" | "family";

/* ---------- users ---------- */
export interface UserDoc {
  uid: string;
  /** 所属する家族グループ。まだ家族に未参加なら null */
  familyId: string | null;
  createdAt: number;
}

/* ---------- families ---------- */
export interface FamilyDoc {
  name: string;
  createdByUid: string;
  createdAt: number;
}

/** families/{familyId}/members/{uid} */
export interface MemberDoc {
  uid: string;
  displayName: string;
  role: MemberRole;
  /** 本人アカウントは家族が発行する共有アカウントであり得る（発行元 uid） */
  issuedByUid?: string;
  /**
   * 登録メールアドレス（本人 member のみ保持する）。
   * 家族の設定画面で現アドレスを表示し、復旧操作を記憶に頼らせないために持つ。
   * 発行フロー（inviteCodes 経由）で引き継がれ、訂正時に Functions が更新する。
   * 旧データには無いことがある。
   */
  email?: string | null;
  createdAt: number;
}

/**
 * families/{familyId}/inviteCodes/{code}（Phase 4 §1.3）
 *
 * 参加コードのドキュメント。生成・検証・消費は Cloud Functions（Admin SDK）
 * のみが行い、クライアントからは読み書きできない（Rules で全面拒否）。
 * 時刻はサーバー時刻（Firestore Timestamp）。
 */
export interface InviteCodeDoc {
  kind: "person";
  /** ドキュメント ID と同じ 6 桁コード（collectionGroup 検索用にフィールドにも持つ） */
  code: string;
  /** 発行対象の本人アカウント uid */
  personUid: string;
  /** 本人の表示名（参加時に members へ引き継ぐ） */
  displayName: string;
  /** 本人の登録メール（参加時に members へ引き継ぐ。設定画面の現アドレス表示用） */
  email: string;
  createdByUid: string;
  createdAt: Timestamp;
  /** 発行から 15 分 */
  expiresAt: Timestamp;
  usedByUid: string | null;
  usedAt: Timestamp | null;
  /** 失敗した検証の回数（5 回で無効） */
  attempts: number;
}

/** joinAttempts/{uid}（サーバー内部用・Phase 4 §5）: 参加試行のレート制限 */
export interface JoinAttemptsDoc {
  count: number;
  windowStartMs: number;
  updatedAt: number;
}

/* ---------- photos ---------- */
/** 本人が追加したのか家族が追加したのか（入力不要フローのため役割で区別する） */
export type AddedByRole = MemberRole;

export interface PhotoDoc {
  /** Firebase Storage のパス（families/{familyId}/photos/{photoId}/...） */
  storagePath: string;
  /** 表示用URL（downloadURL） */
  downloadURL: string;
  width: number | null;
  height: number | null;
  /** 追加した人の役割（本人が選ぶだけで追加完了する） */
  addedByUid: string;
  addedByRole: AddedByRole;
  /** 家族があとから補完する任意情報。本人に入力を求めない */
  description: string | null;
  takenDate: string | null; // "YYYY-MM-DD"（任意）
  createdAt: number;
  updatedAt: number;
}

/* ---------- people ---------- */
export interface PersonDoc {
  name: string;
  photoURL: string | null;
  birthday: string | null; // "YYYY-MM-DD"（任意）
  note: string | null;
  addedByUid: string;
  createdAt: number;
  updatedAt: number;
}

/* ---------- events ---------- */
/*
 * 時期の精度。家族が入力した区切り（日 / 月 / 年）だけを扱う。
 * 表示は入力値の範囲に限り、月日を補って推測しない（Phase 4 仕様 §3.2）。
 */
export type DatePrecision = "day" | "month" | "year";

export interface PreciseDate {
  /** precision に応じた部分集合: day → "YYYY-MM-DD" / month → "YYYY-MM" / year → "YYYY" */
  value: string;
  precision: DatePrecision;
}

export interface EventDoc {
  title: string;
  description: string | null;
  /** 精度付き時期（day / month / year）。null は時期が数値で特定できない */
  startDate: PreciseDate | null;
  endDate: PreciseDate | null;
  /** 「子どもの頃」など年が特定できないときの自由表現（startDate が null のとき使う） */
  eraLabel: string | null;
  /** 視覚ガイドとして使える絵文字（任意） */
  icon: string | null;
  /** 直接関連する人物 docId（弱参照。正本は links サブコレクション） */
  personRefs: string[];
  addedByUid: string;
  createdAt: number;
  updatedAt: number;
}

/* ---------- photoReactions ---------- */
/*
 * 「実際に写真が表示された」瞬間の記録（Phase 4 §4）。
 * 本人 / 家族の区別は uid で行い、分析時に members.role と結合する。
 * 閲覧時間・反応速度などの指標は持たない。
 */
export type PhotoViewMethod = "initial" | "swipe" | "button" | "direct";

export interface PhotoReactionDoc {
  uid: string;
  photoId: string;
  action: "photo_viewed";
  method: PhotoViewMethod;
  /** サーバー時刻（serverTimestamp） */
  createdAt: Timestamp;
}
