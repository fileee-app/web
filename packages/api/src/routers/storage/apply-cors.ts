import { applyCors as putCors } from "@fileee/storage";
import * as z from "zod";
import { appOrigin } from "../../lib/http.ts";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { connect } from "../../lib/storage.ts";

export const applyCors = authed
  .input(z.object({ storageId: z.string() }))
  .use(requireStorage)
  .handler(async ({ context }) => {
    const { client, config } = await connect(context.storage);

    await putCors(client, config.bucket, appOrigin());

    return { ok: true };
  });
