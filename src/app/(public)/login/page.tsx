"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";

/**
 * ログイン画面（Phase 2 基盤版）
 *
 * - 家族・本人どちらも同じ画面から入る（共通画面の原則）。
 * - 本人が招待コードで参加し、簡易ログインにする改良は Phase 3 で行う（仕様確認済み）。
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { auth } = getFirebase();
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      /* 自動遷移はしない方針だが、ログイン成功後の移動は画面の確定として行う */
      router.replace("/home");
    } catch (err) {
      setError(toFriendlyMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold tracking-tight">Memoria</h1>
          <p className="mt-3 text-2xl text-ink-soft">写真から、人生をたどる。</p>
        </div>

        <div className="rounded-card border border-line bg-surface p-6 shadow-sm sm:p-8">
          {/* タブ: 色だけでなく枠と下線でも選択状態を伝える */}
          <div className="mb-6 grid grid-cols-2 gap-2" role="tablist" aria-label="ログインメニュー">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => setMode("signin")}
              className={`rounded-btn border-2 px-4 py-4 text-2xl font-bold ${
                mode === "signin"
                  ? "border-accent-deep bg-accent text-white"
                  : "border-line bg-back-soft text-ink underline decoration-2 underline-offset-4"
              }`}
            >
              つづきから（ログイン）
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => setMode("signup")}
              className={`rounded-btn border-2 px-4 py-4 text-2xl font-bold ${
                mode === "signup"
                  ? "border-accent-deep bg-accent text-white"
                  : "border-line bg-back-soft text-ink underline decoration-2 underline-offset-4"
              }`}
            >
              はじめて（アカウント作り）
            </button>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <label className="block">
              <span className="text-2xl font-semibold">メールアドレス</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
              />
            </label>
            <label className="block">
              <span className="text-2xl font-semibold">パスワード</span>
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-btn border-2 border-danger bg-danger-soft px-4 py-3 text-xl"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-btn bg-go-deep px-6 py-5 text-3xl font-bold text-white shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? "おまちください…" : mode === "signin" ? "入る（ログイン）" : "登録する"}
            </button>
          </form>

          <p className="mt-6 text-center text-lg text-ink-soft">
            家族への参加方法（招待コード）は家族設定から行えます。
          </p>
        </div>
      </div>
    </main>
  );
}

function toFriendlyMessage(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-email":
      return "メールアドレスの形が正しくないようです。もう一度ご確認ください。";
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/user-not-found":
      return "メールアドレスかパスワードがちがうようです。もう一度ご確認ください。";
    case "auth/email-already-in-use":
      return "このメールアドレスはすでに使われています。「つづきから」をお試しください。";
    case "auth/weak-password":
      return "パスワードは 6 文字以上にしてください。";
    case "auth/network-request-failed":
      return "ネットワークに接続できません。Wi-Fi や回線をご確認ください。";
    default:
      return "うまくいきませんでした。もう一度お試しください。";
  }
}
