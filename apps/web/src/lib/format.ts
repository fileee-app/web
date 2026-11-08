export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** "3 mins ago", "2 hours ago", "in 4 days" in the largest whole unit; an exact date past 5 days. */
export function formatDate(date: Date, now = Date.now()) {
  const ms = date.getTime() - now;
  const days = Math.trunc(Math.abs(ms) / 86_400_000);

  if (days > 5) return date.toLocaleDateString(undefined, { dateStyle: "medium" });

  const hours = Math.trunc(Math.abs(ms) / 3_600_000);
  const minutes = Math.trunc(Math.abs(ms) / 60_000);
  const [n, unit] = days ? [days, "day"] : hours ? [hours, "hour"] : [minutes, "min"];

  if (n === 0) return "just now";

  const text = `${n} ${unit}${n === 1 ? "" : "s"}`;

  return ms < 0 ? `${text} ago` : `in ${text}`;
}

export function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const rest = `${Math.floor((total % 3600) / 60)}:${String(total % 60).padStart(2, "0")}`;

  return total >= 3600 ? `${Math.floor(total / 3600)}:${rest.padStart(5, "0")}` : rest;
}
