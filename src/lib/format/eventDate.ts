/*
 * 精度付き出来事の日付の表示・整列ヘルパー（events v2）
 *
 * 原則:
 * - 表示は入力値の範囲のみ。月精度なら「YYYY年M月」、年精度なら「YYYY年」まで。
 *   月や日を補って表示しない（推測禁止）。
 * - 整列は同じ正規化キー（不明な下位桁を 0 に置く）で行う。
 *   不明部分を補うのは表示ではなく、安定した順序を作るためだけの内部計算。
 * - 年精度の出来事は同年内で順序を確定させない（地図側で「この年」クラスタにする）。
 */
import type { DatePrecision, PreciseDate } from "@/types/models";

/** value と precision の整合（保存時・入力値の検証に使う） */
export function isValidPreciseDate(d: unknown): d is PreciseDate {
  if (typeof d !== "object" || d === null) return false;
  const { value, precision } = d as { value?: unknown; precision?: unknown };
  if (typeof value !== "string" || typeof precision !== "string") return false;
  if (precision === "day") return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value);
  if (precision === "month") return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  if (precision === "year") return /^\d{4}$/.test(value);
  return false;
}

/** 表示ラベル。入力精度の範囲だけで作る */
export function formatPreciseDate(d: PreciseDate): string {
  const [y, m, day] = d.value.split("-");
  const yearNum = Number(y);
  if (d.precision === "day") return `${yearNum}年${Number(m)}月${Number(day)}日`;
  if (d.precision === "month") return `${yearNum}年${Number(m)}月`;
  return `${yearNum}年`;
}

/** 期間表示。始まり・終わりをそれぞれ自分の精度の範囲で示す */
export function formatEventPeriod(
  start: PreciseDate,
  end: PreciseDate | null,
): string {
  if (!isValidPreciseDate(end)) return formatPreciseDate(start);
  return `${formatPreciseDate(start)} 〜 ${formatPreciseDate(end)}`;
}

/**
 * 整列用の正規化キー（"YYYY-MM-DD" 形式。不明な桁は 0）。
 * - month "2020-03" → "2020-03-00"  → 同月の日の出来事より前に置く
 *   （日が不明な出来事を、その月内で確定していると見せないための保守的な位置）
 * - year  "2020"    → "2020-00-00"
 */
export function preciseDateSortKey(d: PreciseDate): string {
  if (d.precision === "day") return d.value;
  if (d.precision === "month") return `${d.value}-00`;
  return `${d.value}-00-00`;
}

/** 開始時期の年（整列の大区分）。value が不正なら null */
export function preciseDateYear(d: PreciseDate): number | null {
  if (!isValidPreciseDate(d)) return null;
  const year = Number(d.value.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}

/** 入力値を precision に合わせて整える（保存前の検証）。不整合なら null */
export function normalizeDateInput(
  raw: string,
  precision: DatePrecision,
): PreciseDate | null {
  const value = raw.trim();
  const candidate = { value, precision } as PreciseDate;
  return isValidPreciseDate(candidate) ? candidate : null;
}

/**
 * 精度変更時の値の引き継ぎ。
 * - 粗い精度への変更: 入力済みの値を切り詰めて引き継ぐ（家族が入れた値からの削り）
 * - 細かい精度への変更: 不明な桁が必要になるため値をいったん空にする（推測で埋めない）
 */
export function adjustDateValueForPrecision(
  value: string,
  from: DatePrecision,
  to: DatePrecision,
): string {
  if (from === to) return value;
  const order: Record<DatePrecision, number> = { day: 2, month: 1, year: 0 };
  if (order[to] < order[from]) return value.slice(0, 4 + order[to] * 3);
  return "";
}
