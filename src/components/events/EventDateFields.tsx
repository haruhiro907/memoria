"use client";

import type { DatePrecision } from "@/types/models";
import { adjustDateValueForPrecision } from "@/lib/format/eventDate";

/*
 * 出来事の時期入力（登録・編集で共用）
 *
 * - 時期の区切り方（日 / 月 / 年）を先に選ぶ。区切りに合わせた入力欄を出す。
 *   日: <input type=date> / 月: <input type=month> / 年: 4 桁の数字
 * - 区切りを選ばない場合は eraLabel（自由表現。子どもの頃・戦前など）を入力できる。
 * - 表示は入力値だけで、月日を補って推測しない。
 * - 精度を粗く変更すると入力値を切り詰め、細かく変更すると一度空にする（推測で埋めない）。
 */

const PRECISION_OPTIONS: Array<{
  value: "day" | "month" | "year" | null;
  label: string;
  hint: string;
}> = [
  { value: null, label: "年が分からない", hint: "子どもの頃・戦前 などの書き方" },
  { value: "year", label: "年だけ", hint: "2020年ごろ" },
  { value: "month", label: "年月", hint: "2020年3月" },
  { value: "day", label: "年月日", hint: "2020年3月15日" },
];

export interface EventDateFieldsValue {
  precision: "day" | "month" | "year" | null;
  start: string;
  end: string;
  eraLabel: string;
}

interface EventDateFieldsProps {
  value: EventDateFieldsValue;
  onChange: (value: EventDateFieldsValue) => void;
}

export function EventDateFields({ value, onChange }: EventDateFieldsProps) {
  const setPrecision = (next: "day" | "month" | "year" | null) => {
    if (next === value.precision) return;
    if (next === null) {
      onChange({ ...value, precision: null });
      return;
    }
    if (value.precision === null) {
      onChange({ ...value, precision: next, start: "", end: "" });
      return;
    }
    const start = adjustDateValueForPrecision(value.start, value.precision, next);
    const end = adjustDateValueForPrecision(value.end, value.precision, next);
    onChange({ precision: next, start, end, eraLabel: value.eraLabel });
  };

  const isNull = value.precision === null;

  return (
    <div>
      <span className="text-2xl font-semibold">時期の区切り方（わかる範囲で）</span>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="時期の区切り方を選ぶ">
        {PRECISION_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            aria-pressed={value.precision === opt.value}
            onClick={() => setPrecision(opt.value)}
            className={`min-h-14 rounded-btn border-2 px-4 py-3 text-2xl ${
              value.precision === opt.value ? "border-go-deep bg-go-soft" : "border-line bg-white"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-lg text-ink-soft" aria-hidden="true">
        {PRECISION_OPTIONS.find((opt) => value.precision === opt.value)?.hint}
      </p>

      {isNull ? (
        <label className="mt-4 block">
          <span className="text-xl font-semibold">
            時期の呼び方（例: 子どもの頃・戦前）
          </span>
          <input
            type="text"
            value={value.eraLabel}
            onChange={(e) => onChange({ ...value, eraLabel: e.target.value })}
            maxLength={30}
            placeholder="分からないままでも構いません"
            className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
          />
        </label>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="text-2xl font-semibold">始まり</span>
            {value.precision === "day" && (
              <input
                type="date"
                value={value.start}
                onChange={(e) => onChange({ ...value, start: e.target.value })}
                className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
              />
            )}
            {value.precision === "month" && (
              <input
                type="month"
                value={value.start}
                onChange={(e) => onChange({ ...value, start: e.target.value })}
                className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
              />
            )}
            {value.precision === "year" && (
              <input
                type="text"
                inputMode="numeric"
                value={value.start}
                onChange={(e) =>
                  onChange({ ...value, start: e.target.value.replace(/\D/g, "").slice(0, 4) })
                }
                placeholder="2020"
                className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
              />
            )}
          </label>
          <label className="block">
            <span className="text-2xl font-semibold">終わり（あれば）</span>
            {value.precision === "day" && (
              <input
                type="date"
                value={value.end}
                onChange={(e) => onChange({ ...value, end: e.target.value })}
                className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
              />
            )}
            {value.precision === "month" && (
              <input
                type="month"
                value={value.end}
                onChange={(e) => onChange({ ...value, end: e.target.value })}
                className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
              />
            )}
            {value.precision === "year" && (
              <input
                type="text"
                inputMode="numeric"
                value={value.end}
                onChange={(e) =>
                  onChange({ ...value, end: e.target.value.replace(/\D/g, "").slice(0, 4) })
                }
                placeholder="2021"
                className="mt-2 w-full rounded-btn border-2 border-line bg-white px-4 py-4 text-2xl"
              />
            )}
          </label>
        </div>
      )}
    </div>
  );
}

/** 入力値 → EventInput の時期フィールドに変換する */
export function toDateFieldsInput(v: EventDateFieldsValue): {
  startDate: { value: string; precision: DatePrecision } | null;
  endDate: { value: string; precision: DatePrecision } | null;
  eraLabel: string | null;
} {
  if (v.precision === null) {
    return { startDate: null, endDate: null, eraLabel: v.eraLabel.trim() || null };
  }
  const startDate = v.start ? { value: v.start, precision: v.precision } : null;
  const endDate =
    v.start && v.end ? { value: v.end, precision: v.precision } : null;
  return { startDate, endDate, eraLabel: v.eraLabel.trim() || null };
}
