"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  watchEvents,
  type EventSummary,
  type MemoriaEvent,
} from "@/lib/firestore/event";
import { watchPhotos, type PhotoSummary } from "@/lib/firestore/photo";
import { useSession } from "@/lib/auth/session";
import {
  formatEventPeriod,
  isValidPreciseDate,
  preciseDateSortKey,
  preciseDateYear,
} from "@/lib/format/eventDate";
import { PhotoTile } from "@/components/ui/PhotoTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { BigButton, BigLink } from "@/components/ui/BigButton";
import { AlertIcon, ArrowLeftIcon, ArrowRightIcon, MapIcon, PlusIcon } from "@/components/ui/icons";

/*
 * 人生の地図（/map）— 「時間の一本道」
 *
 * - 出来事が「駅」として、古い年から新しい年へ並ぶ。
 * - 並びは「年ブロック → 精度（day / month）の正規化キー順」。
 *   年精度の出来事は順序が確定していないため、複数ある年は
 *   「この年の出来事」のグループにまとめ、順序つきの駅とは並べない。
 * - 時期がまったく入力されていない出来事は道に載せない。
 *   eraLabel（子どもの頃・戦前など）だけの出来事は、末尾の
 *   「時期がくわしくない出来事」区画に載せる。
 * - 写真は出来事の駅に載る（撮影日が分からない写真も、出来事経由なら表示する）。
 * - 操作: 横スクロール ＋「←」「→」大ボタン ＋ 駅タップ。自動送りはない。
 */

interface RoadStation {
  id: string;
  data: MemoriaEvent;
  photos: PhotoSummary[];
}

interface RoadModel {
  /** 年ごとの区間（古い順） */
  blocks: Array<{
    year: number;
    /** 年精度だけの出来事（順序未確定のクラスタ） */
    yearOnly: RoadStation[];
    /** 日・月の精度が入力された出来事（正規化キー順） */
    precise: RoadStation[];
  }>;
  /** eraLabel だけの出来事（末尾区画） */
  eraEvents: RoadStation[];
  /** 道に載せる駅の総数 */
  stationCount: number;
}

