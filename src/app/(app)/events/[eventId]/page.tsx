import EventDetailClient from "./EventDetailClient";

/*
 * 出来事詳細（サーバー側ラッパー）
 *
 * このルートは blocking（サーバーで完結する描画）にする。
 * 動的 params を "use client" のページ本体で直接使うと、App Shell 検証の
 * レジューム待ちで直接読み込み（URL 直打ち・更新）時にページセグメントが
 * 再開されないことがあるため。
 * データはすべてクライアント側の Firestore ウォッチャーで取るため、
 * blocking にしてもサーバー側の追加コストはない。
 * blocking なので params はここで解決して文字列として渡せる。
 */
export const instant = false;

export default async function EventDetailPage(props: PageProps<"/events/[eventId]">) {
  const { eventId } = await props.params;
  return <EventDetailClient eventId={eventId} />;
}
