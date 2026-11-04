"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";

/*
 * photoReactions の記録（photo_viewed / /explore ほか）
 *
 * - 「実際に写真が表示された」瞬間に 1 件記録する（表示イベント）。
 *   本人の注視・想起・記憶能力を示すものではない（docs/phase4-spec.md §4）。
 * - 本人 / 家族は uid で区別して保存する（同一レコード構造。
 *   本人の反応としての集計は分析時に members.role で結合して行う。家族の閲覧を含めない）。
 * - createdAt は serverTimestamp（サーバー時刻）。
 * - 二重記録防止: 直近 1.5 秒以内の同一 (uid + photoId + method) 記録は無視する。
 *   React StrictMode の二重マウントや連打・連続スクロールによる同一表示処理を吸収するための
 *   静的ガード。書き込み失敗時はガードを解除して、次回の表示で再試行できるようにする。
 * - 不正値・他者の記録は Security Rules が拒否する（action / method ホワイトリスト、
 *   uid 一致、自家族写真の実在確認）。
 */

export type ViewMethod = "initial" | "swipe" | "button" | "direct";

const DEDUP_WINDOW_MS = 1500;
const lastRecorded = new Map<string, number>();

/** 実際に表示された写真を記録する（表示イベント。1 表示につき 1 件） */
export async function recordPhotoViewed(
  familyId: string,
  photoId: string,
  method: ViewMethod,
): Promise<void> {
  const { auth, db } = getFirebase();
  const uid = auth.currentUser?.uid;
  if (!uid || !photoId) return;

  const key = `${uid}:${photoId}:${method}`;
  const now = Date.now();
  const prev = lastRecorded.get(key);
  if (prev !== undefined && now - prev < DEDUP_WINDOW_MS) return;
  lastRecorded.set(key, now);

  try {
    await addDoc(collection(db, "families", familyId, "photoReactions"), {
      uid,
      photoId,
      action: "photo_viewed",
      method,
      createdAt: serverTimestamp(),
    });
  } catch {
    lastRecorded.delete(key);
  }
}
