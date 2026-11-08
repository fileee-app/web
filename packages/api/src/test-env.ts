import { createTestDatabase } from "@fileee/db/test-database";

// Runs before each test file's imports, since @fileee/db reads DATABASE_URL on import.
process.env.DATABASE_URL = await createTestDatabase();
process.env.APP_URL = "http://localhost:3000";
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.ALLOW_PRIVATE_ENDPOINTS = "true";
