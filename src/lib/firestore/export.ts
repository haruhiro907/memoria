"use client";

import { collection, getDocs } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";

/*
 * 記録のエクスポート
 *
 * 家族がいつでも記録を持ち出せるようにするための一括読み出し。
 * 人物・出来事・写真（関連付け links 含む）・メンバーの全ドキュメントを
 * そのままの形で返す。写真の画像ファイル自体は含めないが、各写真の
 * downloadURL と storagePath が記録に残るため、たどって取得できる。
 */
export async function buildMemoriaExport(familyId: string, familyName: string | null) {
  const { db } = getFirebase();
  const base = `families/${familyId}`;

  const readAll = async (path: string) => {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const [members, people, events, photos] = await Promise.all([
    readAll(`${base}/members`),
    readAll(`${base}/people`),
    readAll(`${base}/events`),
    readAll(`${base}/photos`),
  ]);

  const photosWithLinks = [];
  for (const photo of photos) {
    const links = await readAll(`${base}/photos/${photo.id}/links`);
    photosWithLinks.push({ ...photo, links });
  }

  return {
    app: "Memoria",
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    family: { id: familyId, name: familyName },
    members,
    people,
    events,
    photos: photosWithLinks,
  };
}
