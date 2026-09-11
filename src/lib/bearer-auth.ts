import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time check of an `Authorization: Bearer <secret>` header. Shared by
 * the machine-to-machine routes (cron runner, ingest receivers, reporting API).
 */
export function hasValidBearer(
  authorization: string | null,
  secret: string,
): boolean {
  if (!authorization) return false;
  const expected = `Bearer ${secret}`;
  const authorizationBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  if (authorizationBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(authorizationBuffer, expectedBuffer);
}
