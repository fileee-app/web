import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export * from "./schema.ts";

const url = process.env.DATABASE_URL;

if (!url) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");

// allowExitOnIdle so commands such as admin:reset-password end when they're done.
const pool = new Pool({ connectionString: url, allowExitOnIdle: true });

// Without a listener, losing an idle connection (Postgres restarting, say) would crash the process.
pool.on("error", (error) => console.error("Idle database connection failed", error));

export const db = drizzle({ client: pool });

const begin = db.transaction.bind(db);

/**
 * Transactions take turns, across every process using the database, so code inside one can check a row and then act on it.
 * Keep them short, and inside the callback use only its `tx`: `db` is another connection and sees none of its work.
 * shortcut: one lock for the whole database, narrow it per storage if write throughput ever matters.
 */
db.transaction = ((run, config) =>
  begin(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7236001)`);

    return run(tx);
  }, config)) as typeof db.transaction;
