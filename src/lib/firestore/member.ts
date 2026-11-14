"use client";

import { collection, onSnapshot, orderBy, query, type Unsubscribe } from "firebase/firestore";
import { z } from "zod";
import { getFirebase } from "@/lib/firebase/client";

/*
 * 家族メンバー（members）の照会層
 *
 * role の正本は families/{familyId}/members/{uid}。
 * 書き込みは行わない（家族作成は lib/auth/family.ts、本人メンバーの
 * 作成・削除は Cloud Functions が Admin SDK で行う。docs/phase4-spec.md §7）。
 */

const memberSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  role: z.enum(["person", "family"]),
  issuedByUid: z.string().nullable().optional().catch(null),
  createdAt: z.number(),
});

export type MemoriaMember = z.infer<typeof memberSchema>;

export interface MemberSummary {
  uid: string;
  data: MemoriaMember;
}

/** 家族の全メンバーを監視する（家族の設定画面などで使う） */
export function watchMembers(
  familyId: string,
  callback: (members: MemberSummary[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const { db } = getFirebase();
  const q = query(
    collection(db, "families", familyId, "members"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const members: MemberSummary[] = [];
      for (const d of snap.docs) {
        const parsed = memberSchema.safeParse(d.data());
        if (parsed.success) members.push({ uid: d.id, data: parsed.data });
      }
      callback(members);
    },
    (err) => onError?.(err),
  );
}
