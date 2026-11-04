"use client";

import {
  addDoc,
  arrayRemove,
  arrayUnion,
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
import { isValidPreciseDate } from "@/lib/format/eventDate";
import type { PreciseDate } from "@/types/models";

/*
 * 出来事（events）のデータアクセス層（events v2）
 * - 日付は { value, precision } の精度付き構造（day / month / year）。
 *   月日を推測で補わないため、表示・整列は format/eventDate.ts のヘルパーに統一する。
 * - eraLabel は年が特定できないときの自由表現（「子どもの頃」など）。
 * - 削除時は写真側の関連（eventRefs / links）を photo.ts の helper で外してから削除する。
 */

const preciseDateSchema = z
  .union([
    z
      .object({
        value: z.string(),
        precision: z.enum(["day", "month", "year"]),
      })
      .refine(isValidPreciseDate, { message: "value と precision の整合が不正" }),
    z.null(),
  ])
  .catch(null);

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  startDate: preciseDateSchema,
  endDate: preciseDateSchema,
  eraLabel: z.string().nullable().catch(null),
  icon: z.string().nullable(),
  personRefs: z.array(z.string()).catch([]),
  addedByUid: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type MemoriaEvent = z.infer<typeof eventSchema>;

export interface EventSummary {
  id: string;
  data: MemoriaEvent;
}

/* ---------- 書き込み ---------- */

export interface EventInput {
  title: string;
  description: string | null;
  startDate: PreciseDate | null;
  endDate: PreciseDate | null;
  eraLabel: string | null;
  icon: string | null;
  personRefs: string[];
}

export async function createEvent(
  familyId: string,
  input: EventInput,
  addedByUid: string,
): Promise<string> {
  const { db } = getFirebase();
  const now = Date.now();
  const ref = await addDoc(collection(db, "families", familyId, "events"), {
    ...input,
    title: input.title.trim().slice(0, 50),
    description: input.description?.slice(0, 2000) ?? null,
    eraLabel: input.eraLabel?.slice(0, 30) ?? null,
    addedByUid,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateEvent(
  familyId: string,
  eventId: string,
  input: EventInput,
) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "families", familyId, "events", eventId), {
    ...input,
    title: input.title.trim().slice(0, 50),
    description: input.description?.slice(0, 2000) ?? null,
    eraLabel: input.eraLabel?.slice(0, 30) ?? null,
    updatedAt: Date.now(),
  });
}

export async function deleteEventDoc(familyId: string, eventId: string) {
  const { db } = getFirebase();
  await deleteDoc(doc(db, "families", familyId, "events", eventId));
}

/** 出来事と人物の関連付け（events.personRefs を更新する。人物側の検索に使う） */
export async function toggleEventPersonRef(
  familyId: string,
  eventId: string,
  personId: string,
  linked: boolean,
) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "families", familyId, "events", eventId), {
    personRefs: linked ? arrayUnion(personId) : arrayRemove(personId),
    updatedAt: Date.now(),
  });
}

/* ---------- 照会 ---------- */

export function watchEvents(
  familyId: string,
  callback: (events: EventSummary[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const { db } = getFirebase();
  const q = query(
    collection(db, "families", familyId, "events"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const events: EventSummary[] = [];
      for (const d of snap.docs) {
        const parsed = eventSchema.safeParse(d.data());
        if (parsed.success) events.push({ id: d.id, data: parsed.data });
      }
      callback(events);
    },
    (err) => onError?.(err),
  );
}

export async function getEvent(
  familyId: string,
  eventId: string,
): Promise<EventSummary | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, "families", familyId, "events", eventId));
  if (!snap.exists()) return null;
  const parsed = eventSchema.safeParse(snap.data());
  if (!parsed.success) return null;
  return { id: snap.id, data: parsed.data };
}

/** 出来事 1 件のリアルタイム監視（詳細画面用） */
export function watchEvent(
  familyId: string,
  eventId: string,
  callback: (event: EventSummary | null) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    doc(db, "families", familyId, "events", eventId),
    (snap) => {
      const parsed = snap.exists() ? eventSchema.safeParse(snap.data()) : null;
      callback(parsed?.success ? { id: snap.id, data: parsed.data } : null);
    },
    (err) => onError?.(err),
  );
}
