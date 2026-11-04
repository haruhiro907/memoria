"use client";

/**
 * Phase 3 以降で実装する画面の仮ページ。
 * 未実装の問い合わせ先を明示するだけで、入力を求めたりしない。
 */
export function ComingSoonStub({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 text-3xl font-bold">{title}</h2>
      <div className="rounded-card border-2 border-line bg-surface p-8">
        <p className="text-2xl">{note}</p>
        <p className="mt-4 text-xl text-ink-soft">このページは作成中です。</p>
      </div>
    </div>
  );
}
