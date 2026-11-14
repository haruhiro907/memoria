"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { watchEvents, type EventSummary } from "@/lib/firestore/event";
import { useSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/EmptyState";
import { BigLink } from "@/components/ui/BigButton";
import { formatPreciseDate, isValidPreciseDate, preciseDateSortKey } from "@/lib/format/eventDate";
import { FlagIcon, PlusIcon } from "@/components/ui/icons";

/*
 * 出来事一覧
 * 「いつ・何があったか」の単位。写真や人物につなげられる。
 * 並びは人生の時系列（古い順）。日付のない出来事（eraLabel のみ）は末尾。
 * 見た目は人物一覧と同じ surface カードにそろえ、色で目立たせない
 * （最も目立つ要素は「登録」ボタン 1 つだけにする。DESIGN.md の規則）。
 */

export default function EventsPage() {
  const { familyId, role } = useSession();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchEvents(
      familyId,
      (list) => {
        setEvents(list);
        setError(false);
      },
      () => setError(true),
    );
    return () => unsub();
  }, [familyId]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">出来事</h2>
        {role === "family" && (
          <BigLink href="/events/new" tone="go" icon={<PlusIcon size={26} />}>
            新しい出来事を登録
          </BigLink>
        )}
      </div>

      {error && (
        <div className="mt-8 rounded-card border-2 border-danger bg-danger-soft p-6 text-2xl">
          出来事を読み込めませんでした。通信をご確認ください。
        </div>
      )}

      {events && events.length === 0 && (
        <div className="mt-8">
          <EmptyState
            title="出来事がまだありません"
            note="結婚式・お誕生日・花見など、思い出のタイトルをつけて登録します。"
            action={
              role === "family" ? (
                <BigLink href="/events/new" tone="go" icon={<PlusIcon size={26} />}>
                  新しい出来事を登録
                </BigLink>
              ) : undefined
            }
          />
        </div>
      )}

      {(events?.length ?? 0) > 0 && (
        <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sortChronologically(events ?? []).map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className="flex min-h-28 items-start gap-4 rounded-card bg-surface p-6 ring-2 ring-inset ring-line transition-transform active:scale-[0.99]"
              >
                <span className="mt-1 shrink-0 text-accent-deep" aria-hidden="true">
                  <FlagIcon size={34} />
                </span>
                <span className="block">
                  <span className="block text-2xl font-bold text-ink">{e.data.icon ? `${e.data.icon} ` : ""}{e.data.title}</span>
                  {e.data.startDate && isValidPreciseDate(e.data.startDate) && (
                    <span className="mt-1 block text-xl text-ink-soft">
                      {formatPreciseDate(e.data.startDate)}
                    </span>
                  )}
                  {!e.data.startDate && e.data.eraLabel && (
                    <span className="mt-1 block text-xl text-ink-soft">
                      {e.data.eraLabel}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!events && !error && (
        <p className="mt-10 text-center text-2xl text-ink-soft" aria-live="polite">
          読み込み中…
        </p>
      )}
    </div>
  );
}

/** 人生の時系列（古い順）に並べる。日付のある出来事が先、eraLabel のみは末尾（同士は受け取り順を保つ） */
function sortChronologically(list: EventSummary[]): EventSummary[] {
  return [...list].sort((a, b) => {
    const ka = a.data.startDate && isValidPreciseDate(a.data.startDate) ? preciseDateSortKey(a.data.startDate) : null;
    const kb = b.data.startDate && isValidPreciseDate(b.data.startDate) ? preciseDateSortKey(b.data.startDate) : null;
    if (ka && kb) return ka < kb ? -1 : ka > kb ? 1 : 0;
    if (ka) return -1;
    if (kb) return 1;
    return 0;
  });
}
