import { client } from "../../../lib/orpc.ts";

export type StorageRow = Awaited<ReturnType<typeof client.storage.list>>[number];
