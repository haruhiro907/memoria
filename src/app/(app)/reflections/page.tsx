"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { useSession } from "@/lib/auth/session";
import { watchMembers, type MemberSummary } from "@/lib/firestore/member";
import { watchPhotos, type PhotoSummary } from "@/lib/firestore/photo";
import { fetchRecentReactions, type ReactionRecord } from "@/lib/firestore/reflection";
import { PhotoTile } from "@/components/ui/PhotoTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { BigLink } from "@/components/ui/BigButton";

/**
 * ふりかえり（家族向け / photoReactions の出口）
 *
 * 本人が写真を「実際に見た」記録（表示イベント）を家族に返す画面。
 * - 集計は本人の記録だけ（members の role === "person" の uid と結合し、
 *   家族自身の閲覧は混ぜない。docs/phase4-spec.md §4）。
 * - 表示イベントは本人の記憶・反応の良し悪しを測るものではない。
 *   その旨を画面にも明記し、「よく見ている写真・時代」を家族の
 *   次の声かけや写真選びの手がかりとして返す。
 * - 本人（person ロール）には管理・分析の画面は出さない（設定画面と同じ型）。
 */
export default function ReflectionsPage() {
  const { familyId, role } = useSession();
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [photos, setPhotos] = useState<PhotoSummary[] | null>(null);
  const [reactions, setReactions] = useState<ReactionRecord[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    const u1 = watchMembers(familyId, setMembers, () => setError(true));
    const u2 = watchPhotos(familyId, setPhotos, () => setError(true));
    return () => {
      u1();
      u2();
    };
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    let cancelled = false;
    fetchRecentReactions(familyId)
      .then((list) => {
        if (!cancelled) setReactions(list);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [familyId]);

  const personUid = useMemo(
    () => members?.find((m) => m.data.role === "person")?.uid ?? null,
    [members],
  );

  const model = useMemo(() => {
    if (!photos || !reactions || !personUid) return null;
    return buildModel(photos, reactions, personUid);
  }, [photos, reactions, personUid]);

  if (role === "person") {
    return (
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold">ふりかえり</h2>
        <p className="mt-4 text-2xl leading-relaxed">
          この画面は、家族の方が見る画面です。
          写真はホームからいつでも見られます。
        </p>
      </div>
    );
  }

  if (role !== "family") {
    return (
      <p className="mt-10 text-center text-2xl text-ink-soft" aria-live="polite">
        読み込み中…
      </p>
    );
  }

  const loading = members === null || photos === null || reactions === null;

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="text-3xl font-bold">ふりかえり</h2>
      <p className="mt-3 max-w-3xl text-xl leading-relaxed text-ink-soft">
        本人が写真を見た記録です。よく見ている写真や時代が分かると、
        次の声かけや写真選びの手がかりになります。
        あくまで「表示された記録」で、記憶や反応の良し悪しを測るものではありません。
      </p>

      {error && (
        <div className="mt-8 rounded-card border-2 border-danger bg-danger-soft p-6 text-2xl">
          記録を読み込めませんでした。通信をご確認ください。
        </div>
      )}

      {!error && loading && (
        <p className="mt-10 text-center text-2xl text-ink-soft" aria-live="polite">
          読み込み中…
        </p>
      )}

      {!error && !loading && !personUid && (
        <div className="mt-8">
          <EmptyState
            title="本人のアカウントがまだ参加していません"
            note="本人がタブレットで写真を見るようになると、ここに記録が残ります。本人アカウントの発行は「家族の設定」からできます。"
            action={
              <BigLink href="/settings" tone="go">
                家族の設定へ
              </BigLink>
            }
          />
        </div>
      )}

      {!error && !loading && personUid && model && model.totalViews === 0 && (
        <div className="mt-8">
          <EmptyState
            title="まだ記録がありません"
            note="本人が写真を見ると、ここに見た写真が残っていきます。"
          />
        </div>
      )}

      {!error && model && model.totalViews > 0 && (
        <>
          <p className="mt-8 text-2xl" aria-live="polite">
            これまでに <span className="font-bold">{model.totalViews} 回</span>、
            <span className="font-bold">{model.uniquePhotos} 枚</span> の写真が表示されました。
          </p>

          {/* よく見ている写真 */}
          <section className="mt-12" aria-labelledby="top-photos-heading">
            <h3 id="top-photos-heading" className="text-2xl font-bold">
              よく見ている写真
            </h3>
            <ul className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {model.topPhotos.map(({ photo, count }) => (
                <li key={photo.id}>
                  <PhotoTile
                    href={`/photos/${photo.id}`}
                    src={photo.data.downloadURL}
                    alt={photo.data.description ?? "写真"}
                    caption={
                      photo.data.description
                        ? `${photo.data.description}（${count} 回）`
                        : `${count} 回見ました`
                    }
                  />
                </li>
              ))}
            </ul>
          </section>

          {/* よく見ている時代 */}
          {model.eras.length > 0 && (
            <section className="mt-12" aria-labelledby="eras-heading">
              <h3 id="eras-heading" className="text-2xl font-bold">
                よく見ている時代
              </h3>
              <ul className="mt-5 divide-y-2 divide-line rounded-card border-2 border-line bg-surface">
                {model.eras.map((era) => (
                  <li key={era.label} className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="text-2xl font-semibold">{era.label}</span>
                    <span className="text-xl text-ink-soft">{era.count} 回</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 最近見た写真 */}
          <section className="mt-12" aria-labelledby="recent-heading">
            <h3 id="recent-heading" className="text-2xl font-bold">
              最近見た写真
            </h3>
            <ul className="mt-5 space-y-4">
              {model.recentPhotos.map(({ photo, lastViewedMs }) => (
                <li key={photo.id}>
                  <Link
                    href={`/photos/${photo.id}`}
                    className="flex items-center gap-5 rounded-card bg-surface p-3 ring-2 ring-inset ring-line transition-transform active:scale-[0.99]"
                  >
                    <img
                      src={photo.data.downloadURL}
                      alt={photo.data.description ?? "写真"}
                      loading="lazy"
                      className="h-20 w-20 shrink-0 rounded-xl object-cover"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-2xl font-semibold text-ink">
                        {photo.data.description ?? "（説明はまだありません）"}
                      </span>
                      <span className="mt-0.5 block text-lg text-ink-soft">
                        {dayjs(lastViewedMs).format("M月D日")}に見ました
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/* ---------- 集計 ---------- */

interface ReflectionsModel {
  totalViews: number;
  uniquePhotos: number;
  topPhotos: { photo: PhotoSummary; count: number }[];
  recentPhotos: { photo: PhotoSummary; lastViewedMs: number }[];
  eras: { label: string; count: number }[];
}

function buildModel(
  photos: PhotoSummary[],
  reactions: ReactionRecord[],
  personUid: string,
): ReflectionsModel {
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const counts = new Map<string, number>();
  const lastViewed = new Map<string, number>();

  let totalViews = 0;
  for (const r of reactions) {
    if (r.uid !== personUid) continue;
    if (!photoById.has(r.photoId)) continue; // 削除済みの写真は数えない
    totalViews += 1;
    counts.set(r.photoId, (counts.get(r.photoId) ?? 0) + 1);
    if (r.viewedAtMs > (lastViewed.get(r.photoId) ?? 0)) {
      lastViewed.set(r.photoId, r.viewedAtMs);
    }
  }

  const topPhotos = [...counts.entries()]
    .map(([id, count]) => ({ photo: photoById.get(id)!, count }))
    .sort((a, b) => b.count - a.count || (lastViewed.get(b.photo.id) ?? 0) - (lastViewed.get(a.photo.id) ?? 0))
    .slice(0, 8);

  const recentPhotos = [...lastViewed.entries()]
    .map(([id, ms]) => ({ photo: photoById.get(id)!, lastViewedMs: ms }))
    .sort((a, b) => b.lastViewedMs - a.lastViewedMs)
    .slice(0, 8);

  /* 時代: 撮影年から年代を出す。年が分からない写真はまとめて 1 行にする */
  const eraCounts = new Map<string, number>();
  for (const [id, count] of counts) {
    const year = photoYear(photoById.get(id)!);
    const label = year !== null ? `${Math.floor(year / 10) * 10}年代` : "時期が分からない写真";
    eraCounts.set(label, (eraCounts.get(label) ?? 0) + count);
  }
  const eras = [...eraCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { totalViews, uniquePhotos: counts.size, topPhotos, recentPhotos, eras };
}

function photoYear(photo: PhotoSummary): number | null {
  const taken = photo.data.takenDate;
  if (!taken) return null;
  const year = Number(taken.slice(0, 4));
  return Number.isInteger(year) && year >= 1800 && year <= 2200 ? year : null;
}
