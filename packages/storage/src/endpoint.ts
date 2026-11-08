import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();

for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, bits, "ipv4");
}

for (const [net, bits] of [
  ["::", 128],
  ["::1", 128],
  // These two carry an IPv4 address inside, so a gateway could forward them to a private one.
  ["64:ff9b::", 96],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, bits, "ipv6");
}

const allowPrivate = () => process.env.ALLOW_PRIVATE_ENDPOINTS === "true";

export function isPrivateAddress(address: string) {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  const ip = mapped ?? address;

  return blocked.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}

/** Rejects what can be judged from the URL alone. Hostnames are checked at connection time by `safeLookup`. */
export function validateEndpoint(endpoint: string): string | null {
  let url: URL;

  try {
    url = new URL(endpoint);
  } catch {
    return "Enter a valid URL.";
  }

  if (url.username || url.password) return "The URL must not contain credentials.";

  if (allowPrivate()) {
    return url.protocol === "https:" || url.protocol === "http:"
      ? null
      : "The URL must use HTTP or HTTPS.";
  }

  if (url.protocol !== "https:") return "The URL must use HTTPS.";

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    (isIP(host) && isPrivateAddress(host))
  ) {
    return "Private addresses are not allowed. Set ALLOW_PRIVATE_ENDPOINTS to use one.";
  }

  return null;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/** Used as the socket's DNS lookup, so a hostname that later rebinds to a private address still fails. */
export function safeLookup(hostname: string, options: object, callback: LookupCallback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);

    const bad = !allowPrivate() && addresses.some((a) => isPrivateAddress(a.address));

    if (bad) return callback(new Error(`${hostname} resolves to a private address`), []);
    if ((options as { all?: boolean }).all) return callback(null, addresses);

    const first = addresses[0]!;

    callback(null, first.address, first.family);
  });
}
