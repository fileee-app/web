const hasCode = (error: unknown, codes: string[]) => {
  const e = error as { code?: string; cause?: { code?: string } };

  return codes.includes(e.code ?? e.cause?.code ?? "");
};

export const isUniqueViolation = (error: unknown) => hasCode(error, ["23505"]);

/** Postgres text and jsonb can't hold a NUL byte. */
export const isInvalidText = (error: unknown) => hasCode(error, ["22021", "22P05"]);
