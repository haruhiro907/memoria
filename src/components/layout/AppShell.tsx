"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { signOut } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import { useSession } from "@/lib/auth/session";

/*
 * ログイン後の共通シェル
 *
 * 方針（Phase 1 設計書）:
 * - 本人と家族が同じ画面を使う。差分はボタンの有無のみ。
 * - どの画面からもホームへ戻れる大ボタンを常設。
 * - 自動遷移はしない（過度なアニメーションも使わない）。
 *
 * Next.js 16（cacheComponents）対応:
 * - {children} は必ずレンダリングツリーに残し、認証ガードは
 *   全画面オーバーレイとして上に重ねる。ガードで描画を省略しない。
 * - usePathname は実行時にしか確定しないため、ヘッダーを Suspense で包む。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  /* 未ログインのとき /login へ誘導する（描画は省略せず覆う） */
  const router = useRouter();
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<HeaderFallback />}>
        <ShellHeader />
      </Suspense>
      <Suspense fallback={null}>
        <JoinGate />
      </Suspense>

      <main className="flex-1 px-5 pb-16 sm:px-8">{children}</main>

      {/* 認証の確定前だけ全画面を覆う。children はツリーから外さない */}
      {status !== "authenticated" && <AuthOverlay status={status} />}
    </div>
  );
}

function ShellHeader() {
  const pathname = usePathname();
  const { displayName, role } = useSession();
  const isHome = pathname === "/home";

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
      {!isHome ? (
        <Link
          href="/home"
          className="flex items-center gap-3 rounded-btn bg-accent px-6 py-4 text-2xl font-bold text-white shadow-sm transition-transform active:scale-[0.98]"
          aria-label="ホームへ戻る"
        >
          <HomeIcon />
          <span>ホームへ戻る</span>
        </Link>
      ) : (
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Memoria</h1>
      )}

      <div className="flex items-center gap-3">
        {displayName && (
          <span className="hidden text-xl text-ink-soft sm:inline">
            {displayName}（{role === "family" ? "家族" : "本人"}）
          </span>
        )}
        <button
          type="button"
          onClick={() => void signOut(getFirebase().auth)}
          className="rounded-btn bg-back-soft px-5 py-3 text-xl font-semibold text-ink underline decoration-2 underline-offset-4"
          aria-label="ログアウトする"
        >
          やめる（ログアウト）
        </button>
      </div>
    </header>
  );
}

function HeaderFallback() {
  return <header className="px-5 py-4 sm:px-8" aria-hidden="true" />;
}

/**
 * 家族に未参加（familyId が null）のログイン済みユーザーは、
 * 参加コード入力画面（/join）へ誘導する（Phase 4 §1.6）。
 * 家族作成・コード参加で familyId が付くと、通常の画面に戻れる。
 */
function JoinGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, familyId } = useSession();

  useEffect(() => {
    if (status === "authenticated" && familyId === null && pathname !== "/join") {
      router.replace("/join");
    }
  }, [status, familyId, pathname, router]);

  return null;
}

function AuthOverlay({ status }: { status: "loading" | "unauthenticated" }) {
  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <p className="text-2xl text-ink-soft">
        {status === "loading" ? "読み込み中…" : "ログイン画面へ移動しています…"}
      </p>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 11.5 12 4l9 7.5M5.5 10.5V20h5v-5h3v5h5v-9.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
