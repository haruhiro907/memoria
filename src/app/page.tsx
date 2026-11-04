import { redirect } from "next/navigation";

/** トップページはホームへ飛ばす（ログイン未済なら AppShell がログイン画面へ誘導する） */
export default function RootPage() {
  redirect("/home");
}
