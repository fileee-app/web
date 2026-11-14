import { createRouterClient } from "@orpc/server";
import { expect, test } from "vitest";
import { ADMIN, setupTestApp } from "../../test-utils.ts";
import { router } from "../_router.ts";

await setupTestApp();

test("setup through the app API signs the admin in with a bearer token", async () => {
  const resHeaders = new Headers();
  const app = (token = "") =>
    createRouterClient(router, {
      context: {
        tokenAuth: true,
        reqHeaders: new Headers(token ? { authorization: `Bearer ${token}` } : {}),
        resHeaders,
      },
    });

  const { token } = await app().setup.complete(ADMIN);

  expect(resHeaders.get("set-cookie")).toBeNull();
  expect(await app(token).auth.me()).toMatchObject({ email: ADMIN.email, role: "admin" });
});
