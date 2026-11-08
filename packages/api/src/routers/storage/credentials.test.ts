import { expect, test, vi } from "vitest";
import { connect } from "../../lib/storage.ts";
import { ADMIN, setupTestApp } from "../../test-utils.ts";

const { browser } = await setupTestApp();

test("credentials saved under a lost key stay visible and can be replaced", async () => {
  const admin = browser();

  await admin.setup.complete(ADMIN);

  const fields = {
    name: "Work",
    provider: "other" as const,
    endpoint: "http://localhost:1",
    region: "us-east-1",
    bucket: "bucket",
    prefix: "",
    forcePathStyle: true,
  };

  const { id: storageId } = await admin.storage.create({
    ...fields,
    accessKeyId: "old-key-1234",
    secretAccessKey: "old-secret",
  });

  vi.stubEnv("ENCRYPTION_KEY", Buffer.alloc(32, 8).toString("base64"));

  try {
    expect((await admin.storage.list())[0]!.accessKeyHint).toBeNull();

    await expect(
      admin.storage.update({ ...fields, storageId, accessKeyId: "", secretAccessKey: "new" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await admin.storage.update({
      ...fields,
      storageId,
      accessKeyId: "new-key-5678",
      secretAccessKey: "new-secret",
    });

    expect((await admin.storage.list())[0]!.accessKeyHint).toBe("5678");
  } finally {
    vi.unstubAllEnvs();
  }
});

test("a saved private address is refused once private endpoints are off", async () => {
  vi.stubEnv("ALLOW_PRIVATE_ENDPOINTS", "false");

  await expect(
    connect({
      endpoint: "http://127.0.0.1:9000",
      region: "us-east-1",
      bucket: "b",
      prefix: "",
      forcePathStyle: true,
      encryptedCredentials: "",
      keyVersion: 2,
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });

  vi.stubEnv("ALLOW_PRIVATE_ENDPOINTS", "true");
});
