"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { z } from "zod";
import { getFirebase } from "@/lib/firebase/client";

/*
 * 人物（people）のデータアクセス層
 * 削除時は写真側の関連（personRefs / links）を photo.ts の helper で外してから削除する。
 */

const personSchema = z.object({
  name: z.string().min(1),
  photoURL: z.string().url().nullable().catch(null),
  birthday: z.string().nullable(),
  note: z.string().nullable(),
  addedByUid: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type MemoriaPerson = z.infer<typeof personSchema>;

export interface PersonSummary {
  id: string;
  data: MemoriaPerson;
}

/* ---------- 書き込み ---------- */

export interface PersonInput {
  name: string;
  photoURL: string | null;
  birthday: string | null;
  note: string | null;
}

export async function createPerson(
  familyId: string,
  input: PersonInput,
  addedByUid: string,
): Promise<string> {
  const { db } = getFirebase();
  const now = Date.now();
  const ref = await addDoc(collection(db, "families", familyId, "people"), {
    ...input,
    name: input.name.trim().slice(0, 30),
    note: input.note?.slice(0, 1000) ?? null,
    addedByUid,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updatePerson(
  familyId: string,
  personId: string,
  input: PersonInput,
) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "families", familyId, "people", personId), {
    name: input.name.trim().slice(0, 30),
    photoURL: input.photoURL,
    birthday: input.birthday,
    note: input.note?.slice(0, 1000) ?? null,
    updatedAt: Date.now(),
  });
}

export async function deletePersonDoc(familyId: string, personId: string) {
  const { db } = getFirebase();
  await deleteDoc(doc(db, "families", familyId, "people", personId));
}

/* ---------- 照会 ---------- */

export function watchPeople(
  familyId: string,
  callback: (people: PersonSummary[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const { db } = getFirebase();
  const q = query(
    collection(db, "families", familyId, "people"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const people: PersonSummary[] = [];
      for (const d of snap.docs) {
        const parsed = personSchema.safeParse(d.data());
        if (parsed.success) people.push({ id: d.id, data: parsed.data });
      }
      callback(people);
    },
    (err) => onError?.(err),
  );
}

export async function getPerson(
  familyId: string,
  personId: string,
): Promise<PersonSummary | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, "families", familyId, "people", personId));
  if (!snap.exists()) return null;
  const parsed = personSchema.safeParse(snap.data());
  if (!parsed.success) return null;
  return { id: snap.id, data: parsed.data };
}

/** 人物 1 人のリアルタイム監視（詳細・編集画面用） */
export function watchPerson(
  familyId: string,
  personId: string,
  callback: (person: PersonSummary | null) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    doc(db, "families", familyId, "people", personId),
    (snap) => {
      const parsed = snap.exists() ? personSchema.safeParse(snap.data()) : null;
      callback(parsed?.success ? { id: snap.id, data: parsed.data } : null);
    },
    (err) => onError?.(err),
  );
}
