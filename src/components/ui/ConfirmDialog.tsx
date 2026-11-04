"use client";

import { AlertIcon } from "@/components/ui/icons";
import { BigButton } from "@/components/ui/BigButton";
import { useEffect, useRef } from "react";

/*
 * 大きな確認ダイアログ。
 * - 削除など、取り返しのつかない操作にのみ使う（craft-floor: modal は要中断）。
 * - 「やめる」を先に置く（安全側）。
 * - Esc キー・背景クリックは「中断」。
 */

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "やめる",
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-card border-4 border-danger bg-surface p-8"
      >
        <p className="flex items-center gap-3 text-3xl font-bold text-danger">
          <AlertIcon size={32} />
          {title}
        </p>
        <p className="mt-4 text-2xl text-ink">{body}</p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row-reverse">
          <BigButton
            tone="quiet"
            wide
            onClick={onCancel}
            autoFocus
          >
            {cancelLabel}
          </BigButton>
          <BigButton
            ref={confirmRef}
            tone="primary"
            wide
            disabled={busy}
            onClick={onConfirm}
            className="border-4 border-danger bg-danger hover:brightness-110 focus-visible:outline-danger"
          >
            {busy ? "おまちください…" : confirmLabel}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
