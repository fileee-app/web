const appUrl = () => {
  const url = process.env.APP_URL;

  if (!url) throw new Error("APP_URL is not set");

  return new URL(url);
};

export const appOrigin = () => appUrl().origin;
export const isHttpsApp = () => appUrl().protocol === "https:";

export const isAllowedOrigin = (headers: Headers) => headers.get("origin") === appOrigin();

/** With TRUST_PROXY, the rightmost X-Forwarded-For entry is the one our proxy added; anything left of it is client-supplied. */
export function clientIp(headers: Headers, socketIp: string | undefined) {
  if (process.env.TRUST_PROXY !== "true") return socketIp;

  return headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || socketIp;
}
