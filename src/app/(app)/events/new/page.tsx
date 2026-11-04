"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createEvent } from "@/lib/firestore/event";
import { watchPeople, type PersonSummary } from "@/lib/firestore/person";
import { useSession } from "@/lib/auth/session";
import { EventDateFields, toDateFieldsInput, type EventDateFieldsValue } from "@/components/events/EventDateFields";
import { AlertIcon } from "@/components/ui/icons";

/*
 * 出来事を登録（家族のみ）
 * - タイトルだけ必須。時期（日/月/年の区別・または自由表現）・アイコン・関連人物は任意。
 */

export default function EventNewPage() {
  const router = useRouter();
  const { uid, familyId, role } = useSession();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string>("");
  const [dateFields, setDateFields] = useState<EventDateFieldsValue>({
    precision: null,
    start: "",
    end: "",
    eraLabel: "",
  });
  const [description, setDescription] = useState("");
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPeople(familyId, setPeople, () => undefined);
    return () => unsub();
  }, [familyId]);

  if (role !== "family") {
    return (
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold">出来事を登録</h2>
        <p className="mt-8 rounded-card border-2 border-line bg-surface px-8 py-10 text-center text-2xl">
          出来事の登録は家族だけができます。写真はどなたでも追加できます。
        </p>
      </div>
    );
  }

  const togglePerson = (id: string) => {
    setSelectedPeople((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyId || !uid) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError("タイトルを入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createEvent(
        familyId,
        {
          title: trimmed,
          description: description || null,
          ...toDateFieldsInput(dateFields),
          icon: icon || null,
          personRefs: selectedPeople,
        },
        uid,
      );
      router.push(`/events/${id}`);
    } catch (err) {
      setBusy(false);
      setError(friendlyError(err));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-3xl font-bold">出来事を登録</h2>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-card border-2 border-danger bg-danger-soft p-5">
          <AlertIcon size={28} className="mt-1 shrink-0 text-danger" />
          <p className="text-2xl">{error}</p>
        </div>
      )}

      <form className="mt-6 rounded-card border-2 border-line bg-surface p-6 sm:p-8" onSubmit={(e) => void submit(e)}>
        <label className="block">
          <span className="text-2xl font-semibold">
            タイトル<span className="text-danger">（必ず）</span>
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={50}
            placeholder="例: 結婚式・お誕生日・富士山の旅"
            className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
          />
        </label>

        <div className="mt-6">
          <span className="text-2xl font-semibold">マーク（わかる絵で）</span>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="出来事のマークを選ぶ">
            {["🎊", "🎂", "🌸", "⛩", "✈", "🎓", "🏡", "👶"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setIcon(icon === c ? "" : c)}
                aria-pressed={icon === c}
                className={`min-h-14 min-w-14 rounded-btn border-2 px-3 text-3xl ${
                  icon === c ? "border-go-deep bg-go-soft" : "border-line bg-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <EventDateFields value={dateFields} onChange={setDateFields} />

        <label className="mt-6 block">
          <span className="text-2xl font-semibold">説明（任意）</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
          />
        </label>

        {people.length > 0 && (
          <div className="mt-6">
            <span className="text-2xl font-semibold">この出来事の人物（わかる範囲で）</span>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {people.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={selectedPeople.includes(p.id)}
                    onClick={() => togglePerson(p.id)}
                    className={`w-full min-h-14 truncate rounded-btn border-2 px-4 py-3 text-2xl ${
                      selectedPeople.includes(p.id)
                        ? "border-go-deep bg-go-soft"
                        : "border-line bg-white"
                    }`}
                  >
                    {p.data.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <button
            type="submit"
            disabled={busy}
            className="min-h-18 flex-1 rounded-btn bg-go-deep text-3xl font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "保存中…" : "登録する"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/events")}
            className="min-h-18 rounded-btn bg-back-soft px-8 text-2xl font-bold text-ink underline decoration-2 underline-offset-4"
          >
            やめる
          </button>
        </div>
      </form>
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
