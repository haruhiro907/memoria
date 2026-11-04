"use client";

import Link from "next/link";
import { AlbumIcon } from "@/components/ui/icons";

/*
 * 一覧に並ぶ大きな写真タイル
 * 白紙の台紙（白枠）で写真を包む（DESIGN.md: 写真グリッド）。
 */

interface PhotoTileProps {
  href: string;
  src: string;
  alt: string;
  /** タイルの下に載せる任意ラベル（誰か・いつか） */
  caption?: string | null;
}

export function PhotoTile({ href, src, alt, caption }: PhotoTileProps) {
  return (
    <Link
      href={href}
      className="group block rounded-card bg-surface p-2 ring-2 ring-inset ring-line transition-transform duration-150 active:scale-[0.99]"
      aria-label={alt}
    >
      {/* next/image 不使用: 元画像のまま保存する仕様のため、縦横比はスタイルで抑制 */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="aspect-square w-full rounded-xl object-cover"
      />
      {caption ? (
        <p className="truncate px-2 pb-2 pt-3 text-xl text-ink">{caption}</p>
      ) : (
        <p className="px-2 pb-2 pt-3 text-lg text-ink-soft opacity-0 group-hover:opacity-60">
          <AlbumIcon size={18} className="inline-block align-middle" />
        </p>
      )}
    </Link>
  );
}
