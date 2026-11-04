"use client";

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
  type Unsubscribe,
} from "firebase/firestore";
import { z } from "zod";
import { getFirebase } from "@/lib/firebase/client";

/*
 * 写真（photos）のデータアクセス層
 *
 * - 関連（人物・出来事）は links サブコレクションを正本にし、
 *   photos ドキュメントの personRefs / eventRefs 配列を検索用の弱参照として併用する。
 * - 配列の更新は必ず links の set/delete と同じバッチで行い、整合性を保つ。
 * - 読み出しは zod で検証し、要件を満たさないドキュメントは防御的に無視する。
 */

const photoSchema = z.object({
  storagePath: z.string(),
  downloadURL: z.string().url(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  addedByUid: z.string(),
  addedByRole: z.enum(["person", "family"]),
  description: z.string().nullable(),
  takenDate: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  /* 古いドキュメントが持たない場合のフォールバック → 空配列 */
  personRefs: z.array(z.string()).catch([]),
  eventRefs: z.array(z.string()).catch([]),
});

export type MemoriaPhoto = z.infer<typeof photoSchema>;

export interface PhotoSummary {
  id: string;
  data: MemoriaPhoto;
}

/* ---------- 書き込み ---------- */

export interface AddPhotoInput {
  storagePath: string;
  downloadURL: string;
  width: number | null;
  height: number | null;
  addedByUid: string;
  addedByRole: "person" | "family";
}

/** 写真 id を先に確保する（書き込みはしない。Storage パスに使う） */
export function reservePhotoId(familyId: string): string {
  const { db } = getFirebase();
  return doc(collection(db, "families", familyId, "photos")).id;
}

export async function addPhoto(familyId: string, input: AddPhotoInput): Promise<string> {
  const { db } = getFirebase();
  const now = Date.now();
  const photoRef = await addDoc(collection(db, "families", familyId, "photos"), {
    ...input,
    description: null,
    takenDate: null,
    personRefs: [],
    eventRefs: [],
    createdAt: now,
    updatedAt: now,
  });
  return photoRef.id;
}

/** 説明の補完は family ロールだけが行える（Security Rules で強制） */
export async function updatePhotoDescription(
  familyId: string,
  photoId: string,
  description: string,
) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "families", familyId, "photos", photoId), {
    description: description.slice(0, 2000),
    updatedAt: Date.now(),
  });
}

/** 撮影日の補完（任意。"YYYY-MM-DD"） */
export async function setPhotoTakenDate(familyId: string, photoId: string, takenDate: string) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "families", familyId, "photos", photoId), {
    takenDate,
    updatedAt: Date.now(),
  });
}

/* ---------- 関連付け ---------- */

export async function togglePhotoPersonLink(
  familyId: string,
  photoId: string,
  personId: string,
  linked: boolean,
) {
  const { db } = getFirebase();
  const photoRef = doc(db, "families", familyId, "photos", photoId);
  /* links ドキュメントは 1 階層。ID に種類と参照先を込める（document path は偶数セグメント必須） */
  const linkRef = doc(photoRef, "links", `person_${personId}`);
  const batch = writeBatch(db);
  if (linked) {
    batch.set(linkRef, { kind: "person", refId: personId, role: "subject", createdAt: Date.now() });
    batch.update(photoRef, {
      personRefs: arrayUnion(personId),
      updatedAt: Date.now(),
    });
  } else {
    batch.delete(linkRef);
    batch.update(photoRef, {
      personRefs: arrayRemove(personId),
      updatedAt: Date.now(),
    });
  }
  await batch.commit();
}

export async function togglePhotoEventLink(
  familyId: string,
  photoId: string,
  eventId: string,
  linked: boolean,
) {
  const { db } = getFirebase();
  const photoRef = doc(db, "families", familyId, "photos", photoId);
  const linkRef = doc(photoRef, "links", `event_${eventId}`);
  const batch = writeBatch(db);
  if (linked) {
    batch.set(linkRef, { kind: "event", refId: eventId, createdAt: Date.now() });
    batch.update(photoRef, {
      eventRefs: arrayUnion(eventId),
      updatedAt: Date.now(),
    });
  } else {
    batch.delete(linkRef);
    batch.update(photoRef, {
      eventRefs: arrayRemove(eventId),
      updatedAt: Date.now(),
    });
  }
  await batch.commit();
}

