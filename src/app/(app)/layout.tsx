import { AppShell } from "@/components/layout/AppShell";

/**
 * ログイン後の共通レイアウト。
 * 認証ガードと「ホームへ戻る」常設ボタンは AppShell 内で行う。
 */
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
