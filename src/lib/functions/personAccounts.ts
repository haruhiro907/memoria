"use client";

import { httpsCallable, type FunctionsError } from "firebase/functions";
import { getFirebase } from "@/lib/firebase/client";

/*
 * 本人アカウント関連の Cloud Functions 呼び出し（docs/phase4-spec.md §7）
 *
 * 発行・参加・復旧はサーバー側（Admin SDK）でのみ行う。
 * サーバーは HttpsError の message に機械可読キーを返すため、
 * ここで利用者向けの案内文に変換する（personAccountErrorMessage）。
 */

export interface CreatePersonAccountResult {
  uid: string;
  code: string;
  /** コードの有効期限（UNIX ミリ秒） */
  expiresAt: number;
}

export async function createPersonAccount(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<CreatePersonAccountResult> {
  const { functions } = getFirebase();
  const call = httpsCallable<typeof input, CreatePersonAccountResult>(functions, "createPersonAccount");
  const res = await call(input);
  return res.data;
}

export async function joinFamilyWithCode(code: string): Promise<{ familyId: string }> {
  const { functions } = getFirebase();
  const call = httpsCallable<{ code: string }, { familyId: string }>(functions, "joinFamilyWithCode");
  const res = await call({ code });
  return res.data;
}

/** 登録メールを確認し、確認済みメールを返す（実際の再設定メール送信は呼び出し側） */
export async function verifyPersonEmailForReset(email: string): Promise<{ email: string }> {
  const { functions } = getFirebase();
  const call = httpsCallable<{ email: string }, { email: string }>(functions, "sendPersonPasswordReset");
  const res = await call({ email });
  return res.data;
}

export async function updatePersonEmail(personUid: string, newEmail: string): Promise<{ email: string }> {
  const { functions } = getFirebase();
  const call = httpsCallable<{ personUid: string; newEmail: string }, { email: string }>(
    functions,
    "updatePersonEmail",
  );
  const res = await call({ personUid, newEmail });
  return res.data;
}

export async function removePersonMember(personUid: string): Promise<void> {
  const { functions } = getFirebase();
  const call = httpsCallable<{ personUid: string }, { ok: boolean }>(functions, "removePersonMember");
  await call({ personUid });
}

/** Functions のエラーキー → 利用者向け案内文 */
export function personAccountErrorMessage(err: unknown): string {
  const key = extractKey(err);
  switch (key) {
    case "invalid-email":
      return "メールアドレスの形が正しくないようです。実在するメールアドレスをご確認ください。";
    case "weak-password":
      return "パスワードは 8 文字以上にしてください。";
    case "invalid-display-name":
      return "名前は 1〜30 文字で入力してください。";
    case "email-in-use":
      return "このメールアドレスはすでに使われています。別のメールアドレスをお試しください。";
    case "person-exists":
      return "本人のアカウントはすでにあります。再発行する場合は、先に「家族から外す」を行ってください。";
    case "person-not-found":
      return "本人のアカウントが見つかりませんでした。";
    case "email-mismatch":
      return "入力したメールアドレスが、登録されているものと一致しません。";
    case "invalid-code":
      return "参加コードがちがうようです。数字 6 桁をご確認ください。";
    case "code-used":
      return "この参加コードはすでに使われています。新しいコードを発行してください。";
    case "code-expired":
      return "参加コードの有効期限（15 分）が切れています。新しいコードを発行してください。";
    case "code-locked":
      return "この参加コードは、まちがった入力が続いたため無効になりました。新しいコードを発行してください。";
    case "rate-limited":
      return "まちがった入力が続いたため、しばらく参加できません。15 分ほど待ってからお試しください。";
    case "already-joined":
      return "このアカウントはすでに家族に参加しています。";
    case "family-role-required":
    case "no-family":
      return "この操作は家族のアカウントからのみ行えます。";
    case "signin-required":
      return "ログインが必要です。もう一度ログインしてください。";
    default:
      return "うまくいきませんでした。もう一度お試しください。";
  }
}

function extractKey(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as Partial<FunctionsError> & { details?: unknown };
    if (typeof e.message === "string" && e.message.length > 0 && !e.message.includes(" ")) {
      return e.message;
    }
    if (typeof e.details === "string") return e.details;
  }
  return "";
}
