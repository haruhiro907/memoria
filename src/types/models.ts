/**
 * Memoria のデータモデル（Phase 1 設計書 docs/phase1-design.md に対応）
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
  createdAt: number;
}

/** families/{familyId}/inviteCodes/{code} */
export interface InviteCodeDoc {
  familyId: string;
  createdAt: number;
  usedByUid: string | null;
  usedAt: number | null;
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
/** 思い出を探す（/explore）での操作記録。将来の AI 機能への素材（現時点では AI は実装しない） */
export type ExploreAction =
  | "swipe_next"
  | "swipe_back"
  | "button_next"
  | "button_back";

export interface PhotoReactionDoc {
  photoId: string;
  uid: string;
  action: ExploreAction;
  /** その写真をどれくらい見つめていたか（ミリ秒）。将来の分析用 */
  dwellMs: number | null;
  viewedAt: number;
  createdAt: number;
}
