"use client";

import { doc, updateDoc, writeBatch, collection } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";

/**
 * 家族グループの簡易セットアップ（Phase 3）
 *
 * 方針変更（ユーザー指示）により、認証・招待は簡略化する。
 * - ログインしたユーザーがまだ家族に属していない場合、
 *   その場で「自分の家族グループ」を作成し、family ロールのメンバーになる。
 * - 招待コード・複数アカウントの合流は後回し（既定: 家族で 1 アカウント共有）。
 * - データ分離は従来どおり families/{fid}/ 配下 + Security Rules で行う。
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
