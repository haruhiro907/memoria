"use client";

import { doc, updateDoc, writeBatch, collection } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";

/**
 * 家族グループの作成（Phase 4 / docs/phase4-spec.md §1.6）
 *
 * - 登録画面で「家族として始める」を選んだときにだけ明示的に呼ぶ。
 *   ログインしただけで自動作成はしない（AuthProvider は未参加状態を保つ）。
 * - 本人アカウントの参加は参加コード（Cloud Functions）で行う。
 * - データ分離は families/{fid}/ 配下 + Security Rules で行う。
 */
export async function ensureUserFamily(uid: string, displayName: string | null): Promise<string> {
  const { db } = getFirebase();
  const familyName = buildFamilyName(displayName);

  // 新しい家族ドキュメントの id（書き込みはしない。バッチ内で set する）
  const familyRef = doc(collection(db, "families"));

  const batch = writeBatch(db);
  batch.set(familyRef, {
    name: familyName.slice(0, 50),
    createdByUid: uid,
    createdAt: Date.now(),
  });
  batch.set(doc(db, "families", familyRef.id, "members", uid), {
    uid,
    displayName: (displayName ?? "家族").slice(0, 30),
    role: "family",
    createdAt: Date.now(),
  });
  batch.update(doc(db, "users", uid), { familyId: familyRef.id });
  await batch.commit();

  return familyRef.id;
}

function buildFamilyName(displayName: string | null): string {
  const base = (displayName ?? "").trim();
  return base ? `${base}の家族` : "わたしの家族";
}

/** familyId の付け替えなど（将来の招待参加で利用） */
export async function joinFamilyId(uid: string, familyId: string) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "users", uid), { familyId });
}
