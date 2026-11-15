"use client";

import { collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";

/*
 * photoReactions の読み取り（ふりかえり画面用）
 *
 * - 記録は「実際に写真が表示された」表示イベント（docs/phase4-spec.md §4）。
 *   本人の注視・想起・記憶能力を示すものではない。
 * - 集計は呼び出し側で行う。本人の記録だけを対象にする場合は、
 *   members の role === "person" の uid と結合すること（家族の閲覧は混ぜない）。
 * - 直近 1000 件を上限に読む（表示イベントは増え続けるため。当面の家庭利用では十分）。
 */

export interface ReactionRecord {
  photoId: string;
  uid: string;
  /** 表示時刻（サーバー時刻のミリ秒） */
  viewedAtMs: number;
}

/** 直近の表示イベントを新しい順に取得する */
export async function fetchRecentReactions(
  familyId: string,
  max = 1000,
): Promise<ReactionRecord[]> {
  const { db } = getFirebase();
  const q = query(
    collection(db, "families", familyId, "photoReactions"),
    orderBy("createdAt", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);
  const out: ReactionRecord[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (typeof data.photoId !== "string" || typeof data.uid !== "string") continue;
    const ts: unknown = data.createdAt;
    const ms = ts instanceof Timestamp ? ts.toMillis() : typeof ts === "number" ? ts : 0;
    out.push({ photoId: data.photoId, uid: data.uid, viewedAtMs: ms });
  }
  return out;
}
