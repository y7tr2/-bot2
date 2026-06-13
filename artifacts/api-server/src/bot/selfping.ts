import { logger } from "../lib/logger";

const PING_INTERVAL_MS = 14 * 60 * 1000;

async function doPing(url: string): Promise<void> {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10_000) });
    logger.info({ status: res.status, url }, "Self-ping OK");
  } catch (err) {
    logger.warn({ err, url }, "Self-ping failed — will retry next interval");
  }
}

export function startSelfPing(renderUrl: string): void {
  const base = renderUrl.replace(/\/$/, "");
  const url = `${base}/api/ping`;

  logger.info({ url, intervalMinutes: 14 }, "Self-ping started for Render");

  doPing(url);
  setInterval(() => doPing(url), PING_INTERVAL_MS);
}
