"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  watchEvent,
  updateEvent,
  deleteEventDoc,
  toggleEventPersonRef,
  type EventSummary,
} from "@/lib/firestore/event";
import { detachEventFromAllPhotos, watchPhotosByEvent, type PhotoSummary } from "@/lib/firestore/photo";
import { watchPeople, type PersonSummary } from "@/lib/firestore/person";
import { useSession } from "@/lib/auth/session";
import { PhotoTile } from "@/components/ui/PhotoTile";
import { RelationChip } from "@/components/ui/RelationChip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BigButton, BigLink } from "@/components/ui/BigButton";
import { EditIcon, HomeIcon, PersonIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatEventPeriod, isValidPreciseDate } from "@/lib/format/eventDate";
import { EventDateFields, toDateFieldsInput, type EventDateFieldsValue } from "@/components/events/EventDateFields";

/*
 * 出来事詳細（クライアント本体）
 * - タイトル・時期・説明を静かに示す。
 * - 出来事の写真・関連人物へ移動できる。
 * - 編集・削除・人物との関連付けは family ロールのみ。
 * - page.tsx（Server Component）から解決済みの eventId を受け取る。
 */

const MARK_CHOICES = ["🎊", "🎂", "🌸", "⛩", "✈", "🎓", "🏡", "👶"];

export default function EventDetailClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { familyId, role } = useSession();
  const isFamily = role === "family";

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [notFound, setNotFound] = useState(false);

  const photosState = useEventPhotos(familyId, eventId);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchEvent(
      familyId,
      eventId,
      (e) => {
        setEvent(e);
        if (!e) setNotFound(true);
      },
      () => setNotFound(true),
    );
    return () => unsub();
  }, [familyId, eventId]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPeople(familyId, setPeople, () => undefined);
    return () => unsub();
  }, [familyId]);

  const doDelete = useCallback(async () => {
    if (!familyId) return;
    setBusy(true);
    try {
      if (photosState.photos.length > 0) {
        await detachEventFromAllPhotos(
          familyId,
          eventId,
          photosState.photos.map((p) => p.id),
        );
      }
      await deleteEventDoc(familyId, eventId);
      router.push("/events");
    } catch {
      setBusy(false);
      setConfirmingDelete(false);
      setErrorText("削除できませんでした。もう一度ためしてください。");
    }
  }, [familyId, eventId, photosState.photos, router]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mt-10 rounded-card border-2 border-line bg-surface px-8 py-10 text-center text-2xl">
          この出来事は削除されたか、存在しません。
        </p>
      </div>
    );
  }

  if (!event) {
    return (
      <p className="mt-10 text-center text-2xl text-ink-soft" aria-live="polite">
        読み込み中…
      </p>
    );
  }

  const period =
    event.data.startDate && isValidPreciseDate(event.data.startDate)
      ? formatEventPeriod(event.data.startDate, event.data.endDate)
      : event.data.eraLabel;
  const linkedPeople = people.filter((p) => event.data.personRefs.includes(p.id));

  return (
    <article className="mx-auto max-w-5xl">
      <header>
        <h2 className="text-4xl font-bold">
          {event.data.icon ? `${event.data.icon} ` : ""}
          {event.data.title}
        </h2>
        {period && <p className="mt-2 text-2xl text-ink-soft">{period}</p>}
        {event.data.description && (
          <p className="mt-4 max-w-3xl whitespace-pre-line text-2xl">{event.data.description}</p>
        )}
      </header>

      {isFamily && (
        <div className="mt-6 flex flex-wrap gap-4">
          <BigButton tone="quiet" icon={<EditIcon size={20} />} onClick={() => setEditing((v) => !v)}>
            {editing ? "やめる" : "内容を直す"}
          </BigButton>
          <BigButton tone="quiet" icon={<TrashIcon size={20} />} onClick={() => setConfirmingDelete(true)}>
            出来事を削除
          </BigButton>
        </div>
      )}
      {errorText && (
        <p role="alert" className="mt-4 rounded-btn border-2 border-danger bg-danger-soft px-4 py-3 text-xl">
          {errorText}
        </p>
      )}

      {editing && (
        <EventEditForm
          key={event.data.updatedAt}
          familyId={familyId!}
          eventId={eventId}
          event={event}
          busyLabel="保存中…"
          onDone={() => setEditing(false)}
          onError={(msg) => setErrorText(msg)}
        />
      )}

      {/* 関連人物 */}
      <section className="mt-10" aria-label="この出来事の人物">
        <h3 className="text-2xl font-bold">この出来事の人物</h3>
        {linkedPeople.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {linkedPeople.map((p) => (
              <RelationChip
                key={p.id}
                kind="person"
                label={p.data.name}
                href={`/people/${p.id}`}
                onRemove={isFamily ? () => void toggleEventPersonRef(familyId!, eventId, p.id, false) : undefined}
              />
            ))}
            {isFamily && <PersonAddChips familyId={familyId!} eventId={eventId} event={event} people={people} />}
          </div>
        ) : (
          <div className="mt-3">
            {isFamily ? (
              <p className="text-xl text-ink-soft">人物を登録すると、ここにつなげられます。</p>
            ) : (
              <p className="text-xl text-ink-soft">まだ人物が登録されていません。</p>
            )}
          </div>
        )}
      </section>

      {/* この出来事の写真 */}
      <section className="mt-10" aria-label="この出来事の写真">
        <h3 className="text-2xl font-bold">この出来事の写真</h3>
        {photosState.photos.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {photosState.photos.map((p) => (
              <li key={p.id}>
                <PhotoTile
                  href={`/photos/${p.id}`}
                  src={p.data.downloadURL}
                  alt={p.data.description ?? "写真"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3">
            <EmptyState
              title="まだ写真がありません"
              note="写真を追加して、この出来事につなげましょう。"
              action={
                <BigLink href="/photos/new" tone="go">
                  写真を追加
                </BigLink>
              }
            />
          </div>
        )}
      </section>

      <div className="mt-12 flex justify-start">
        <BigButton tone="quiet" icon={<HomeIcon size={22} />} onClick={() => router.push("/events")}>
          出来事一覧へ戻る
        </BigButton>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="出来事を削除しますか？"
          body="写真からはこの出来事の関連だけが外れ、写真そのものは残ります。"
          confirmLabel="削除する"
          busy={busy}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void doDelete()}
        />
      )}
    </article>
  );
}

