import { migrateDb } from "@fileee/db/migrate";
import { createRouterClient } from "@orpc/server";
import { router } from "./routers/_router.ts";

/** A client with a cookie jar, like one browser. */
const browser = (clientIp = "1.2.3.4") => {
  let cookie = "";

  return createRouterClient(router, {
    context: () => {
      const resHeaders = new Headers();
      const append = resHeaders.append.bind(resHeaders);

      (resHeaders as { append: Headers["append"] }).append = (name, value) => {
        append(name, value);

        if (name.toLowerCase() === "set-cookie") {
          cookie = /max-age=0/i.test(value) ? "" : value.split(";")[0]!;
        }
      };

      return { clientIp, reqHeaders: new Headers({ cookie }), resHeaders };
    },
  });
};

export async function setupTestApp() {
  await migrateDb();

  return { browser };
}

export const ADMIN = {
  appName: "Acme",
  name: "Admin",
  email: "admin@example.com",
  password: "correct horse battery",
  setupToken: "",
};
