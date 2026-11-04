"use client";

import { useState } from "react";
import { BigButton } from "@/components/ui/BigButton";
import { PersonIcon } from "@/components/ui/icons";

/*
 * 人物フォーム（登録・編集で共用）
 * - 名前だけが必須。写真・誕生日・メモは任意（本人に入力を求めない原則は家族向け編集にも適用）。
 * - 写真は 1 枚、タブして差し替え。元画像のまま保存する。
 */

export interface PersonFormValues {
  name: string;
  photoFile: File | null;
  photoURL: string | null;
  birthday: string;
  note: string;
}

interface PersonFormProps {
  initial?: Partial<PersonFormValues>;
  submitLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onSubmit: (values: PersonFormValues) => void;
}

export function PersonForm({ initial, submitLabel, busyLabel = "保存中…", busy, onSubmit }: PersonFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(initial?.photoURL ?? null);
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const fileRef = {
    current: null as HTMLInputElement | null,
  } as React.RefObject<HTMLInputElement>;

  return (
    <form
      className="rounded-card border-2 border-line bg-surface p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
          setError("名前を入力してください。");
          return;
        }
        setError(null);
        onSubmit({ name: trimmed, photoFile, photoURL, birthday, note });
      }}
    >
      {/* 顔写真: タップで選ぶ。伝えるための大きな領域 */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="block w-44 rounded-card border-2 border-line bg-white p-2 text-center transition-transform active:scale-[0.98]"
        aria-label="顔写真を選ぶ"
      >
        {photoURL ? (
           
          <img src={photoURL} alt="顔写真のプレビュー" className="aspect-square w-full rounded-xl object-cover" />
        ) : (
          <span className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl bg-surface-accent text-ink-soft">
            <PersonIcon size={48} />
            <span className="text-lg">写真を選ぶ</span>
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) {
            setPhotoFile(f);
            setPhotoURL(URL.createObjectURL(f));
          }
        }}
      />

      <label className="mt-6 block">
        <span className="text-2xl font-semibold">
          名前<span className="text-danger">（必ず）</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={30}
          className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
          placeholder="例: たかし・いもうと"
        />
      </label>

      <label className="mt-6 block">
        <span className="text-2xl font-semibold">誕生日（わかれば）</span>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
        />
      </label>

      <label className="mt-6 block">
        <span className="text-2xl font-semibold">メモ（任意）</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
          placeholder="例: 長男。海が好き。"
        />
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-btn border-2 border-danger bg-danger-soft px-4 py-3 text-xl">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <BigButton type="submit" tone="go" wide disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </BigButton>
      </div>
    </form>
  );
}
