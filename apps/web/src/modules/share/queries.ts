import { orpc, client } from "../../lib/orpc.ts";

export const resolveOptions = (token: string) =>
  orpc.share.resolve.queryOptions({ input: { token } });

export type Resolved = Awaited<ReturnType<typeof client.share.resolve>>;
export type SharedFile = Extract<Resolved, { kind: "file" }>["file"];
export type Crumb = { id: string; name: string };
