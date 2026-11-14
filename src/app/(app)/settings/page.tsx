"use client";

import { FormEvent, useEffect, useState } from "react";
import dayjs from "dayjs";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import { useSession } from "@/lib/auth/session";
import { watchMembers, type MemberSummary } from "@/lib/firestore/member";
import {
  createPersonAccount,
  personAccountErrorMessage,
  removePersonMember,
  updatePersonEmail,
  verifyPersonEmailForReset,
  type CreatePersonAccountResult,
} from "@/lib/functions/personAccounts";
import { BigButton } from "@/components/ui/BigButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AlertIcon } from "@/components/ui/icons";

/**
 * 家族の設定（/settings、family ロール限定 / docs/phase4-spec.md §1.2・§1.5・§8）
 *
 * - 本人アカウントの発行（Cloud Functions で作成 + 参加コード表示）
 * - パスワード再設定（登録メールの確認 → Firebase Auth の再設定メール）
 * - メールアドレスの訂正、メンバー解除（作り直しは「外す → 発行」の順）
 * - 家族メンバーの一覧
 *
 * 本人（person ロール）には管理操作を出さない（強制は Rules / Functions 側）。
 */
export default function SettingsPage() {
  const { familyId, familyName, role } = useSession();
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchMembers(familyId, setMembers, () => setLoadError(true));
    return () => unsub();
  }, [familyId]);

  if (role === "person") {
    return (
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold">家族の設定</h2>
        <p className="mt-4 text-2xl leading-relaxed">
          この画面は、家族の方が使う設定です。
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

  const person = members?.find((m) => m.data.role === "person") ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-3xl font-bold">家族の設定</h2>
      {familyName && <p className="mt-2 text-xl text-ink-soft">{familyName}</p>}

      {loadError && (
        <div className="mt-6 flex items-start gap-3 rounded-card border-2 border-danger bg-danger-soft p-5">
          <AlertIcon size={28} className="mt-1 shrink-0 text-danger" />
          <p className="text-2xl">設定を読み込めませんでした。通信をご確認ください。</p>
        </div>
      )}

      {/* 本人アカウント */}
      <section className="mt-10" aria-labelledby="person-account-heading">
        <h3 id="person-account-heading" className="text-2xl font-bold">
          本人のアカウント
        </h3>
        {members === null ? (
          <p className="mt-4 text-xl text-ink-soft" aria-live="polite">
            読み込み中…
          </p>
        ) : person ? (
          <PersonAccountManager person={person} />
        ) : (
          <CreatePersonForm />
        )}
      </section>

      {/* メンバー一覧 */}
      <section className="mt-12" aria-labelledby="members-heading">
        <h3 id="members-heading" className="text-2xl font-bold">
          家族のメンバー
        </h3>
        {members === null ? (
          <p className="mt-4 text-xl text-ink-soft">読み込み中…</p>
        ) : (
          <ul className="mt-4 divide-y-2 divide-line rounded-card border-2 border-line bg-surface">
            {members.map((m) => (
              <li key={m.uid} className="flex items-center justify-between gap-4 px-5 py-4">
                <span>
                  <span className="block text-2xl font-semibold">{m.data.displayName}</span>
                  {m.data.email && (
                    <span className="mt-0.5 block text-lg text-ink-soft">{m.data.email}</span>
                  )}
                </span>
                <span className="rounded-full border-2 border-line bg-back-soft px-4 py-1 text-lg font-bold">
                  {m.data.role === "family" ? "家族" : "本人"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------- 本人アカウントの発行フォーム ---------- */

function CreatePersonForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<CreatePersonAccountResult | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await createPersonAccount({ email: email.trim(), password, displayName: displayName.trim() });
      setIssued(res);
    } catch (err) {
      setError(personAccountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (issued) {
    return (
      <div className="mt-4 rounded-card border-2 border-go bg-go-soft p-6 sm:p-8">
        <p className="text-2xl font-bold">本人アカウントを作りました。</p>
        <p className="mt-3 text-xl leading-relaxed">
          パスワードは必ず家族が安全に保管してください。
          つぎに、共有タブレットで本人のアカウントにログインし、
          参加コードを入れてください（コードの有効期限は{" "}
          {dayjs(issued.expiresAt).format("H:mm")} まで・15 分間です）。
        </p>
        <p className="mt-6 text-center text-xl font-semibold">参加コード</p>
        <p
          className="mt-1 text-center text-6xl font-bold tracking-[0.35em]"
          aria-label={`参加コード ${issued.code.split("").join(" ")}`}
        >
          {issued.code}
        </p>
        <p className="mt-6 text-lg text-ink-soft">
          コードを入力すると、この家族のメンバーとして参加が完了します。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-5 rounded-card border-2 border-line bg-surface p-6 sm:p-8">
      <p className="text-xl leading-relaxed text-ink-soft">
        本人が共有タブレットで使うアカウントを発行します。
        メールアドレスは、実在するもの（家族が管理できるもの）を使ってください。
      </p>
      <label className="block">
        <span className="text-2xl font-semibold">本人の名前（表示名）</span>
        <input
          type="text"
          required
          maxLength={30}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
        />
      </label>
      <label className="block">
        <span className="text-2xl font-semibold">メールアドレス</span>
        <input
          type="email"
          autoComplete="off"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
        />
      </label>
      <label className="block">
        <span className="text-2xl font-semibold">パスワード（8 文字以上）</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-btn border-2 border-danger bg-danger-soft px-4 py-3 text-xl">
          {error}
        </p>
      )}
      <BigButton type="submit" tone="go" wide disabled={busy}>
        {busy ? "おまちください…" : "本人アカウントを作る"}
      </BigButton>
    </form>
  );
}

/* ---------- 発行済み本人アカウントの管理 ---------- */

function PersonAccountManager({ person }: { person: MemberSummary }) {
  const [resetEmail, setResetEmail] = useState(person.data.email ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const run = async (fn: () => Promise<string>) => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      setMessage(await fn());
    } catch (err) {
      setError(personAccountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void run(async () => {
      const { email } = await verifyPersonEmailForReset(resetEmail.trim());
      const { auth } = getFirebase();
      await sendPasswordResetEmail(auth, email);
      return `パスワード再設定のメールを ${email} へ送りました。メール内のリンクから新しいパスワードを設定し、タブレットで再ログインしてください。`;
    });
  };

  const onUpdateEmail = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void run(async () => {
      const { email } = await updatePersonEmail(person.uid, newEmail.trim());
      setNewEmail("");
      /* 再設定フォームの初期値も新しいアドレスへ追随させる（表示との矛盾を防ぐ） */
      setResetEmail(email);
      return `メールアドレスを ${email} に変更しました。`;
    });
  };

  const onRemove = () => {
    void run(async () => {
      await removePersonMember(person.uid);
      setConfirmRemove(false);
      return "本人を家族から外しました。新しいアカウントを発行できます（これまでの写真や記録は残ります）。";
    });
  };

  return (
    <div className="mt-4 rounded-card border-2 border-line bg-surface p-6 sm:p-8">
      <p className="text-2xl">
        <span className="font-bold">{person.data.displayName}</span>
        <span className="ml-3 text-xl text-ink-soft">（本人として参加中）</span>
      </p>
      <p className="mt-2 text-xl text-ink-soft">
        登録メール: {person.data.email ?? "（未登録）"}
      </p>

      {message && (
        <p className="mt-5 rounded-btn border-2 border-go bg-go-soft px-4 py-3 text-xl" aria-live="polite">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-5 rounded-btn border-2 border-danger bg-danger-soft px-4 py-3 text-xl">
          {error}
        </p>
      )}

      <form onSubmit={onReset} className="mt-8 space-y-4">
        <h4 className="text-2xl font-bold">パスワードを再設定する</h4>
        <p className="text-xl text-ink-soft">
          登録メールに、パスワード再設定のメールを送ります（初期状態で登録メールが入っています）。
        </p>
        <label className="block">
          <span className="text-xl font-semibold">登録メールアドレス</span>
          <input
            type="email"
            required
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
          />
        </label>
        <BigButton type="submit" tone="primary" wide disabled={busy}>
          再設定メールを送る
        </BigButton>
      </form>

      <form onSubmit={onUpdateEmail} className="mt-10 space-y-4">
        <h4 className="text-2xl font-bold">メールアドレスを訂正する</h4>
        <p className="text-xl text-ink-soft">
          現在のメールアドレス: {person.data.email ?? "（未登録）"}
        </p>
        <label className="block">
          <span className="text-xl font-semibold">新しいメールアドレス</span>
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
          />
        </label>
        <BigButton type="submit" tone="primary" wide disabled={busy}>
          メールアドレスを変更する
        </BigButton>
      </form>

      <div className="mt-10 border-t-2 border-line pt-8">
        <h4 className="text-2xl font-bold">家族から外す</h4>
        <p className="mt-2 text-xl leading-relaxed text-ink-soft">
          アカウントを作り直すときに使います。これまでの写真や記録は消えません。
        </p>
        <div className="mt-4">
          <BigButton tone="quiet" onClick={() => setConfirmRemove(true)} disabled={busy}>
            本人を家族から外す
          </BigButton>
        </div>
      </div>

      {confirmRemove && (
        <ConfirmDialog
          title="本人を家族から外しますか"
          body={`${person.data.displayName}さんは、この家族の写真を見られなくなります。写真や記録そのものは消えません。`}
          confirmLabel="外す"
          busy={busy}
          onConfirm={onRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}
