// <input type="datetime-local"> values ("2026-10-22T10:00") carry no timezone. These helpers
// read and write them in the school's timezone instead of the server's (UTC in Docker).

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE ?? "Asia/Phnom_Penh";

// Offset of `tz` from UTC at `date`, in ms (Phnom Penh = +7h).
function tzOffsetMs(date: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function parseLocalDateTime(value: string, tz = APP_TIME_ZONE): Date | null {
  const m = LOCAL_INPUT.exec(value);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes handle a DST change between the guess and the real instant.
  let utc = guess - tzOffsetMs(new Date(guess), tz);
  utc = guess - tzOffsetMs(new Date(utc), tz);
  return new Date(utc);
}

export function toLocalInputValue(date: Date | null, tz = APP_TIME_ZONE): string {
  if (!date) return "";
  const local = new Date(date.getTime() + tzOffsetMs(date, tz));
  return local.toISOString().slice(0, 16);
}
