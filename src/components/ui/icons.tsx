import type { SVGProps } from "react";

/*
 * Memoria のアイコンセット
 * - すべて 24px viewBox の同一線幅（2）の線画。
 * - 絵文字をアイコン代わりに使わない（DESIGN.md の方針）。
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11.5 12 4l9 7.5M5.5 10.5V20h5v-5h3v5h5v-9.5" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="7" width="18" height="13" rx="3" />
      <circle cx="12" cy="13.5" r="3.5" />
      <path d="M8 7l1.5-2.5h5L16 7" />
    </svg>
  );
}

export function AlbumIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="m5 19 5-5 3.5 3.5M14 15l2-2 4 4" />
    </svg>
  );
}

export function ImagesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="6" y="3" width="15" height="12" rx="2.5" />
      <path d="M4 7v10.5A2.5 2.5 0 0 0 6.5 20H18" />
      <circle cx="10.5" cy="7.5" r="1.5" />
      <path d="m8 12.5 3-3 3.5 3.5M13 13l1.5-1.5L17 14" />
    </svg>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8.5" cy="8.5" r="3.2" />
      <path d="M3.5 19c.7-3 2.6-4.5 5-4.5S13.3 16 14 19" />
      <circle cx="16.5" cy="7.5" r="2.6" />
      <path d="M15.5 13.8c2.6.1 4.3 1.7 5 5.2" />
    </svg>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.9-3.5 3.4-5.5 7-5.5S18.1 16.5 19 20" />
    </svg>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 21V4" />
      <path d="M6 4h11l-2.5 3.5L17 11H6" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20h4l10.5-10.5a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" />
      <path d="M13.5 8 16 10.5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 12H4M10 6l-6 6 6 6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

export function CakeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 21h16M5 21v-7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v7" />
      <path d="M12 11V8" />
      <path d="M12 8a1.6 1.6 0 1 0-1.6-1.6c0 1 1.6 2.6 1.6 2.6s1.6-1.6 1.6-2.6" />
    </svg>
  );
}

export function MapIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
      <path d="M9 4v13M15 6.5v13" />
    </svg>
  );
}

export function SwipeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 12h13M18 8l4 4-4 4" />
      <path d="M4 5v14" />
      <circle cx="4" cy="19" r="1.6" />
      <circle cx="4" cy="5" r="1.6" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m3 16 5-5 4 4 3-3 6 5" />
    </svg>
  );
}

/** 通知・エラーなどで形状を伴う注意のマーク */
export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v5M12 18h.01" />
    </svg>
  );
}
