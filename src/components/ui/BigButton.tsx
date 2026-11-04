"use client";

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import Link from "next/link";

/*
 * 大きく・触り倒せるボタン（DESIGN.md: Buttons）
 * tone:
 *  - primary: 焼き菓子テラコッタ（主要操作）
 *  - go: 冴えた青緑の深色（進む・確定）
 *  - quiet: 静かな灰茶（戻る・低優先度）
 */

type Tone = "primary" | "go" | "quiet";

const toneClasses: Record<Tone, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-deep min-h-16 text-3xl",
  go: "bg-go-deep text-white hover:brightness-110 min-h-18 text-3xl",
  quiet:
    "bg-back-soft text-ink hover:bg-line min-h-14 text-xl underline decoration-2 underline-offset-4",
};

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  icon?: ReactNode;
  wide?: boolean;
  /* React 19: 関数コンポーネントでも ref をプロップとして受けられる（ConfirmDialog で使用） */
  ref?: Ref<HTMLButtonElement>;
}

export function BigButton({ tone = "primary", icon, wide, className = "", children, ...rest }: BigButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-3 rounded-btn font-bold shadow-none transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${wide ? "w-full" : ""} ${toneClasses[tone]} ${className}`}
      {...rest}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

interface BigLinkProps {
  href: string;
  tone?: Tone;
  icon?: ReactNode;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}

export function BigLink({ href, tone = "primary", icon, wide, className = "", children }: BigLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-3 rounded-btn font-bold transition-[background-color,transform] duration-150 active:scale-[0.98] ${wide ? "w-full" : ""} ${toneClasses[tone]} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
