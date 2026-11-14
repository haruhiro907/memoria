"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteObject, ref } from "firebase/storage";
import dayjs from "dayjs";
import {
  deletePhotoDoc,
  updatePhotoDescription,
  setPhotoTakenDate,
  togglePhotoPersonLink,
  togglePhotoEventLink,
  watchPhoto,
  watchPhotos,
  type PhotoSummary,
} from "@/lib/firestore/photo";
import { watchPeople, type PersonSummary } from "@/lib/firestore/person";
import { watchEvents, type EventSummary } from "@/lib/firestore/event";
import { recordPhotoViewed } from "@/lib/firestore/reaction";
import { getFirebase } from "@/lib/firebase/client";
import { useSession } from "@/lib/auth/session";
import { PhotoTile } from "@/components/ui/PhotoTile";
import { RelationChip } from "@/components/ui/RelationChip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BigButton } from "@/components/ui/BigButton";
import { EditIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";

/*
 * 写真詳細（クライアント本体）
 *
 * - 写真が主役。台紙（白枠）に包んで大きく見せる。
 * - 本人にも見られる画面。編集操作（説明・関連付け・削除）は family ロールのみ。
 * - 関連人物・関連出来事から、次の思い出へ移動できる（記憶ネットワークの循環）。
 * - page.tsx（Server Component）から params を受け取り、Suspense 境界の中で使う。
 */

export default function PhotoDetailClient({ photoId }: { photoId: string }) {
  return <PhotoDetailBody photoId={photoId} />;
}

function PhotoDetailBody({ photoId }: { photoId: string }) {
  const router = useRouter();
  const { familyId, role } = useSession();
  const isFamily = role === "family";

  const [photo, setPhoto] = useState<PhotoSummary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPhoto(
      familyId,
      photoId,
      (p) => {
        setPhoto(p);
        if (!p) setNotFound(true);
      },
      () => setLoadError(true),
    );
    return () => unsub();
  }, [familyId, photoId]);

  /* direct: 探す以外の導線（写真詳細・地図・関連写真タイル）で実際に表示した記録 */
  useEffect(() => {
    if (!familyId || !photo) return;
    void recordPhotoViewed(familyId, photo.id, "direct");
    // photo オブジェクトはスナップショットのたびに作り直されるため id を依存にする
  }, [familyId, photo?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- photo の実体でなく id の変化だけを見る

  /* 関連 people/events の一覧（連付先選択用） */
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);

  useEffect(() => {
    if (!familyId) return;
    const u1 = watchPeople(familyId, setPeople);
    const u2 = watchEvents(familyId, setEvents);
    return () => {
      u1();
      u2();
    };
  }, [familyId]);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const removePhoto = useCallback(async () => {
    if (!photo || !familyId) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      try {
        await deleteObject(ref(getFirebase().storage, photo.data.storagePath));
      } catch {
        /* Storage の削除に失敗しても、ドキュメント削除は続行する（孤立ファイルは将来一括整理） */
      }
      await deletePhotoDoc(familyId, photo.id);
      router.push("/photos");
    } catch {
      /* 失敗を無言で閉じない（家族が成否を誤認しないように画面に残す） */
      setDeleting(false);
      setConfirmingDelete(false);
      setDeleteError(true);
    }
  }, [photo, familyId, router]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mt-10 rounded-card border-2 border-line bg-surface px-8 py-12 text-center text-2xl">
          この写真はもう削除されたか、存在しません。
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mt-10 rounded-card border-2 border-danger bg-danger-soft px-8 py-12 text-center text-2xl">
          写真を読み込めませんでした。通信をご確認ください。
        </p>
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

  const addedLabel = `${dayjs(photo.data.createdAt).format("YYYY年M月D日")} に追加`;

  return (
    <article className="mx-auto max-w-5xl">
      {/* 主役: 写真 */}
      <figure className="rounded-card bg-white p-3 ring-2 ring-inset ring-line sm:p-4">
        { }
        <img
          src={photo.data.downloadURL}
          alt={photo.data.description ?? "写真"}
          className="mx-auto max-h-[62vh] rounded-xl object-contain"
        />
      </figure>
      <p className="mt-3 text-center text-xl text-ink-soft">
        {photo.data.takenDate
          ? `${toJpDate(photo.data.takenDate)} の写真・${addedLabel}`
          : addedLabel}
      </p>

      {isFamily && (
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <DescriptionEditor
            familyId={familyId!}
            photoId={photo.id}
            initial={photo.data.description ?? ""}
          />
          <TakenDateEditor
            familyId={familyId!}
            photoId={photo.id}
            initial={photo.data.takenDate ?? ""}
          />
          <BigButton
            tone="quiet"
            icon={<TrashIcon size={20} />}
            onClick={() => setConfirmingDelete(true)}
            aria-label="この写真を削除する"
          >
            写真を削除
          </BigButton>
        </div>
      )}

      {photo.data.description && (
        <p className="mx-auto mt-6 max-w-3xl whitespace-pre-line break-words text-2xl">
          {photo.data.description}
        </p>
      )}

      <LinkSection
        kind="person"
        familyId={familyId}
        linkedIds={photo.data.personRefs}
        allLabels={[
          ...people.map((p) => ({ id: p.id, label: p.data.name, href: `/people/${p.id}` })),
        ]}
        emptyNote="人物を登録すると、ここにつなげられます。"
        isFamily={isFamily}
        onToggle={(pid, linked) => void togglePhotoPersonLink(familyId!, photo.id, pid, linked)}
      />

      <LinkSection
        kind="event"
        familyId={familyId}
        linkedIds={photo.data.eventRefs}
        allLabels={[...events.map((e) => ({ id: e.id, label: e.data.title, href: `/events/${e.id}` }))]}
        emptyNote="出来事を登録すると、ここにつなげられます。"
        isFamily={isFamily}
        onToggle={(eid, linked) => void togglePhotoEventLink(familyId!, photo.id, eid, linked)}
      />

      <RelatedPhotos familyId={familyId} photo={photo} />

      {deleteError && (
        <p role="alert" className="mt-6 rounded-btn border-2 border-danger bg-danger-soft px-4 py-3 text-center text-xl">
          写真を削除できませんでした。通信を確認して、もう一度ためしてください。
        </p>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="写真を削除しますか？"
          body="削除すると、元に戻せません。"
          confirmLabel="削除する"
          busy={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void removePhoto()}
        />
      )}
    </article>
  );
}

