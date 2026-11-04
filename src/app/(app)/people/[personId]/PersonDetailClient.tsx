"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  watchPerson,
  updatePerson,
  deletePersonDoc,
  type PersonSummary,
} from "@/lib/firestore/person";
import { detachPersonFromAllPhotos, watchPhotosByPerson, type PhotoSummary } from "@/lib/firestore/photo";
import { watchEvents, type EventSummary } from "@/lib/firestore/event";
import { useSession } from "@/lib/auth/session";
import { uploadPersonPhoto } from "@/lib/firebase/upload";
import { PersonForm, type PersonFormValues } from "@/components/person/PersonForm";
import { PhotoTile } from "@/components/ui/PhotoTile";
import { RelationChip } from "@/components/ui/RelationChip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BigButton, BigLink } from "@/components/ui/BigButton";
import { CakeIcon, EditIcon, HomeIcon, PersonIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import dayjs from "dayjs";

/*
 * 人物詳細（クライアント本体）
 * - 顔写真が主役。名前・誕生日・メモを静かに添える。
 * - この人物の写真・出来事へ移動できる（記憶ネットワーク）。
 * - 編集・削除は家族のみ。
 * - page.tsx（Server Component）から解決済みの personId を受け取る。
 */

export default function PersonDetailClient({ personId }: { personId: string }) {
  const router = useRouter();
  const { familyId, role } = useSession();
  const isFamily = role === "family";

  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [notFound, setNotFound] = useState(false);

  const photosState = usePersonPhotos(familyId, personId);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPerson(
      familyId,
      personId,
      (p) => {
        setPerson(p);
        if (!p) setNotFound(true);
      },
      () => setNotFound(true),
    );
    return () => unsub();
  }, [familyId, personId]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchEvents(familyId, setEvents, () => undefined);
    return () => unsub();
  }, [familyId]);

  const linkedEvents = events.filter((e) => e.data.personRefs.includes(personId));

  const submitEdit = useCallback(
    async (values: PersonFormValues) => {
      if (!familyId) return;
      setBusy(true);
      setErrorText(null);
      try {
        let photoURL: string | null = person?.data.photoURL ?? null;
        if (values.photoFile) {
          photoURL = await uploadPersonPhoto(familyId, values.photoFile);
        }
        await updatePerson(familyId, personId, {
          name: values.name,
          photoURL,
          birthday: values.birthday || null,
          note: values.note || null,
        });
        setEditing(false);
      } catch {
        setErrorText("保存できませんでした。もう一度ためしてください。");
      } finally {
        setBusy(false);
      }
    },
    [familyId, personId, person],
  );

  const doDelete = useCallback(async () => {
    if (!familyId) return;
    setBusy(true);
    try {
      if (photosState.photos.length > 0) {
        await detachPersonFromAllPhotos(
          familyId,
          personId,
          photosState.photos.map((p) => p.id),
        );
      }
      await deletePersonDoc(familyId, personId);
      router.push("/people");
    } catch {
      setBusy(false);
      setConfirmingDelete(false);
      setErrorText("削除できませんでした。もう一度ためしてください。");
    }
  }, [familyId, personId, photosState.photos, router]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mt-10 rounded-card border-2 border-line bg-surface px-8 py-10 text-center text-2xl">
          この人物は削除されたか、存在しません。
        </p>
      </div>
    );
  }

  if (!person) {
    return (
      <p className="mt-10 text-center text-2xl text-ink-soft" aria-live="polite">
        読み込み中…
      </p>
    );
  }

  return (
    <article className="mx-auto max-w-5xl">
      <div className="sm:flex sm:items-start sm:gap-10">
        {/* 顔写真が主役 */}
        <div className="mx-auto w-56 shrink-0 rounded-card bg-white p-2 ring-2 ring-inset ring-line sm:mx-0 sm:w-64">
          {person.data.photoURL ? (

            <img
              src={person.data.photoURL}
              alt={person.data.name}
              className="aspect-square w-full rounded-xl object-cover"
            />
          ) : (
            <span className="flex aspect-square w-full items-center justify-center rounded-xl bg-surface-accent text-ink-soft">
              <PersonIcon size={72} />
            </span>
          )}
        </div>

        <div className="mt-6 flex-1 sm:mt-0">
          <h2 className="text-4xl font-bold">{person.data.name}</h2>
          {person.data.birthday && (
            <p className="mt-3 flex items-center gap-2 text-2xl text-ink">
              <CakeIcon size={24} className="text-ink-soft" />
              {dayjs(person.data.birthday).format("YYYY年M月D日")} 生まれ
            </p>
          )}
          {person.data.note && (
            <p className="mt-3 whitespace-pre-line text-2xl text-ink-soft">{person.data.note}</p>
          )}

          {isFamily && (
            <div className="mt-6 flex flex-wrap gap-4">
              <BigButton tone="quiet" icon={<EditIcon size={20} />} onClick={() => setEditing((v) => !v)}>
                {editing ? "やめる" : "見えている情報を直す"}
              </BigButton>
              <BigButton tone="quiet" icon={<TrashIcon size={20} />} onClick={() => setConfirmingDelete(true)}>
                人物を削除
              </BigButton>
            </div>
          )}
          {errorText && (
            <p role="alert" className="mt-4 rounded-btn border-2 border-danger bg-danger-soft px-4 py-3 text-xl">
              {errorText}
            </p>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-8">
          <PersonForm
            initial={{
              name: person.data.name,
              photoURL: person.data.photoURL,
              birthday: person.data.birthday ?? "",
              note: person.data.note ?? "",
            }}
            submitLabel="保存する"
            busy={busy}
            busyLabel="保存中…"
            onSubmit={(v) => void submitEdit(v)}
          />
        </div>
      )}

      {/* この人物の出来事 */}
      <section className="mt-10" aria-label="この人物の出来事">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-2xl font-bold">この人物の出来事</h3>
          {isFamily && (
            <BigLink href="/events/new" tone="quiet" icon={<PlusIcon size={20} />}>
              新しい出来事を登録
            </BigLink>
          )}
        </div>
        {linkedEvents.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {linkedEvents.map((e) => (
              <RelationChip key={e.id} kind="event" label={e.data.title} href={`/events/${e.id}`} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xl text-ink-soft">
            まだ出来事がありません。写真に出来事をつなげると、ここに現れます。
          </p>
        )}
      </section>

      {/* この人物の写真 */}
      <section className="mt-10" aria-label="この人物の写真">
        <h3 className="text-2xl font-bold">この人物の写真</h3>
        {photosState.error && (
          <p className="mt-3 rounded-card border-2 border-danger bg-danger-soft p-4 text-xl">
            写真の一覧を読み込めませんでした。
          </p>
        )}
        {photosState.photos.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {photosState.photos.map((p) => (
              <li key={p.id}>
                <PhotoTile
                  href={`/photos/${p.id}`}
                  src={p.data.downloadURL}
                  alt={p.data.description ?? "写真"}
                  caption={p.data.description ? null : dayjs(p.data.createdAt).format("YYYY年M月") }
                />
              </li>
            ))}
          </ul>
        ) : (
          !photosState.loading && (
            <p className="mt-3 text-xl text-ink-soft">まだ写真がありません。写真の詳細から「つなげる」ことができます。</p>
          )
        )}
      </section>

      <div className="mt-12 flex justify-start">
        <BigButton tone="quiet" icon={<HomeIcon size={22} />} onClick={() => router.push("/people")}>
          人物一覧へ戻る
        </BigButton>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title={`${person.data.name} さんを削除しますか？`}
          body="写真からはこの人の関連だけが外れ、写真そのものは残ります。"
          confirmLabel="削除する"
          busy={busy}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void doDelete()}
        />
      )}
    </article>
  );
}

function usePersonPhotos(familyId: string | null, personId: string) {
  const [photos, setPhotos] = useState<PhotoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPhotosByPerson(
      familyId,
      personId,
      (list) => {
        setPhotos(list);
        setLoading(false);
        setError(false);
      },
      () => {
        setLoading(false);
        setError(true);
      },
    );
    return () => unsub();
  }, [familyId, personId]);

  return { photos, loading, error };
}
