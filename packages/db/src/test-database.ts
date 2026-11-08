import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";

// Postgres from docker-compose.dev.yml. Connects to the maintenance database, to create the others.
const admin = process.env.TEST_DATABASE_URL ?? "postgres://fileee:fileee@localhost:5432/postgres";

async function withAdmin<T>(use: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: admin });

  await client.connect();

  try {
    return await use(client);
  } finally {
    await client.end();
  }
}

/** Vitest global setup. Databases are dropped once every test file has ended, so no background job is cut off. */
export default function setup() {
  const prefix = `fileee_test_${randomBytes(4).toString("hex")}_`;

  process.env.FILEEE_TEST_PREFIX = prefix;

  return () =>
    withAdmin(async (client) => {
      const { rows } = await client.query<{ datname: string }>(
        "SELECT datname FROM pg_database WHERE starts_with(datname, $1)",
        [prefix],
      );

      for (const { datname } of rows) await client.query(`DROP DATABASE ${datname} WITH (FORCE)`);
    });
}

/** An empty database of its own for one test file. Returns its URL. */
export async function createTestDatabase() {
  const name = `${process.env.FILEEE_TEST_PREFIX}${randomUUID().replaceAll("-", "")}`;

  await withAdmin((client) => client.query(`CREATE DATABASE ${name}`));

  const url = new URL(admin);

  url.pathname = `/${name}`;

  return url.href;
}