/* ---------- 編集: 説明 ---------- */

function DescriptionEditor({
  familyId,
  photoId,
  initial,
}: {
  familyId: string;
  photoId: string;
  initial: string;
}) {
  /* initial が変わるたびに state を初期化したいので、key で切り替える */
  return <DescriptionEditorInner key={initial} familyId={familyId} photoId={photoId} initial={initial} />;
}

function DescriptionEditorInner({
  familyId,
  photoId,
  initial,
}: {
  familyId: string;
  photoId: string;
  initial: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updatePhotoDescription(familyId, photoId, value);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <BigButton tone="quiet" icon={<EditIcon size={20} />} onClick={() => setOpen(true)}>
        説明を書く・直す
      </BigButton>
    );
  }

  return (
    <div className="w-full rounded-card border-2 border-line bg-surface p-4">
      <label className="block text-xl font-semibold">
        説明（例: 息子の結婚式。〇〇と〇〇）
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-3 text-2xl"
        />
      </label>
      <div className="mt-3 flex gap-3">
        <BigButton tone="go" disabled={saving} onClick={() => void save()}>
          保存する
        </BigButton>
        <BigButton tone="quiet" onClick={() => setOpen(false)}>
          やめる
        </BigButton>
      </div>
    </div>
  );
}

/* ---------- 編集: 撮影日 ---------- */

function TakenDateEditor({
  familyId,
  photoId,
  initial,
}: {
  familyId: string;
  photoId: string;
  initial: string;
}) {
  return <TakenDateEditorInner key={initial} familyId={familyId} photoId={photoId} initial={initial} />;
}

