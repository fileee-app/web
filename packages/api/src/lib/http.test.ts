import { expect, test, vi } from "vitest";
import { clientIp, isAllowedOrigin } from "./http.ts";
import { withSuffix } from "./names.ts";

test("only the app's own origin may make state-changing requests", () => {
  vi.stubEnv("APP_URL", "https://files.example.com/");
  expect(isAllowedOrigin(new Headers({ origin: "https://files.example.com" }))).toBe(true);
  expect(isAllowedOrigin(new Headers({ origin: "https://evil.example.com" }))).toBe(false);
  expect(isAllowedOrigin(new Headers())).toBe(false);
});

test("X-Forwarded-For counts only behind a trusted proxy, and only the proxy's entry", () => {
  const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 1.1.1.1" });

  vi.stubEnv("TRUST_PROXY", "");
  expect(clientIp(headers, "2.2.2.2")).toBe("2.2.2.2");
  vi.stubEnv("TRUST_PROXY", "true");
  expect(clientIp(headers, "2.2.2.2")).toBe("1.1.1.1");
  expect(clientIp(new Headers(), "2.2.2.2")).toBe("2.2.2.2");
});

test.each([
  ["report.pdf", 0, "report.pdf"],
  ["report.pdf", 1, "report (1).pdf"],
  ["archive.tar.gz", 2, "archive.tar (2).gz"],
  [".env", 1, ".env (1)"],
  ["README", 3, "README (3)"],
])("withSuffix(%s, %i)", (name, n, expected) => {
  expect(withSuffix(name, n)).toBe(expected);
});
