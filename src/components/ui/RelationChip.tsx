"use client";

import Link from "next/link";
import { CloseIcon, PersonIcon, FlagIcon } from "@/components/ui/icons";

/*
 * 人物・出来事につながる「チップ」。
 * - ラベル（名前）で情報を伝え、色は補助に留める（No-Color-Only Rule）。
 * - 削除できるときは × ボタンを置く。
 */

type ChipKind = "person" | "event";

interface RelationChipProps {
  kind: ChipKind;
  label: string;
  href?: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
}

export function RelationChip({ kind, label, href, onRemove, removeDisabled }: RelationChipProps) {
  const Icon = kind === "person" ? PersonIcon : FlagIcon;

  const inner = (
    <span className="inline-flex min-h-14 items-center gap-2 rounded-btn border-2 border-line bg-surface px-4 py-2 text-2xl text-ink">
      <Icon size={22} className="shrink-0 text-ink-soft" aria-hidden="true" />
      <span className="max-w-48 truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          disabled={removeDisabled}
          className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-back-soft hover:text-ink disabled:opacity-40"
          aria-label={`${label}との関連を外す`}
        >
          <CloseIcon size={18} />
        </button>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex transition-transform active:scale-[0.97]">
        {inner}
      </Link>
    );
  }
  return inner;
}