export default function MapPage() {
  const { familyId, role } = useSession();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [photos, setPhotos] = useState<PhotoSummary[]>([]);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!familyId) return;
    const unsubEvents = watchEvents(
      familyId,
      (list) => {
        setEvents(list);
        setError(false);
      },
      () => setError(true),
    );
    return () => unsubEvents();
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = watchPhotos(familyId, setPhotos, () => setError(true));
    return () => unsub();
  }, [familyId]);

  const model = useMemo(() => buildRoadModel(events ?? [], photos), [events, photos]);

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * scrollRef.current.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="text-3xl font-bold">人生の地図</h2>
      <p className="mt-2 text-xl text-ink-soft">
        ときの一本道です。古いときから新しいときへながめてね。
      </p>

      {error && (
        <div className="mt-8 flex items-start gap-3 rounded-card border-2 border-danger bg-danger-soft p-5">
          <AlertIcon size={28} className="mt-1 shrink-0 text-danger" />
          <p className="text-2xl">地図を読み込めませんでした。通信をご確認ください。</p>
        </div>
      )}

      {events !== null && !error && (
        <>
          {model.stationCount === 0 ? (
            <div className="mt-8">
              <EmptyState
                title="地図にならべる出来事がまだありません"
                note="結婚式・お誕生日・旅など、ときが分かる出来事を登録すると、地図にのります。"
                action={
                  role === "family" ? (
                    <BigLink href="/events/new" tone="go" icon={<PlusIcon size={26} />}>
                      出来事を登録
                    </BigLink>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-6 flex gap-3">
                <BigButton tone="quiet" icon={<ArrowLeftIcon size={22} />} onClick={() => scroll(-1)}>
                  もどる
                </BigButton>
                <BigButton tone="quiet" icon={<ArrowRightIcon size={22} />} onClick={() => scroll(1)}>
                  つぎへ
                </BigButton>
              </div>

              <div
                ref={scrollRef}
                className="mt-4 overflow-x-auto rounded-card bg-surface-accent/60 p-4 sm:p-6"
                aria-label="人生の地図（横にながめる）"
              >
                <div className="flex w-max items-start gap-4">
                  <ol className="flex items-start gap-4">
                    {model.blocks.map((block) => (
                      <li key={block.year} className="flex items-start gap-4">
                        {/* 年の標識（改札のような柱） */}
                        <div className="flex shrink-0 flex-col items-center gap-1 self-stretch">
                          <p
                            aria-label={`${block.year}年`}
                            className="rounded-card border-2 border-line bg-surface px-4 py-3 text-3xl font-bold"
                          >
                            {block.year}年
                          </p>
                          <span className="w-1 flex-1 rounded-full bg-line" aria-hidden="true" />
                        </div>

                        {/* 年精度の出来事: 順序が確定していないため、複数のときはクラスタ表示 */}
                        {block.yearOnly.length >= 2 && (
                          <div
                            className="shrink-0 rounded-card border-2 border-dashed border-line px-3 py-3"
                            aria-label="この年の出来事（順序ははっきりしない）"
                          >
                            <p className="text-lg font-bold text-ink-soft">この年の出来事（順序ははっきりしない）</p>
                            <ul className="mt-3 flex gap-4">
                              {block.yearOnly.map((st) => (
                                <li key={st.id} className="w-48 shrink-0">
                                  <Station station={st} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <ul className="flex items-start gap-4">
                          {(block.yearOnly.length === 1 ? [...block.yearOnly, ...block.precise] : block.precise).map(
                            (st) => (
                              <li key={st.id} className="w-48 shrink-0">
                                <Station station={st} />
                              </li>
                            ),
                          )}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          )}

          {/* 末尾区画: 時期がくわしくない出来事 */}
          {model.eraEvents.length > 0 && (
            <section className="mt-10" aria-label="時期がくわしくない出来事">
              <h3 className="text-2xl font-bold">時期がくわしくない出来事</h3>
              <p className="mt-1 text-lg text-ink-soft">
                年が分からないので、道には置かずにここに置いています。
              </p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {model.eraEvents.map((st) => (
                  <li key={st.id}>
                    <Link
                      href={`/events/${st.id}`}
                      className="flex min-h-28 items-start gap-4 rounded-card bg-surface p-6 ring-2 ring-inset ring-line transition-transform active:scale-[0.99]"
                    >
                      <span className="mt-1 shrink-0 text-accent-deep" aria-hidden="true">
                        <MapIcon size={32} />
                      </span>
                      <span className="block">
                        <span className="block text-2xl font-bold text-ink">
                          {st.data.icon ? `${st.data.icon} ` : ""}
                          {st.data.title}
                        </span>
                        <span className="mt-1 block text-xl text-ink-soft">{st.data.eraLabel}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {events === null && !error && (
        <p className="mt-10 text-center text-2xl text-ink-soft" aria-live="polite">
          読み込み中…
        </p>
      )}
    </div>
  );
}

/* ---------- 駅（出来事のカード） ---------- */

function Station({ station }: { station: RoadStation }) {
  const label = stationLabel(station.data);
  return (
    <div>
      {station.photos.length > 0 && (
        <ul className="flex gap-2">
          {station.photos.slice(0, 3).map((p) => (
            <li key={p.id} className="w-16 shrink-0">
              <PhotoTile
                href={`/photos/${p.id}`}
                src={p.data.downloadURL}
                alt={p.data.description ?? "思い出の写真"}
              />
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/events/${station.id}`}
        className="mt-2 flex min-h-24 flex-col rounded-card border-2 border-line bg-white px-4 py-3 transition-transform duration-150 hover:border-ink-soft active:scale-[0.99]"
        aria-label={`${label ?? "時期がくわしくない"}、${station.data.title}`}
      >
        <span className="text-lg font-bold text-ink-soft">{label ?? "時期がくわしくない"}</span>
        <span className="mt-1 text-xl font-bold leading-snug">
          {station.data.icon ? `${station.data.icon} ` : ""}
          {station.data.title}
        </span>
      </Link>
    </div>
  );
}

function stationLabel(e: MemoriaEvent): string | null {
  if (e.startDate && isValidPreciseDate(e.startDate)) {
    return formatEventPeriod(e.startDate, e.endDate);
  }
  if (e.eraLabel && !e.startDate) return e.eraLabel;
  return null;
}

/* ---------- 地図モデルの組み立て ---------- */

function buildRoadModel(events: EventSummary[], photos: PhotoSummary[]): RoadModel {
  /** 出来事 → 写真（追加の新しい順） */
  const photosByEvent = new Map<string, PhotoSummary[]>();
  for (const p of photos) {
    for (const ref of p.data.eventRefs) {
      const list = photosByEvent.get(ref);
      if (list) list.push(p);
      else photosByEvent.set(ref, [p]);
    }
  }

  const blockMap = new Map<number, { yearOnly: RoadStation[]; precise: Array<{ station: RoadStation; key: string }> }>();
  const eraEvents: RoadStation[] = [];

  for (const { id, data } of events) {
    const station: RoadStation = { id, data, photos: photosByEvent.get(id) ?? [] };
    if (data.startDate && isValidPreciseDate(data.startDate)) {
      const year = preciseDateYear(data.startDate);
      if (year === null) continue;
      const block = blockMap.get(year) ?? { yearOnly: [], precise: [] };
      if (data.startDate.precision === "year") {
        block.yearOnly.push(station);
      } else {
        block.precise.push({ station, key: preciseDateSortKey(data.startDate) });
      }
      blockMap.set(year, block);
    } else if (data.eraLabel) {
      eraEvents.push(station);
    }
    /* startDate も eraLabel もない出来事は道に載せない */
  }

  const blocks = [...blockMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, { yearOnly, precise }]) => ({
      year,
      yearOnly,
      precise: precise.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map((x) => x.station),
    }));

  return {
    blocks,
    eraEvents,
    stationCount: blocks.reduce((sum, b) => sum + b.yearOnly.length + b.precise.length, 0),
  };
}
