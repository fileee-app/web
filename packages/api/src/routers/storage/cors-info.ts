import { corsProbeUrl, corsRule } from "@fileee/storage";
import * as z from "zod";
import { appOrigin } from "../../lib/http.ts";
import { authed, requireStorage } from "../../lib/orpc.ts";
import { connect } from "../../lib/storage.ts";

export const corsInfo = authed
  .input(z.object({ storageId: z.string() }))
  .use(requireStorage)
  .handler(async ({ context }) => {
    const { client, config } = await connect(context.storage);

    return {
      rule: corsRule(appOrigin()),
      probeUrl: await corsProbeUrl(client, config.bucket, config.prefix),
    };
  });
