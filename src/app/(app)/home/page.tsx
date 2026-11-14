"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { watchRecentPhotos, type PhotoSummary } from "@/lib/firestore/photo";
import { useSession } from "@/lib/auth/session";
import { PhotoTile } from "@/components/ui/PhotoTile";
import { BigLink } from "@/components/ui/BigButton";
import { AlbumIcon, CameraIcon, FlagIcon, MapIcon, PeopleIcon, SettingsIcon, SwipeIcon } from "@/components/ui/icons";
import dayjs from "dayjs";

/*
 * ホーム画面
 * - 「今日の思い出」→ 最近の写真 → 主操作の順。写真がいつも近くにある。
 * - 写真が 1 枚もない日は、最初の 1 枚を追加する動きだけを目立たせる。
 */
export default function HomePage() {
  const { familyId, familyName, displayName, role } = useSession();
  const [photos, setPhotos] = useState<PhotoSummary[] | null>(null);
  /* 現在日付は prerender で確定させないため、クライアント側でのみ決める */
  const [today, setToday] = useState("");

  useEffect(() => {
    /* 表示用の現在日は prerender で確定させず、ウォッチャーのコールバック内でのみ決める */
    if (!familyId) return;
    const unsub = watchRecentPhotos(
      familyId,
      12,
      (list) => {
        setPhotos(list);
        setToday(dayjs().format("YYYY-MM-DD"));
      },
      () => undefined,
    );
    return () => unsub();
  }, [familyId]);

  const todays = today ? (photos ?? []).filter((p) => p.data.takenDate === today).slice(0, 3) : [];
  const recent = (photos ?? []).slice(0, 8);

  const greeting = displayName ? `${displayName}さん、こんにちは` : "こんにちは";

  return (
    <div className="mx-auto max-w-5xl">
      <section className="mb-10">
        <h2 className="text-3xl font-bold">{familyName ?? greeting}</h2>
        <p className="mt-1 text-xl text-ink-soft">
          写真から、いっしょに思い出をたどりましょう。
        </p>
      </section>

      {photos && photos.length === 0 && (
        <section className="mb-10 rounded-card bg-surface p-8 ring-2 ring-inset ring-line sm:p-12">
          <p className="text-2xl font-bold">最初の 1 枚を、そろそろ追加しませんか</p>
          <p className="mt-3 text-xl text-ink-soft">
            写真を選ぶだけで追加できます。名前や日付はいりません。
          </p>
          <div className="mt-8">
            <BigLink href="/photos/new" tone="go" icon={<CameraIcon size={30} />}>
              写真を追加
            </BigLink>
          </div>
        </section>
      )}

      {/* 今日の思い出: 撮影日が「今日」の写真があれば先頭に見せる */}
      {todays.length > 0 && (
        <section className="mb-10" aria-labelledby="today-heading">
          <h3 id="today-heading" className="text-2xl font-bold">
            今日の思い出（{dayjs(today).format("M月D日")}）
          </h3>
          <ul className="mt-4 grid grid-cols-3 gap-6">
            {todays.map((p) => (
              <li key={p.id}>
                <PhotoTile href={`/photos/${p.id}`} src={p.data.downloadURL} alt={p.data.description ?? "今日の写真"} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 最近追加された写真 */}
      {recent.length > 0 && (
        <section className="mb-10" aria-labelledby="recent-heading">
          <div className="flex items-center justify-between gap-4">
            <h3 id="recent-heading" className="text-2xl font-bold">最近の写真</h3>
            <Link
              href="/photos"
              className="rounded-btn bg-back-soft px-5 py-3 text-xl font-semibold text-ink underline decoration-2 underline-offset-4"
            >
              全部見る
            </Link>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {recent.map((p) => (
              <li key={p.id}>
                <PhotoTile href={`/photos/${p.id}`} src={p.data.downloadURL} alt={p.data.description ?? "写真"} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 主操作 */}
      <nav aria-label="メインメニュー" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <MenuTile href="/photos" icon={<AlbumIcon size={40} />} label="写真を見る" tone="plain" />
        <MenuTile href="/photos/new" icon={<CameraIcon size={40} />} label="写真を追加" tone="go" />
        <MenuTile href="/explore" icon={<SwipeIcon size={40} />} label="思い出を探す" tone="go" />
        <MenuTile href="/people" icon={<PeopleIcon size={40} />} label="人物から探す" tone="plain" />
        <MenuTile href="/events" icon={<FlagIcon size={40} />} label="出来事から探す" tone="plain" />
        <MenuTile href="/map" icon={<MapIcon size={40} />} label="人生の地図" tone="plain" />
      </nav>

      {/* 家族の管理（family ロールのみ）: 本人アカウントの発行・設定 */}
      {role === "family" && (
        <section className="mt-10" aria-label="家族の管理">
          <BigLink href="/settings" tone="quiet" wide icon={<SettingsIcon size={26} />}>
            家族の設定（本人のアカウント発行など）
          </BigLink>
        </section>
      )}

      {role === "family" && (
        <p className="mt-10 text-center text-lg text-ink-soft">
          画面右上の「やめる」でログアウトできます。
        </p>
      )}
    </div>
  );
}

type Tone = "plain" | "go";

function MenuTile({
  href,
  label,
  icon,
  tone,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  tone: Tone;
}) {
  const colorClass =
    tone === "go"
      ? "border-go-deep bg-go-soft hover:bg-go"
      : "border-line bg-surface hover:bg-surface-accent";

  return (
    <Link
      href={href}
      className={`flex min-h-32 flex-col items-center justify-center gap-3 rounded-card border-4 px-6 py-8 text-center shadow-none transition-colors duration-150 active:scale-[0.99] ${colorClass}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="text-3xl font-bold leading-snug">{label}</span>
    </Link>
  );
}
