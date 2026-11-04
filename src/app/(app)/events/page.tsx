"use client";

import { useEffect, useState } from "react";
import { watchEvents, type EventSummary } from "@/lib/firestore/event";
import { useSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/EmptyState";
import { BigLink } from "@/components/ui/BigButton";
import { formatPreciseDate } from "@/lib/format/eventDate";
import { FlagIcon, PlusIcon } from "@/components/ui/icons";

/*
 * 出来事一覧
 * 「いつ・何があったか」の単位。写真や人物につなげられる。
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
          {(events ?? []).map((e) => (
            <li key={e.id}>
              <BigLink href={`/events/${e.id}`} tone="primary" wide className="min-h-28 py-6 text-left">
                <FlagIcon size={34} />
                <span className="block">
                  <span className="text-2xl font-bold">{e.data.icon ? `${e.data.icon} ` : ""}{e.data.title}</span>
                  {e.data.startDate && (
                    <span className="mt-1 block text-xl font-normal text-white/85">
                      {formatPreciseDate(e.data.startDate)}
                    </span>
                  )}
                  {!e.data.startDate && e.data.eraLabel && (
                    <span className="mt-1 block text-xl font-normal text-white/85">
                      {e.data.eraLabel}
                    </span>
                  )}
                </span>
              </BigLink>
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