/* ---------- 編集フォーム（event.updatedAt を key にして初期化する） ---------- */

function EventEditForm({
  familyId,
  eventId,
  event,
  busyLabel,
  onDone,
  onError,
}: {
  familyId: string;
  eventId: string;
  event: EventSummary;
  busyLabel: string;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState(event.data.title);
  const [icon, setIcon] = useState(event.data.icon ?? "");
  const [dateFields, setDateFields] = useState<EventDateFieldsValue>({
    precision: event.data.startDate?.precision ?? null,
    start: event.data.startDate?.value ?? "",
    end: event.data.endDate?.value ?? "",
    eraLabel: event.data.eraLabel ?? "",
  });
  const [description, setDescription] = useState(event.data.description ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      onError("タイトルを入力してください。");
      return;
    }
    setBusy(true);
    try {
      await updateEvent(familyId, eventId, {
        title: trimmed,
        icon: icon || null,
        ...toDateFieldsInput(dateFields),
        description: description || null,
        personRefs: event.data.personRefs,
      });
      onDone();
    } catch {
      onError("保存できませんでした。もう一度ためしてください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mt-8 rounded-card border-2 border-line bg-surface p-6" onSubmit={(e) => void submit(e)}>
      <label className="block">
        <span className="text-2xl font-semibold">
          タイトル<span className="text-danger">（必ず）</span>
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={50}
          className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
        />
      </label>

      <div className="mt-6">
        <span className="text-2xl font-semibold">マーク</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {MARK_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setIcon(icon === c ? "" : c)}
              aria-pressed={icon === c}
              className={`min-h-14 min-w-14 rounded-btn border-2 px-3 text-3xl ${
                icon === c ? "border-go-deep bg-go-soft" : "border-line bg-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <EventDateFields value={dateFields} onChange={setDateFields} />

      <label className="mt-6 block">
        <span className="text-2xl font-semibold">説明</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
        />
      </label>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <button
          type="submit"
          disabled={busy}
          className="min-h-18 flex-1 rounded-btn bg-go-deep text-3xl font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? busyLabel : "保存する"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-18 rounded-btn bg-back-soft px-8 text-2xl font-bold text-ink underline decoration-2 underline-offset-4"
        >
          やめる
        </button>
      </div>
    </form>
  );
}

/* 追加できる人物（未連結のみ表示） */
function PersonAddChips({
  familyId,
  eventId,
  event,
  people,
}: {
  familyId: string;
  eventId: string;
  event: EventSummary;
  people: PersonSummary[];
}) {
  const unlinked = people.filter((p) => !event.data.personRefs.includes(p.id));
  if (unlinked.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-2">
      {unlinked.slice(0, 6).map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => void toggleEventPersonRef(familyId, eventId, p.id, true)}
          className="inline-flex min-h-14 items-center gap-2 rounded-btn border-2 border-dashed border-line bg-surface px-4 py-2 text-2xl text-ink-soft transition-colors hover:bg-surface-accent hover:text-ink"
          aria-label={`${p.data.name}を関連付ける`}
        >
          <PlusIcon size={18} />
          <PersonIcon size={20} />
          {p.data.name}
        </button>
      ))}
    </span>
  );
}

function useEventPhotos(familyId: string | null, eventId: string) {
  const [photos, setPhotos] = useState<PhotoSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPhotosByEvent(
      familyId,
      eventId,
      (list) => {
        setPhotos(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [familyId, eventId]);

  return { photos, loading };
}
