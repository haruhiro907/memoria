"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { watchPhotos, type PhotoSummary } from "@/lib/firestore/photo";
import { watchPeople, type PersonSummary } from "@/lib/firestore/person";
import { watchEvents, type EventSummary } from "@/lib/firestore/event";
import { recordPhotoViewed } from "@/lib/firestore/reaction";
import { useSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/EmptyState";
import { BigButton, BigLink } from "@/components/ui/BigButton";
import { RelationChip } from "@/components/ui/RelationChip";
import { AlertIcon } from "@/components/ui/icons";

/*
 * 思い出を探す（/explore）
 *
 * - 写真 1 枚が主役の没入画面。追加の新しい順（createdAt 降順・上限 500 枚）でたどる。
 * - 左右スワイプ ＋ 下の大ボタンの両方でめくれる（スワイプ強制なし）。
 * - タップで写真詳細へ。上部の静かなチップで人物・出来事へ移動できる。
 * - 最後まで進むと「最初からもう一度」。自動送り・自動遷移はしない。
 * - 実際に表示された写真を photoReactions に記録する:
 *   initial = 画面を開いて最初に表示した 1 枚 / swipe = スワイプでの切替 /
 *   button = 大ボタンでの切替 / direct = 写真詳細・地図など他の導線での表示。
 * - 見ている枚（位置）は sessionStorage に覚えておき、写真詳細などへ
 *   行って戻ったときに元の位置でもう一度見られる。
 * - 本人と家族は同じ画面を使う。差分はボタンの有無だけ（共通画面の原則）。
 */

const INDEX_STORAGE_KEY = "memoria.explore.index";
const SWIPE_THRESHOLD_PX = 48;

export default function ExplorePage() {
  const router = useRouter();
  const { familyId } = useSession();

  const [photos, setPhotos] = useState<PhotoSummary[] | null>(null);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(false);

  /* 位置の復元は、写真一覧が届いてから 1 回だけ行う */
  const restoredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPhotos(familyId, setPhotos, () => setError(true));
    return () => unsub();
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    const u1 = watchPeople(familyId, setPeople, () => undefined);
    const u2 = watchEvents(familyId, setEvents, () => undefined);
    return () => {
      u1();
      u2();
    };
  }, [familyId]);

  /* 一覧が届いたら、前回見ていた枚（あれば）から開き、その 1 枚を initial として記録する。
     記録位置は復元後の枚にする必要があるため、復元と initial 記録を 1 つの effect で行う
     （分けると index 初期値 0 の写真を initial にしてしまう） */
  useEffect(() => {
    if (!photos || photos.length === 0 || restoredRef.current) return;
    restoredRef.current = true;
    let start = 0;
    try {
      const saved = Number(sessionStorage.getItem(INDEX_STORAGE_KEY));
      if (Number.isInteger(saved) && saved >= 0 && saved < photos.length) start = saved;
    } catch {
      /* sessionStorage が使えない環境では先頭から */
    }
    setIndex(start);
    if (familyId) void recordPhotoViewed(familyId, photos[start].id, "initial");
  }, [photos, familyId]);

  /* 写真が減ったときの越境は描画側で収める（state は「いちばん上で選んだ位置」のまま） */
  const safeIndex =
    photos && photos.length > 0 ? Math.min(index, photos.length - 1) : 0;

  const photo = photos?.[safeIndex] ?? null;

  /** 指定の枚を表示して記録する（切替のたび 1 件） */
  const show = (nextIndex: number, method: "swipe" | "button") => {
    if (!familyId || !photos) return;
    const next = photos[nextIndex];
    if (!next) return;
    setIndex(nextIndex);
    try {
      sessionStorage.setItem(INDEX_STORAGE_KEY, String(nextIndex));
    } catch {
      /* 記憶できなくても閲覧は続く */
    }
    void recordPhotoViewed(familyId, next.id, method);
  };

  /* スワイプ: 横に一定量動いたらめくる。縦方向や小さな動き（タップ）は無視 */
  const onPointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0 && photos && safeIndex < photos.length - 1) show(safeIndex + 1, "swipe");
    if (dx > 0 && safeIndex > 0) show(safeIndex - 1, "swipe");
  };

  if (photos === null && !error) {
    return (
      <p className="mt-10 text-center text-2xl text-ink-soft" aria-live="polite">
        読み込み中…
      </p>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mt-8 flex items-start gap-3 rounded-card border-2 border-danger bg-danger-soft p-5">
          <AlertIcon size={28} className="mt-1 shrink-0 text-danger" />
          <p className="text-2xl">写真を読み込めませんでした。通信をご確認ください。</p>
        </div>
      </div>
    );
  }

  if (photos !== null && photos.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mt-8">
          <EmptyState
            title="写真がまだありません"
            note="写真をえらんで追加すると、アルバムのようにたどれます。"
            action={
              <BigLink href="/photos/new" tone="go">
                写真を追加
              </BigLink>
            }
          />
        </div>
      </div>
    );
  }

  if (!photo) {
    return (
      <p className="mt-10 text-center text-2xl text-ink-soft" aria-live="polite">
        読み込み中…
      </p>
    );
  }

  const linkedPeople = photo.data.personRefs
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is PersonSummary => Boolean(p));
  const linkedEvents = photo.data.eventRefs
    .map((id) => events.find((e) => e.id === id))
    .filter((e): e is EventSummary => Boolean(e));
  const isLast = safeIndex === photos!.length - 1;
  const singlePhoto = photos!.length === 1;

  return (
    <div className="mx-auto max-w-5xl">
      {/* つながる人物・出来事（静かに表示。該当なしのときは何も出さない） */}
      {(linkedPeople.length > 0 || linkedEvents.length > 0) && (
        <div
          className="flex flex-wrap gap-3"
          aria-label="つながる人物・出来事"
        >
          {linkedPeople.map((p) => (
            <RelationChip key={p.id} kind="person" label={p.data.name} href={`/people/${p.id}`} />
          ))}
          {linkedEvents.map((e) => (
            <RelationChip key={e.id} kind="event" label={e.data.title} href={`/events/${e.id}`} />
          ))}
        </div>
      )}

      {/* 主役: 写真。タップで詳細へ。横に払ってめくれる */}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={() => router.push(`/photos/${photo.id}`)}
        aria-label="写真を見る。タップでくわしく見る"
        className="mt-4 block w-full cursor-pointer touch-pan-y rounded-card bg-white p-3 ring-2 ring-inset ring-line sm:p-4"
      >
        <img
          src={photo.data.downloadURL}
          alt={photo.data.description ?? "思い出の写真"}
          draggable={false}
          className="mx-auto max-h-[52vh] rounded-xl object-contain"
        />
      </button>

      <p className="mt-4 text-center text-xl text-ink-soft" aria-live="polite">
        {safeIndex + 1} / {photos!.length} 枚め
        {photo.data.takenDate ? `・${takenJp(photo.data.takenDate)} の写真` : ""}
      </p>

      <div className="mt-6 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center">
        <BigButton
          tone="primary"
          disabled={safeIndex === 0}
          onClick={() => show(safeIndex - 1, "button")}
          className="sm:min-w-64"
        >
          まえの写真
        </BigButton>
        {isLast && !singlePhoto ? (
          <BigButton
            tone="go"
            onClick={() => show(0, "button")}
            className="sm:min-w-64"
          >
            最初からもう一度
          </BigButton>
        ) : (
          <BigButton
            tone="go"
            disabled={singlePhoto}
            onClick={() => show(safeIndex + 1, "button")}
            className="sm:min-w-64"
          >
            つぎの写真
          </BigButton>
        )}
      </div>

      <p className="mt-10 text-center text-lg text-ink-soft">
        横に払っても、ボタンでも、動かせます。
      </p>
    </div>
  );
}

function takenJp(iso: string): string {
  const [y, m, d] = iso.split("-").map((s) => Number(s));
  if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) return `${y}年${m}月${d}日`;
  return iso;
}
