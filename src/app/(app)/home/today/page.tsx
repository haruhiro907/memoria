import { redirect } from "next/navigation";

/*
 * 「今日の思い出」は未実装のため、準備中ページは置かずホームへ戻す
 * （約束だけして果たさない入口を残さない。impeccable critique 2026-11-15 Batch 5）。
 * ホームには「今日の思い出」セクション（撮影日が今日の写真）が既にある。
 */
export default function TodayPage() {
  redirect("/home");
}
