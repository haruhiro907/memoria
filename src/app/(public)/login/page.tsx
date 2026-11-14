"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import { ensureUserFamily } from "@/lib/auth/family";

/**
 * ログイン画面（Phase 4 / docs/phase4-spec.md §1.6）
 *
 * - 家族・本人どちらも同じ画面から入る（共通画面の原則）。
 * - はじめて（登録）では入り口を選ぶ:
 *   - 「家族として始める」: アカウント作成と同時に家族グループを作る。
 *   - 「参加コードで本人として入る」: アカウントだけを作り、家族が発行した
 *     参加コードを入れる画面（/join）へ進む。
 * - ログインしただけでは家族は作られない（自動作成はしない）。
 */
type SignupIntent = "family" | "person";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [intent, setIntent] = useState<SignupIntent>("family");
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
        router.replace("/home");
      } else if (intent === "family") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        /* 家族として始める: グループ作成までを登録の一部として行う */
        await ensureUserFamily(cred.user.uid, null);
        router.replace("/home");
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        /* 本人として入る: 家族は作らず、参加コード入力へ */
        router.replace("/join");
      }
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
            {mode === "signup" && (
              <fieldset>
                <legend className="text-2xl font-semibold">はじめ方をえらんでください</legend>
                <div className="mt-3 grid gap-3" role="radiogroup" aria-label="はじめ方">
                  <IntentOption
                    selected={intent === "family"}
                    onSelect={() => setIntent("family")}
                    title="家族として始める"
                    note="家族のグループを新しく作ります。写真の整理や設定は、家族の方が行います。"
                  />
                  <IntentOption
                    selected={intent === "person"}
                    onSelect={() => setIntent("person")}
                    title="参加コードで本人として入る"
                    note="家族から聞いた参加コード（数字 6 桁）を、あとで入れる画面に進みます。"
                  />
                </div>
              </fieldset>
            )}

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
            本人の参加コードは、家族の設定画面で発行します。
          </p>
        </div>
      </div>
    </main>
  );
}

function IntentOption({
  selected,
  onSelect,
  title,
  note,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  note: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`rounded-btn border-2 px-5 py-4 text-left transition-colors ${
        selected
          ? "border-accent-deep bg-accent text-white"
          : "border-line bg-back-soft text-ink"
      }`}
    >
      <span className="flex items-center gap-3 text-2xl font-bold">
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? "border-white bg-white" : "border-line bg-white"
          }`}
        >
          {selected && <span className="h-3.5 w-3.5 rounded-full bg-accent-deep" />}
        </span>
        {title}
      </span>
      <span className={`mt-2 block text-lg ${selected ? "text-white/90" : "text-ink-soft"}`}>{note}</span>
    </button>
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
