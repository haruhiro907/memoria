"use client";

import type { ReactNode } from "react";

/*
 * 空状態。静かに説明し、次の一手だけを示す。
 * 迫りくる欄式（カードの羅列）ではなく、余白の広い一枚。
 */

interface EmptyStateProps {
  title: string;
  note?: string;
  action?: ReactNode;
}

export function EmptyState({ title, note, action }: EmptyStateProps) {
  return (
    <div className="rounded-card border-2 border-line bg-surface px-8 py-12 text-center">
      <p className="text-2xl font-bold">{title}</p>
      {note && <p className="mt-3 text-xl text-ink-soft">{note}</p>}
      {action && <div className="mt-8 flex justify-center">{action}</div>}
    </div>
  );
}