function TakenDateEditorInner({
  familyId,
  photoId,
  initial,
}: {
  familyId: string;
  photoId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  return (
    <div className="inline-flex items-center gap-2 rounded-btn border-2 border-line bg-surface px-4 py-3">
      <label className="text-xl font-semibold">
        撮影日（わかる場合）
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="ml-3 rounded-btn border-2 border-line bg-white px-3 py-2 text-xl"
        />
      </label>
      <BigButton
        tone="quiet"
        disabled={saving}
        className="px-5"
        onClick={() => {
          setSaving(true);
          setPhotoTakenDate(familyId, photoId, value || "")
            .catch(() => undefined)
            .finally(() => setSaving(false));
        }}
      >
        保存
      </BigButton>
    </div>
  );
}

/* ---------- 関連付け ---------- */

interface LinkSectionProps {
  kind: "person" | "event";
  familyId: string | null;
  linkedIds: string[];
  allLabels: { id: string; label: string; href: string }[];
  emptyNote: string;
  isFamily: boolean;
  onToggle: (id: string, linked: boolean) => void;
}

function LinkSection({ kind, familyId, linkedIds, allLabels, emptyNote, isFamily, onToggle }: LinkSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const linked = allLabels.filter((l) => linkedIds.includes(l.id));
  const pickable = allLabels.filter((l) => !linkedIds.includes(l.id));
  const sectionTitle = kind === "person" ? "この写真の人物" : "この写真の出来事";
  const pickLabel = kind === "person" ? "人物を関連付ける" : "出来事を関連付ける";
  const newPath = kind === "person" ? "/people/new" : "/events/new";
  const newLabel = kind === "person" ? "新しい人物を登録" : "新しい出来事を登録";

  return (
    <section className="mt-10" aria-label={sectionTitle}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-2xl font-bold">{sectionTitle}</h3>
        {isFamily && familyId && (
          <BigButton tone="quiet" icon={<PlusIcon size={20} />} onClick={() => setPickerOpen((v) => !v)}>
            {pickerOpen ? "とじる" : pickLabel}
          </BigButton>
        )}
      </div>

      {linked.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {linked.map((l) => (
            <RelationChip
              key={l.id}
              kind={kind}
              label={l.label}
              href={l.href}
              onRemove={isFamily ? () => onToggle(l.id, false) : undefined}
            />
          ))}
        </div>
      )}

      {linked.length === 0 && (
        <p className="mt-3 text-xl text-ink-soft">{emptyNote}</p>
      )}

      {pickerOpen && (
        <div className="mt-4 rounded-card border-2 border-line bg-surface p-6">
          {pickable.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pickable.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-btn bg-surface-accent px-4 py-3">
                  <span className="truncate text-2xl">{l.label}</span>
                  <BigButton
                    tone="go"
                    onClick={() => onToggle(l.id, true)}
                    aria-label={`${l.label}を関連付ける`}
                  >
                    つなげる
                  </BigButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xl text-ink-soft">つなげられるものがまだありません。</p>
          )}
          <div className="mt-5">
            <Link
              href={newPath}
              className="inline-flex items-center gap-2 rounded-btn bg-back-soft px-5 py-3 text-xl font-semibold underline decoration-2 underline-offset-4"
            >
              <PlusIcon size={20} />
              {newLabel}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- 関連写真 ---------- */

function RelatedPhotos({ familyId, photo }: { familyId: string | null; photo: PhotoSummary }) {
  const related = useRelatedPhotos(familyId, photo);
  const items = related.filter((p) => p.id !== photo.id).slice(0, 12);

  if (items.length === 0) return null;

  return (
    <section className="mt-10" aria-label="関連する写真">
      <h3 className="text-2xl font-bold">つながる写真</h3>
      <ul className="mt-4 flex snap-x gap-4 overflow-x-auto pb-4">
        {items.map((p) => (
          <li key={p.id} className="w-56 shrink-0 snap-start">
            <PhotoTile
              href={`/photos/${p.id}`}
              src={p.data.downloadURL}
              alt={p.data.description ?? "関連写真"}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/*
 * この写真と同じ人物・出来事を含む写真の集まり。
 * MVP: 最新 500 枚を購読して、フロント側で共通参照を結合する。
 * （件数が増えたら server 側の複合検索へ移行する）
 */
function useRelatedPhotos(familyId: string | null, photo: PhotoSummary): PhotoSummary[] {
  const [all, setAll] = useState<PhotoSummary[]>([]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPhotos(
      familyId,
      setAll,
      () => undefined,
    );
    return () => unsub();
  }, [familyId]);

  return useMemo(() => {
    const personSet = new Set(photo.data.personRefs);
    const eventSet = new Set(photo.data.eventRefs);
    return all
      .filter(
        (p) =>
          p.id !== photo.id &&
          (p.data.personRefs.some((r) => personSet.has(r)) ||
            p.data.eventRefs.some((r) => eventSet.has(r))),
      )
      .sort((a, b) => b.data.createdAt - a.data.createdAt);
  }, [all, photo]);
}

function toJpDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((s) => Number(s));
  if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) return `${y}年${m}月${d}日`;
  return iso;
}
