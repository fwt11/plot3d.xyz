/**
 * Date handling helpers for the computed-column formula (F(x)) engine.
 *
 * These are injected into the mathjs evaluation scope so users can convert
 * date / time text columns into numeric values that the chart engine and the
 * curve fitter can consume. All functions return `NaN` when the input cannot
 * be parsed, which the computed-column writer turns into an empty cell.
 */

/** Parse a value into a Unix epoch in milliseconds. Returns NaN on failure. */
export function parseDateInput(v: unknown): number {
  if (v == null) return NaN;
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  if (v instanceof Date) return v.getTime();
  const s = String(v).trim();
  if (!s) return NaN;
  // ISO variant with a space instead of 'T' (e.g. '2026-07-07 17:12:00')
  const candidates = [s, s.replace(' ', 'T')];
  for (const c of candidates) {
    const t = Date.parse(c);
    if (!isNaN(t)) return t;
  }
  return NaN;
}

type DatePart = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'weekday' | 'dayOfYear';

function datePart(v: unknown, part: DatePart): number {
  const t = parseDateInput(v);
  if (isNaN(t)) return NaN;
  const d = new Date(t);
  switch (part) {
    case 'year':
      return d.getFullYear();
    case 'month':
      return d.getMonth() + 1;
    case 'day':
      return d.getDate();
    case 'hour':
      return d.getHours();
    case 'minute':
      return d.getMinutes();
    case 'second':
      return d.getSeconds();
    case 'weekday':
      return d.getDay(); // 0 (Sun) .. 6 (Sat)
    case 'dayOfYear': {
      const start = new Date(d.getFullYear(), 0, 0);
      const diff = d.getTime() - start.getTime();
      return Math.floor(diff / 86400000);
    }
  }
}

/**
 * Functions exposed to the formula language. Each receives the raw column
 * value (string or number) and returns a number. They are merged into the
 * mathjs scope so they can be called like any built-in (e.g. `toTimestamp(col_0)`).
 */
export const DATE_FUNCTIONS: Record<string, (v: unknown) => number> = {
  toTimestamp: (v) => parseDateInput(v),
  dateNum: (v) => parseDateInput(v),
  unixTime: (v) => {
    const t = parseDateInput(v);
    return isNaN(t) ? NaN : t / 1000;
  },
  dateYear: (v) => datePart(v, 'year'),
  dateMonth: (v) => datePart(v, 'month'),
  dateDay: (v) => datePart(v, 'day'),
  dateHour: (v) => datePart(v, 'hour'),
  dateMinute: (v) => datePart(v, 'minute'),
  dateSecond: (v) => datePart(v, 'second'),
  dayOfWeek: (v) => datePart(v, 'weekday'),
  dayOfYear: (v) => datePart(v, 'dayOfYear'),
};

/** Quick-insert buttons shown in the computed-column dialog. */
export const DATE_FUNCTION_LIST: { label: string; code: string }[] = [
  { label: 'toTimestamp', code: 'toTimestamp(' },
  { label: 'unixTime', code: 'unixTime(' },
  { label: 'dateYear', code: 'dateYear(' },
  { label: 'dateMonth', code: 'dateMonth(' },
  { label: 'dateDay', code: 'dateDay(' },
  { label: 'dateHour', code: 'dateHour(' },
  { label: 'dateMinute', code: 'dateMinute(' },
  { label: 'dayOfWeek', code: 'dayOfWeek(' },
  { label: 'dayOfYear', code: 'dayOfYear(' },
];
