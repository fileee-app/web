import { isUniqueViolation } from "./db-errors.ts";

/** `report.pdf` becomes `report (1).pdf`, as Drive does. A leading dot isn't an extension. */
export function withSuffix(name: string, n: number) {
  if (n === 0) return name;

  const dot = name.lastIndexOf(".");

  return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
}

/** The unique indexes decide who gets a name, so concurrent writers can't both take it. */
export async function withFreeName<T>(name: string, write: (candidate: string) => Promise<T>) {
  for (let n = 0; n < 10_000; n++) {
    try {
      return await write(withSuffix(name, n));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new Error(`No free name for ${name}`);
}
