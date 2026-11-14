"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session";
import { joinFamilyWithCode, personAccountErrorMessage } from "@/lib/functions/personAccounts";
import { BigButton } from "@/components/ui/BigButton";

/**
 * 参加コード入力画面（Phase 4 / docs/phase4-spec.md §1.4・§1.6）
 *
 * - 本人アカウントでログインしたが、まだ家族に参加していないときに表示される。
 * - 操作するのは家族（初期設定の代行）。本人に日常操作は求めない。
 * - コードの検証・消費は Cloud Functions（joinFamilyWithCode）が行い、
 *   成功すると users.familyId が付いてホームへ進める。
 */
export default function JoinPage() {
  const router = useRouter();
  const { status, familyId } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  /* 参加が確定したらホームへ（セッションの familyId 更新に追随する） */
  useEffect(() => {
    if (status === "authenticated" && familyId) {
      router.replace("/home");
    }
  }, [status, familyId, router]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const digits = code.replace(/\D/g, "");
    if (!/^\d{6}$/.test(digits)) {
      setError("参加コードは数字 6 桁で入力してください。");
      return;
    }
    setBusy(true);
    try {
      await joinFamilyWithCode(digits);
      setDone(true);
      /* familyId のセッション反映で上の effect がホームへ進める。
         反映が遅い場合の保険として、少し待ってからも進める */
      setTimeout(() => router.replace("/home"), 1200);
    } catch (err) {
      setError(personAccountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-3xl font-bold">家族への参加</h2>
      <p className="mt-3 text-xl leading-relaxed text-ink-soft">
        家族の設定画面で発行した「参加コード」（数字 6 桁）を入れてください。
        コードの有効期限は 15 分です。この設定は家族の方が行ってください。
      </p>

      {done ? (
        <p className="mt-10 rounded-card border-2 border-go bg-go-soft p-6 text-center text-2xl font-bold" aria-live="polite">
          参加できました。ホームへ進みます…
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-6">
          <label className="block">
            <span className="text-2xl font-semibold">参加コード</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="参加コード（数字 6 桁）"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="mt-3 w-full rounded-btn border-2 border-line bg-white px-4 py-5 text-center text-5xl font-bold tracking-[0.4em]"
              placeholder="＿＿＿＿＿＿"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-btn border-2 border-danger bg-danger-soft px-4 py-3 text-xl">
              {error}
            </p>
          )}

          <BigButton type="submit" tone="go" wide disabled={busy || code.length !== 6}>
            {busy ? "おまちください…" : "参加する"}
          </BigButton>
        </form>
      )}

      <p className="mt-10 text-lg text-ink-soft">
        参加コードは、家族の方が家族用アカウントで「家族の設定」から発行します。
        コードが分からない場合は、家族の方にご確認ください。
      </p>
    </div>
  );
}