/**
 * 人物・出来事を削除するとき、写真側の参照を一括で外す。
 * writeBatch は 1 回で 500 操作まで、そのため分割する。
 */
export async function detachPersonFromAllPhotos(
  familyId: string,
  personId: string,
  photoIds: string[],
) {
  await detachRefs(familyId, "person", personId, photoIds);
}

export async function detachEventFromAllPhotos(
  familyId: string,
  eventId: string,
  photoIds: string[],
) {
  await detachRefs(familyId, "event", eventId, photoIds);
}

async function detachRefs(
  familyId: string,
  kind: "person" | "event",
  refId: string,
  photoIds: string[],
) {
  const { db } = getFirebase();
  for (let i = 0; i < photoIds.length; i += 100) {
    /* 1 件あたり 2 操作（links 削除 + 配列更新）なので 100 件ずつ */
    const batch = writeBatch(db);
    for (const photoId of photoIds.slice(i, i + 100)) {
      const photoRef = doc(db, "families", familyId, "photos", photoId);
      batch.delete(doc(photoRef, "links", `${kind}_${refId}`));
      batch.update(photoRef, {
        ...(kind === "person"
          ? { personRefs: arrayRemove(refId) }
          : { eventRefs: arrayRemove(refId) }),
        updatedAt: Date.now(),
      });
    }
    await batch.commit();
  }
}

/* ---------- 照会 ---------- */

export function watchRecentPhotos(
  familyId: string,
  count: number,
  callback: (photos: PhotoSummary[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const { db } = getFirebase();
  const q = query(
    collection(db, "families", familyId, "photos"),
    orderBy("createdAt", "desc"),
    fbLimit(count),
  );
  return subscribePhotos(q, callback, onError);
}

export function watchPhotos(
  familyId: string,
  callback: (photos: PhotoSummary[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return watchRecentPhotos(familyId, 500, callback, onError);
}

export function watchPhotosByPerson(
  familyId: string,
  personId: string,
  callback: (photos: PhotoSummary[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const { db } = getFirebase();
  const q = query(
    collection(db, "families", familyId, "photos"),
    where("personRefs", "array-contains", personId),
    orderBy("createdAt", "desc"),
    fbLimit(200),
  );
  return subscribePhotos(q, callback, onError);
}

export function watchPhotosByEvent(
  familyId: string,
  eventId: string,
  callback: (photos: PhotoSummary[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const { db } = getFirebase();
  const q = query(
    collection(db, "families", familyId, "photos"),
    where("eventRefs", "array-contains", eventId),
    orderBy("createdAt", "desc"),
    fbLimit(200),
  );
  return subscribePhotos(q, callback, onError);
}

export async function getPhoto(
  familyId: string,
  photoId: string,
): Promise<PhotoSummary | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, "families", familyId, "photos", photoId));
  if (!snap.exists()) return null;
  const parsed = photoSchema.safeParse(snap.data());
  if (!parsed.success) return null;
  return { id: snap.id, data: parsed.data };
}

/** 写真 1 枚のリアルタイム監視（詳細画面用） */
export function watchPhoto(
  familyId: string,
  photoId: string,
  callback: (photo: PhotoSummary | null) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    doc(db, "families", familyId, "photos", photoId),
    (snap) => {
      const parsed = snap.exists() ? photoSchema.safeParse(snap.data()) : null;
      callback(parsed?.success ? { id: snap.id, data: parsed.data } : null);
    },
    (err) => onError?.(err),
  );
}

/** 写真を削除する（Storage ファイルの削除は呼び出し側が行う） */
export async function deletePhotoDoc(familyId: string, photoId: string) {
  const { db } = getFirebase();
  await deleteDoc(doc(db, "families", familyId, "photos", photoId));
}

/* ---------- 内部 ---------- */

function subscribePhotos(
  q: Query<DocumentData, DocumentData>,
  callback: (photos: PhotoSummary[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    q,
    (snap) => {
      const photos: PhotoSummary[] = [];
      for (const d of snap.docs) {
        const parsed = photoSchema.safeParse(d.data());
        if (parsed.success) photos.push({ id: d.id, data: parsed.data });
      }
      callback(photos);
    },
    (err: unknown) => onError?.(err),
  );
}
