import { formatDate } from "../lib/format.ts";

/** The server doesn't know the visitor's locale or time zone, so its first render may differ. */
export const DateText = ({ date }: { date: Date }) => (
  <span
    suppressHydrationWarning
    title={date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
  >
    {formatDate(date)}
  </span>
);
