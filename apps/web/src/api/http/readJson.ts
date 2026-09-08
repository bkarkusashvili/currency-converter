export type ReadJsonResult = { ok: true; body: unknown } | { ok: false };

/** Reads a JSON body without throwing, so callers can decide what an unreadable body means. */
export async function readJson(response: Response): Promise<ReadJsonResult> {
  try {
    return { ok: true, body: (await response.json()) as unknown };
  } catch {
    return { ok: false };
  }
}
