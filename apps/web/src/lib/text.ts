export const TEXT_LIMIT = 1024 * 1024;

/** Null for bytes that aren't text. The input may stop mid-character, as a preview's first 1 MiB does. */
export function decodeText(bytes: Uint8Array) {
  const [a, b] = bytes;

  const utf16 =
    a === 0xff && b === 0xfe ? "utf-16le" : a === 0xfe && b === 0xff ? "utf-16be" : null;

  if (utf16) return { text: new TextDecoder(utf16).decode(bytes), encoding: utf16 };
  if (bytes.subarray(0, 8192).includes(0)) return null;

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true });

    return { text, encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "windows-1252" };
  }
}
