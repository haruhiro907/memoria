"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { watchPeople, type PersonSummary } from "@/lib/firestore/person";
import { useSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/EmptyState";
import { BigLink } from "@/components/ui/BigButton";
import { PersonIcon, PlusIcon } from "@/components/ui/icons";

/*
 * 人物一覧
 * 顔写真を主役に、大きく並べる（人物から探す入口）。
 */

export default function PeoplePage() {
  const { familyId, role } = useSession();
  const [people, setPeople] = useState<PersonSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPeople(
      familyId,
      (list) => {
        setPeople(list);
        setError(false);
      },
      () => setError(true),
    );
    return () => unsub();
  }, [familyId]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">人物</h2>
        {role === "family" && (
          <BigLink href="/people/new" tone="go" icon={<PlusIcon size={26} />}>
            新しい人物を登録
          </BigLink>
        )}
      </div>

      {error && (
        <div className="mt-8 rounded-card border-2 border-danger bg-danger-soft p-6 text-2xl">
          人物を読み込めませんでした。通信をご確認ください。
        </div>
      )}

      {people && people.length === 0 && (
        <div className="mt-8">
          <EmptyState
            title="人物がまだ登録されていません"
            note="家族や友人を登録すると、写真とつなげられます。"
            action={
              role === "family" ? (
                <BigLink href="/people/new" tone="go" icon={<PlusIcon size={26} />}>
                  新しい人物を登録
                </BigLink>
              ) : undefined
            }
          />
        </div>
      )}

      {(people?.length ?? 0) > 0 && (
        <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {(people ?? []).map((p) => (
            <li key={p.id}>
              <Link
                href={`/people/${p.id}`}
                className="block rounded-card bg-surface p-2 ring-2 ring-inset ring-line transition-transform active:scale-[0.99]"
                aria-label={`${p.data.name} のページへ`}
              >
                {p.data.photoURL ? (
                   
                  <img
                    src={p.data.photoURL}
                    alt={p.data.name}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex aspect-square w-full items-center justify-center rounded-xl bg-surface-accent text-ink-soft">
                    <PersonIcon size={56} />
                  </span>
                )}
                <p className="truncate px-2 pb-2 pt-3 text-2xl font-bold text-ink">{p.data.name}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!people && !error && (
        <p className="mt-10 text-center text-2xl text-ink-soft" aria-live="polite">
          読み込み中…
        </p>
      )}
    </div>
  );
}
