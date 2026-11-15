"use client";

import { useEffect, useState } from "react";
import { watchPhotos, type PhotoSummary } from "@/lib/firestore/photo";
import { useSession } from "@/lib/auth/session";
import { PhotoTile } from "@/components/ui/PhotoTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { BigLink } from "@/components/ui/BigButton";
import { CameraIcon } from "@/components/ui/icons";
import dayjs from "dayjs";

/*
 * 写真一覧
 * 新しく追加された順に大きなタイルで並べる。写真が主役の画面。
 */

export default function PhotosPage() {
  const { familyId, role } = useSession();
  const [photos, setPhotos] = useState<PhotoSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPhotos(
      familyId,
      (list) => {
        setPhotos(list);
        setError(false);
      },
      () => setError(true),
    );
    return () => unsub();
  }, [familyId]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">写真</h2>
        <div className="flex items-center gap-3">
          {role === "family" && (
            <BigLink href="/reflections" tone="quiet">
              ふりかえり
            </BigLink>
          )}
          {familyId && (
            <BigLink href="/photos/new" tone="go" icon={<CameraIcon size={30} />}>
              写真を追加
            </BigLink>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-8 rounded-card border-2 border-danger bg-danger-soft p-6 text-2xl">
          写真の一覧を読み込めませんでした。通信をご確認ください。
        </div>
      )}

      {photos && photos.length === 0 && (
        <div className="mt-8">
          <EmptyState
            title="写真がまだありません"
            note="最初の 1 枚を追加すると、ここに並びます。"
            action={
              <BigLink href="/photos/new" tone="go" icon={<CameraIcon size={30} />}>
                写真を追加
              </BigLink>
            }
          />
        </div>
      )}

      {(photos?.length ?? 0) > 0 && (
        <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {(photos ?? []).map((p) => (
            <li key={p.id}>
              <PhotoTile
                href={`/photos/${p.id}`}
                src={p.data.downloadURL}
                alt={p.data.description ?? "写真"}
                caption={p.data.description ?? formatAddedAt(p.data.createdAt)}
              />
            </li>
          ))}
        </ul>
      )}

      {!photos && !error && (
        <p className="mt-10 text-center text-2xl text-ink-soft" aria-live="polite">
          読み込み中…
        </p>
      )}
    </div>
  );
}

function formatAddedAt(createdAt: number): string {
  return `${dayjs(createdAt).format("M月D日")}に追加`;
}
