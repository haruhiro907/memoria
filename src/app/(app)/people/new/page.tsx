"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPerson } from "@/lib/firestore/person";
import { uploadPersonPhoto } from "@/lib/firebase/upload";
import { useSession } from "@/lib/auth/session";
import { PersonForm, type PersonFormValues } from "@/components/person/PersonForm";
import { AlertIcon, HomeIcon } from "@/components/ui/icons";
import { BigButton } from "@/components/ui/BigButton";

/* 人物を新しく登録する（family ロール） */

export default function PersonNewPage() {
  const router = useRouter();
  const { uid, familyId, role } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (role !== "family") {
    return (
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold">人物を登録</h2>
        <p className="mt-8 rounded-card border-2 border-line bg-surface px-8 py-10 text-center text-2xl">
          人物の登録は家族だけができます。写真はどなたでも追加できます。
        </p>
      </div>
    );
  }

  const submit = async (values: PersonFormValues) => {
    if (!familyId || !uid) return;
    setBusy(true);
    setError(null);
    try {
      let photoURL: string | null = null;
      if (values.photoFile) {
        photoURL = await uploadPersonPhoto(familyId, values.photoFile);
      }
      const id = await createPerson(
        familyId,
        {
          name: values.name,
          photoURL,
          birthday: values.birthday || null,
          note: values.note || null,
        },
        uid,
      );
      router.push(`/people/${id}`);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-3xl font-bold">人物を登録</h2>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-card border-2 border-danger bg-danger-soft p-5">
          <AlertIcon size={28} className="mt-1 shrink-0 text-danger" />
          <p className="text-2xl">{error}</p>
        </div>
      )}

      <div className="mt-6">
        <PersonForm submitLabel="登録する" busy={busy} onSubmit={(v) => void submit(v)} />
      </div>

      <div className="mt-6 flex justify-end">
        <BigButton tone="quiet" icon={<HomeIcon size={20} />} onClick={() => router.push("/people")}>
          やめる
        </BigButton>
      </div>
    </div>
  );
}

function friendlyError(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
  if (code.includes("permission-denied")) {
    return "保存の権限がありません。ログインし直してからもう一度ためしてください。";
  }
  return "保存できませんでした。通信を確認して、もう一度ためしてください。";
}
